import type { AssessorInfo, ParsedPlanRoom, SurveySession, SurveyType } from "@aisd/shared"
import {
  getRoomSurveyRubric,
  getSurveyRubric,
  isAbsentSpaceTypeRoomId,
  isOutdoorSurveyRoomId,
  isSpaceTypeForSurveyModule,
  isSpaceTypeMarkedAbsentAtSchool,
  isStudioType,
  isSpaceTypeRoomsComplete,
  OUTDOOR_SURVEY_ROOM_ID,
  outdoorSurveyRoomDisplayName,
  spaceTypesForSurveyModule,
  type RoomSurveySession,
} from "@aisd/shared"
import { assessorFromSession, isAssessorRegistered } from "@/lib/assessor"
import {
  closeOutSessionHasWork,
  isCloseOutSurveyComplete,
} from "@/lib/closeout"
import { isRoomSurveyFilledOut } from "@/lib/room-survey-progress"
import { loadDraft, type AssessorBySurveyType } from "@/lib/survey-persistence"
import { validateRoomSession } from "@/lib/survey-validation"

export type SurveyTypeStatus = "not_started" | "in_progress" | "complete"

export interface SurveyTypeInfo {
  status: SurveyTypeStatus
  assessor: AssessorInfo | null
}

function sessionHasProgress(session: SurveySession): boolean {
  if (
    session.spaceTypeExistsAtSchool &&
    Object.values(session.spaceTypeExistsAtSchool).some((exists) => exists === false)
  ) {
    return true
  }
  return Object.values(session.rooms).some(
    (room) =>
      room.spaceTypeMarkedAbsent ||
      room.responses.length > 0 ||
      !!room.gradeType ||
      (room.pendingQuestionIds?.length ?? 0) > 0 ||
      !!room.pendingGrade ||
      !!room.deferredToCloseOut,
  )
}

function attachPlanNeighborhood(
  room: RoomSurveySession,
  planRooms?: ParsedPlanRoom[],
): RoomSurveySession {
  if (room.neighborhood?.trim()) return room
  const fromPlan = planRooms?.find((planRoom) => planRoom.id === room.roomId)?.neighborhood?.trim()
  if (!fromPlan) return room
  return { ...room, neighborhood: fromPlan }
}

function roomsMatchingSpaceType(
  session: SurveySession,
  surveyType: SurveyType,
  spaceType: string,
  schoolClass?: string | null,
  planRooms?: ParsedPlanRoom[],
): RoomSurveySession[] {
  return Object.values(session.rooms)
    .filter(
      (room) =>
        room.roomType === spaceType &&
        isSpaceTypeForSurveyModule(surveyType, room.roomType, schoolClass),
    )
    .map((room) => attachPlanNeighborhood(room, planRooms))
}

function isRequiredSpaceTypeSatisfied(
  session: SurveySession,
  surveyType: SurveyType,
  spaceType: string,
  schoolClass?: string | null,
  planRooms?: ParsedPlanRoom[],
): boolean {
  if (isSpaceTypeMarkedAbsentAtSchool(session, spaceType)) return true
  const ofType = roomsMatchingSpaceType(session, surveyType, spaceType, schoolClass, planRooms)
  if (ofType.some((room) => room.spaceTypeMarkedAbsent || isAbsentSpaceTypeRoomId(room.roomId))) {
    return true
  }
  return isSpaceTypeRoomsComplete(spaceType, ofType, schoolClass, (room) =>
    isRoomSurveyFilledOut(room, surveyType, schoolClass),
  )
}

/**
 * Studios survey is complete when every required space type is satisfied:
 * - Non-traditional types: at least one filled-out room survey each.
 * - Traditional studio: at least two filled-out room surveys per identified neighborhood.
 */
export function isStudiosSurveyComplete(
  session: SurveySession | null | undefined,
  schoolClass?: string | null,
  planRooms?: ParsedPlanRoom[],
): boolean {
  if (!session) return false

  const requiredTypes = spaceTypesForSurveyModule("studios", schoolClass)
    .filter((entry) => entry.required)
    .map((entry) => entry.spaceType)

  for (const studioType of requiredTypes) {
    if (!isRequiredSpaceTypeSatisfied(session, "studios", studioType, schoolClass, planRooms)) {
      return false
    }
  }

  return true
}

/** True when every required space type meets its guidance-based room count. */
export function isSpaceTypeSurveyComplete(
  surveyType: SurveyType,
  session: SurveySession | null | undefined,
  schoolClass?: string | null,
  planRooms?: ParsedPlanRoom[],
): boolean {
  if (!session) return false

  const requiredTypes = spaceTypesForSurveyModule(surveyType, schoolClass)
    .filter((entry) => entry.required)
    .map((entry) => entry.spaceType)

  for (const spaceType of requiredTypes) {
    if (!isRequiredSpaceTypeSatisfied(session, surveyType, spaceType, schoolClass, planRooms)) {
      return false
    }
  }
  return true
}

