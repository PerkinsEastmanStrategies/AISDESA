import type {
  EsaQuestion,
  ParsedPlanRoom,
  RoomQuestionResponse,
  RoomSurveySession,
  SurveySession,
  SurveyType,
} from "@aisd/shared"
import {
  getRoomSurveyRubric,
  hasRequiredUnableToAssessNote,
  isMultiSelectQuestionType,
  isOutdoorSurveyRoomId,
  outdoorSurveyRoomDisplayName,
  responseRequiresUnableToAssessNote,
  studioTypeRequiresGrade,
} from "@aisd/shared"
import { isSkippedDependentQuestion } from "@/lib/question-dependencies"

export function isQuestionAnswered(
  question: EsaQuestion,
  value: string | string[] | undefined,
): boolean {
  if (value === undefined || value === "") return false
  if (isMultiSelectQuestionType(question.questionType)) {
    return Array.isArray(value) && value.length > 0
  }
  return typeof value === "string" && value.length > 0
}

/** Answered, including a required note when Not/Unable to assess is selected. */
export function isQuestionFullyAnswered(
  question: EsaQuestion,
  response: Pick<RoomQuestionResponse, "value" | "comment"> | null | undefined,
): boolean {
  if (!isQuestionAnswered(question, response?.value)) return false
  return hasRequiredUnableToAssessNote(response)
}

export { responseRequiresUnableToAssessNote }

export interface RoomValidationResult {
  roomId: string
  roomName: string
  complete: boolean
  missingGrade: boolean
  missingQuestionIds: string[]
  missingQuestions: { questionId: string; index: number; label: string }[]
}

export interface SubmitValidationResult {
  valid: boolean
  rooms: RoomValidationResult[]
  firstIncompleteRoomId: string | null
  firstMissingQuestionId: string | null
}

export function validateRoomSession(
  roomId: string,
  roomName: string,
  roomSession: RoomSurveySession,
  questions: EsaQuestion[],
  options?: { forSubmit?: boolean; schoolClass?: string | null },
): RoomValidationResult {
  const forSubmit = options?.forSubmit === true
  const schoolClass = options?.schoolClass

  if (roomSession.sourceSurveyType && (roomSession.pendingQuestionIds || roomSession.pendingGrade)) {
    // Close Out room: only pending items matter
    const pending = new Set(roomSession.pendingQuestionIds ?? [])
    const missingQuestions: RoomValidationResult["missingQuestions"] = []
    const missingQuestionIds: string[] = []
    const responseMap = new Map(roomSession.responses.map((r) => [r.questionId, r]))

    questions.forEach((q, index) => {
      if (!pending.has(q.questionId)) return
      if (isSkippedDependentQuestion(q.questionId, roomSession.responses, questions)) return
      const response = responseMap.get(q.questionId)
      if (!isQuestionFullyAnswered(q, response)) {
        missingQuestionIds.push(q.questionId)
        missingQuestions.push({
          questionId: q.questionId,
          index: index + 1,
          label: q.question,
        })
      }
    })

    const missingGrade =
      studioTypeRequiresGrade(roomSession.roomType, schoolClass) &&
      !!roomSession.pendingGrade &&
      !roomSession.gradeType
    return {
      roomId,
      roomName,
      complete: !missingGrade && missingQuestions.length === 0,
      missingGrade,
      missingQuestionIds,
      missingQuestions,
    }
  }

  // Grade only for Traditional at elementary; deferred rooms can finish it in Close Out.
  const missingGrade =
    studioTypeRequiresGrade(roomSession.roomType, schoolClass) &&
    !roomSession.gradeType &&
    !(forSubmit && roomSession.deferredToCloseOut)
  const missingQuestions: RoomValidationResult["missingQuestions"] = []
  const missingQuestionIds: string[] = []
  const deferred = forSubmit ? new Set(roomSession.deferredQuestionIds ?? []) : new Set<string>()

  const responseMap = new Map(roomSession.responses.map((r) => [r.questionId, r]))

  questions.forEach((q, index) => {
    if (!q.required) return
    if (isSkippedDependentQuestion(q.questionId, roomSession.responses, questions)) return
    if (deferred.has(q.questionId)) return

    const response = responseMap.get(q.questionId)
    if (!isQuestionFullyAnswered(q, response)) {
      missingQuestionIds.push(q.questionId)
      missingQuestions.push({
        questionId: q.questionId,
        index: index + 1,
        label: q.question,
      })
    }
  })

  return {
    roomId,
    roomName,
    complete: !missingGrade && missingQuestions.length === 0,
    missingGrade,
    missingQuestionIds,
    missingQuestions,
  }
}

