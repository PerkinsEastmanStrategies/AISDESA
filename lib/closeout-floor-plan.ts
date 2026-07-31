import type { ParsedPlanRoom, RoomSurveySession, SurveySession, SurveyType } from "@aisd/shared"
import { getRoomSurveyRubric, surveyTypeLabel } from "@aisd/shared"
import {
  effectiveCloseOutPendingQuestionIds,
  roomNeedsCloseOut,
} from "@/lib/closeout"
import { computeRoomQuestionProgress } from "@/lib/survey-question-progress"
import { isQuestionFullyAnswered } from "@/lib/survey-validation"

export interface CloseOutRoomFloorPlanEntry {
  roomId: string
  percent: number
  complete: boolean
  /** Room is part of the Close Out queue (pending or finished). */
  inQueue: boolean
  sourceSurveyType: SurveyType | null
  sourceSurveyLabel: string
  spaceType: string
}

function roomIsOnCloseOutPlan(room: RoomSurveySession): boolean {
  return (
    roomNeedsCloseOut(room) ||
    !!room.deferredToCloseOut ||
    (room.pendingQuestionIds?.length ?? 0) > 0 ||
    !!room.sourceSurveyType
  )
}

/** Progress and source survey metadata for Close Out floor plan overlays. */
export function computeCloseOutRoomFloorPlanEntry(
  room: RoomSurveySession,
  schoolClass?: string | null,
): CloseOutRoomFloorPlanEntry | null {
  if (!roomIsOnCloseOutPlan(room)) return null

  const sourceSurveyType = room.sourceSurveyType ?? null
  const sourceSurveyLabel = sourceSurveyType ? surveyTypeLabel(sourceSurveyType) : "Survey"
  const spaceType = room.roomType?.trim() || "Room"

  if (!roomNeedsCloseOut(room)) {
    return {
      roomId: room.roomId,
      percent: 100,
      complete: true,
      inQueue: true,
      sourceSurveyType,
      sourceSurveyLabel,
      spaceType,
    }
  }

  const rubric = sourceSurveyType
    ? getRoomSurveyRubric(
        "closeout",
        room.roomType,
        room.gradeType,
        schoolClass,
        sourceSurveyType,
      )
    : null

  const pendingIds = new Set(room.pendingQuestionIds ?? [])
  const pendingQuestions =
    rubric?.questions.filter((q) => pendingIds.has(q.questionId)) ?? []
  const responseMap = new Map(room.responses.map((r) => [r.questionId, r]))

  let answered = pendingQuestions.filter((q) =>
    isQuestionFullyAnswered(q, responseMap.get(q.questionId)),
  ).length
  let total = pendingQuestions.length

  if (room.pendingGrade) {
    total += 1
    if (room.gradeType) answered += 1
  }

  // Fallback when rubric questions aren't resolved but pending IDs remain.
  if (total === 0) {
    const unresolved = effectiveCloseOutPendingQuestionIds(room, schoolClass).length
    total = unresolved + (room.pendingGrade ? 1 : 0)
    answered = Math.max(0, (room.pendingQuestionIds?.length ?? 0) - unresolved)
    if (room.pendingGrade && room.gradeType) answered += 1
  }

  const percent = total > 0 ? Math.round((answered / total) * 100) : 0

  return {
    roomId: room.roomId,
    percent,
    complete: false,
    inQueue: true,
    sourceSurveyType,
    sourceSurveyLabel,
    spaceType,
  }
}

function normalizeRoomKey(value: string): string {
  return value.trim().toUpperCase()
}

/** Match a floor-plan or list room id to its Close Out session entry (handles id aliases). */
export function resolveCloseOutSessionRoom(
  session: SurveySession | null | undefined,
  roomId: string,
  allRooms?: ParsedPlanRoom[],
): RoomSurveySession | null {
  if (!session) return null

  if (session.rooms[roomId]) return session.rooms[roomId]

  const target = normalizeRoomKey(roomId)
  const planRoom = allRooms?.find((room) => room.id === roomId)

  for (const room of Object.values(session.rooms)) {
    if (normalizeRoomKey(room.roomId) === target) return room
    if (room.schoolRoomNumber && normalizeRoomKey(room.schoolRoomNumber) === target) return room
    if (room.roomNumber && normalizeRoomKey(room.roomNumber) === target) return room
    if (planRoom?.name && room.roomNumber && normalizeRoomKey(room.roomNumber) === normalizeRoomKey(planRoom.name)) {
      return room
    }
  }

  return null
}

export function buildCloseOutFloorPlanEntries(
  session: SurveySession | null | undefined,
  schoolClass?: string | null,
): Record<string, CloseOutRoomFloorPlanEntry> {
  if (!session) return {}
  const map: Record<string, CloseOutRoomFloorPlanEntry> = {}
  for (const room of Object.values(session.rooms)) {
    const entry = computeCloseOutRoomFloorPlanEntry(room, schoolClass)
    if (entry) map[room.roomId] = entry
  }
  return map
}
