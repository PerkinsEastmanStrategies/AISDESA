import type {
  AssessorInfo,
  EsaQuestion,
  ParsedPlanRoom,
  RoomQuestionResponse,
  RoomSurveySession,
  SurveySession,
  SurveyType,
} from "@aisd/shared"
import { getRoomSurveyRubric, studioTypeRequiresGrade, SURVEY_TYPES } from "@aisd/shared"
import { assessorSessionFields } from "@/lib/assessor"
import { isSkippedDependentQuestion } from "@/lib/question-dependencies"
import { isQuestionFullyAnswered, validateRoomSession, type SubmitValidationResult } from "@/lib/survey-validation"

export function countIncompleteItems(validation: SubmitValidationResult): {
  rooms: number
  questions: number
  grades: number
} {
  let questions = 0
  let grades = 0
  for (const room of validation.rooms) {
    questions += room.missingQuestions.length
    if (room.missingGrade) grades += 1
  }
  return { rooms: validation.rooms.length, questions, grades }
}

/** Pending Close Out questions that still need an answer (excludes auto-skipped). */
export function effectiveCloseOutPendingQuestionIds(
  room: RoomSurveySession,
  schoolClass?: string | null,
): string[] {
  const pending = room.pendingQuestionIds ?? []
  if (pending.length === 0) return []

  const rubric = room.sourceSurveyType
    ? getRoomSurveyRubric(
        "closeout",
        room.roomType,
        room.gradeType,
        schoolClass,
        room.sourceSurveyType,
      )
    : null
  // Without a rubric we cannot tell which IDs are answerable — keep the raw list.
  if (!rubric) return [...pending]

  const responseMap = new Map(room.responses.map((response) => [response.questionId, response]))
  return pending.filter((id) => {
    if (isSkippedDependentQuestion(id, room.responses, rubric.questions)) return false
    const question = rubric.questions.find((item) => item.questionId === id)
    // Drop IDs outside the current rubric — they are not shown and cannot be answered.
    if (!question) return false
    return !isQuestionFullyAnswered(question, responseMap.get(id))
  })
}

/** True when this Close Out room still has unanswered, non-skipped work. */
export function roomNeedsCloseOut(
  room: RoomSurveySession,
  schoolClass?: string | null,
): boolean {
  return (
    effectiveCloseOutPendingQuestionIds(room, schoolClass).length > 0 || !!room.pendingGrade
  )
}

/** Drop auto-skipped IDs from the pending list so completed rooms clear out. */
export function pruneCloseOutRoomPending(
  room: RoomSurveySession,
  schoolClass?: string | null,
): RoomSurveySession {
  const pendingQuestionIds = effectiveCloseOutPendingQuestionIds(room, schoolClass)
  const unchanged =
    pendingQuestionIds.length === (room.pendingQuestionIds?.length ?? 0) &&
    pendingQuestionIds.every((id, i) => id === room.pendingQuestionIds![i])
  if (unchanged) {
    return {
      ...room,
      deferredToCloseOut: pendingQuestionIds.length > 0 || !!room.pendingGrade,
    }
  }
  return {
    ...room,
    pendingQuestionIds,
    deferredToCloseOut: pendingQuestionIds.length > 0 || !!room.pendingGrade,
  }
}

function roomHasCloseOutWork(
  room: RoomSurveySession,
  schoolClass?: string | null,
): boolean {
  return roomNeedsCloseOut(room, schoolClass)
}

export function closeOutSessionHasWork(session: SurveySession | null | undefined): boolean {
  if (!session) return false
  return Object.values(session.rooms).some((room) => roomHasCloseOutWork(room))
}

export function isCloseOutSurveyComplete(session: SurveySession | null | undefined): boolean {
  if (!session) return false
  const rooms = Object.values(session.rooms)
  if (rooms.length === 0) return true
  return !rooms.some((room) => roomHasCloseOutWork(room))
}

export function countCloseOutPendingItems(session: SurveySession | null | undefined): {
  rooms: number
  questions: number
  grades: number
} {
  if (!session) return { rooms: 0, questions: 0, grades: 0 }
  let questions = 0
  let grades = 0
  let rooms = 0
  for (const room of Object.values(session.rooms)) {
    if (!roomHasCloseOutWork(room)) continue
    rooms += 1
    questions += effectiveCloseOutPendingQuestionIds(room).length
    if (room.pendingGrade) grades += 1
  }
  return { rooms, questions, grades }
}