/** Administration is complete when each required space type has at least one filled-out room survey. */
export function isAdministrationSurveyComplete(
  session: SurveySession | null | undefined,
  schoolClass?: string | null,
): boolean {
  return isSpaceTypeSurveyComplete("administration", session, schoolClass)
}

/** Arrival is complete when each required space type has at least one filled-out room survey. */
export function isArrivalSurveyComplete(
  session: SurveySession | null | undefined,
  schoolClass?: string | null,
): boolean {
  return isSpaceTypeSurveyComplete("arrival", session, schoolClass)
}

/** Neighborhoods is complete when each required space type has at least one filled-out room survey. */
export function isNeighborhoodsSurveyComplete(
  session: SurveySession | null | undefined,
  schoolClass?: string | null,
): boolean {
  return isSpaceTypeSurveyComplete("neighborhoods", session, schoolClass)
}

/** Outdoor is complete when every required outdoor space type is filled out. */
export function isOutdoorSurveyComplete(
  session: SurveySession | null | undefined,
  schoolClass?: string | null,
  planRooms?: ParsedPlanRoom[],
): boolean {
  if (!session) return false
  return isSpaceTypeSurveyComplete("outdoor", session, schoolClass, planRooms)
}

function isSurveyModuleComplete(
  surveyType: SurveyType,
  session: SurveySession,
  schoolClass?: string | null,
  planRooms?: ParsedPlanRoom[],
): boolean {
  if (surveyType === "studios") return isStudiosSurveyComplete(session, schoolClass, planRooms)
  if (surveyType === "outdoor") return isOutdoorSurveyComplete(session, schoolClass, planRooms)
  if (surveyType === "closeout") return isCloseOutSurveyComplete(session)
  return isSpaceTypeSurveyComplete(surveyType, session, schoolClass, planRooms)
}

/** True when every classroom room for the school has a fully complete survey session. */
export function areAllRoomsSurveyed(
  session: SurveySession | null | undefined,
  classroomRooms: ParsedPlanRoom[],
  surveyType: SurveyType,
  schoolClass?: string | null,
): boolean {
  if (!session) return false

  if (
    surveyType === "studios" ||
    surveyType === "administration" ||
    surveyType === "arrival" ||
    surveyType === "neighborhoods" ||
    surveyType === "outdoor" ||
    surveyType === "athletics" ||
    surveyType === "shared_spaces" ||
    surveyType === "cte" ||
    surveyType === "performing_arts"
  ) {
    return isSurveyModuleComplete(surveyType, session, schoolClass, classroomRooms)
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
      getRoomSurveyRubric(surveyType, roomSession.roomType, roomSession.gradeType, schoolClass) ??
      rubric
    const result = validateRoomSession(room.id, room.name, roomSession, roomRubric.questions, {
      schoolClass,
    })
    if (!result.complete) return false
  }
  return true
}

function surveyTypeHasDedicatedCompletion(surveyType: SurveyType): boolean {
  return (
    surveyType === "studios" ||
    surveyType === "administration" ||
    surveyType === "arrival" ||
    surveyType === "neighborhoods" ||
    surveyType === "outdoor" ||
    surveyType === "athletics" ||
    surveyType === "shared_spaces" ||
    surveyType === "cte" ||
    surveyType === "performing_arts" ||
    surveyType === "closeout"
  )
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
    /** Floor-plan rooms used to resolve neighborhood when the session omitted it */
    planRooms?: ParsedPlanRoom[]
    /** Live in-memory session when this survey type is currently active */
    liveSession?: SurveySession | null
    schoolClass?: string | null
  },
): SurveyTypeInfo {
  const registeredAssessor = isAssessorRegistered(assessors[surveyType])
    ? (assessors[surveyType] ?? null)
    : surveyType === "closeout" && isAssessorRegistered(assessors.studios)
      ? (assessors.studios ?? null)
      : null
  const classroomRooms = options?.classroomRooms ?? []
  const planRooms = options?.planRooms ?? classroomRooms
  const schoolClass = options?.schoolClass

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
    if (session.campusSubmittedAt || draft?.lastSubmission?.session.campusSubmittedAt) {
      return { status: "complete", assessor }
    }
    if (closeOutSessionHasWork(session) || !!session.finalComment?.trim() || draft?.lastSubmission) {
      return { status: "in_progress", assessor }
    }
    if (isCloseOutSurveyComplete(session) && Object.keys(session.rooms).length > 0) {
      return { status: "in_progress", assessor }
    }
    return { status: "not_started", assessor }
  }

  if (surveyTypeHasDedicatedCompletion(surveyType)) {
    if (isSurveyModuleComplete(surveyType, session, schoolClass, planRooms)) {
      return { status: "complete", assessor }
    }
    const hasProgress = sessionHasProgress(session) || !!draft?.lastSubmission
    if (hasProgress) {
      return { status: "in_progress", assessor }
    }
    return { status: "not_started", assessor }
  }

  if (areAllRoomsSurveyed(session, classroomRooms, surveyType, schoolClass)) {
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

export { isStudioType, outdoorSurveyRoomDisplayName, OUTDOOR_SURVEY_ROOM_ID, isOutdoorSurveyRoomId }
