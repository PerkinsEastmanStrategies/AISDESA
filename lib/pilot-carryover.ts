import {
  absentSpaceTypeRoomDisplayName,
  absentSpaceTypeRoomId,
  aggregateCampusScores,
  applyPreWalkSpaceTypeExistsToSession,
  applySpaceTypeExistsToSession,
  campusAutoCarryOverPercent,
  campusUsesSeededWalkedRooms,
  getRoomSurveyRubric,
  isAbsentSpaceTypeRoomId,
  isArrivalSurveyRoomId,
  isOutdoorSurveyRoomId,
  isStudioType,
  lookupTableEntry,
  neighborhoodFromSurveyRoomId,
  neighborhoodSurveyRoomDisplayName,
  outdoorSurveyRoomDisplayName,
  arrivalSurveyRoomDisplayName,
  parseAbsentSpaceTypeRoomId,
  spaceTypeFromArrivalSurveyRoomId,
  spaceTypeFromOutdoorSurveyRoomId,
  surveyTypeForSpaceType,
  SURVEY_TYPES,
  surveyTypeLabel,
  usesPackageStudioRubric,
  type AisdSchoolOption,
  type RoomSurveySession,
  type ScoredRoomEntry,
  type SurveySession,
  type SurveySubmission,
  type SurveyType,
} from "@aisd/shared"
import { isSkippedDependentQuestion } from "@/lib/question-dependencies"
import { roomHasAssessmentProgress } from "@/lib/school-assessment-index"
import { isRoomSurveyFilledOut } from "@/lib/room-survey-progress"
import { loadDraftsForSchool, type PersistedSurveyDraft } from "@/lib/survey-persistence"
import { isQuestionFullyAnswered } from "@/lib/survey-validation"
import { roomHasLinkedPhotos } from "@/lib/response-photos"

const STORAGE_PREFIX = "esa-pilot-carryover-review:"
const AUTO_CARRYOVER_PREFIX = "esa-pilot-auto-carryover:"
const AUTO_CARRYOVER_VERSION = "1"

export type PilotCarryOverRoom = {
  key: string
  surveyType: SurveyType
  surveyLabel: string
  spaceType: string
  roomId: string
  label: string
  answered: number
  total: number
  percent: number
  complete: boolean
  absent: boolean
}

export type PilotCarryOverGroup = {
  surveyType: SurveyType
  surveyLabel: string
  spaceType: string
  rooms: PilotCarryOverRoom[]
}

function storageKey(schoolId: string): string {
  return `${STORAGE_PREFIX}${schoolId}`
}

export function isPilotCarryOverSchool(
  school: Pick<AisdSchoolOption, "id" | "name" | "campusId"> | null | undefined,
): boolean {
  return campusUsesSeededWalkedRooms(school) && campusAutoCarryOverPercent(school) == null
}

export function isPilotAutoCarryOverSchool(
  school: Pick<AisdSchoolOption, "id" | "name" | "campusId"> | null | undefined,
): boolean {
  return campusAutoCarryOverPercent(school) != null
}

function autoCarryOverStorageKey(schoolId: string): string {
  return `${AUTO_CARRYOVER_PREFIX}${schoolId}`
}

export function shouldApplyPilotAutoCarryOver(schoolId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(autoCarryOverStorageKey(schoolId)) !== AUTO_CARRYOVER_VERSION
  } catch {
    return true
  }
}

export function markPilotAutoCarryOverApplied(schoolId: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(autoCarryOverStorageKey(schoolId), AUTO_CARRYOVER_VERSION)
  } catch {
    /* private browsing */
  }
}

export function carryOverRoomKey(surveyType: SurveyType, roomId: string): string {
  return `${surveyType}:${roomId}`
}

/** True when this space type is actually assessed in this survey module. */
export function spaceTypeBelongsToSurvey(
  surveyType: SurveyType,
  spaceType: string | null | undefined,
  schoolClass?: string | null,
): boolean {
  const type = spaceType?.trim()
  if (!type) return false
  const ownedBy = surveyTypeForSpaceType(type, schoolClass)
  if (ownedBy) return ownedBy === surveyType
  if (lookupTableEntry(surveyType, type, schoolClass)) return true
  const rubric = getRoomSurveyRubric(surveyType, type, null, schoolClass)
  if (!rubric?.questions.length) return false
  if (surveyType === "studios") {
    return usesPackageStudioRubric(type) || isStudioType(type)
  }
  return true
}

function readReviewedKeys(schoolId: string): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(storageKey(schoolId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as { roomKeys?: string[] }
    return new Set(parsed.roomKeys ?? [])
  } catch {
    return new Set()
  }
}

