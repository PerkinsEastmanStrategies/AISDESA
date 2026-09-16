import fs from "node:fs"
import path from "node:path"
import type {
  AisdSchoolOption,
  EsaQuestion,
  EsaQuestionOption,
  RoomQuestionResponse,
  RoomSurveySession,
  SurveySession,
  SurveyType,
} from "@aisd/shared"
import {
  campusAutoCarryOverPercent,
  NOT_ABLE_TO_ASSESS_OPTION,
  asMultiSelectValues,
  canonicalizeResponseValue,
  getRoomSurveyRubric,
  isAbsentSpaceTypeRoomId,
  isMultiSelectQuestionType,
  isNotAbleToAssessOption,
  isOptionValueSelected,
  isTextQuestionType,
} from "@aisd/shared"
import type { PersistedSurveyDraft } from "@/lib/survey-persistence"
import { prepareAutoCarryOverDraft, spaceTypeBelongsToSurvey } from "@/lib/pilot-carryover"
import { linkedPhotoUrls, linkedPhotoCount, mergeRoomLinkedPhotos, roomHasLinkedPhotos } from "@/lib/response-photos"

export interface RemapAnswerStats {
  kept: number
  dropped: number
  rooms: number
}

function normalizeQuestionContent(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d"'`]/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?()[\]]/g, "")
    .trim()
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      field = ""
      if (row.length > 1 || row[0] !== "") rows.push(row)
      row = []
    } else {
      field += char
    }
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function collectCsvFiles(dir: string, acc: string[]): void {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
    const next = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectCsvFiles(next, acc)
      continue
    }
    if (entry.name === "05_Questions.csv" || entry.name === "Questions.csv") {
      acc.push(next)
    }
  }
}

function addCatalogText(
  catalog: Map<string, string[]>,
  questionId: string,
  text: string,
  prepend: boolean,
): void {
  const id = questionId.trim()
  const value = text.trim()
  if (!id || !value) return
  const existing = catalog.get(id) ?? []
  if (existing.some((item) => normalizeQuestionContent(item) === normalizeQuestionContent(value))) {
    return
  }
  catalog.set(id, prepend ? [value, ...existing] : [...existing, value])
}

let cachedCatalog: Map<string, string[]> | null = null

function historicalQuestionTextsById(): Map<string, string[]> {
  if (cachedCatalog) return cachedCatalog
  const catalog = new Map<string, string[]>()

  try {
    const roots = [
      path.join(process.cwd(), "public", "Questions.csv"),
      path.join(process.cwd(), "Questions.csv"),
    ]
    const discovered: string[] = []
    collectCsvFiles(path.join(process.cwd(), "packages", "shared", "src", "data"), discovered)
    collectCsvFiles(path.join(process.cwd(), "public"), discovered)
    const files = [...new Set([...roots, ...discovered])].filter((file) => fs.existsSync(file))

    for (const file of files) {
      const rows = parseCsv(fs.readFileSync(file, "utf8"))
      const header = rows[0]?.map((cell) => cell.trim()) ?? []
      const idIndex = header.findIndex((cell) => /^questionid$/i.test(cell))
      const legacyIndex = header.findIndex((cell) => /^legacyquestionid$/i.test(cell))
      const textIndex = header.findIndex((cell) =>
        /^(questiontext|question)$/i.test(cell),
      )
      if (idIndex < 0 || textIndex < 0) continue
      const originalSource = /(?:^|[\\/])Questions\.csv$/i.test(file)
      for (const row of rows.slice(1)) {
        const text = row[textIndex] ?? ""
        addCatalogText(catalog, row[idIndex] ?? "", text, originalSource)
        if (legacyIndex >= 0) {
          addCatalogText(catalog, row[legacyIndex] ?? "", text, false)
        }
      }
    }
  } catch {
    /* historical CSVs are optional */
  }

  cachedCatalog = catalog
  return catalog
}

function optionLabelForStoredValue(
  options: EsaQuestionOption[],
  value: string,
): string | null {
  const match = options.find((option) => isOptionValueSelected(option.option, value))
  if (!match) return null
  return isNotAbleToAssessOption(match.option) ? NOT_ABLE_TO_ASSESS_OPTION : match.option
}

