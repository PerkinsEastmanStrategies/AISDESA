import type {
  CategoryScore,
  RoomScoreResult,
  RoomSurveySession,
  ScoredRoomEntry,
  SurveySession,
  SurveyType,
} from "@aisd/shared"
import {
  aggregateCampusScores,
  EMPTY_WEIGHT_OVERRIDES,
  getRoomSurveyRubric,
  isOutdoorSurveyRoomId,
  isAbsentSpaceTypeRoomId,
  parseAbsentSpaceTypeRoomId,
  absentSpaceTypeRoomDisplayName,
  isRoomComplete,
  neighborhoodFromSurveyRoomId,
  neighborhoodSurveyRoomDisplayName,
  outdoorSurveyRoomDisplayName,
  spaceTypeFromOutdoorSurveyRoomId,
  scoringFocusAreaForRoom,
  SCORING_FOCUS_AREAS,
  spaceTypesForScoringFocusArea,
  surveyTypeForScoringFocusArea,
  type ScoringFocusAreaId,
} from "@aisd/shared"
import {
  focusAreaWeightForSchool,
  lookupTableEntry,
  schoolLevelFromSchoolClass,
  TABLE_OF_SURVEY_ENTRIES,
} from "@aisd/shared"
import { scoreRoomSessionWithMetadata, scoreAbsentSpaceTypeRoom } from "@/lib/traditional-studio-room-score"
import { loadDraftsForSchool, type PersistedSurveyDraft } from "@/lib/survey-persistence"

/** True when a campus room entry counts as a finished submission (excludes in-progress partials). */
export function isSubmittedCampusRoom(entry: {
  complete?: boolean
  answeredCount?: number
  totalCount?: number
}): boolean {
  if (entry.complete === false) return false
  if (entry.complete === true) return true
  return (entry.totalCount ?? 0) > 0 && (entry.answeredCount ?? 0) >= (entry.totalCount ?? 0)
}

export interface AssessedRoomRecord extends ScoredRoomEntry {
  surveyType: SurveyType
  spaceType: string
  focusAreaId: ScoringFocusAreaId
}

export interface SpaceTypeGroup {
  spaceType: string
  surveyType: SurveyType
  spaceTypeWeight: number
  roomCount: number
  scoredRoomCount: number
  overallScore: number | null
  categoryScores: CategoryScore[]
  rooms: AssessedRoomRecord[]
}

export interface FocusAreaGroup {
  id: ScoringFocusAreaId
  label: string
  focusAreaWeight: number
  roomCount: number
  scoredRoomCount: number
  overallScore: number | null
  categoryScores: CategoryScore[]
  spaceTypes: SpaceTypeGroup[]
}

export interface CampusScoringSnapshot {
  schoolId: string
  schoolName: string
  campusId: string
  focusAreas: FocusAreaGroup[]
  allRooms: AssessedRoomRecord[]
  neighborhoods: ReturnType<typeof aggregateCampusScores>["neighborhoods"]
  campusOverallScore: number | null
  sessionsBySurveyType: Partial<Record<SurveyType, SurveySession>>
  roomScoreDetailsBySurveyType: Partial<Record<SurveyType, Record<string, RoomScoreResult>>>
}