export function validateSurveySubmission(
  session: SurveySession,
  allRooms: ParsedPlanRoom[],
  surveyType: SurveyType,
  schoolClass?: string | null,
): SubmitValidationResult {
  const incompleteRooms: RoomValidationResult[] = []

  for (const [roomId, roomSession] of Object.entries(session.rooms)) {
    const rubric = getRoomSurveyRubric(
      surveyType,
      roomSession.roomType,
      roomSession.gradeType,
      schoolClass,
      surveyType === "closeout" ? roomSession.sourceSurveyType : undefined,
    )
    if (!rubric) continue

    if (surveyType === "closeout") {
      const hasPending =
        (roomSession.pendingQuestionIds?.length ?? 0) > 0 || !!roomSession.pendingGrade
      if (!hasPending) continue
    } else {
      const started = roomSession.responses.length > 0 || !!roomSession.gradeType
      if (!started) continue
    }

    const parsed = allRooms.find((r) => r.id === roomId)
    const roomName = isOutdoorSurveyRoomId(roomId)
      ? outdoorSurveyRoomDisplayName()
      : (parsed?.name ?? roomId)
    const result = validateRoomSession(
      roomId,
      roomName,
      roomSession,
      rubric.questions,
      { forSubmit: true, schoolClass },
    )
    if (!result.complete) incompleteRooms.push(result)
  }

  const first = incompleteRooms[0]
  return {
    valid: incompleteRooms.length === 0,
    rooms: incompleteRooms,
    firstIncompleteRoomId: first?.roomId ?? null,
    firstMissingQuestionId: first?.missingQuestionIds[0] ?? null,
  }
}

/** Fresh incompleteness before any deferral (used by the confirm dialog). */
export function validateSurveyBeforeDeferral(
  session: SurveySession,
  allRooms: ParsedPlanRoom[],
  surveyType: SurveyType,
  options?: { roomId?: string | null; schoolClass?: string | null },
): SubmitValidationResult {
  const incompleteRooms: RoomValidationResult[] = []
  const schoolClass = options?.schoolClass
  const roomIds = options?.roomId
    ? [options.roomId]
    : Object.keys(session.rooms)

  for (const roomId of roomIds) {
    const roomSession = session.rooms[roomId]
    if (!roomSession) continue

    const rubric = getRoomSurveyRubric(
      surveyType,
      roomSession.roomType,
      roomSession.gradeType,
      schoolClass,
      surveyType === "closeout" ? roomSession.sourceSurveyType : undefined,
    )
    if (!rubric) continue

    if (surveyType === "closeout") {
      const hasPending =
        (roomSession.pendingQuestionIds?.length ?? 0) > 0 || !!roomSession.pendingGrade
      if (!hasPending) continue
    } else {
      const started = roomSession.responses.length > 0 || !!roomSession.gradeType
      if (!started) continue
    }

    const parsed = allRooms.find((r) => r.id === roomId)
    const roomName = isOutdoorSurveyRoomId(roomId)
      ? outdoorSurveyRoomDisplayName()
      : (parsed?.name ?? roomId)
    // Ignore prior deferred flags so newly unanswered items are listed
    const forCheck: RoomSurveySession = {
      ...roomSession,
      deferredQuestionIds: [],
      deferredToCloseOut: false,
    }
    const result = validateRoomSession(roomId, roomName, forCheck, rubric.questions, {
      schoolClass,
    })
    if (!result.complete) incompleteRooms.push(result)
  }

  const first = incompleteRooms[0]
  return {
    valid: incompleteRooms.length === 0,
    rooms: incompleteRooms,
    firstIncompleteRoomId: first?.roomId ?? null,
    firstMissingQuestionId: first?.missingQuestionIds[0] ?? null,
  }
}

export function formatSubmitValidationSummary(rooms: RoomValidationResult[]): string {
  if (!rooms.length) return ""
  const parts = rooms.map((room) => {
    const items: string[] = []
    if (room.missingGrade) items.push("grade not selected")
    if (room.missingQuestions.length) {
      const nums = room.missingQuestions.map((q) => `#${q.index}`).join(", ")
      items.push(
        `${room.missingQuestions.length} question${room.missingQuestions.length === 1 ? "" : "s"} (${nums})`,
      )
    }
    return `${room.roomName}: ${items.join(" · ")}`
  })
  return parts.join("; ")
}