function photoFields(
  response: RoomQuestionResponse,
): Pick<RoomQuestionResponse, "photos"> | Record<string, never> {
  const photos = linkedPhotoUrls(response)
  return photos.length ? { photos } : {}
}

function remapResponseToCurrentQuestion(
  question: EsaQuestion,
  options: EsaQuestionOption[],
  response: RoomQuestionResponse,
): RoomQuestionResponse | null {
  const questionOptions = options.filter((option) => option.questionId === question.questionId)
  const comment = response.comment?.trim() || undefined
  const photos = photoFields(response)

  if (isTextQuestionType(question.questionType)) {
    const text =
      typeof response.value === "string"
        ? response.value
        : Array.isArray(response.value)
          ? response.value.filter((value) => typeof value === "string").join("\n")
          : ""
    if (!text.trim() && !comment && !photos.photos?.length) return null
    return {
      questionId: question.questionId,
      value: text,
      ...(comment ? { comment } : {}),
      ...photos,
    }
  }

  if (isMultiSelectQuestionType(question.questionType)) {
    const keptValues = [
      ...new Set(
        asMultiSelectValues(response.value)
          .map((value) => optionLabelForStoredValue(questionOptions, canonicalizeResponseValue(value)))
          .filter((value): value is string => !!value),
      ),
    ]
    if (!keptValues.length && !photos.photos?.length && !comment) return null
    return {
      questionId: question.questionId,
      value: keptValues,
      ...(comment ? { comment } : {}),
      ...photos,
    }
  }

  const raw = Array.isArray(response.value) ? response.value[0] : response.value
  const matched =
    typeof raw === "string" && raw.trim()
      ? optionLabelForStoredValue(questionOptions, canonicalizeResponseValue(raw))
      : null
  if (!matched && !photos.photos?.length && !comment) return null
  return {
    questionId: question.questionId,
    value: matched ?? (typeof raw === "string" ? raw : ""),
    ...(comment ? { comment } : {}),
    ...photos,
  }
}

function storedAnswerValues(response: RoomQuestionResponse): string[] {
  if (Array.isArray(response.value)) {
    return response.value.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
  }
  if (typeof response.value === "string" && response.value.trim()) return [response.value]
  return asMultiSelectValues(response.value)
}

function isGenericAnswerValue(value: string): boolean {
  const normalized = canonicalizeResponseValue(value).trim().toLowerCase()
  if (!normalized) return true
  if (isNotAbleToAssessOption(value)) return true
  return (
    normalized === "yes" ||
    normalized === "no" ||
    normalized === "none" ||
    normalized === "n/a" ||
    normalized === "na" ||
    normalized === "other" ||
    normalized === "other (please note)" ||
    /^\d+$/.test(normalized)
  )
}

function parseQuestionIdParts(questionId: string): { prefix: string; num: number | null; baseId: string } {
  const match = questionId.trim().match(/^([A-Za-z]+)-(\d+)/)
  if (!match) return { prefix: questionId, num: null, baseId: questionId.trim() }
  return {
    prefix: match[1].toUpperCase(),
    num: Number(match[2]),
    baseId: `${match[1].toUpperCase()}-${match[2]}`,
  }
}

function questionAcceptsOptionValues(
  question: EsaQuestion,
  options: EsaQuestionOption[],
  values: string[],
): boolean {
  if (!values.length || isTextQuestionType(question.questionType)) return false
  const questionOptions = options.filter((option) => option.questionId === question.questionId)
  return values.every((value) =>
    optionLabelForStoredValue(questionOptions, canonicalizeResponseValue(value)),
  )
}

function currentQuestionCanTakeAnswer(
  question: EsaQuestion,
  options: EsaQuestionOption[],
  values: string[],
): boolean {
  if (!values.length) return true
  if (isTextQuestionType(question.questionType)) return true
  return questionAcceptsOptionValues(question, options, values)
}