function average(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function averageCategoryScores(rooms: Pick<ScoredRoomEntry, "categoryScores" | "overallScore">[]): CategoryScore[] {
  const byCat = new Map<string, { scores: number[]; weight: number }>()
  for (const room of rooms) {
    if (room.overallScore === null) continue
    for (const cat of room.categoryScores) {
      const entry = byCat.get(cat.category) ?? { scores: [], weight: cat.weight }
      entry.scores.push(cat.score)
      byCat.set(cat.category, entry)
    }
  }
  return Array.from(byCat.entries()).map(([category, { scores, weight }]) => ({
    category,
    score: average(scores) ?? 0,
    weight,
  }))
}

function roomDisplayName(roomId: string, roomSession: RoomSurveySession): string {
  if (isOutdoorSurveyRoomId(roomId)) {
    return outdoorSurveyRoomDisplayName(spaceTypeFromOutdoorSurveyRoomId(roomId))
  }
  const absent = parseAbsentSpaceTypeRoomId(roomId)
  if (absent) return absentSpaceTypeRoomDisplayName(absent.spaceType, absent.neighborhood)
  const neighborhoodLabel = neighborhoodFromSurveyRoomId(roomId)
  if (neighborhoodLabel) return neighborhoodSurveyRoomDisplayName(neighborhoodLabel)
  return roomSession.roomNumber?.trim() || roomId
}

function resolveSpaceType(
  roomSession: RoomSurveySession,
  surveyType: SurveyType,
  schoolClass?: string | null,
): string {
  const type = roomSession.roomType?.trim()
  if (!type || type === "Studios") return type || "Unassigned space type"
  const entry = lookupTableEntry(surveyType, type, schoolClass)
  return entry?.spaceType ?? type
}

function scoreSessionRooms(
  session: SurveySession,
  surveyType: SurveyType,
  schoolClass?: string | null,
  existingDetails?: Record<string, RoomScoreResult>,
): Record<string, RoomScoreResult> {
  const next: Record<string, RoomScoreResult> = { ...(existingDetails ?? {}) }

  for (const [roomId, roomSession] of Object.entries(session.rooms)) {
    if (next[roomId]?.subcategoryScores?.length) continue

    if (roomSession.spaceTypeMarkedAbsent || isAbsentSpaceTypeRoomId(roomId)) {
      next[roomId] = scoreAbsentSpaceTypeRoom(roomId)
      continue
    }

    const rubric = getRoomSurveyRubric(
      surveyType,
      roomSession.roomType,
      roomSession.gradeType,
      schoolClass,
    )
    if (!rubric) continue

    next[roomId] = {
      ...scoreRoomSessionWithMetadata(roomSession, rubric, EMPTY_WEIGHT_OVERRIDES, undefined),
      roomId,
    }
  }

  return next
}

/** Prefer the room copy that still has answers (live rows can lag behind submission snapshots). */
function richerRoomSession(
  live: RoomSurveySession | undefined,
  submitted: RoomSurveySession | undefined,
): RoomSurveySession | undefined {
  if (!live) return submitted
  if (!submitted) return live
  const liveAnswers = live.responses?.length ?? 0
  const submittedAnswers = submitted.responses?.length ?? 0
  return submittedAnswers > liveAnswers ? submitted : live
}

function mergeSessionWithSubmission(
  live: SurveySession | undefined,
  submitted: SurveySession | undefined,
): SurveySession | undefined {
  if (!live) return submitted
  if (!submitted) return live
  const rooms: Record<string, RoomSurveySession> = { ...live.rooms }
  for (const [roomId, submittedRoom] of Object.entries(submitted.rooms ?? {})) {
    const merged = richerRoomSession(rooms[roomId], submittedRoom)
    if (merged) rooms[roomId] = merged
  }
  return {
    ...live,
    rooms,
    submittedAt: live.submittedAt ?? submitted.submittedAt,
  }
}

function roomHasAssessment(
  detail: RoomScoreResult | undefined,
  options?: { allowScoreWithoutAnswers?: boolean },
): boolean {
  if (!detail) return false
  if (detail.answeredCount > 0) return true
  return !!(options?.allowScoreWithoutAnswers && detail.overallScore !== null)
}

function weightedAverage(items: { score: number; weight: number }[]): number | null {
  const valid = items.filter((item) => item.weight > 0)
  if (!valid.length) return null
  const totalWeight = valid.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight <= 0) return null
  return valid.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight
}