/** Merge incomplete items from one source survey session into the Close Out queue. */
function mergeIncompleteFromSourceSurvey(
  sourceSession: SurveySession,
  allRooms: ParsedPlanRoom[],
  closeRooms: Record<string, RoomSurveySession>,
  schoolClass?: string | null,
): Record<string, RoomSurveySession> {
  const surveyType = sourceSession.surveyType
  if (surveyType === "closeout") return closeRooms

  const next = { ...closeRooms }

  for (const [roomId, roomSession] of Object.entries(sourceSession.rooms)) {
    const started = roomSession.responses.length > 0 || !!roomSession.gradeType
    if (!started) continue

    const rubric = getRoomSurveyRubric(
      surveyType,
      roomSession.roomType,
      roomSession.gradeType,
      schoolClass,
    )
    if (!rubric) continue

    const parsed = allRooms.find((r) => r.id === roomId)
    const result = validateRoomSession(
      roomId,
      parsed?.name ?? roomId,
      roomSession,
      rubric.questions,
      { schoolClass },
    )

    if (result.complete) {
      if (next[roomId] && !roomHasCloseOutWork(next[roomId])) {
        delete next[roomId]
      }
      continue
    }

    const missingIds = result.missingQuestionIds
    const pendingGrade = result.missingGrade
    const existingClose = next[roomId]

    const responseMap = new Map((existingClose?.responses ?? []).map((r) => [r.questionId, r]))
    for (const response of roomSession.responses) {
      if (missingIds.includes(response.questionId)) {
        responseMap.set(response.questionId, response)
      }
    }
    for (const response of existingClose?.responses ?? []) {
      responseMap.set(response.questionId, response)
    }

    const closeoutRubric = getRoomSurveyRubric(
      "closeout",
      roomSession.roomType,
      roomSession.gradeType,
      schoolClass,
      surveyType as Exclude<SurveyType, "closeout">,
    )
    const isAnsweredInCloseout = (questionId: string) => {
      const question = closeoutRubric?.questions.find((item) => item.questionId === questionId)
      if (!question) return false
      return isQuestionFullyAnswered(question, responseMap.get(questionId))
    }

    const pendingQuestionIds = [
      ...new Set([
        ...(existingClose?.pendingQuestionIds ?? []).filter((id) => !isAnsweredInCloseout(id)),
        ...missingIds.filter((id) => !isAnsweredInCloseout(id)),
      ]),
    ]

    next[roomId] = {
      roomId,
      roomNumber: roomSession.roomNumber,
      schoolRoomNumber: roomSession.schoolRoomNumber,
      preWalkNote1: roomSession.preWalkNote1,
      preWalkNote2: roomSession.preWalkNote2,
      neighborhood: roomSession.neighborhood,
      areaSqft: roomSession.areaSqft,
      roomType: roomSession.roomType,
      gradeType: roomSession.gradeType,
      building: roomSession.building,
      levelId: roomSession.levelId,
      responses: [...responseMap.values()],
      sourceSurveyType: surveyType as Exclude<SurveyType, "closeout">,
      pendingQuestionIds,
      pendingGrade:
        pendingGrade ||
        (!!existingClose?.pendingGrade && studioTypeRequiresGrade(roomSession.roomType, schoolClass)),
    }
  }

  return next
}