function closestQuestionById(storedId: string, questions: EsaQuestion[]): EsaQuestion | null {
  if (!questions.length) return null
  const stored = parseQuestionIdParts(storedId)
  return [...questions].sort((left, right) => {
    const a = parseQuestionIdParts(left.questionId)
    const b = parseQuestionIdParts(right.questionId)
    const aPrefix = a.prefix === stored.prefix ? 0 : 1
    const bPrefix = b.prefix === stored.prefix ? 0 : 1
    if (aPrefix !== bPrefix) return aPrefix - bPrefix
    const aDist = Math.abs((a.num ?? 9999) - (stored.num ?? 9999))
    const bDist = Math.abs((b.num ?? 9999) - (stored.num ?? 9999))
    return aDist - bDist
  })[0]
}

function currentQuestionForStoredAnswer(
  response: RoomQuestionResponse,
  rubric: { questions: EsaQuestion[]; options: EsaQuestionOption[] },
  usedCurrentIds: Set<string>,
): EsaQuestion | null {
  const values = storedAnswerValues(response)
  const storedId = response.questionId
  const baseId = parseQuestionIdParts(storedId).baseId
  const unused = rubric.questions.filter((question) => !usedCurrentIds.has(question.questionId))
  const distinctive = values.some((value) => !isGenericAnswerValue(value))

  if (distinctive) {
    const optionMatches = unused.filter((question) =>
      questionAcceptsOptionValues(question, rubric.options, values),
    )
    if (optionMatches.length === 1) return optionMatches[0]
    if (optionMatches.length > 1) return closestQuestionById(storedId, optionMatches)
  }

  const sameId =
    unused.find((question) => question.questionId === storedId) ??
    unused.find((question) => parseQuestionIdParts(question.questionId).baseId === baseId)
  if (sameId && currentQuestionCanTakeAnswer(sameId, rubric.options, values)) {
    return sameId
  }

  const originals = historicalQuestionTextsById().get(storedId) ?? historicalQuestionTextsById().get(baseId) ?? []
  const matchesText = (question: EsaQuestion, text: string) =>
    normalizeQuestionContent(question.question) === normalizeQuestionContent(text)
  for (const text of originals) {
    const unusedMatch = unused.find((question) => matchesText(question, text))
    if (unusedMatch) return unusedMatch
  }

  if (linkedPhotoUrls(response).length && unused.length) {
    return (
      unused.find((question) => question.questionId === storedId) ??
      unused.find((question) => parseQuestionIdParts(question.questionId).baseId === baseId) ??
      closestQuestionById(storedId, unused)
    )
  }

  return null
}

export function remapRoomAnswersToCurrentQuestions(
  room: RoomSurveySession,
  surveyType: SurveyType,
  schoolClass: string,
): { room: RoomSurveySession; kept: number; dropped: number } {
  if (room.spaceTypeMarkedAbsent || isAbsentSpaceTypeRoomId(room.roomId)) {
    return { room, kept: 0, dropped: 0 }
  }

  const rubric = getRoomSurveyRubric(
    surveyType,
    room.roomType,
    room.gradeType,
    schoolClass,
    room.sourceSurveyType,
  )
  if (!rubric) {
    return {
      room: {
        ...room,
        responses: [],
        pendingQuestionIds: undefined,
        deferredQuestionIds: undefined,
      },
      kept: 0,
      dropped: room.responses.length,
    }
  }

  const remapped: RoomQuestionResponse[] = []
  const usedCurrentIds = new Set<string>()
  let kept = 0
  let dropped = 0
  const idMap = new Map<string, string>()

  for (const response of room.responses) {
    const target = currentQuestionForStoredAnswer(response, rubric, usedCurrentIds)
    if (!target) {
      dropped += 1
      continue
    }
    const next = remapResponseToCurrentQuestion(target, rubric.options, response)
    if (!next) {
      dropped += 1
      continue
    }
    usedCurrentIds.add(target.questionId)
    idMap.set(response.questionId, target.questionId)
    remapped.push(next)
    kept += 1
  }

  const mapStoredIds = (ids: string[] | undefined) => {
    if (!ids?.length) return undefined
    const next = [
      ...new Set(
        ids
          .map((id) => idMap.get(id) ?? (rubric.questions.some((question) => question.questionId === id) ? id : null))
          .filter((id): id is string => !!id),
      ),
    ]
    return next.length ? next : undefined
  }

  return {
    room: {
      ...room,
      responses: remapped,
      pendingQuestionIds: mapStoredIds(room.pendingQuestionIds),
      deferredQuestionIds: mapStoredIds(room.deferredQuestionIds),
      traditionalStudioCopyReviewPending: false,
    },
    kept,
    dropped,
  }
}