function computeWeightedCampusScore(
  rooms: AssessedRoomRecord[],
  schoolClass?: string | null,
): number | null {
  const scored = rooms.filter((room) => room.overallScore !== null)
  if (!scored.length) return null

  const byFocus = new Map<ScoringFocusAreaId, AssessedRoomRecord[]>()
  for (const room of scored) {
    const list = byFocus.get(room.focusAreaId) ?? []
    list.push(room)
    byFocus.set(room.focusAreaId, list)
  }

  const focusAreaScores: { score: number; weight: number }[] = []
  for (const [focusAreaId, focusRooms] of byFocus) {
    const bySpaceType = new Map<string, AssessedRoomRecord[]>()
    for (const room of focusRooms) {
      const list = bySpaceType.get(room.spaceType) ?? []
      list.push(room)
      bySpaceType.set(room.spaceType, list)
    }

    const spaceTypeScores: { score: number; weight: number }[] = []
    for (const [spaceType, typeRooms] of bySpaceType) {
      const avg = average(typeRooms.map((room) => room.overallScore!))
      if (avg == null) continue
      const entry = lookupTableEntry(typeRooms[0].surveyType, spaceType, schoolClass)
      spaceTypeScores.push({ score: avg, weight: entry?.spaceTypeWeight ?? 1 })
    }

    const focusScore = weightedAverage(spaceTypeScores)
    if (focusScore == null) continue
    focusAreaScores.push({
      score: focusScore,
      weight: focusAreaWeightForSchool(focusAreaId, schoolClass) || 1,
    })
  }

  return (
    weightedAverage(focusAreaScores) ??
    average(scored.map((room) => room.overallScore!))
  )
}

function buildAssessedRoom(
  roomId: string,
  roomSession: RoomSurveySession,
  surveyType: SurveyType,
  detail: RoomScoreResult | undefined,
  schoolClass?: string | null,
  neighborhood?: string,
  assessmentOptions?: { allowScoreWithoutAnswers?: boolean },
): AssessedRoomRecord | null {
  if (!roomHasAssessment(detail, assessmentOptions)) return null

  const spaceType = resolveSpaceType(roomSession, surveyType, schoolClass)
  const focusAreaId = scoringFocusAreaForRoom(surveyType, roomSession.roomType, schoolClass)
  if (!focusAreaId) return null

  const resolvedNeighborhood = isOutdoorSurveyRoomId(roomId)
    ? "Outdoor"
    : neighborhood

  return {
    roomId,
    roomName: roomDisplayName(roomId, roomSession),
    schoolRoomNumber: roomSession.schoolRoomNumber?.trim() || undefined,
    neighborhood: resolvedNeighborhood,
    levelId: roomSession.levelId,
    gradeType: roomSession.gradeType,
    overallScore: detail?.overallScore ?? null,
    categoryScores: detail?.categoryScores ?? [],
    answeredCount: detail?.answeredCount ?? 0,
    totalCount: detail?.totalCount ?? 0,
    complete: detail
      ? isRoomComplete(detail, roomSession.gradeType, roomSession.roomType, schoolClass)
      : false,
    surveyType,
    spaceType,
    focusAreaId,
  }
}

function groupSpaceTypes(
  rooms: AssessedRoomRecord[],
  focusAreaId: ScoringFocusAreaId,
  schoolClass?: string | null,
): SpaceTypeGroup[] {
  const configured = spaceTypesForScoringFocusArea(focusAreaId, schoolClass)
  const byType = new Map<string, AssessedRoomRecord[]>()

  for (const room of rooms) {
    const list = byType.get(room.spaceType) ?? []
    list.push(room)
    byType.set(room.spaceType, list)
  }

  const orderedTypes = [
    ...configured.filter((t) => byType.has(t)),
    ...[...byType.keys()].filter((t) => !configured.includes(t)).sort(),
    ...configured.filter((t) => !byType.has(t)),
  ]

  const seen = new Set<string>()
  const groups: SpaceTypeGroup[] = []

  for (const spaceType of orderedTypes) {
    if (seen.has(spaceType)) continue
    seen.add(spaceType)
    const typeRooms = byType.get(spaceType) ?? []
    const scored = typeRooms.filter((r) => r.overallScore !== null)
    groups.push({
      spaceType,
      surveyType: typeRooms[0]?.surveyType ?? surveyTypeForScoringFocusArea(focusAreaId),
      spaceTypeWeight:
        lookupTableEntry(
          typeRooms[0]?.surveyType ?? surveyTypeForScoringFocusArea(focusAreaId),
          spaceType,
          schoolClass,
        )?.spaceTypeWeight ?? 1,
      roomCount: typeRooms.length,
      scoredRoomCount: scored.length,
      overallScore: average(scored.map((r) => r.overallScore!)),
      categoryScores: averageCategoryScores(scored),
      rooms: typeRooms.sort((a, b) => a.roomName.localeCompare(b.roomName)),
    })
  }

  return groups
}

