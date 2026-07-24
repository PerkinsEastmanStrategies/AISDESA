import type { ParsedPlanRoom, RoomQuestionResponse, RoomSurveySession, SurveySession } from "@aisd/shared"
import {
  getRoomSurveyRubric,
  isElementaryGrade,
  isSecondaryGrade,
  studioTypeRequiresGrade,
} from "@aisd/shared"
import { validateRoomSession } from "@/lib/survey-validation"

export const TRADITIONAL_STUDIO_COPY_REVIEW_TITLE = "Review copied responses"
export const TRADITIONAL_STUDIO_COPY_OFFER_INTRO =
  "Another Traditional studio in this neighborhood has already been assessed. You can copy those responses as a starting point, then verify and edit anything that differs."
export const TRADITIONAL_STUDIO_COPY_REVIEW_INTRO =
  "Responses from another Traditional studio in this neighborhood were loaded into this room. Classrooms in the same neighborhood are often similar, but you must verify each answer and update anything that differs before continuing."

export const TRADITIONAL_STUDIO_COPY_DIFFERENCES = [
  "Size and layout",
  "Windows and natural daylight",
  "Overall condition",
  "Furniture and built-in features",
  "Other distinguishing classroom characteristics",
] as const

export function normalizeNeighborhood(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? ""
}

export function resolveRoomNeighborhoodForCopy(
  allRooms: ParsedPlanRoom[],
  roomId: string,
  roomSession: RoomSurveySession,
): string {
  const fromSession = normalizeNeighborhood(roomSession.neighborhood)
  if (fromSession) return fromSession
  const fromPlan = normalizeNeighborhood(allRooms.find((r) => r.id === roomId)?.neighborhood)
  return fromPlan
}

export function roomHasAssessedTraditionalStudioResponses(room: RoomSurveySession): boolean {
  return room.roomType === "Traditional studio" && room.responses.length > 0
}

function sourceRoomNeighborhood(
  allRooms: ParsedPlanRoom[],
  room: RoomSurveySession,
): string {
  return resolveRoomNeighborhoodForCopy(allRooms, room.roomId, room)
}

export function findTraditionalStudioCopySource(params: {
  session: SurveySession
  allRooms: ParsedPlanRoom[]
  targetRoomId: string
  targetNeighborhood: string
  schoolClass?: string | null
}): RoomSurveySession | null {
  const normalizedTarget = normalizeNeighborhood(params.targetNeighborhood)
  if (!normalizedTarget) return null

  const candidates = Object.values(params.session.rooms).filter((room) => {
    if (room.roomId === params.targetRoomId) return false
    if (room.roomType !== "Traditional studio") return false
    if (!roomHasAssessedTraditionalStudioResponses(room)) return false
    return sourceRoomNeighborhood(params.allRooms, room) === normalizedTarget
  })

  if (candidates.length === 0) return null

  return candidates.sort((a, b) => {
    const rubricA = getRoomSurveyRubric("studios", a.roomType, a.gradeType, params.schoolClass)
    const rubricB = getRoomSurveyRubric("studios", b.roomType, b.gradeType, params.schoolClass)
    const completeA =
      rubricA &&
      validateRoomSession(a.roomId, a.roomId, a, rubricA.questions, {
        schoolClass: params.schoolClass,
      }).complete
    const completeB =
      rubricB &&
      validateRoomSession(b.roomId, b.roomId, b, rubricB.questions, {
        schoolClass: params.schoolClass,
      }).complete
    if (completeA !== completeB) return completeA ? -1 : 1
    return b.responses.length - a.responses.length
  })[0]
}

export function canApplyTraditionalStudioCopy(params: {
  surveyType: string
  schoolClass?: string | null
  session: SurveySession | null | undefined
  allRooms: ParsedPlanRoom[]
  roomId: string
  room: RoomSurveySession
}): boolean {
  if (params.surveyType !== "studios") return false
  if (params.room.roomType !== "Traditional studio") return false
  if (params.room.responses.length > 0) return false
  if (params.room.traditionalStudioCopiedFromRoomId) return false
  if (!params.session) return false

  if (studioTypeRequiresGrade(params.room.roomType, params.schoolClass) && !params.room.gradeType) {
    return false
  }

  const neighborhood = resolveRoomNeighborhoodForCopy(params.allRooms, params.roomId, params.room)
  if (!neighborhood) return false

  return (
    findTraditionalStudioCopySource({
      session: params.session,
      allRooms: params.allRooms,
      targetRoomId: params.roomId,
      targetNeighborhood: neighborhood,
      schoolClass: params.schoolClass,
    }) !== null
  )
}

export function getTraditionalStudioCopyOffer(params: {
  surveyType: string
  schoolClass?: string | null
  session: SurveySession | null | undefined
  allRooms: ParsedPlanRoom[]
  roomId: string
  room: RoomSurveySession
}): { sourceRoomId: string; neighborhood: string } | null {
  if (!canApplyTraditionalStudioCopy(params)) return null

  const neighborhood = resolveRoomNeighborhoodForCopy(params.allRooms, params.roomId, params.room)
  const source = findTraditionalStudioCopySource({
    session: params.session!,
    allRooms: params.allRooms,
    targetRoomId: params.roomId,
    targetNeighborhood: neighborhood,
    schoolClass: params.schoolClass,
  })
  if (!source) return null

  return {
    sourceRoomId: source.roomId,
    neighborhood,
  }
}

export function cloneTraditionalStudioResponses(
  source: RoomSurveySession,
  targetGrade: RoomSurveySession["gradeType"],
): RoomQuestionResponse[] {
  return source.responses
    .map((response) => ({
      questionId: response.questionId,
      value: Array.isArray(response.value) ? [...response.value] : response.value,
      ...(response.comment ? { comment: response.comment } : {}),
      ...(response.photo ? { photo: response.photo } : {}),
    }))
    .filter((response) => {
      if (response.questionId === "ST-009-ES") return isElementaryGrade(targetGrade)
      if (response.questionId === "ST-009-MSHS" || response.questionId === "ST-009-MS-HS") {
        return isSecondaryGrade(targetGrade)
      }
      return true
    })
}

export function applyTraditionalStudioCopyToRoom(params: {
  schoolClass?: string | null
  session: SurveySession
  allRooms: ParsedPlanRoom[]
  roomId: string
  room: RoomSurveySession
}): RoomSurveySession | null {
  if (
    !canApplyTraditionalStudioCopy({
      surveyType: "studios",
      schoolClass: params.schoolClass,
      session: params.session,
      allRooms: params.allRooms,
      roomId: params.roomId,
      room: params.room,
    })
  ) {
    return null
  }

  const neighborhood = resolveRoomNeighborhoodForCopy(params.allRooms, params.roomId, params.room)
  const source = findTraditionalStudioCopySource({
    session: params.session,
    allRooms: params.allRooms,
    targetRoomId: params.roomId,
    targetNeighborhood: neighborhood,
    schoolClass: params.schoolClass,
  })
  if (!source) return null

  const responses = cloneTraditionalStudioResponses(source, params.room.gradeType)
  if (responses.length === 0) return null

  return {
    ...params.room,
    responses,
    traditionalStudioCopiedFromRoomId: source.roomId,
    traditionalStudioCopyReviewPending: true,
  }
}