/** Keep the copy of each room that still has the most answers, and union linked photos. */
export function mergeRicherRoomSessions(
  ...sessions: Array<SurveySession | null | undefined>
): Record<string, RoomSurveySession> {
  const rooms: Record<string, RoomSurveySession> = {}
  for (const session of sessions) {
    if (!session?.rooms) continue
    for (const [roomId, room] of Object.entries(session.rooms)) {
      const current = rooms[roomId]
      if (!current) {
        rooms[roomId] = room
        continue
      }
      const nextCount = room.responses?.length ?? 0
      const currentCount = current.responses?.length ?? 0
      const richer = nextCount > currentCount ? room : current
      const other = nextCount > currentCount ? current : room
      rooms[roomId] = mergeRoomLinkedPhotos(richer, other)
    }
  }
  return rooms
}

/** Copy original cloud photo URLs onto an already-seeded clone without changing answers. */
export function mergeLinkedPhotosIntoDestDraft(input: {
  dest: PersistedSurveyDraft
  source: PersistedSurveyDraft
  destSchool: AisdSchoolOption
  extraSessions?: Array<SurveySession | null | undefined>
}): { draft: PersistedSurveyDraft; added: number } {
  const restoreDiscardedPhotoRooms = campusAutoCarryOverPercent(input.destSchool) != null
  const sourceRooms = mergeRicherRoomSessions(
    input.source.session,
    input.source.lastSubmission?.session,
    ...(input.extraSessions ?? []),
  )
  const destRooms: Record<string, RoomSurveySession> = { ...input.dest.session.rooms }
  const discarded = new Set(input.dest.discardedRoomIds ?? [])
  let added = 0

  for (const [roomId, sourceRoom] of Object.entries(sourceRooms)) {
    if (
      !sourceRoom.spaceTypeMarkedAbsent &&
      !isAbsentSpaceTypeRoomId(sourceRoom.roomId) &&
      !spaceTypeBelongsToSurvey(input.dest.surveyType, sourceRoom.roomType, input.destSchool.schoolClass)
    ) {
      continue
    }

    const remapped = remapRoomAnswersToCurrentQuestions(
      sourceRoom,
      input.dest.surveyType,
      input.destSchool.schoolClass,
    ).room
    const destRoom = destRooms[roomId]

    if (!destRoom) {
      if (!roomHasLinkedPhotos(remapped)) continue
      if (discarded.has(roomId) && !restoreDiscardedPhotoRooms) continue
      destRooms[roomId] = remapped
      discarded.delete(roomId)
      added += linkedPhotoCount(remapped)
      continue
    }

    const merged = mergeRoomLinkedPhotos(destRoom, remapped)
    const extra = linkedPhotoCount(merged) - linkedPhotoCount(destRoom)
    if (extra > 0) {
      destRooms[roomId] = merged
      added += extra
    }
  }

  const sourcePreWalkPhotos = input.source.preWalk?.spaceTypePhotos ?? {}
  const destPreWalkPhotos = { ...(input.dest.preWalk?.spaceTypePhotos ?? {}) }
  let preWalkAdded = 0
  for (const [key, photo] of Object.entries(sourcePreWalkPhotos)) {
    const url = photo?.trim()
    if (!url || !url.startsWith("http") || destPreWalkPhotos[key]) continue
    destPreWalkPhotos[key] = url
    preWalkAdded += 1
  }
  added += preWalkAdded

  if (added === 0) return { draft: input.dest, added: 0 }

  const now = new Date().toISOString()
  const session: SurveySession = {
    ...input.dest.session,
    rooms: destRooms,
    updatedAt: now,
  }

  let lastSubmission = input.dest.lastSubmission
  if (lastSubmission?.session.rooms) {
    const subRooms = { ...lastSubmission.session.rooms }
    let subChanged = false
    for (const [roomId, room] of Object.entries(destRooms)) {
      const existing = subRooms[roomId]
      if (!existing) {
        if (!roomHasLinkedPhotos(room)) continue
        subRooms[roomId] = room
        subChanged = true
        continue
      }
      const merged = mergeRoomLinkedPhotos(existing, room)
      if (linkedPhotoCount(merged) > linkedPhotoCount(existing)) {
        subRooms[roomId] = merged
        subChanged = true
      }
    }
    if (subChanged) {
      lastSubmission = {
        ...lastSubmission,
        session: { ...lastSubmission.session, rooms: subRooms },
      }
    }
  }

  return {
    draft: {
      ...input.dest,
      session,
      preWalk:
        preWalkAdded > 0
          ? {
              mappings: input.dest.preWalk?.mappings ?? {},
              ...input.dest.preWalk,
              spaceTypePhotos: destPreWalkPhotos,
            }
          : input.dest.preWalk,
      lastSubmission,
      discardedRoomIds: [...discarded],
      ownedRoomIds: Object.keys(destRooms),
      savedAt: now,
    },
    added,
  }
}

