import type { AssessorInfo, ParsedPlanRoom, SurveySession, SurveyType } from "@aisd/shared"
import {
  ADMIN_SPACE_TYPE_OPTIONS,
  ARRIVAL_SPACE_TYPE_OPTIONS,
  getRoomSurveyRubric,
  getSurveyRubric,
  isAdminSpaceType,
  isArrivalSpaceType,
  isNeighborhoodSpaceType,
  isStudioType,
  NEIGHBORHOOD_SPACE_TYPE_OPTIONS,
  STUDIO_TYPE_OPTIONS,
  type RoomSurveySession,
} from "@aisd/shared"
import { assessorFromSession, isAssessorRegistered } from "@/lib/assessor"
import {
  closeOutSessionHasWork,
  isCloseOutSurveyComplete,
} from "@/lib/closeout"
import { loadDraft, type AssessorBySurveyType } from "@/lib/survey-persistence"
import { validateRoomSession } from "@/lib/survey-validation"

export type SurveyTypeStatus = "not_started" | "in_progress" | "complete"

export interface SurveyTypeInfo {
  status: SurveyTypeStatus
  assessor: AssessorInfo | null
}

function sessionHasProgress(session: SurveySession): boolean {
  return Object.values(session.rooms).some(
    (room) =>
      room.responses.length > 0 ||
      !!room.gradeType ||
      (room.pendingQuestionIds?.length ?? 0) > 0 ||
      !!room.pendingGrade,
  )
}

function isRoomSurveyFilledOut(room: RoomSurveySession, surveyType: SurveyType): boolean {
  const rubric = getRoomSurveyRubric(surveyType, room.roomType, room.gradeType)
  if (!rubric) return false
  return validateRoomSession(room.roomId, room.roomId, room, rubric.questions).complete
}

/**
 * Studios survey is complete when:
 * - every non-traditional studio type has at least one filled-out room survey, and
 * - Traditional studio has at least two filled-out room surveys for each identified
 *   neighborhood (any neighborhood letter assigned on a Traditional room).
 */
export function isStudiosSurveyComplete(session: SurveySession | null | undefined): boolean {
  if (!session) return false

  const rooms = Object.values(session.rooms).filter((room) => isStudioType(room.roomType))

  for (const studioType of STUDIO_TYPE_OPTIONS) {
    const ofType = rooms.filter((room) => room.roomType === studioType)
    const filled = ofType.filter((room) => isRoomSurveyFilledOut(room, "studios"))

    if (studioType === "Traditional studio") {
      const identified = new Set(
        ofType
          .map((room) => room.neighborhood?.trim())
          .filter((n): n is string => !!n),
      )
      if (identified.size === 0) return false

      for (const neighborhood of identified) {
        const count = filled.filter((room) => room.neighborhood?.trim() === neighborhood).length
        if (count < 2) return false
      }
      continue
    }

    if (filled.length < 1) return false
  }

  return true
}

/** Administration is complete when each space type has at least one filled-out room survey. */
export function isAdministrationSurveyComplete(session: SurveySession | null | undefined): boolean {
  if (!session) return false

  const rooms = Object.values(session.rooms).filter((room) => isAdminSpaceType(room.roomType))
  for (const spaceType of ADMIN_SPACE_TYPE_OPTIONS) {
    const filled = rooms.filter(
      (room) => room.roomType === spaceType && isRoomSurveyFilledOut(room, "administration"),
    )
    if (filled.length < 1) return false
  }
  return true
}

/** Arrival is complete when each space type has at least one filled-out room survey. */
export function isArrivalSurveyComplete(session: SurveySession | null | undefined): boolean {
  if (!session) return false

  const rooms = Object.values(session.rooms).filter((room) => isArrivalSpaceType(room.roomType))
  for (const spaceType of ARRIVAL_SPACE_TYPE_OPTIONS) {
    const filled = rooms.filter(
      (room) => room.roomType === spaceType && isRoomSurveyFilledOut(room, "arrival"),
    )
    if (filled.length < 1) return false
  }
  return true
}

/** Neighborhoods is complete when each space type has at least one filled-out room survey. */
export function isNeighborhoodsSurveyComplete(session: SurveySession | null | undefined): boolean {
  if (!session) return false

  const rooms = Object.values(session.rooms).filter((room) =>
    isNeighborhoodSpaceType(room.roomType),
  )
  for (const spaceType of NEIGHBORHOOD_SPACE_TYPE_OPTIONS) {
    const filled = rooms.filter(
      (room) => room.roomType === spaceType && isRoomSurveyFilledOut(room, "neighborhoods"),
    )
    if (filled.length < 1) return false
  }
  return true
}

