import type { ParsedPlanRoom, RoomSurveySession, SurveySession, SurveyType } from "@aisd/shared"
import { getRoomSurveyRubric, studioTypeRequiresGrade, surveyTypeLabel } from "@aisd/shared"
import {
  effectiveCloseOutPendingQuestionIds,
  roomNeedsCloseOut,
} from "@/lib/closeout"
import { isSkippedDependentQuestion } from "@/lib/question-dependencies"

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

  const remainingIds = effectiveCloseOutPendingQuestionIds(room, schoolClass)
  const remaining =
    remainingIds.length + (room.pendingGrade && !room.gradeType ? 1 : 0)

  if (!roomNeedsCloseOut(room, schoolClass) || remaining === 0) {
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

  // Pending IDs are already pruned to unanswered items, and Close Out only keeps
  // responses for deferred questions — so counting "answered among remaining" is
  // always ~0%. Compare remaining deferred work to the required, applicable rubric
  // (same basis as source-survey deferral validation).
  const rubric =
    (sourceSurveyType
      ? getRoomSurveyRubric(
          "closeout",
          room.roomType,
          room.gradeType,
          schoolClass,
          sourceSurveyType,
        )
      : null) ??
    (sourceSurveyType
      ? getRoomSurveyRubric(sourceSurveyType, room.roomType, room.gradeType, schoolClass)
      : null)

  const rubricQuestions = rubric?.questions ?? []
  const applicableRequired = rubricQuestions.filter(
    (question) =>
      question.required &&
      !isSkippedDependentQuestion(question.questionId, room.responses, rubricQuestions),
  )
  const applicableIds = new Set(applicableRequired.map((question) => question.questionId))
  const remainingInRubric = remainingIds.filter((id) => applicableIds.has(id)).length
  const gradeRemaining = room.pendingGrade && !room.gradeType ? 1 : 0
  const remainingWork = remainingInRubric + gradeRemaining

  let total = applicableRequired.length
  if (studioTypeRequiresGrade(room.roomType, schoolClass) || room.pendingGrade) {
    total += 1
  }
  total = Math.max(total, remainingWork)

  const answered = Math.max(0, total - remainingWork)
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

/** Look up Close Out overlay progress for a floor-plan room id (including aliases). */
export function closeOutEntryForPlanRoom(
  entries: Record<string, CloseOutRoomFloorPlanEntry> | undefined,
  session: SurveySession | null | undefined,
  planRoomId: string,
  allRooms?: ParsedPlanRoom[],
): CloseOutRoomFloorPlanEntry | undefined {
  if (!entries) return undefined
  if (entries[planRoomId]) return entries[planRoomId]
  const room = resolveCloseOutSessionRoom(session, planRoomId, allRooms)
  return room ? entries[room.roomId] : undefined
}