export function buildCampusScoringSnapshot(input: {
  schoolId: string
  schoolName: string
  campusId: string
  schoolClass?: string | null
  drafts?: PersistedSurveyDraft[]
  liveSurveyType?: SurveyType
  liveSession?: SurveySession | null
  liveRoomScoreDetails?: Record<string, RoomScoreResult>
  liveNeighborhoodResolver?: (roomId: string, roomSession: RoomSurveySession) => string | undefined
}): CampusScoringSnapshot {
  const sessionsBySurveyType: Partial<Record<SurveyType, SurveySession>> = {}
  const roomScoreDetailsBySurveyType: Partial<Record<SurveyType, Record<string, RoomScoreResult>>> = {}

  const drafts = input.drafts ?? loadDraftsForSchool(input.schoolId)
  for (const draft of drafts) {
    if (draft.surveyType === "closeout") continue
    sessionsBySurveyType[draft.surveyType] = draft.session
  }

  if (input.liveSession && input.liveSurveyType && input.liveSurveyType !== "closeout") {
    sessionsBySurveyType[input.liveSurveyType] = input.liveSession
  }

  // Submission snapshots can retain answers after live esa_question_responses were cleared.
  // Merge richer submitted rooms into the working session before scoring drill-downs.
  for (const draft of drafts) {
    if (draft.surveyType === "closeout") continue
    const submittedSession = draft.lastSubmission?.session
    if (!submittedSession) continue
    sessionsBySurveyType[draft.surveyType] = mergeSessionWithSubmission(
      sessionsBySurveyType[draft.surveyType],
      submittedSession,
    )
  }

  for (const [surveyType, session] of Object.entries(sessionsBySurveyType) as [
    SurveyType,
    SurveySession,
  ][]) {
    const existing =
      surveyType === input.liveSurveyType ? input.liveRoomScoreDetails : undefined
    roomScoreDetailsBySurveyType[surveyType] = scoreSessionRooms(
      session,
      surveyType,
      input.schoolClass,
      existing,
    )
  }

  // Submitted campus snapshots are the source of truth for room scores (keeps admin
  // list, QA review, and drill-down aligned with what assessors submitted).
  for (const draft of drafts) {
    if (draft.surveyType === "closeout") continue
    const sub = draft.lastSubmission
    if (!sub?.campus?.rooms?.length) continue

    const surveyType = draft.surveyType
    const details = { ...(roomScoreDetailsBySurveyType[surveyType] ?? {}) }

    for (const entry of sub.campus.rooms) {
      if (!isSubmittedCampusRoom(entry)) continue
      let existing = details[entry.roomId]

      // If live scoring lacked subcategory/question detail, rebuild from submitted answers.
      if (!existing?.subcategoryScores?.length) {
        const submittedRoom = sub.session.rooms[entry.roomId]
        if (submittedRoom && (submittedRoom.responses?.length ?? 0) > 0) {
          const rescored = scoreSessionRooms(
            { ...sub.session, rooms: { [entry.roomId]: submittedRoom } },
            surveyType,
            input.schoolClass,
          )[entry.roomId]
          if (rescored?.subcategoryScores?.length) existing = rescored
        }
      }

      details[entry.roomId] = {
        roomId: entry.roomId,
        overallScore: entry.overallScore,
        categoryScores: entry.categoryScores,
        subcategoryScores: existing?.subcategoryScores ?? [],
        questionScores: existing?.questionScores ?? [],
        answeredCount: entry.answeredCount,
        totalCount: entry.totalCount,
      }
    }

    roomScoreDetailsBySurveyType[surveyType] = details
  }

  const allRooms: AssessedRoomRecord[] = []

  for (const draft of drafts) {
    if (draft.surveyType === "closeout") continue
    const sub = draft.lastSubmission
    if (!sub?.campus?.rooms?.length) continue

    const surveyType = draft.surveyType
    const session = sessionsBySurveyType[surveyType] ?? sub.session
    sessionsBySurveyType[surveyType] = session

    let details = roomScoreDetailsBySurveyType[surveyType]
    if (!details) {
      details = scoreSessionRooms(session, surveyType, input.schoolClass)
      roomScoreDetailsBySurveyType[surveyType] = details
    }

    for (const entry of sub.campus.rooms) {
      if (!isSubmittedCampusRoom(entry)) continue

      const roomSession = session.rooms[entry.roomId] ?? sub.session.rooms[entry.roomId]
      if (!roomSession) continue

      if (!roomHasAssessment(details[entry.roomId], { allowScoreWithoutAnswers: true })) {
        details[entry.roomId] = {
          roomId: entry.roomId,
          overallScore: entry.overallScore,
          categoryScores: entry.categoryScores,
          subcategoryScores: [],
          questionScores: [],
          answeredCount: entry.answeredCount,
          totalCount: entry.totalCount,
        }
      }

      const record = buildAssessedRoom(
        entry.roomId,
        roomSession,
        surveyType,
        details[entry.roomId],
        input.schoolClass,
        entry.neighborhood,
        { allowScoreWithoutAnswers: true },
      )
      if (record) allRooms.push(record)
    }
  }

  // Just-finished rooms on this device (e.g. first save on a sandbox campus)
  // are not always in a cloud submission snapshot yet.
  if (input.liveSession && input.liveSurveyType && input.liveSurveyType !== "closeout") {
    const surveyType = input.liveSurveyType
    const session = input.liveSession
    let details = roomScoreDetailsBySurveyType[surveyType]
    if (!details) {
      details = scoreSessionRooms(session, surveyType, input.schoolClass)
      roomScoreDetailsBySurveyType[surveyType] = details
    }
    const seen = new Set(allRooms.map((room) => room.roomId))
    for (const [roomId, roomSession] of Object.entries(session.rooms)) {
      if (seen.has(roomId)) continue
      const detail = details[roomId]
      const complete =
        roomSession.spaceTypeMarkedAbsent ||
        isAbsentSpaceTypeRoomId(roomId) ||
        (detail
          ? isRoomComplete(detail, roomSession.gradeType, roomSession.roomType, input.schoolClass)
          : false)
      if (!complete) continue
      const record = buildAssessedRoom(
        roomId,
        roomSession,
        surveyType,
        detail,
        input.schoolClass,
        input.liveNeighborhoodResolver?.(roomId, roomSession) ?? roomSession.neighborhood,
        { allowScoreWithoutAnswers: true },
      )
      if (record) allRooms.push(record)
    }
  }

  allRooms.sort((a, b) => a.roomName.localeCompare(b.roomName))

  const campusAgg = aggregateCampusScores(allRooms, {
    schoolId: input.schoolId,
    schoolName: input.schoolName,
    campusId: input.campusId,
  })

  const level = schoolLevelFromSchoolClass(input.schoolClass)
  const focusAreaDefs = SCORING_FOCUS_AREAS.filter((def) => {
    if (!level) return true
    return TABLE_OF_SURVEY_ENTRIES.some(
      (entry) => entry.scoringFocusAreaId === def.id && entry.schoolLevel === level,
    )
  })

  const focusAreas: FocusAreaGroup[] = focusAreaDefs.map((def) => {
    const areaRooms = allRooms.filter((r) => r.focusAreaId === def.id)
    const scored = areaRooms.filter((r) => r.overallScore !== null)
    return {
      id: def.id,
      label: def.label,
      focusAreaWeight: focusAreaWeightForSchool(def.id, input.schoolClass) || 1,
      roomCount: areaRooms.length,
      scoredRoomCount: scored.length,
      overallScore: average(scored.map((r) => r.overallScore!)),
      categoryScores: averageCategoryScores(scored),
      spaceTypes: groupSpaceTypes(areaRooms, def.id, input.schoolClass),
    }
  })

  return {
    schoolId: input.schoolId,
    schoolName: input.schoolName,
    campusId: input.campusId,
    focusAreas,
    allRooms,
    neighborhoods: campusAgg.neighborhoods,
    campusOverallScore: computeWeightedCampusScore(allRooms, input.schoolClass),
    sessionsBySurveyType,
    roomScoreDetailsBySurveyType,
  }
}