export function cloneDraftWithCompatibleAnswers(input: {
  draft: PersistedSurveyDraft
  destSchool: AisdSchoolOption
  surveyIdPrefix?: string
  extraSessions?: Array<SurveySession | null | undefined>
}): { draft: PersistedSurveyDraft; stats: RemapAnswerStats } {
  const { draft, destSchool } = input
  const prefix = input.surveyIdPrefix ?? "AISD-PILOT-TEST"
  const now = new Date().toISOString()
  const rooms: Record<string, RoomSurveySession> = {}
  let kept = 0
  let dropped = 0

  const sourceRooms = mergeRicherRoomSessions(
    draft.session,
    draft.lastSubmission?.session,
    ...(input.extraSessions ?? []),
  )

  for (const [roomId, room] of Object.entries(sourceRooms)) {
    if (
      !room.spaceTypeMarkedAbsent &&
      !isAbsentSpaceTypeRoomId(room.roomId) &&
      !spaceTypeBelongsToSurvey(draft.surveyType, room.roomType, destSchool.schoolClass)
    ) {
      dropped += room.responses.length
      continue
    }
    const remapped = remapRoomAnswersToCurrentQuestions(
      room,
      draft.surveyType,
      destSchool.schoolClass,
    )
    rooms[roomId] = remapped.room
    kept += remapped.kept
    dropped += remapped.dropped
  }

  const session: SurveySession = {
    ...draft.session,
    surveyId: `${prefix}-${draft.surveyType}`,
    schoolId: destSchool.id,
    schoolName: destSchool.displayName,
    campusId: destSchool.campusId,
    rooms,
    submittedAt: undefined,
    campusSubmittedAt: undefined,
    updatedAt: now,
    assessorName: draft.session.assessorName?.trim() || "PILOT Test",
    assessorEmail: draft.session.assessorEmail?.trim() || "esa.pilot.test@austinisd.org",
    assessorRegisteredAt: draft.session.assessorRegisteredAt || now,
  }

  const cloned: PersistedSurveyDraft = {
    ...draft,
    schoolId: destSchool.id,
    session,
    selectedRoomId: null,
    pendingStudioType: null,
    pendingNeighborhood: null,
    view: "home",
    lastSubmission: null,
    savedAt: now,
    discardedRoomIds: [],
    discardedPinIds: [],
    ownedRoomIds: Object.keys(rooms),
    ownedPinIds: (session.outdoorElementPins ?? []).map((pin) => pin.id),
  }
  const autoPercent = campusAutoCarryOverPercent(destSchool)
  const prepared =
    autoPercent != null ? prepareAutoCarryOverDraft(cloned, destSchool, autoPercent) : cloned

  return {
    draft: prepared,
    stats: { kept, dropped, rooms: Object.keys(prepared.session.rooms).length },
  }
}
