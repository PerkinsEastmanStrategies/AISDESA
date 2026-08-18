import type { RoomSurveySession, SurveyType } from "@aisd/shared"
import { getRoomSurveyRubric, isAbsentSpaceTypeRoomId } from "@aisd/shared"
import { roomNeedsCloseOut } from "@/lib/closeout"
import { validateRoomSession } from "@/lib/survey-validation"

export type RoomSurveyProgress = "idle" | "in_progress" | "complete"

export const ROOM_PROGRESS_FILL: Record<"in_progress" | "complete", string> = {
  in_progress: "#eab308",
  complete: "#22c55e",
}

/**
 * True when the room's answers meet Save/submit rules (required questions, Close Out deferrals).
 * Scoring counts (`answeredCount >= totalCount`) are not used — multi-select score units can
 * leave those short after the survey itself is finished.
 */
export function isRoomSurveyFilledOut(
  room: RoomSurveySession,
  surveyType: SurveyType,
  schoolClass?: string | null,
): boolean {
  if (room.spaceTypeMarkedAbsent || isAbsentSpaceTypeRoomId(room.roomId)) return true
  const rubric = getRoomSurveyRubric(
    surveyType,
    room.roomType,
    room.gradeType,
    schoolClass,
    surveyType === "closeout" ? room.sourceSurveyType : undefined,
  )
  if (!rubric) return false
  return validateRoomSession(room.roomId, room.roomId, room, rubric.questions, {
    schoolClass,
    forSubmit: true,
  }).complete
}

/**
 * Floor-plan shading status for a room's current survey session.
 * idle = not started; in_progress = started but incomplete; complete = fully answered.
 */
export function getRoomSurveyProgress(
  room: RoomSurveySession | undefined,
  options: {
    surveyType: SurveyType
    schoolClass?: string | null
  },
): RoomSurveyProgress {
  if (!room) return "idle"

  if (options.surveyType === "closeout") {
    if (!roomNeedsCloseOut(room) && (room.responses.length > 0 || !!room.gradeType)) {
      return "complete"
    }
    if (roomNeedsCloseOut(room)) return "in_progress"
    return "idle"
  }

  const started =
    room.responses.length > 0 || !!room.gradeType || !!room.deferredToCloseOut
  if (!started) return "idle"

  if (isRoomSurveyFilledOut(room, options.surveyType, options.schoolClass)) return "complete"
  return "in_progress"
}