export function markPilotCarryOverReviewed(schoolId: string, roomKeys: string[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(
    storageKey(schoolId),
    JSON.stringify({ reviewedAt: new Date().toISOString(), roomKeys }),
  )
}

export function shouldPromptPilotCarryOver(schoolId: string, roomKeys: string[]): boolean {
  if (!roomKeys.length) return false
  const reviewed = readReviewedKeys(schoolId)
  if (reviewed.size === 0) return true
  return roomKeys.some((key) => !reviewed.has(key))
}

export function carryOverRoomLabel(room: RoomSurveySession): string {
  const absent = parseAbsentSpaceTypeRoomId(room.roomId)
  if (absent) {
    return absentSpaceTypeRoomDisplayName(absent.spaceType, absent.neighborhood)
  }
  if (room.spaceTypeMarkedAbsent) {
    return absentSpaceTypeRoomDisplayName(room.roomType, room.neighborhood)
  }
  if (isOutdoorSurveyRoomId(room.roomId)) {
    return outdoorSurveyRoomDisplayName(
      room.roomType || spaceTypeFromOutdoorSurveyRoomId(room.roomId),
    )
  }
  if (isArrivalSurveyRoomId(room.roomId)) {
    return arrivalSurveyRoomDisplayName(
      room.roomType || spaceTypeFromArrivalSurveyRoomId(room.roomId),
    )
  }
  const neighborhood = neighborhoodFromSurveyRoomId(room.roomId)
  if (neighborhood) return neighborhoodSurveyRoomDisplayName(neighborhood)
  return (
    room.schoolRoomNumber?.trim() ||
    room.roomNumber?.trim() ||
    room.roomId
  )
}

export function roomCarryOverProgress(
  room: RoomSurveySession,
  surveyType: SurveyType,
  schoolClass?: string | null,
): { answered: number; total: number; percent: number; complete: boolean } {
  if (room.spaceTypeMarkedAbsent || isAbsentSpaceTypeRoomId(room.roomId)) {
    return { answered: 1, total: 1, percent: 100, complete: true }
  }
  const rubric = getRoomSurveyRubric(
    surveyType,
    room.roomType,
    room.gradeType,
    schoolClass,
    surveyType === "closeout" ? room.sourceSurveyType : undefined,
  )
  const complete = isRoomSurveyFilledOut(room, surveyType, schoolClass)
  if (!rubric?.questions.length) {
    const answered = room.responses.length
    return {
      answered,
      total: Math.max(answered, 1),
      percent: answered ? 100 : 0,
      complete,
    }
  }
  const questions = rubric.questions.filter(
    (question) => !isSkippedDependentQuestion(question.questionId, room.responses, rubric.questions),
  )
  const total = questions.length || rubric.questions.length
  const answered = questions.filter((question) =>
    isQuestionFullyAnswered(
      question,
      room.responses.find((response) => response.questionId === question.questionId),
    ),
  ).length
  return {
    answered,
    total,
    percent: total ? Math.round((answered / total) * 100) : 0,
    complete,
  }
}

function parseExistenceKey(key: string): { spaceType: string; neighborhood?: string } {
  const sep = key.indexOf("::")
  if (sep >= 0) {
    return {
      spaceType: key.slice(0, sep).trim(),
      neighborhood: key.slice(sep + 2).trim() || undefined,
    }
  }
  return { spaceType: key.trim() }
}

function pushAbsentCarryOverRoom(
  rooms: PilotCarryOverRoom[],
  seen: Set<string>,
  surveyType: SurveyType,
  spaceType: string,
  neighborhood?: string,
) {
  const roomId = absentSpaceTypeRoomId(spaceType, neighborhood)
  if (seen.has(roomId)) return
  seen.add(roomId)
  rooms.push({
    key: carryOverRoomKey(surveyType, roomId),
    surveyType,
    surveyLabel: surveyTypeLabel(surveyType),
    spaceType,
    roomId,
    label: absentSpaceTypeRoomDisplayName(spaceType, neighborhood),
    absent: true,
    answered: 1,
    total: 1,
    percent: 100,
    complete: true,
  })
}

export function listPilotCarryOverRooms(
  schoolId: string,
  schoolClass?: string | null,
): PilotCarryOverRoom[] {
  const rooms: PilotCarryOverRoom[] = []
  for (const draft of loadDraftsForSchool(schoolId)) {
    if (draft.surveyType === "closeout") continue
    const roomsById = { ...draft.session.rooms }
    for (const [roomId, room] of Object.entries(draft.lastSubmission?.session.rooms ?? {})) {
      const existing = roomsById[roomId]
      const incomingAbsent = isAbsentSpaceTypeRoomId(roomId) || !!room.spaceTypeMarkedAbsent
      if (!existing) {
        if (incomingAbsent || roomHasAssessmentProgress(room)) roomsById[roomId] = room
        continue
      }
      if ((room.responses?.length ?? 0) > (existing.responses?.length ?? 0)) {
        roomsById[roomId] = room
      }
    }
    const seen = new Set<string>()
    for (const room of Object.values(roomsById)) {
      const absent = isAbsentSpaceTypeRoomId(room.roomId) || !!room.spaceTypeMarkedAbsent
      if (!absent && !roomHasAssessmentProgress(room)) continue
      const spaceType =
        parseAbsentSpaceTypeRoomId(room.roomId)?.spaceType?.trim() || room.roomType?.trim()
      if (!spaceType) continue
      if (!spaceTypeBelongsToSurvey(draft.surveyType, spaceType, schoolClass)) continue
      const progress = roomCarryOverProgress(room, draft.surveyType, schoolClass)
      seen.add(room.roomId)
      rooms.push({
        key: carryOverRoomKey(draft.surveyType, room.roomId),
        surveyType: draft.surveyType,
        surveyLabel: surveyTypeLabel(draft.surveyType),
        spaceType,
        roomId: room.roomId,
        label: carryOverRoomLabel(room),
        absent,
        ...progress,
      })
    }
    const existence = {
      ...(draft.lastSubmission?.session.spaceTypeExistsAtSchool ?? {}),
      ...(draft.session.spaceTypeExistsAtSchool ?? {}),
    }
    for (const [key, exists] of Object.entries(existence)) {
      if (exists !== false) continue
      const { spaceType, neighborhood } = parseExistenceKey(key)
      if (!spaceType || !spaceTypeBelongsToSurvey(draft.surveyType, spaceType, schoolClass)) continue
      pushAbsentCarryOverRoom(rooms, seen, draft.surveyType, spaceType, neighborhood)
    }
    for (const [key, exists] of Object.entries(draft.preWalk?.spaceTypeExists ?? {})) {
      if (exists !== false) continue
      const prefix = `${draft.surveyType}::`
      if (!key.startsWith(prefix)) continue
      const spaceType = key.slice(prefix.length).trim()
      if (!spaceType || spaceType.includes("::")) continue
      if (!spaceTypeBelongsToSurvey(draft.surveyType, spaceType, schoolClass)) continue
      pushAbsentCarryOverRoom(rooms, seen, draft.surveyType, spaceType)
    }
  }
  return rooms.sort((a, b) => {
    const survey = SURVEY_TYPES.indexOf(a.surveyType) - SURVEY_TYPES.indexOf(b.surveyType)
    if (survey !== 0) return survey
    const type = a.spaceType.localeCompare(b.spaceType)
    if (type !== 0) return type
    return a.label.localeCompare(b.label, undefined, { numeric: true })
  })
}

export function groupPilotCarryOverRooms(rooms: PilotCarryOverRoom[]): PilotCarryOverGroup[] {
  const groups: PilotCarryOverGroup[] = []
  for (const room of rooms) {
    const last = groups[groups.length - 1]
    if (last && last.surveyType === room.surveyType && last.spaceType === room.spaceType) {
      last.rooms.push(room)
      continue
    }
    groups.push({
      surveyType: room.surveyType,
      surveyLabel: room.surveyLabel,
      spaceType: room.spaceType,
      rooms: [room],
    })
  }
  return groups
}

function scoreAbsentCarryOverRoom(room: RoomSurveySession): ScoredRoomEntry {
  return {
    roomId: room.roomId,
    roomName: carryOverRoomLabel(room),
    neighborhood: room.neighborhood?.trim() || undefined,
    levelId: room.levelId || "campus",
    gradeType: room.gradeType || "",
    overallScore: 0,
    categoryScores: [],
    answeredCount: 1,
    totalCount: 1,
    complete: true,
  }
}

function mergeAbsentRoomsIntoLastSubmission(
  draft: PersistedSurveyDraft,
  school: AisdSchoolOption,
  session: SurveySession,
  absentRooms: ScoredRoomEntry[],
  appliedAt: string,
): SurveySubmission {
  const priorRooms = draft.lastSubmission?.campus.rooms ?? []
  const merged = new Map(priorRooms.map((room) => [room.roomId, room]))
  for (const room of absentRooms) {
    merged.set(room.roomId, room)
  }
  const submittedAt =
    draft.lastSubmission?.submittedAt &&
    (!draft.pilotResultsResetAt ||
      draft.lastSubmission.submittedAt >= draft.pilotResultsResetAt)
      ? draft.lastSubmission.submittedAt
      : new Date().toISOString()
  return {
    session: {
      ...session,
      autoCarryOverAppliedAt: appliedAt,
    },
    submittedAt,
    campus: aggregateCampusScores([...merged.values()], {
      schoolId: school.id,
      schoolName: school.displayName,
      campusId: school.campusId,
    }),
    floorPlanRooms: draft.lastSubmission?.floorPlanRooms ?? [],
  }
}

export function draftHasAutoCarryOverApplied(draft: PersistedSurveyDraft): boolean {
  return !!(
    draft.autoCarryOverAppliedAt ||
    draft.session.autoCarryOverAppliedAt ||
    draft.lastSubmission?.session.autoCarryOverAppliedAt
  )
}

export function prepareAutoCarryOverDraft(
  draft: PersistedSurveyDraft,
  school: AisdSchoolOption,
  percentThreshold: number,
): PersistedSurveyDraft {
  const schoolClass = school.schoolClass
  const alreadyApplied = draftHasAutoCarryOverApplied(draft)
  const appliedAt =
    draft.autoCarryOverAppliedAt ||
    draft.session.autoCarryOverAppliedAt ||
    draft.lastSubmission?.session.autoCarryOverAppliedAt ||
    new Date().toISOString()
  const discarded = new Set(draft.discardedRoomIds ?? [])

  let session: SurveySession = { ...draft.session }
  const existence = {
    ...(draft.lastSubmission?.session.spaceTypeExistsAtSchool ?? {}),
    ...(session.spaceTypeExistsAtSchool ?? {}),
  }
  for (const [key, exists] of Object.entries(existence)) {
    if (exists !== false) continue
    const { spaceType, neighborhood } = parseExistenceKey(key)
    if (!spaceType || !spaceTypeBelongsToSurvey(draft.surveyType, spaceType, schoolClass)) continue
    session = applySpaceTypeExistsToSession(session, spaceType, false, neighborhood)
  }
  session = applyPreWalkSpaceTypeExistsToSession(
    session,
    draft.preWalk?.spaceTypeExists,
    draft.surveyType,
  )
  for (const [roomId, room] of Object.entries(draft.lastSubmission?.session.rooms ?? {})) {
    const absent = isAbsentSpaceTypeRoomId(roomId) || !!room.spaceTypeMarkedAbsent
    if (!absent) continue
    const spaceType =
      parseAbsentSpaceTypeRoomId(roomId)?.spaceType?.trim() || room.roomType?.trim()
    if (!spaceType || !spaceTypeBelongsToSurvey(draft.surveyType, spaceType, schoolClass)) continue
    const neighborhood =
      parseAbsentSpaceTypeRoomId(roomId)?.neighborhood || room.neighborhood || null
    session = applySpaceTypeExistsToSession(session, spaceType, false, neighborhood)
  }

  const rooms: Record<string, RoomSurveySession> = {}
  const absentRooms: ScoredRoomEntry[] = []
  for (const [roomId, room] of Object.entries(session.rooms)) {
    const spaceType =
      parseAbsentSpaceTypeRoomId(roomId)?.spaceType?.trim() || room.roomType?.trim()
    const absent = isAbsentSpaceTypeRoomId(roomId) || !!room.spaceTypeMarkedAbsent
    if (!absent && !spaceTypeBelongsToSurvey(draft.surveyType, spaceType, schoolClass)) {
      discarded.add(roomId)
      continue
    }
    if (absent) {
      rooms[roomId] = room
      absentRooms.push(scoreAbsentCarryOverRoom(room))
      continue
    }
    if (
      !alreadyApplied &&
      roomCarryOverProgress(room, draft.surveyType, schoolClass).percent <= percentThreshold &&
      !roomHasLinkedPhotos(room)
    ) {
      discarded.add(roomId)
      continue
    }
    rooms[roomId] = room
  }

  session = {
    ...session,
    rooms,
    autoCarryOverAppliedAt: appliedAt,
    updatedAt: appliedAt,
  }
  const selectedRoomId =
    draft.selectedRoomId && rooms[draft.selectedRoomId] ? draft.selectedRoomId : null

  return {
    ...draft,
    session,
    selectedRoomId,
    lastSubmission:
      absentRooms.length > 0 || draft.lastSubmission
        ? mergeAbsentRoomsIntoLastSubmission(
            draft,
            school,
            session,
            absentRooms,
            appliedAt,
          )
        : null,
    discardedRoomIds: [...discarded],
    ownedRoomIds: Object.keys(rooms),
    autoCarryOverAppliedAt: appliedAt,
    savedAt: appliedAt,
  }
}
