import type { RoomSurveySession, SurveyType } from "@aisd/shared"
import {
  getRoomSurveyRubric,
  isRoomComplete,
  type RoomScoreResult,
} from "@aisd/shared"
import { roomNeedsCloseOut } from "@/lib/closeout"
import { validateRoomSession } from "@/lib/survey-validation"

export type RoomSurveyProgress = "idle" | "in_progress" | "complete"

export const ROOM_PROGRESS_FILL: Record<"in_progress" | "complete", string> = {
  in_progress: "#eab308",
  complete: "#22c55e",
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
    scoreDetail?: RoomScoreResult | null
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

  const fullyScored = !!(
    options.scoreDetail &&
    isRoomComplete(
      options.scoreDetail,
      room.gradeType,
      room.roomType,
      options.schoolClass,
    )
  )
  const rubric = getRoomSurveyRubric(
    options.surveyType,
    room.roomType,
    room.gradeType,
    options.schoolClass,
  )
  const submitReady =
    !!rubric &&
    validateRoomSession(room.roomId, room.roomId, room, rubric.questions, {
      forSubmit: true,
      schoolClass: options.schoolClass,
    }).complete

  if (fullyScored || submitReady) return "complete"
  return "in_progress"
}