/** Merge newly incomplete source items into an existing Close Out draft without wiping answers. */
export function refreshCloseOutDraftFromSources(params: {
  existingCloseOut: SurveySession
  sourceSessions: SurveySession[]
  allRooms: ParsedPlanRoom[]
  schoolClass?: string | null
}): SurveySession {
  let closeRooms: Record<string, RoomSurveySession> = { ...params.existingCloseOut.rooms }

  for (const sourceSession of params.sourceSessions) {
    if (sourceSession.surveyType === "closeout") continue
    closeRooms = mergeIncompleteFromSourceSurvey(
      sourceSession,
      params.allRooms,
      closeRooms,
      params.schoolClass,
    )
  }

  for (const [roomId, room] of Object.entries(closeRooms)) {
    const pruned = pruneCloseOutRoomPending(room, params.schoolClass)
    if (roomHasCloseOutWork(pruned, params.schoolClass)) {
      closeRooms[roomId] = pruned
    } else {
      delete closeRooms[roomId]
    }
  }

  return {
    ...params.existingCloseOut,
    rooms: closeRooms,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Rebuild the Close Out queue from all in-progress source survey drafts for a school.
 * Preserves Close Out answers and campus-level fields on the existing session.
 */
export function rebuildCloseOutFromSourceSurveys(params: {
  schoolId: string
  schoolName: string
  campusId: string
  building: string
  existingCloseOut: SurveySession | null
  sourceSessions: SurveySession[]
  allRooms: ParsedPlanRoom[]
  assessor?: AssessorInfo | null
  schoolClass?: string | null
}): SurveySession {
  const now = new Date().toISOString()
  let closeRooms: Record<string, RoomSurveySession> = { ...(params.existingCloseOut?.rooms ?? {}) }

  for (const sourceSession of params.sourceSessions) {
    if (sourceSession.surveyType === "closeout") continue
    closeRooms = mergeIncompleteFromSourceSurvey(
      sourceSession,
      params.allRooms,
      closeRooms,
      params.schoolClass,
    )
  }

  for (const [roomId, room] of Object.entries(closeRooms)) {
    const pruned = pruneCloseOutRoomPending(room, params.schoolClass)
    if (roomHasCloseOutWork(pruned, params.schoolClass)) {
      closeRooms[roomId] = pruned
    } else {
      delete closeRooms[roomId]
    }
  }

  const base =
    params.existingCloseOut ??
    emptyCloseOutSession(
      {
        surveyId: `AISD-CLOSEOUT-${Date.now()}`,
        surveyType: "closeout",
        schoolId: params.schoolId,
        schoolName: params.schoolName,
        campusId: params.campusId,
        building: params.building,
        rooms: {},
        startedAt: now,
        updatedAt: now,
      },
      params.assessor,
    )

  return {
    ...base,
    schoolId: params.schoolId,
    schoolName: params.schoolName,
    campusId: params.campusId,
    building: params.building,
    rooms: closeRooms,
    updatedAt: now,
    ...(params.assessor ? assessorSessionFields(params.assessor) : {}),
  }
}

/** Source survey modules scanned when rebuilding Close Out. */
export const CLOSEOUT_SOURCE_SURVEY_TYPES = SURVEY_TYPES.filter((type) => type !== "closeout")

export function withPendingUpdatedForResponse(
  room: RoomSurveySession,
  response: RoomQuestionResponse,
  questions: EsaQuestion[],
  schoolClass?: string | null,
): RoomSurveySession {
  const question = questions.find((q) => q.questionId === response.questionId)
  if (!question) return pruneCloseOutRoomPending(room, schoolClass)
  if (!isQuestionFullyAnswered(question, response)) return pruneCloseOutRoomPending(room, schoolClass)

  const pendingQuestionIds = (room.pendingQuestionIds ?? []).filter((id) => id !== response.questionId)
  const deferredQuestionIds = (room.deferredQuestionIds ?? []).filter((id) => id !== response.questionId)
  return pruneCloseOutRoomPending(
    {
      ...room,
      pendingQuestionIds,
      deferredQuestionIds,
    },
    schoolClass,
  )
}

export function withPendingUpdatedForGrade(
  room: RoomSurveySession,
  gradeType: string,
  schoolClass?: string | null,
): RoomSurveySession {
  if (!gradeType) {
    return pruneCloseOutRoomPending({ ...room, gradeType: "", pendingGrade: true }, schoolClass)
  }
  return pruneCloseOutRoomPending(
    {
      ...room,
      gradeType: gradeType as RoomSurveySession["gradeType"],
      pendingGrade: false,
    },
    schoolClass,
  )
}

/**
 * Copy Close Out answers/grade back into the source survey draft session.
 */
export function applyCloseOutRoomToSource(
  sourceSession: SurveySession,
  closeOutRoom: RoomSurveySession,
): SurveySession {
  const existing = sourceSession.rooms[closeOutRoom.roomId]
  if (!existing) {
    return {
      ...sourceSession,
      updatedAt: new Date().toISOString(),
      rooms: {
        ...sourceSession.rooms,
        [closeOutRoom.roomId]: {
          ...closeOutRoom,
          sourceSurveyType: undefined,
          pendingQuestionIds: undefined,
          pendingGrade: undefined,
          deferredQuestionIds: roomHasCloseOutWork(closeOutRoom)
            ? [...effectiveCloseOutPendingQuestionIds(closeOutRoom)]
            : [],
          deferredToCloseOut: roomHasCloseOutWork(closeOutRoom),
        },
      },
    }
  }

  const responseMap = new Map(existing.responses.map((r) => [r.questionId, r]))
  for (const response of closeOutRoom.responses) {
    responseMap.set(response.questionId, response)
  }

  const stillPending = effectiveCloseOutPendingQuestionIds(closeOutRoom)
  const deferredQuestionIds = stillPending
  const deferredToCloseOut = deferredQuestionIds.length > 0 || !!closeOutRoom.pendingGrade

  return {
    ...sourceSession,
    updatedAt: new Date().toISOString(),
    rooms: {
      ...sourceSession.rooms,
      [closeOutRoom.roomId]: {
        ...existing,
        gradeType: closeOutRoom.gradeType || existing.gradeType,
        schoolRoomNumber: closeOutRoom.schoolRoomNumber ?? existing.schoolRoomNumber,
        responses: [...responseMap.values()],
        deferredQuestionIds,
        deferredToCloseOut,
      },
    },
  }
}

export function syncCloseOutProgressToSource(
  closeOutSession: SurveySession,
  sourceSession: SurveySession,
): SurveySession {
  let next = sourceSession
  for (const room of Object.values(closeOutSession.rooms)) {
    next = applyCloseOutRoomToSource(next, room)
  }
  return next
}

/**
 * When answering on the source survey, clear matching pending items in Close Out draft.
 */
export function syncSourceProgressToCloseOut(
  sourceSession: SurveySession,
  closeOutSession: SurveySession,
): SurveySession {
  const rooms = { ...closeOutSession.rooms }
  let changed = false

  for (const [roomId, sourceRoom] of Object.entries(sourceSession.rooms)) {
    const closeRoom = rooms[roomId]
    if (!closeRoom || !roomHasCloseOutWork(closeRoom)) continue

    const rubric = getRoomSurveyRubric(
      "closeout",
      sourceRoom.roomType,
      sourceRoom.gradeType,
      undefined,
      closeRoom.sourceSurveyType,
    )
    const questions = rubric?.questions ?? []

    const responseMap = new Map(sourceRoom.responses.map((r) => [r.questionId, r]))
    const pendingQuestionIds = (closeRoom.pendingQuestionIds ?? []).filter((id) => {
      const q = questions.find((item) => item.questionId === id)
      if (!q) return false
      return !isQuestionFullyAnswered(q, responseMap.get(id))
    })

    const closeResponses = new Map(closeRoom.responses.map((r) => [r.questionId, r]))
    for (const [questionId, response] of responseMap) {
      if ((closeRoom.pendingQuestionIds ?? []).includes(questionId)) {
        closeResponses.set(questionId, response)
      }
    }

    const pendingGrade = closeRoom.pendingGrade && !sourceRoom.gradeType
    const nextRoom = pruneCloseOutRoomPending({
      ...closeRoom,
      gradeType: sourceRoom.gradeType || closeRoom.gradeType,
      schoolRoomNumber: sourceRoom.schoolRoomNumber ?? closeRoom.schoolRoomNumber,
      responses: [...closeResponses.values()],
      pendingQuestionIds,
      pendingGrade,
    })

    if (
      nextRoom.pendingQuestionIds?.length !== (closeRoom.pendingQuestionIds ?? []).length ||
      nextRoom.pendingGrade !== !!closeRoom.pendingGrade ||
      nextRoom.gradeType !== closeRoom.gradeType
    ) {
      rooms[roomId] = nextRoom
      changed = true
    }
  }

  if (!changed) return closeOutSession
  return { ...closeOutSession, rooms, updatedAt: new Date().toISOString() }
}

export function deferIncompleteToCloseOut(
  sourceSession: SurveySession,
  allRooms: ParsedPlanRoom[],
  existingCloseOut: SurveySession | null,
  assessor?: AssessorInfo | null,
  options?: { roomIds?: string[]; schoolClass?: string | null },
): { sourceSession: SurveySession; closeOutSession: SurveySession } {
  const surveyType = sourceSession.surveyType
  const schoolClass = options?.schoolClass
  if (surveyType === "closeout") {
    return {
      sourceSession,
      closeOutSession: existingCloseOut ?? emptyCloseOutSession(sourceSession, assessor),
    }
  }

  const now = new Date().toISOString()
  const sourceRooms = { ...sourceSession.rooms }
  const closeRooms: Record<string, RoomSurveySession> = { ...(existingCloseOut?.rooms ?? {}) }
  const roomEntries = options?.roomIds?.length
    ? options.roomIds
        .map((roomId) => [roomId, sourceSession.rooms[roomId]] as const)
        .filter((entry): entry is readonly [string, RoomSurveySession] => !!entry[1])
    : Object.entries(sourceSession.rooms)

  for (const [roomId, roomSession] of roomEntries) {
    const started = roomSession.responses.length > 0 || !!roomSession.gradeType
    if (!started) continue

    const rubric = getRoomSurveyRubric(
      surveyType,
      roomSession.roomType,
      roomSession.gradeType,
      schoolClass,
    )
    if (!rubric) continue

    const parsed = allRooms.find((r) => r.id === roomId)
    const result = validateRoomSession(
      roomId,
      parsed?.name ?? roomId,
      roomSession,
      rubric.questions,
      { schoolClass },
    )

    if (result.complete) {
      // Clear any prior close-out residue for finished rooms
      if (closeRooms[roomId] && !roomHasCloseOutWork(closeRooms[roomId])) {
        delete closeRooms[roomId]
      }
      sourceRooms[roomId] = {
        ...roomSession,
        deferredQuestionIds: [],
        deferredToCloseOut: false,
      }
      continue
    }

    const missingIds = result.missingQuestionIds
    const pendingGrade = result.missingGrade
    const existingClose = closeRooms[roomId]

    const pendingQuestionIds = [...new Set([...(existingClose?.pendingQuestionIds ?? []), ...missingIds])]
    const responseMap = new Map((existingClose?.responses ?? []).map((r) => [r.questionId, r]))
    for (const response of roomSession.responses) {
      // Seed close-out with unanswered targets only — keep prior close-out answers
      if (pendingQuestionIds.includes(response.questionId)) {
        responseMap.set(response.questionId, response)
      }
    }

    closeRooms[roomId] = {
      roomId,
      roomNumber: roomSession.roomNumber,
      schoolRoomNumber: roomSession.schoolRoomNumber,
      preWalkNote1: roomSession.preWalkNote1,
      preWalkNote2: roomSession.preWalkNote2,
      roomType: roomSession.roomType,
      gradeType: roomSession.gradeType,
      building: roomSession.building,
      levelId: roomSession.levelId,
      responses: [...responseMap.values()],
      sourceSurveyType: surveyType as Exclude<SurveyType, "closeout">,
      pendingQuestionIds,
      pendingGrade:
        pendingGrade ||
        (!!existingClose?.pendingGrade &&
          studioTypeRequiresGrade(roomSession.roomType, schoolClass)),
    }

    sourceRooms[roomId] = {
      ...roomSession,
      deferredQuestionIds: missingIds,
      deferredToCloseOut: true,
    }
  }

  const closeOutSession: SurveySession = {
    ...(existingCloseOut ?? emptyCloseOutSession(sourceSession, assessor)),
    schoolId: sourceSession.schoolId,
    schoolName: sourceSession.schoolName,
    campusId: sourceSession.campusId,
    building: sourceSession.building,
    rooms: closeRooms,
    updatedAt: now,
    ...(assessor ? assessorSessionFields(assessor) : {}),
  }

  return {
    sourceSession: {
      ...sourceSession,
      rooms: sourceRooms,
      updatedAt: now,
    },
    closeOutSession,
  }
}

function emptyCloseOutSession(source: SurveySession, assessor?: AssessorInfo | null): SurveySession {
  const now = new Date().toISOString()
  return {
    surveyId: `AISD-CLOSEOUT-${Date.now()}`,
    surveyType: "closeout",
    schoolId: source.schoolId,
    schoolName: source.schoolName,
    campusId: source.campusId,
    building: source.building,
    rooms: {},
    startedAt: now,
    updatedAt: now,
    ...(assessor ? assessorSessionFields(assessor) : {}),
  }
}