/** True when every classroom room for the school has a fully complete survey session. */
export function areAllRoomsSurveyed(
  session: SurveySession | null | undefined,
  classroomRooms: ParsedPlanRoom[],
  surveyType: SurveyType,
): boolean {
  if (!session) return false

  if (surveyType === "studios") {
    return isStudiosSurveyComplete(session)
  }

  if (surveyType === "administration") {
    return isAdministrationSurveyComplete(session)
  }

  if (surveyType === "arrival") {
    return isArrivalSurveyComplete(session)
  }

  if (surveyType === "neighborhoods") {
    return isNeighborhoodsSurveyComplete(session)
  }

  if (classroomRooms.length === 0) return false
  const rubric = getSurveyRubric(surveyType)
  if (!rubric) return false

  if (surveyType === "closeout") {
    return isCloseOutSurveyComplete(session)
  }

  for (const room of classroomRooms) {
    const roomSession = session.rooms[room.id]
    if (!roomSession) return false
    const roomRubric =
      getRoomSurveyRubric(surveyType, roomSession.roomType, roomSession.gradeType) ?? rubric
    const result = validateRoomSession(room.id, room.name, roomSession, roomRubric.questions)
    if (!result.complete) return false
  }
  return true
}

/**
 * Sidebar status is always scoped to the selected school.
 * Signing in as an assessor alone does not mark a survey in progress.
 */
export function getSurveyTypeInfo(
  surveyType: SurveyType,
  schoolId: string | null,
  assessors: AssessorBySurveyType,
  options?: {
    classroomRooms?: ParsedPlanRoom[]
    /** Live in-memory session when this survey type is currently active */
    liveSession?: SurveySession | null
  },
): SurveyTypeInfo {
  const registeredAssessor = isAssessorRegistered(assessors[surveyType])
    ? (assessors[surveyType] ?? null)
    : surveyType === "closeout" && isAssessorRegistered(assessors.studios)
      ? (assessors.studios ?? null)
      : null
  const classroomRooms = options?.classroomRooms ?? []

  if (!schoolId) {
    return { status: "not_started", assessor: registeredAssessor }
  }

  const draft = loadDraft(schoolId, surveyType)
  const liveSession = options?.liveSession
  const liveMatchesSchool = !!(liveSession && liveSession.schoolId === schoolId)
  const session = (liveMatchesSchool ? liveSession : null) ?? draft?.session ?? null

  const sessionAssessor = session ? assessorFromSession(session) : null
  const assessor =
    (sessionAssessor && isAssessorRegistered(sessionAssessor) ? sessionAssessor : null) ??
    registeredAssessor

  if (!session) {
    return { status: "not_started", assessor }
  }

  if (surveyType === "closeout") {
    if (!closeOutSessionHasWork(session) && !draft?.lastSubmission) {
      return { status: "not_started", assessor }
    }
    if (isCloseOutSurveyComplete(session) || (draft?.lastSubmission && !closeOutSessionHasWork(session))) {
      return { status: "complete", assessor }
    }
    return { status: "in_progress", assessor }
  }

  if (surveyType === "studios") {
    if (isStudiosSurveyComplete(session)) {
      return { status: "complete", assessor }
    }
    const hasProgress = sessionHasProgress(session) || !!draft?.lastSubmission
    if (hasProgress) {
      return { status: "in_progress", assessor }
    }
    return { status: "not_started", assessor }
  }

  if (surveyType === "administration") {
    if (isAdministrationSurveyComplete(session)) {
      return { status: "complete", assessor }
    }
    const hasProgress = sessionHasProgress(session) || !!draft?.lastSubmission
    if (hasProgress) {
      return { status: "in_progress", assessor }
    }
    return { status: "not_started", assessor }
  }

  if (surveyType === "arrival") {
    if (isArrivalSurveyComplete(session)) {
      return { status: "complete", assessor }
    }
    const hasProgress = sessionHasProgress(session) || !!draft?.lastSubmission
    if (hasProgress) {
      return { status: "in_progress", assessor }
    }
    return { status: "not_started", assessor }
  }

  if (surveyType === "neighborhoods") {
    if (isNeighborhoodsSurveyComplete(session)) {
      return { status: "complete", assessor }
    }
    const hasProgress = sessionHasProgress(session) || !!draft?.lastSubmission
    if (hasProgress) {
      return { status: "in_progress", assessor }
    }
    return { status: "not_started", assessor }
  }

  if (areAllRoomsSurveyed(session, classroomRooms, surveyType)) {
    return { status: "complete", assessor }
  }

  const hasProgress = sessionHasProgress(session) || !!draft?.lastSubmission
  if (hasProgress) {
    return { status: "in_progress", assessor }
  }

  return { status: "not_started", assessor }
}

export function surveyStatusLabel(status: SurveyTypeStatus): string {
  switch (status) {
    case "not_started":
      return "Not started"
    case "in_progress":
      return "In progress"
    case "complete":
      return "Complete"
  }
}
