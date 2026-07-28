"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from "react"
import type {
  AisdSchoolOption,
  AssessorInfo,
  FloorPlanRoom,
  ParsedPlanRoom,
  RoomQuestionResponse,
  RoomScoreResult,
  RoomSurveySession,
  ScoredRoomEntry,
  SchoolFloorPlanConfig,
  SurveySession,
  SurveySubmission,
  SurveyType,
  PreWalkState,
  OutdoorElementPin,
} from "@aisd/shared"
import {
  aggregateCampusScores,
  EMPTY_WEIGHT_OVERRIDES,
  getRoomSurveyRubric,
  getSurveyRubric,
  hasActiveWeightOverrides,
  isAdminSpaceType,
  isArrivalSpaceType,
  isCampusScopedSurveyType,
  isElementaryGrade,
  isNeighborhoodSpaceType,
  isOutdoorSpaceType,
  isOutdoorSurveyRoomId,
  isRoomComplete,
  isSecondaryGrade,
  OUTDOOR_SURVEY_ROOM_ID,
  outdoorSurveyRoomDisplayName,
  subcategoryOverrideKey,
  toFloorPlanRoom,
  isClassroomRoom,
  isStudioType,
  studioTypeRequiresGrade,
  surveyTypeAvailableForSchool,
  usesDedicatedSpaceRubric,
  type WeightOverrides,
} from "@aisd/shared"
import {
  clearDraft,
  loadActiveDraftMeta,
  loadAssessors,
  loadDraft,
  loadDraftsForSchool,
  loadResumableDraft,
  saveAssessors,
  saveDraft,
  markActiveVisit,
  hasActiveVisit,
  type AssessorBySurveyType,
  type PersistedSurveyDraft,
} from "@/lib/survey-persistence"
import { runFieldDataResetIfNeeded } from "@/lib/clear-field-survey-data"
import { applyQuestionDependencies, isSkippedDependentQuestion } from "@/lib/question-dependencies"
import {
  placeOutdoorElementPin as mergeOutdoorElementPin,
  removeOutdoorElementPin as dropOutdoorElementPin,
} from "@/lib/outdoor-element-types"
import {
  assessorFromSession,
  assessorSessionFields,
  isAssessorRegistered,
  resolveCampusAssessor,
  sessionHasRegisteredAssessor,
  withCampusAssessorOnSession,
} from "@/lib/assessor"
import { getSurveyTypeInfo, type SurveyTypeInfo } from "@/lib/survey-status"
import { SURVEY_TYPES } from "@aisd/shared"
import { validateSurveyBeforeDeferral, type SubmitValidationResult } from "@/lib/survey-validation"
import {
  loadFloorPlanLevelDisplay,
  hasFloorPlanDisplayCache,
  isInlineFloorPlanSrc,
  loadSchoolRoomsForSchool,
  revokeFloorPlanBlobUrls,
} from "@/lib/floor-plan-loader"
import { loadAisdSchoolOptions } from "@/lib/load-aisd-schools"
import {
  deferIncompleteToCloseOut,
  countCloseOutPendingItems,
  isCloseOutSurveyComplete,
  rebuildCloseOutFromSourceSurveys,
  roomNeedsCloseOut,
  syncCloseOutProgressToSource,
  syncSourceProgressToCloseOut,
  withPendingUpdatedForGrade,
  withPendingUpdatedForResponse,
} from "@/lib/closeout"
import { buildCampusScoringSnapshot } from "@/lib/campus-scoring-tree"
import { EMPTY_PREWALK, getPreWalkMappingForSurveyModule, migratePreWalkState, preWalkMappingKey, preWalkRoomIdsForSurvey, preWalkRoomSpaceTypePhotoKey, preWalkSpaceTypeForRoom, preWalkSpaceTypePhotoKey, shouldPromptPreWalkOnSchoolSelect } from "@/lib/prewalk"
import { applyTraditionalStudioCopyToRoom, getTraditionalStudioCopyOffer } from "@/lib/traditional-studio-copy"
import { scoreRoomSessionWithMetadata } from "@/lib/traditional-studio-room-score"
import {
  fetchRemoteSurveyStatusClient,
  flushSurveySyncQueue,
  isBrowserOnline,
  pullRemoteDraftClient,
  pullRemoteDraftsForSchoolClient,
  pushSurveyDraftClient,
  queueSurveySync,
} from "@/lib/survey-remote-sync"
import type { RemoteSurveyStatus } from "@/lib/survey-remote-types"
import {
  findSubmittedRoomAssessment,
  schoolHasResults,
  schoolScoredRoomCount,
  type SubmittedRoomAssessment,
} from "@/lib/school-assessment-index"
import {
  hydrateLocalDraftsFromRemote,
  mergeSchoolDrafts,
} from "@/lib/school-draft-merge"

export type SurveyView = "landing" | "admin" | "survey" | "results"

interface SurveyState {
  surveyType: SurveyType
  school: AisdSchoolOption | null
  session: SurveySession | null
  selectedRoomId: string | null
  selectedLevelId: string | null
  floorPlan: SchoolFloorPlanConfig | null
  floorPlanLoading: boolean
  allRooms: ParsedPlanRoom[]
  /** Manual (not on floor plan) rooms for the current school — merged into allRooms */
  manualRooms: ParsedPlanRoom[]
  roomScores: Record<string, number | null>
  roomScoreDetails: Record<string, RoomScoreResult>
  floorPlanRooms: Record<string, FloorPlanRoom>
  view: SurveyView
  submission: SurveySubmission | null
  lastSavedAt: string | null
  showResumeBanner: boolean
  hydrated: boolean
  weightOverrides: WeightOverrides
  assessorByType: AssessorBySurveyType
  submitValidation: SubmitValidationResult | null
  pendingStudioType: string | null
  preWalk: PreWalkState
  preWalkPromptPending: boolean
  preWalkRequested: boolean
}

type Action =
  | {
      type: "SET_SURVEY_TYPE"
      surveyType: SurveyType
      draft?: PersistedSurveyDraft | null
      pendingStudioType?: string | null
    }
  | { type: "SET_SCHOOL"; school: AisdSchoolOption | null; draft?: PersistedSurveyDraft | null }
  | { type: "RESTORE"; school: AisdSchoolOption; draft: PersistedSurveyDraft; showResumeBanner?: boolean }
  | { type: "UPDATE_SCHOOL"; school: AisdSchoolOption }
  | { type: "SET_LEVEL"; levelId: string }
  | { type: "SET_FLOOR_PLAN"; plan: SchoolFloorPlanConfig | null; rooms: ParsedPlanRoom[] }
  | { type: "SET_FLOOR_PLAN_LOADING"; loading: boolean }
  | { type: "PATCH_FLOOR_PLAN_LEVEL"; level: SchoolFloorPlanConfig["levels"][number] }
  | { type: "STRIP_FLOOR_PLAN_DISPLAY" }
  | { type: "SET_ROOMS"; rooms: ParsedPlanRoom[] }
  | { type: "ADD_MANUAL_ROOM"; roomNumber: string; building?: string }
  | { type: "SELECT_ROOM"; roomId: string | null }
  | { type: "SET_GRADE"; roomId: string; gradeType: string }
  | { type: "SET_NEIGHBORHOOD"; roomId: string; neighborhood: string }
  | { type: "SET_SCHOOL_ROOM_NUMBER"; roomId: string; schoolRoomNumber: string }
  | { type: "SET_PREWALK_SPACE_TYPE_PHOTO"; surveyType: SurveyType; spaceType: string; roomId?: string; photo?: string }
  | { type: "SET_PREWALK_MAPPING"; surveyType: SurveyType; roomId: string; spaceType: string }
  | { type: "UPDATE_PREWALK_NOTES"; surveyType: SurveyType; roomId: string; note1: string; note2: string }
  | { type: "REMOVE_PREWALK_MAPPING"; surveyType: SurveyType; roomId: string }
  | { type: "CLEAR_PREWALK_MAPPINGS_FOR_SURVEY"; surveyType: SurveyType }
  | { type: "COMPLETE_PREWALK" }
  | { type: "SKIP_PREWALK" }
  | { type: "ANSWER_PREWALK_PROMPT"; choice: "map" | "skip" }
  | { type: "SET_ROOM_TYPE"; roomId: string; roomType: string }
  | { type: "SET_PENDING_STUDIO_TYPE"; roomType: string | null }
  | { type: "SET_RESPONSE"; roomId: string; response: RoomQuestionResponse }
  | { type: "APPLY_TRADITIONAL_STUDIO_COPY"; roomId: string }
  | { type: "ACK_TRADITIONAL_STUDIO_COPY_REVIEW"; roomId: string }
  | { type: "RECALC_SCORES" }
  | { type: "SUBMIT" }
  | { type: "SET_VIEW"; view: SurveyView }
  | { type: "CONTINUE_SURVEY" }
  | { type: "RESET_SURVEY" }
  | { type: "DISMISS_RESUME_BANNER" }
  | { type: "SET_HYDRATED" }
  | { type: "MARK_SAVED"; savedAt: string }
  | { type: "SET_WEIGHT_OVERRIDE"; level: "category" | "subcategory" | "question"; key: string; weight: number | null }
  | { type: "RESET_WEIGHT_OVERRIDES" }
  | { type: "LOAD_ASSESSORS"; assessors: AssessorBySurveyType }
  | { type: "REGISTER_ASSESSOR"; surveyType: SurveyType; name: string; email: string }
  | { type: "CLEAR_ASSESSOR"; surveyType: SurveyType }
  | { type: "SET_SUBMIT_VALIDATION"; validation: SubmitValidationResult }
  | { type: "PLACE_OUTDOOR_ELEMENT_PIN"; elementType: string; lng: number; lat: number }
  | { type: "REMOVE_OUTDOOR_ELEMENT_PIN"; pinId: string }
  | { type: "CLEAR_SUBMIT_VALIDATION" }
  | {
      type: "APPLY_CLOSEOUT_DEFERRAL"
      session: SurveySession
      assessor?: AssessorInfo | null
    }
  | { type: "SET_FINAL_COMMENT"; comment: string }
  | { type: "SUBMIT_CAMPUS" }

function newSession(
  school: AisdSchoolOption,
  surveyType: SurveyType,
  assessor?: AssessorInfo,
): SurveySession {
  const now = new Date().toISOString()
  return {
    surveyId: `AISD-${Date.now()}`,
    surveyType,
    schoolId: school.id,
    schoolName: school.displayName,
    campusId: school.campusId,
    building: "Main",
    rooms: {},
    startedAt: now,
    updatedAt: now,
    ...(assessor ? assessorSessionFields(assessor) : {}),
  }
}

function emptyScoreState(): Pick<SurveyState, "roomScores" | "roomScoreDetails" | "floorPlanRooms"> {
  return { roomScores: {}, roomScoreDetails: {}, floorPlanRooms: {} }
}

function countSessionResponses(session: SurveySession | null | undefined): number {
  if (!session) return 0
  return Object.values(session.rooms).reduce((total, room) => total + room.responses.length, 0)
}

function lookupNeighborhoodFromPlan(
  planRoom: ParsedPlanRoom | undefined,
): string {
  return planRoom?.neighborhood?.trim().toUpperCase() ?? ""
}

/** Space type covers Studios types plus the dedicated Admin/Arrival/Neighborhoods space types. */
function isPendingSpaceType(value: string | null | undefined): boolean {
  return (
    !!value &&
    (isStudioType(value) ||
      isAdminSpaceType(value) ||
      isArrivalSpaceType(value) ||
      isNeighborhoodSpaceType(value) ||
      isOutdoorSpaceType(value))
  )
}

function roomHasSurveyStarted(session: RoomSurveySession): boolean {
  return (
    session.responses.length > 0 ||
    !!session.gradeType ||
    !!session.deferredToCloseOut
  )
}

function resolveRoomType(
  state: SurveyState,
  roomId: string,
  existing?: RoomSurveySession,
): string {
  if (isOutdoorSurveyRoomId(roomId) && state.surveyType === "outdoor") {
    return "Outdoor Spaces"
  }

  const preWalkType = preWalkSpaceTypeForRoom(
    state.preWalk.mappings,
    roomId,
    state.surveyType,
    state.school?.schoolClass,
  )
  const canApplyPreWalk =
    !!preWalkType &&
    isPendingSpaceType(preWalkType) &&
    (!existing || !roomHasSurveyStarted(existing))

  if (canApplyPreWalk) return preWalkType

  if (existing) {
    if (isPendingSpaceType(existing.roomType)) return existing.roomType
    if (existing.roomType === "Studios") return state.pendingStudioType ?? ""
    return existing.roomType
  }

  if (state.pendingStudioType && isPendingSpaceType(state.pendingStudioType)) {
    return state.pendingStudioType
  }
  return ""
}

function mergeOutdoorSessionsIntoCampusRoom(session: SurveySession): SurveySession {
  const campusId = OUTDOOR_SURVEY_ROOM_ID
  let merged = session.rooms[campusId]

  for (const [roomId, room] of Object.entries(session.rooms)) {
    if (roomId === campusId || !isOutdoorSpaceType(room.roomType)) continue
    if (!merged) {
      merged = {
        ...room,
        roomId: campusId,
        roomNumber: "Outdoor Spaces",
        roomType: "Outdoor Spaces",
      }
      continue
    }
    if (room.responses.length > merged.responses.length) {
      merged = {
        ...merged,
        responses: room.responses,
        deferredQuestionIds: room.deferredQuestionIds,
        deferredToCloseOut: room.deferredToCloseOut,
        pendingQuestionIds: room.pendingQuestionIds,
        pendingGrade: room.pendingGrade,
      }
    }
  }

  const rooms = { ...session.rooms }
  for (const roomId of Object.keys(rooms)) {
    if (roomId !== campusId && isOutdoorSpaceType(rooms[roomId]?.roomType ?? "")) {
      delete rooms[roomId]
    }
  }

  if (!merged) {
    merged = ensureRoomSession(
      { surveyType: "outdoor" } as SurveyState,
      campusId,
      undefined,
    )
  }

  rooms[campusId] = merged
  return { ...session, rooms }
}

function bootstrapCampusScopedSurvey(state: SurveyState): SurveyState {
  if (!isCampusScopedSurveyType(state.surveyType) || !state.school) return state

  const roomId = OUTDOOR_SURVEY_ROOM_ID
  if (!state.session) {
    return {
      ...state,
      selectedRoomId: roomId,
      pendingStudioType: "Outdoor Spaces",
    }
  }

  const session = mergeOutdoorSessionsIntoCampusRoom(state.session)
  const existing = session.rooms[roomId]
  const ensured = ensureRoomSession(state, roomId, existing)

  return {
    ...state,
    selectedRoomId: roomId,
    pendingStudioType: "Outdoor Spaces",
    session: {
      ...session,
      updatedAt: new Date().toISOString(),
      rooms: { ...session.rooms, [roomId]: ensured },
    },
  }
}

function roomDisplayName(state: SurveyState, roomId: string): string {
  if (isOutdoorSurveyRoomId(roomId)) return outdoorSurveyRoomDisplayName()
  const parsed = state.allRooms.find((r) => r.id === roomId)
  const sessionRoom = state.session?.rooms[roomId]
  return parsed?.name ?? sessionRoom?.roomNumber ?? roomId
}

function resolveRoomNeighborhood(
  state: SurveyState,
  roomId: string,
  roomSession: RoomSurveySession,
): string | undefined {
  const fromSession = roomSession.neighborhood?.trim()
  if (fromSession) return fromSession
  const fromPlan = state.allRooms.find((r) => r.id === roomId)?.neighborhood?.trim()
  if (fromPlan) return fromPlan
  return undefined
}

function clearTraditionalStudioCopyMeta(): Pick<
  RoomSurveySession,
  "traditionalStudioCopiedFromRoomId" | "traditionalStudioCopyReviewPending"
> {
  return {
    traditionalStudioCopiedFromRoomId: undefined,
    traditionalStudioCopyReviewPending: undefined,
  }
}

function applyTraditionalStudioCopyForRoom(state: SurveyState, roomId: string): SurveyState {
  if (!state.session) return state
  const existing = state.session.rooms[roomId]
  if (!existing) return state
  const ensured = ensureRoomSession(state, roomId, existing)
  const copied = applyTraditionalStudioCopyToRoom({
    schoolClass: state.school?.schoolClass,
    session: state.session,
    allRooms: state.allRooms,
    roomId,
    room: ensured,
  })
  if (!copied) return state
  const nextState: SurveyState = {
    ...state,
    session: {
      ...state.session,
      updatedAt: new Date().toISOString(),
      rooms: {
        ...state.session.rooms,
        [roomId]: copied,
      },
    },
  }
  return reducer(nextState, { type: "RECALC_SCORES" })
}

function lookupAreaFromPlan(planRoom: ParsedPlanRoom | undefined): number | undefined {
  if (planRoom?.areaSqft != null && planRoom.areaSqft > 0) return planRoom.areaSqft
  return undefined
}

function ensureRoomSession(
  state: SurveyState,
  roomId: string,
  existing?: RoomSurveySession,
): RoomSurveySession {
  if (isOutdoorSurveyRoomId(roomId) && state.surveyType === "outdoor") {
    if (existing) {
      return {
        ...existing,
        roomType: "Outdoor Spaces",
        roomNumber: existing.roomNumber?.trim() || "Outdoor Spaces",
      }
    }
    return {
      roomId,
      roomNumber: "Outdoor Spaces",
      roomType: "Outdoor Spaces",
      gradeType: "",
      neighborhood: "",
      preWalkNote1: "",
      preWalkNote2: "",
      levelId: "campus",
      responses: [],
    }
  }

  const planRoom = state.allRooms.find((r) => r.id === roomId)
  const lookupNeighborhood = lookupNeighborhoodFromPlan(planRoom)
  const preWalkMapping = getPreWalkMappingForSurveyModule(
    state.preWalk.mappings,
    state.surveyType,
    roomId,
    state.school?.schoolClass,
  )
  const roomType = resolveRoomType(state, roomId, existing)

  if (existing) {
    const areaSqft =
      existing.areaSqft != null && existing.areaSqft > 0
        ? existing.areaSqft
        : lookupAreaFromPlan(planRoom)
    return {
      ...existing,
      roomType,
      areaSqft,
      neighborhood: existing.neighborhood?.trim()
        ? existing.neighborhood
        : lookupNeighborhood || existing.neighborhood || "",
      preWalkNote1: existing.preWalkNote1 ?? preWalkMapping?.note1 ?? "",
      preWalkNote2: existing.preWalkNote2 ?? preWalkMapping?.note2 ?? "",
    }
  }
  return {
    roomId,
    roomNumber: roomId,
    roomType,
    gradeType: "",
    neighborhood: lookupNeighborhood,
    areaSqft: lookupAreaFromPlan(planRoom),
    preWalkNote1: preWalkMapping?.note1 ?? "",
    preWalkNote2: preWalkMapping?.note2 ?? "",
    building: planRoom?.building,
    levelId: planRoom?.levelId ?? state.selectedLevelId ?? "floor-1",
    responses: [],
  }
}

function schoolFromDraft(draft: PersistedSurveyDraft): AisdSchoolOption {
  return {
    id: draft.schoolId,
    campusId: draft.session.campusId,
    name: draft.session.schoolName,
    displayName: draft.session.schoolName,
    schoolClass: "",
    address: "",
    lat: 0,
    lng: 0,
    hasFloorPlan: true,
  }
}

function normalizeManualRoomId(roomNumber: string): string {
  return roomNumber.trim().replace(/\s+/g, "").toUpperCase()
}

function createManualRoom(roomNumber: string, levelId: string, building?: string): ParsedPlanRoom {
  const baseId = normalizeManualRoomId(roomNumber)
  const label = roomNumber.trim()
  const buildingKey = building?.trim() ? normalizeManualRoomId(building) : ""
  // Keep room numbers unique across buildings when a building is required.
  const id = buildingKey ? `${buildingKey}-${baseId}` : baseId
  return {
    id,
    name: `Room ${label}`,
    x: 0,
    y: 0,
    area: 0,
    building: building?.trim() || undefined,
    levelId,
    points: [],
  }
}

function mergeManualRooms(
  planRooms: ParsedPlanRoom[],
  manualRooms: ParsedPlanRoom[],
): ParsedPlanRoom[] {
  if (manualRooms.length === 0) return planRooms
  const ids = new Set(planRooms.map((r) => r.id.toUpperCase()))
  const extras = manualRooms.filter((r) => !ids.has(r.id.toUpperCase()))
  return extras.length === 0 ? planRooms : [...planRooms, ...extras]
}

function stateFromDraft(
  school: AisdSchoolOption,
  draft: PersistedSurveyDraft,
  showResumeBanner: boolean,
  assessorByType: AssessorBySurveyType,
  existingRooms: ParsedPlanRoom[] = [],
  existingFloorPlan: SchoolFloorPlanConfig | null = null,
): SurveyState {
  const sessionAssessor = assessorFromSession(draft.session)
  const mergedAssessors = { ...assessorByType }
  if (sessionAssessor && isAssessorRegistered(sessionAssessor)) {
    mergedAssessors[draft.surveyType] = sessionAssessor
  }
  const stamped = withCampusAssessorOnSession(
    draft.session,
    mergedAssessors,
    draft.surveyType,
  )
  const manualRooms = draft.manualRooms ?? []
  const selectedRoomId = draft.selectedRoomId ?? null
  const levelFromSession = selectedRoomId
    ? draft.session.rooms[selectedRoomId]?.levelId
    : undefined
  const resolvedLevelId =
    draft.selectedLevelId ??
    levelFromSession ??
    existingFloorPlan?.defaultLevelId ??
    existingRooms.find((r) => r.id === selectedRoomId)?.levelId ??
    existingRooms[0]?.levelId ??
    null
  const base: SurveyState = {
    surveyType: draft.surveyType,
    school,
    session: stamped.session,
    selectedRoomId,
    selectedLevelId: resolvedLevelId,
    floorPlan: existingFloorPlan,
    floorPlanLoading: !existingFloorPlan && !existingRooms.length && school.hasFloorPlan,
    allRooms: mergeManualRooms(existingRooms, manualRooms),
    manualRooms,
    view: draft.view ?? "survey",
    submission: draft.lastSubmission,
    lastSavedAt: draft.savedAt,
    showResumeBanner,
    hydrated: true,
    weightOverrides: EMPTY_WEIGHT_OVERRIDES,
    assessorByType: stamped.assessorByType,
    submitValidation: null,
    pendingStudioType: draft.pendingStudioType ?? null,
    preWalk: migratePreWalkState(draft.preWalk, school.schoolClass),
    preWalkPromptPending: false,
    preWalkRequested: false,
    ...emptyScoreState(),
  }
  return isCampusScopedSurveyType(draft.surveyType) ? bootstrapCampusScopedSurvey(base) : base
}

function prepareCloseOutDraft(
  school: AisdSchoolOption,
  existingDraft: PersistedSurveyDraft | null,
  allRooms: ParsedPlanRoom[],
  assessorByType: AssessorBySurveyType,
): PersistedSurveyDraft {
  const assessor =
    (isAssessorRegistered(assessorByType.closeout) ? assessorByType.closeout : null) ??
    (isAssessorRegistered(assessorByType.studios) ? assessorByType.studios : null) ??
    (existingDraft?.session ? assessorFromSession(existingDraft.session) : null)
  const sourceSessions = loadDraftsForSchool(school.id).map((draft) => draft.session)
  const session = rebuildCloseOutFromSourceSurveys({
    schoolId: school.id,
    schoolName: school.displayName,
    campusId: school.campusId,
    building: existingDraft?.session.building ?? "",
    existingCloseOut: existingDraft?.session ?? null,
    sourceSessions,
    allRooms,
    assessor: assessor && isAssessorRegistered(assessor) ? assessor : null,
    schoolClass: school.schoolClass,
  })

  return {
    version: 1,
    schoolId: school.id,
    surveyType: "closeout",
    session,
    selectedLevelId: existingDraft?.selectedLevelId ?? null,
    selectedRoomId: existingDraft?.selectedRoomId ?? null,
    lastSubmission: existingDraft?.lastSubmission ?? null,
    savedAt: new Date().toISOString(),
  }
}

function buildCampusSubmission(state: SurveyState): SurveySubmission | null {
  if (!state.session || !state.school || state.surveyType !== "closeout") return null

  const snapshot = buildCampusScoringSnapshot({
    schoolId: state.school.id,
    schoolName: state.school.displayName,
    campusId: state.school.campusId,
    schoolClass: state.school.schoolClass,
    liveSurveyType: state.surveyType,
    liveSession: state.session,
    liveRoomScoreDetails: state.roomScoreDetails,
  })

  const submittedAt = new Date().toISOString()
  const session: SurveySession = {
    ...state.session,
    campusSubmittedAt: submittedAt,
    submittedAt,
    updatedAt: submittedAt,
  }

  const campus = aggregateCampusScores(snapshot.allRooms, {
    schoolId: state.school.id,
    schoolName: state.school.displayName,
    campusId: state.school.campusId,
  })

  return {
    session,
    submittedAt,
    campus,
    floorPlanRooms: Object.values(state.floorPlanRooms),
  }
}

function buildSubmission(state: SurveyState): SurveySubmission | null {
  if (!state.session || !state.school) return null
  const rubric = getSurveyRubric(state.surveyType)
  if (!rubric) return null

  const scoredRooms: ScoredRoomEntry[] = Object.entries(state.session.rooms).map(([roomId, roomSession]) => {
    const detail = state.roomScoreDetails[roomId]
    return {
      roomId,
      roomName: roomDisplayName(state, roomId),
      schoolRoomNumber: roomSession.schoolRoomNumber?.trim() || undefined,
      building: isOutdoorSurveyRoomId(roomId)
        ? undefined
        : roomSession.building ?? state.allRooms.find((r) => r.id === roomId)?.building,
      neighborhood: resolveRoomNeighborhood(state, roomId, roomSession),
      levelId: roomSession.levelId,
      gradeType: roomSession.gradeType,
      overallScore: detail?.overallScore ?? null,
      categoryScores: detail?.categoryScores ?? [],
      answeredCount: detail?.answeredCount ?? 0,
      totalCount: detail?.totalCount ?? 0,
      complete: detail
          ? isRoomComplete(
              detail,
              roomSession.gradeType,
              roomSession.roomType,
              state.school?.schoolClass,
            )
          : false,
    }
  })

  const campus = aggregateCampusScores(scoredRooms, {
    schoolId: state.school.id,
    schoolName: state.school.displayName,
    campusId: state.school.campusId,
  })

  const submittedAt = new Date().toISOString()
  return {
    session: { ...state.session, submittedAt, updatedAt: submittedAt },
    submittedAt,
    campus,
    floorPlanRooms: Object.values(state.floorPlanRooms),
  }
}

function reducer(state: SurveyState, action: Action): SurveyState {
  switch (action.type) {
    case "SET_HYDRATED":
      return { ...state, hydrated: true }
    case "DISMISS_RESUME_BANNER":
      return { ...state, showResumeBanner: false }
    case "MARK_SAVED":
      return { ...state, lastSavedAt: action.savedAt }
    case "RESTORE": {
      const sameSchool = state.school?.id === action.school.id
      return stateFromDraft(
        action.school,
        action.draft,
        action.showResumeBanner ?? false,
        state.assessorByType,
        sameSchool ? state.allRooms : [],
        sameSchool ? state.floorPlan : null,
      )
    }
    case "UPDATE_SCHOOL": {
      if (!state.school || state.school.id !== action.school.id) return state
      const identityChanged =
        state.school.campusId !== action.school.campusId ||
        state.school.name !== action.school.name ||
        state.school.hasFloorPlan !== action.school.hasFloorPlan
      const shouldReloadPlan =
        identityChanged || (action.school.hasFloorPlan && state.allRooms.length === 0)
      return {
        ...state,
        school: action.school,
        // Clear a failed/empty provisional floor-plan load so rooms reload with the real school.
        ...(shouldReloadPlan
          ? {
              floorPlan: null,
              allRooms: mergeManualRooms([], state.manualRooms),
              floorPlanLoading: action.school.hasFloorPlan,
            }
          : {}),
      }
    }
    case "LOAD_ASSESSORS":
      return { ...state, assessorByType: action.assessors, hydrated: true }
    case "REGISTER_ASSESSOR": {
      const registeredAt = new Date().toISOString()
      const info: AssessorInfo = {
        name: action.name.trim(),
        email: action.email.trim(),
        registeredAt,
      }
      const assessorByType = { ...state.assessorByType, [action.surveyType]: info }
      saveAssessors(assessorByType)

      const session = state.session
        ? {
            ...state.session,
            ...assessorSessionFields(info),
            updatedAt: registeredAt,
          }
        : state.session

      return bootstrapCampusScopedSurvey({ ...state, assessorByType, session })
    }
    case "CLEAR_ASSESSOR": {
      const assessorByType = { ...state.assessorByType }
      delete assessorByType[action.surveyType]
      saveAssessors(assessorByType)

      const session =
        state.session && state.surveyType === action.surveyType
          ? {
              ...state.session,
              assessorName: undefined,
              assessorEmail: undefined,
              assessorRegisteredAt: undefined,
              updatedAt: new Date().toISOString(),
            }
          : state.session

      return {
        ...state,
        assessorByType,
        session,
        view: "survey",
      }
    }
    case "SET_SURVEY_TYPE": {
      if (!state.school) {
        return { ...state, surveyType: action.surveyType, submission: null, showResumeBanner: false }
      }
      if (action.surveyType === "closeout") {
        const prepared = prepareCloseOutDraft(
          state.school,
          action.draft ?? loadDraft(state.school.id, "closeout"),
          state.allRooms,
          state.assessorByType,
        )
        const restored = stateFromDraft(
          state.school,
          prepared,
          false,
          state.assessorByType,
          state.allRooms,
          state.floorPlan,
        )
        return bootstrapCampusScopedSurvey({
          ...restored,
          surveyType: "closeout",
          pendingStudioType:
            action.pendingStudioType !== undefined
              ? action.pendingStudioType
              : restored.pendingStudioType,
        })
      }
      if (action.draft) {
        const restored = stateFromDraft(
          state.school,
          action.draft,
          false,
          state.assessorByType,
          state.allRooms,
          state.floorPlan,
        )
        return bootstrapCampusScopedSurvey({
          ...restored,
          surveyType: action.surveyType,
          pendingStudioType:
            action.pendingStudioType !== undefined
              ? action.pendingStudioType
              : restored.pendingStudioType,
        })
      }
      const assessor = resolveCampusAssessor(state.assessorByType, action.surveyType)
      const session = newSession(state.school, action.surveyType, assessor)
      const stamped = withCampusAssessorOnSession(session, state.assessorByType, action.surveyType)
      return bootstrapCampusScopedSurvey({
        ...state,
        surveyType: action.surveyType,
        session: stamped.session,
        assessorByType: stamped.assessorByType,
        selectedRoomId: null,
        view: "survey",
        submission: null,
        showResumeBanner: false,
        weightOverrides: EMPTY_WEIGHT_OVERRIDES,
        pendingStudioType: action.pendingStudioType ?? null,
        preWalk: EMPTY_PREWALK,
        ...emptyScoreState(),
      })
    }
    case "SET_SCHOOL": {
      if (!action.school) {
        return {
          ...state,
          school: null,
          session: null,
          selectedRoomId: null,
          selectedLevelId: null,
          floorPlan: null,
          floorPlanLoading: false,
          allRooms: [],
          manualRooms: [],
          view: "survey",
          submission: null,
          showResumeBanner: false,
          weightOverrides: EMPTY_WEIGHT_OVERRIDES,
          pendingStudioType: null,
          preWalk: EMPTY_PREWALK,
          preWalkPromptPending: false,
          preWalkRequested: false,
          ...emptyScoreState(),
        }
      }
      if (action.draft) {
        const rooms = action.school.id === state.school?.id ? state.allRooms : []
        const floorPlan = action.school.id === state.school?.id ? state.floorPlan : null
        const restored = stateFromDraft(action.school, action.draft, false, state.assessorByType, rooms, floorPlan)
        return bootstrapCampusScopedSurvey(restored)
      }
      const assessor = resolveCampusAssessor(state.assessorByType, state.surveyType)
      const session = newSession(action.school, state.surveyType, assessor)
      const stamped = withCampusAssessorOnSession(session, state.assessorByType, state.surveyType)
      return bootstrapCampusScopedSurvey({
        ...state,
        school: action.school,
        session: stamped.session,
        assessorByType: stamped.assessorByType,
        selectedRoomId: null,
        selectedLevelId: null,
        floorPlan: null,
        floorPlanLoading: action.school.hasFloorPlan,
        allRooms: [],
        manualRooms: [],
        view: "survey",
        submission: null,
        showResumeBanner: false,
        weightOverrides: EMPTY_WEIGHT_OVERRIDES,
        pendingStudioType: null,
        preWalk: EMPTY_PREWALK,
        preWalkPromptPending: shouldPromptPreWalkOnSchoolSelect(
          EMPTY_PREWALK,
          action.school.schoolClass,
        ),
        preWalkRequested: false,
        ...emptyScoreState(),
      })
    }
    case "SET_LEVEL":
      return { ...state, selectedLevelId: action.levelId }
    case "SET_FLOOR_PLAN": {
      const selectedRoom = state.selectedRoomId
        ? action.rooms.find((r) => r.id === state.selectedRoomId) ??
          state.manualRooms.find((r) => r.id === state.selectedRoomId)
        : undefined
      const mergedRooms = mergeManualRooms(action.rooms, state.manualRooms)
      const roomLevel = selectedRoom?.levelId
      const levelStillValidForRoom =
        !!roomLevel && mergedRooms.some((r) => r.levelId === roomLevel)
      return {
        ...state,
        floorPlan: action.plan,
        floorPlanLoading: false,
        allRooms: mergedRooms,
        selectedLevelId: levelStillValidForRoom
          ? roomLevel
          : (action.plan?.defaultLevelId ?? null),
      }
    }
    case "SET_FLOOR_PLAN_LOADING":
      return { ...state, floorPlanLoading: action.loading }
    case "PATCH_FLOOR_PLAN_LEVEL": {
      if (!state.floorPlan) return state
      return {
        ...state,
        floorPlan: {
          ...state.floorPlan,
          levels: state.floorPlan.levels.map((level) =>
            level.id === action.level.id ? action.level : { ...level, src: "" },
          ),
        },
      }
    }
    case "STRIP_FLOOR_PLAN_DISPLAY": {
      if (!state.floorPlan || !state.school) return state
      revokeFloorPlanBlobUrls(state.school.id)
      return {
        ...state,
        floorPlan: {
          ...state.floorPlan,
          levels: state.floorPlan.levels.map((level) =>
            level.src ? { ...level, src: "" } : level,
          ),
        },
      }
    }
    case "SET_ROOMS":
      return { ...state, allRooms: mergeManualRooms(action.rooms, state.manualRooms) }
    case "ADD_MANUAL_ROOM": {
      const roomNumber = action.roomNumber.trim()
      if (!roomNumber) return state
      const building = action.building?.trim() || undefined
      const levelId =
        state.selectedLevelId ?? state.floorPlan?.defaultLevelId ?? "floor-1"
      const room = createManualRoom(roomNumber, levelId, building)
      const existing =
        state.allRooms.find((r) => r.id.toUpperCase() === room.id.toUpperCase()) ??
        state.manualRooms.find((r) => r.id.toUpperCase() === room.id.toUpperCase())
      if (existing) {
        return {
          ...state,
          selectedRoomId: existing.id,
          selectedLevelId: existing.levelId,
          view: "survey",
          submitValidation: null,
        }
      }
      const ensuredBase = state.session
        ? ensureRoomSession(state, room.id, state.session.rooms[room.id])
        : null
      const ensured = ensuredBase
        ? {
            ...ensuredBase,
            roomNumber: roomNumber,
            building: room.building,
            levelId: room.levelId,
          }
        : null
      const manualRooms = [...state.manualRooms, room]
      return {
        ...state,
        manualRooms,
        allRooms: [...state.allRooms, room],
        selectedRoomId: room.id,
        selectedLevelId: levelId,
        view: "survey",
        submitValidation: null,
        session: state.session && ensured
          ? {
              ...state.session,
              updatedAt: new Date().toISOString(),
              rooms: {
                ...state.session.rooms,
                [room.id]: ensured,
              },
            }
          : state.session,
      }
    }
    case "SELECT_ROOM": {
      if (!action.roomId) {
        return { ...state, selectedRoomId: null, pendingStudioType: null, view: "survey" }
      }
      const campusRoom =
        isOutdoorSurveyRoomId(action.roomId) && state.surveyType === "outdoor"
      const room = campusRoom ? undefined : state.allRooms.find((r) => r.id === action.roomId)
      if (!campusRoom && !room && state.session) {
        return state
      }
      if (!state.session) {
        return bootstrapCampusScopedSurvey({
          ...state,
          selectedRoomId: action.roomId,
          selectedLevelId: room?.levelId ?? state.selectedLevelId,
          view: "survey",
        })
      }
      const existing = state.session.rooms[action.roomId]
      const ensured = ensureRoomSession(state, action.roomId, existing)
      const rooms =
        !existing ||
        existing.roomType !== ensured.roomType ||
        existing.gradeType !== ensured.gradeType ||
        existing.neighborhood !== ensured.neighborhood ||
        !!existing.pendingGrade !== !!ensured.pendingGrade
          ? { ...state.session.rooms, [action.roomId]: ensured }
          : state.session.rooms
      return {
        ...state,
        selectedRoomId: action.roomId,
        selectedLevelId: room?.levelId ?? state.selectedLevelId,
        view: "survey",
        // Only keep the pending space type if this room already has one (or pending was just applied).
        pendingStudioType: isPendingSpaceType(ensured.roomType) ? ensured.roomType : null,
        session: {
          ...state.session,
          updatedAt: new Date().toISOString(),
          rooms,
        },
      }
    }
    case "SET_PENDING_STUDIO_TYPE": {
      if (state.selectedRoomId && state.session && action.roomType) {
        const existing = state.session.rooms[state.selectedRoomId]
        const updated = ensureRoomSession(state, state.selectedRoomId, existing)
        const requiresGrade = studioTypeRequiresGrade(action.roomType, state.school?.schoolClass)
        const prevType = existing?.roomType ?? updated.roomType
        const crossingPackage =
          usesDedicatedSpaceRubric(prevType) || usesDedicatedSpaceRubric(action.roomType)
        const clearResponses = crossingPackage && prevType !== action.roomType
        return {
          ...state,
          pendingStudioType: action.roomType,
          session: {
            ...state.session,
            updatedAt: new Date().toISOString(),
            rooms: {
              ...state.session.rooms,
              [state.selectedRoomId]: {
                ...updated,
                roomType: action.roomType,
                ...(requiresGrade ? {} : { gradeType: "" as const, pendingGrade: false }),
                ...(clearResponses
                  ? {
                      responses: [] as RoomQuestionResponse[],
                      ...clearTraditionalStudioCopyMeta(),
                    }
                  : {}),
              },
            },
          },
        }
      }
      return { ...state, pendingStudioType: action.roomType }
    }
    case "SET_ROOM_TYPE": {
      if (!state.session) return state
      const existing = state.session.rooms[action.roomId]
      const requiresGrade = studioTypeRequiresGrade(action.roomType, state.school?.schoolClass)
      const prevType = existing?.roomType
      const crossingPackage =
        usesDedicatedSpaceRubric(prevType) || usesDedicatedSpaceRubric(action.roomType)
      const clearResponses = crossingPackage && prevType !== action.roomType
      const updated = {
        ...ensureRoomSession(state, action.roomId, existing),
        roomType: action.roomType,
        ...(requiresGrade ? {} : { gradeType: "" as const, pendingGrade: false }),
        ...(clearResponses
          ? {
              responses: [] as RoomQuestionResponse[],
              ...clearTraditionalStudioCopyMeta(),
            }
          : {}),
      }
      return {
        ...state,
        pendingStudioType: isPendingSpaceType(action.roomType)
          ? action.roomType
          : state.pendingStudioType,
        session: {
          ...state.session,
          updatedAt: new Date().toISOString(),
          rooms: {
            ...state.session.rooms,
            [action.roomId]: updated,
          },
        },
      }
    }
    case "SET_GRADE": {
      if (!state.session) return state
      const existing = state.session.rooms[action.roomId]
      const updated = ensureRoomSession(state, action.roomId, existing)
      let responses = updated.responses
      if (updated.roomType === "Traditional studio") {
        const keepEs = isElementaryGrade(action.gradeType)
        const keepMsHs = isSecondaryGrade(action.gradeType)
        responses = responses.filter((r) => {
          if (r.questionId === "ST-009-ES") return keepEs
          if (r.questionId === "ST-009-MSHS") return keepMsHs
          return true
        })
      }
      const gradedBase = { ...updated, responses }
      const graded =
        state.surveyType === "closeout"
          ? withPendingUpdatedForGrade(gradedBase, action.gradeType)
          : { ...gradedBase, gradeType: action.gradeType as RoomSurveySession["gradeType"] }
      const clearSelection =
        state.surveyType === "closeout" &&
        state.selectedRoomId === action.roomId &&
        !roomNeedsCloseOut(graded)
      return {
        ...state,
        selectedRoomId: clearSelection ? null : state.selectedRoomId,
        submitValidation: null,
        session: {
          ...state.session,
          updatedAt: new Date().toISOString(),
          rooms: {
            ...state.session.rooms,
            [action.roomId]: graded,
          },
        },
      }
    }
    case "SET_NEIGHBORHOOD": {
      if (!state.session) return state
      const existing = state.session.rooms[action.roomId]
      const updated = ensureRoomSession(state, action.roomId, existing)
      return {
        ...state,
        submitValidation: null,
        session: {
          ...state.session,
          updatedAt: new Date().toISOString(),
          rooms: {
            ...state.session.rooms,
            [action.roomId]: {
              ...updated,
              neighborhood: action.neighborhood as RoomSurveySession["neighborhood"],
            },
          },
        },
      }
    }
    case "SET_SCHOOL_ROOM_NUMBER": {
      if (!state.session) return state
      const existing = state.session.rooms[action.roomId]
      const updated = ensureRoomSession(state, action.roomId, existing)
      return {
        ...state,
        submitValidation: null,
        session: {
          ...state.session,
          updatedAt: new Date().toISOString(),
          rooms: {
            ...state.session.rooms,
            [action.roomId]: {
              ...updated,
              schoolRoomNumber: action.schoolRoomNumber,
            },
          },
        },
      }
    }
    case "SET_PREWALK_SPACE_TYPE_PHOTO": {
      const photoKey = action.roomId
        ? preWalkRoomSpaceTypePhotoKey(action.surveyType, action.roomId, action.spaceType)
        : preWalkSpaceTypePhotoKey(action.surveyType, action.spaceType)
      const spaceTypePhotos = { ...(state.preWalk.spaceTypePhotos ?? {}) }
      if (action.photo) spaceTypePhotos[photoKey] = action.photo
      else delete spaceTypePhotos[photoKey]
      return {
        ...state,
        preWalk: {
          ...state.preWalk,
          spaceTypePhotos,
        },
      }
    }
    case "SET_PREWALK_MAPPING": {
      if (!state.session) return state
      const mappingKey = preWalkMappingKey(action.surveyType, action.roomId)
      const prev = state.preWalk.mappings[mappingKey]
      const mapping = {
        roomId: action.roomId,
        surveyType: action.surveyType,
        spaceType: action.spaceType,
        note1: prev?.note1 ?? "",
        note2: prev?.note2 ?? "",
        mappedAt: new Date().toISOString(),
      }
      const preWalk = {
        ...state.preWalk,
        mappings: { ...state.preWalk.mappings, [mappingKey]: mapping },
      }
      const nextState = { ...state, preWalk }
      if (action.surveyType !== state.surveyType) {
        return { ...nextState, submitValidation: null }
      }
      const existing = state.session.rooms[action.roomId]
      const ensured = ensureRoomSession(nextState, action.roomId, existing)
      return {
        ...nextState,
        submitValidation: null,
        session: {
          ...state.session,
          updatedAt: new Date().toISOString(),
          rooms: {
            ...state.session.rooms,
            [action.roomId]: {
              ...ensured,
              roomType: action.spaceType,
              preWalkNote1: mapping.note1,
              preWalkNote2: mapping.note2,
            },
          },
        },
      }
    }
    case "UPDATE_PREWALK_NOTES": {
      const mappingKey = preWalkMappingKey(action.surveyType, action.roomId)
      const prev = state.preWalk.mappings[mappingKey]
      if (!prev) return state
      const mapping = { ...prev, note1: action.note1, note2: action.note2 }
      const preWalk = {
        ...state.preWalk,
        mappings: { ...state.preWalk.mappings, [mappingKey]: mapping },
      }
      if (!state.session || action.surveyType !== state.surveyType) {
        return { ...state, preWalk }
      }
      const existing = state.session.rooms[action.roomId]
      if (!existing) return { ...state, preWalk }
      return {
        ...state,
        preWalk,
        session: {
          ...state.session,
          updatedAt: new Date().toISOString(),
          rooms: {
            ...state.session.rooms,
            [action.roomId]: {
              ...existing,
              preWalkNote1: action.note1,
              preWalkNote2: action.note2,
            },
          },
        },
      }
    }
    case "REMOVE_PREWALK_MAPPING": {
      const mappingKey = preWalkMappingKey(action.surveyType, action.roomId)
      const mappings = { ...state.preWalk.mappings }
      delete mappings[mappingKey]
      const preWalk = { ...state.preWalk, mappings }
      if (!state.session || action.surveyType !== state.surveyType) {
        return { ...state, preWalk }
      }
      const existing = state.session.rooms[action.roomId]
      if (!existing) return { ...state, preWalk }
      const canRemoveSession =
        existing.responses.length === 0 && !existing.gradeType && !existing.deferredToCloseOut
      const rooms = { ...state.session.rooms }
      if (canRemoveSession) {
        delete rooms[action.roomId]
      } else {
        rooms[action.roomId] = {
          ...existing,
          preWalkNote1: "",
          preWalkNote2: "",
        }
      }
      return {
        ...state,
        preWalk,
        session: {
          ...state.session,
          updatedAt: new Date().toISOString(),
          rooms,
        },
      }
    }
    case "CLEAR_PREWALK_MAPPINGS_FOR_SURVEY": {
      const roomIdsToClear = preWalkRoomIdsForSurvey(state.preWalk.mappings, action.surveyType)
      const mappings = { ...state.preWalk.mappings }
      for (const key of Object.keys(mappings)) {
        if (mappings[key]?.surveyType === action.surveyType) {
          delete mappings[key]
        }
      }
      const preWalk = { ...state.preWalk, mappings }
      if (!state.session || action.surveyType !== state.surveyType) {
        return { ...state, preWalk }
      }

      const rooms = { ...state.session.rooms }
      let changed = false
      for (const roomId of roomIdsToClear) {
        const existing = rooms[roomId]
        if (!existing) continue
        const canRemoveSession =
          existing.responses.length === 0 && !existing.gradeType && !existing.deferredToCloseOut
        if (canRemoveSession) {
          delete rooms[roomId]
          changed = true
        } else if (existing.preWalkNote1 || existing.preWalkNote2) {
          rooms[roomId] = {
            ...existing,
            preWalkNote1: "",
            preWalkNote2: "",
          }
          changed = true
        }
      }

      if (!changed) {
        return { ...state, preWalk }
      }

      return {
        ...state,
        preWalk,
        session: {
          ...state.session,
          updatedAt: new Date().toISOString(),
          rooms,
        },
      }
    }
    case "COMPLETE_PREWALK":
      return {
        ...state,
        preWalk: { ...state.preWalk, completedAt: new Date().toISOString() },
        preWalkRequested: false,
      }
    case "SKIP_PREWALK":
      return {
        ...state,
        preWalk: { ...state.preWalk, skippedAt: new Date().toISOString() },
        preWalkPromptPending: false,
        preWalkRequested: false,
      }
    case "ANSWER_PREWALK_PROMPT": {
      if (action.choice === "skip") {
        return {
          ...state,
          preWalkPromptPending: false,
          preWalkRequested: false,
          preWalk: { ...state.preWalk, skippedAt: new Date().toISOString() },
        }
      }
      return {
        ...state,
        preWalkPromptPending: false,
        preWalkRequested: true,
      }
    }
    case "APPLY_TRADITIONAL_STUDIO_COPY": {
      return applyTraditionalStudioCopyForRoom(state, action.roomId)
    }
    case "ACK_TRADITIONAL_STUDIO_COPY_REVIEW": {
      if (!state.session) return state
      const existing = state.session.rooms[action.roomId]
      if (!existing?.traditionalStudioCopyReviewPending) return state
      return {
        ...state,
        session: {
          ...state.session,
          updatedAt: new Date().toISOString(),
          rooms: {
            ...state.session.rooms,
            [action.roomId]: {
              ...existing,
              traditionalStudioCopyReviewPending: false,
            },
          },
        },
      }
    }
    case "SET_RESPONSE": {
      if (!state.session) return state
      const existing = state.session.rooms[action.roomId]
      const base = ensureRoomSession(state, action.roomId, existing)
      const rubric = getRoomSurveyRubric(
        state.surveyType,
        base.roomType,
        base.gradeType,
        state.school?.schoolClass,
        base.sourceSurveyType,
      )
      const responses = applyQuestionDependencies(
        base.responses,
        action.response,
        rubric?.questions,
      )
      let nextRoom: RoomSurveySession = { ...base, responses }
      if (state.surveyType === "closeout" && rubric) {
        nextRoom = withPendingUpdatedForResponse(nextRoom, action.response, rubric.questions)
      } else if (rubric && (base.deferredQuestionIds?.length ?? 0) > 0) {
        const cleared = withPendingUpdatedForResponse(
          { ...nextRoom, pendingQuestionIds: [...(base.deferredQuestionIds ?? [])] },
          action.response,
          rubric.questions,
        )
        nextRoom = {
          ...nextRoom,
          deferredQuestionIds: cleared.pendingQuestionIds,
          deferredToCloseOut:
            (cleared.pendingQuestionIds?.length ?? 0) > 0 || !!nextRoom.pendingGrade,
        }
      }
      const clearSelection =
        state.surveyType === "closeout" &&
        state.selectedRoomId === action.roomId &&
        !roomNeedsCloseOut(nextRoom)
      return {
        ...state,
        selectedRoomId: clearSelection ? null : state.selectedRoomId,
        submitValidation: null,
        session: {
          ...state.session,
          updatedAt: new Date().toISOString(),
          rooms: {
            ...state.session.rooms,
            [action.roomId]: nextRoom,
          },
        },
      }
    }
    case "RECALC_SCORES": {
      if (!state.session) return state

      const plan = state.floorPlan
      const totalArea = state.allRooms.reduce((s, r) => s + r.area, 0)
      const roomScores: Record<string, number | null> = {}
      const roomScoreDetails: Record<string, RoomScoreResult> = {}
      const floorPlanRooms: Record<string, FloorPlanRoom> = {}

      for (const [roomId, roomSession] of Object.entries(state.session.rooms)) {
        const campusRoom = isOutdoorSurveyRoomId(roomId)
        const parsed = campusRoom ? undefined : state.allRooms.find((r) => r.id === roomId)
        if (!parsed && !campusRoom) continue
        const rubric = getRoomSurveyRubric(
          state.surveyType,
          roomSession.roomType,
          roomSession.gradeType,
          state.school?.schoolClass,
          roomSession.sourceSurveyType,
        )
        if (!rubric) continue
        const result = scoreRoomSessionWithMetadata(
          roomSession,
          rubric,
          state.weightOverrides,
          parsed,
        )
        roomScoreDetails[roomId] = { ...result, roomId }
        roomScores[roomId] = result.overallScore
        if (result.overallScore !== null && parsed) {
          floorPlanRooms[roomId] = toFloorPlanRoom(
            parsed,
            { ...result, roomId },
            plan?.buildingSqft ?? 100_000,
            totalArea,
          )
        }
      }

      return { ...state, roomScores, roomScoreDetails, floorPlanRooms }
    }
    case "SET_WEIGHT_OVERRIDE": {
      const next: WeightOverrides = {
        categories: { ...state.weightOverrides.categories },
        subcategories: { ...state.weightOverrides.subcategories },
        questions: { ...state.weightOverrides.questions },
      }
      const map =
        action.level === "category"
          ? next.categories
          : action.level === "subcategory"
            ? next.subcategories
            : next.questions
      if (action.weight === null || action.weight < 0) {
        delete map[action.key]
      } else {
        map[action.key] = action.weight
      }
      return { ...state, weightOverrides: next }
    }
    case "RESET_WEIGHT_OVERRIDES":
      return { ...state, weightOverrides: EMPTY_WEIGHT_OVERRIDES }
    case "SUBMIT": {
      const rubric = getSurveyRubric(state.surveyType)
      let submitState = state
      if (rubric && hasActiveWeightOverrides(state.weightOverrides)) {
        submitState = reducer(state, { type: "RESET_WEIGHT_OVERRIDES" })
        submitState = reducer(submitState, { type: "RECALC_SCORES" })
      }
      const submission = buildSubmission(submitState)
      if (!submission || !submitState.session) return state

      console.log("Survey submitted:", submission)

      return {
        ...submitState,
        view: "results",
        submission,
        selectedRoomId: null,
        submitValidation: null,
        session: submission.session,
      }
    }
    case "SET_VIEW":
      return { ...state, view: action.view }
    case "CONTINUE_SURVEY":
      return bootstrapCampusScopedSurvey({ ...state, view: "survey", selectedRoomId: null })
    case "RESET_SURVEY": {
      if (!state.school) return state
      clearDraft(state.school.id, state.surveyType)
      const assessor = state.assessorByType[state.surveyType]
      return bootstrapCampusScopedSurvey({
        ...state,
        session: newSession(state.school, state.surveyType, assessor),
        selectedRoomId: null,
        view: "survey",
        submission: null,
        lastSavedAt: null,
        showResumeBanner: false,
        submitValidation: null,
        weightOverrides: EMPTY_WEIGHT_OVERRIDES,
        pendingStudioType: null,
        manualRooms: [],
        preWalk: EMPTY_PREWALK,
        preWalkPromptPending: shouldPromptPreWalkOnSchoolSelect(
          EMPTY_PREWALK,
          state.school.schoolClass,
        ),
        preWalkRequested: false,
        allRooms: state.allRooms.filter(
          (r) => !(state.manualRooms ?? []).some((m) => m.id === r.id),
        ),
        ...emptyScoreState(),
      })
    }
    case "SET_SUBMIT_VALIDATION":
      return { ...state, submitValidation: action.validation }
    case "PLACE_OUTDOOR_ELEMENT_PIN": {
      if (!state.session || state.surveyType !== "outdoor") return state
      const now = new Date().toISOString()
      const pins = mergeOutdoorElementPin(
        state.session.outdoorElementPins ?? [],
        action.elementType,
        action.lng,
        action.lat,
      )
      return {
        ...state,
        session: {
          ...state.session,
          outdoorElementPins: pins,
          updatedAt: now,
        },
      }
    }
    case "REMOVE_OUTDOOR_ELEMENT_PIN": {
      if (!state.session || state.surveyType !== "outdoor") return state
      const now = new Date().toISOString()
      return {
        ...state,
        session: {
          ...state.session,
          outdoorElementPins: dropOutdoorElementPin(
            state.session.outdoorElementPins ?? [],
            action.pinId,
          ),
          updatedAt: now,
        },
      }
    }
    case "CLEAR_SUBMIT_VALIDATION":
      return { ...state, submitValidation: null }
    case "APPLY_CLOSEOUT_DEFERRAL": {
      const assessorByType = { ...state.assessorByType }
      if (action.assessor && isAssessorRegistered(action.assessor)) {
        assessorByType.closeout = action.assessor
        saveAssessors(assessorByType)
      }
      return {
        ...state,
        session: action.session,
        assessorByType,
        submitValidation: null,
      }
    }
    case "SET_FINAL_COMMENT": {
      if (!state.session || state.surveyType !== "closeout") return state
      return {
        ...state,
        session: {
          ...state.session,
          finalComment: action.comment,
          updatedAt: new Date().toISOString(),
        },
      }
    }
    case "SUBMIT_CAMPUS": {
      if (state.surveyType !== "closeout" || !state.session || !state.school) return state
      if (!isCloseOutSurveyComplete(state.session)) return state
      const submission = buildCampusSubmission(state)
      if (!submission) return state

      console.log("Campus assessment submitted:", submission)

      return {
        ...state,
        view: "results",
        submission,
        selectedRoomId: null,
        submitValidation: null,
        session: submission.session,
      }
    }
    default:
      return state
  }
}

interface SurveyContextValue {
  state: SurveyState
  submission: SurveySubmission | null
  schools: AisdSchoolOption[]
  schoolsLoading: boolean
  schoolsLoadError: string | null
  reloadSchools: () => void
  lastSavedAt: string | null
  setSurveyType: (t: SurveyType, options?: { pendingStudioType?: string | null }) => void
  setSchool: (s: AisdSchoolOption | null) => void
  setLevel: (levelId: string) => void
  selectRoom: (roomId: string | null) => void
  addManualRoom: (roomNumber: string, building?: string) => void
  setGrade: (roomId: string, grade: string) => void
  setNeighborhood: (roomId: string, neighborhood: string) => void
  setSchoolRoomNumber: (roomId: string, schoolRoomNumber: string) => void
  setPreWalkSpaceTypePhoto: (
    surveyType: SurveyType,
    spaceType: string,
    photo: string | undefined,
    roomId?: string,
  ) => void
  setPreWalkMapping: (surveyType: SurveyType, roomId: string, spaceType: string) => void
  updatePreWalkNotes: (surveyType: SurveyType, roomId: string, note1: string, note2: string) => void
  removePreWalkMapping: (surveyType: SurveyType, roomId: string) => void
  clearPreWalkMappingsForSurvey: (surveyType: SurveyType) => void
  completePreWalk: () => void
  skipPreWalk: () => void
  answerPreWalkPrompt: (choice: "map" | "skip") => void
  setRoomType: (roomId: string, roomType: string) => void
  setPendingStudioType: (roomType: string | null) => void
  setResponse: (roomId: string, response: RoomQuestionResponse) => void
  applyTraditionalStudioCopy: (roomId: string) => void
  acknowledgeTraditionalStudioCopyReview: (roomId: string) => void
  traditionalStudioCopyOffer: { sourceRoomId: string; sourceRoomName: string; neighborhood: string } | null
  submitSurvey: (options?: { deferIncomplete?: boolean }) => boolean
  /** Save current room (optionally defer incomplete to Close Out) and select the next room. */
  saveAndContinueToNextRoom: (options?: { deferIncomplete?: boolean }) => boolean
  submitCampusAssessment: () => boolean
  setFinalComment: (comment: string) => void
  peekSubmitValidation: () => SubmitValidationResult | null
  setView: (view: SurveyView) => void
  continueSurvey: () => void
  resetSurvey: () => void
  dismissResumeBanner: () => void
  levelRooms: ParsedPlanRoom[]
  classroomRooms: ParsedPlanRoom[]
  surveyedRooms: ScoredRoomEntry[]
  currentRoomSession: RoomSurveySession | null
  currentRoomScore: RoomScoreResult | null
  canSubmit: boolean
  submitHint: string
  canSubmitCampus: boolean
  submitCampusHint: string
  closeOutPending: { roomIds: string[]; roomLabels: string[] }
  currentResults: SurveySubmission | null
  hasCustomWeights: boolean
  setCategoryWeight: (category: string, weight: number | null) => void
  setSubcategoryWeight: (category: string, subcategory: string, weight: number | null) => void
  setQuestionWeight: (questionId: string, weight: number | null) => void
  resetWeightOverrides: () => void
  hasAssessorRegistered: boolean
  registerAssessor: (name: string, email: string) => void
  logoutAssessor: () => void
  surveyTypeInfos: Record<SurveyType, SurveyTypeInfo>
  flaggedQuestionIds: string[]
  submitValidation: SubmitValidationResult | null
  outdoorElementPins: OutdoorElementPin[]
  placeOutdoorElementPin: (elementType: string, lng: number, lat: number) => void
  removeOutdoorElementPin: (pinId: string) => void
  remoteConflictOpen: boolean
  remoteConflict: RemoteSurveyStatus | null
  dismissRemoteConflict: () => void
  closeRemoteConflict: () => void
  loadRemoteSurveyDraft: () => Promise<boolean>
  pendingSyncCount: number
  remoteSchoolDrafts: PersistedSurveyDraft[] | null
  remoteDraftsConfigured: boolean
  remoteSchoolDraftsLoading: boolean
  refreshRemoteSchoolDrafts: () => Promise<void>
  scoringDrafts: PersistedSurveyDraft[] | undefined
  schoolHasResults: boolean
  schoolScoredRoomCount: number
  findSubmittedRoomAssessment: (roomId: string) => SubmittedRoomAssessment | null
  resultsInitialTab: "campus" | "room" | "neighborhood" | "compare" | "photos" | null
  openResults: (tab?: "campus" | "room" | "neighborhood" | "compare" | "photos") => void
  clearResultsInitialTab: () => void
  floorPlanDisplayLoading: boolean
  requestFloorPlanDisplay: () => void
  releaseFloorPlanDisplay: () => void
  ensureFloorPlanLevel: (levelId: string) => Promise<void>
}

const SurveyContext = createContext<SurveyContextValue | null>(null)

function buildScoredRoomEntries(state: SurveyState): ScoredRoomEntry[] {
  if (!state.session) return []
  return Object.entries(state.session.rooms)
    .filter(([, rs]) => {
      if (rs.responses.length > 0 || !!rs.gradeType) return true
      return roomNeedsCloseOut(rs)
    })
    .map(([roomId, roomSession]) => {
      const detail = state.roomScoreDetails[roomId]
      const pendingDone = !roomNeedsCloseOut(roomSession)
      return {
        roomId,
        roomName: roomDisplayName(state, roomId),
        schoolRoomNumber: roomSession.schoolRoomNumber?.trim() || undefined,
        building: isOutdoorSurveyRoomId(roomId)
          ? undefined
          : roomSession.building ?? state.allRooms.find((r) => r.id === roomId)?.building,
        neighborhood: resolveRoomNeighborhood(state, roomId, roomSession),
        levelId: roomSession.levelId,
        gradeType: roomSession.gradeType,
        overallScore: detail?.overallScore ?? null,
        categoryScores: detail?.categoryScores ?? [],
        answeredCount: detail?.answeredCount ?? 0,
        totalCount: detail?.totalCount ?? 0,
        complete: detail
          ? isRoomComplete(
              detail,
              roomSession.gradeType,
              roomSession.roomType,
              state.school?.schoolClass,
            ) && (state.surveyType !== "closeout" || pendingDone)
          : false,
      }
    })
    .sort((a, b) => a.roomName.localeCompare(b.roomName))
}

export function SurveyProvider({ children }: { children: ReactNode }) {
  const [schools, setSchools] = useState<AisdSchoolOption[]>([])
  const [schoolsLoading, setSchoolsLoading] = useState(true)
  const [schoolsLoadError, setSchoolsLoadError] = useState<string | null>(null)
  const [schoolsReloadNonce, setSchoolsReloadNonce] = useState(0)
  const reloadSchools = useCallback(() => setSchoolsReloadNonce((n) => n + 1), [])
  const [remoteConflictOpen, setRemoteConflictOpen] = useState(false)
  const [remoteConflict, setRemoteConflict] = useState<RemoteSurveyStatus | null>(null)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [remoteSchoolDrafts, setRemoteSchoolDrafts] = useState<PersistedSurveyDraft[] | null>(null)
  const [remoteDraftsConfigured, setRemoteDraftsConfigured] = useState(false)
  const [remoteSchoolDraftsLoading, setRemoteSchoolDraftsLoading] = useState(false)
  const [resultsInitialTab, setResultsInitialTab] = useState<
    "campus" | "room" | "neighborhood" | "compare" | "photos" | null
  >(null)
  const [floorPlanDisplayRequests, setFloorPlanDisplayRequests] = useState(0)
  const [floorPlanDisplayLoading, setFloorPlanDisplayLoading] = useState(false)
  const lastSyncedSubmissionRef = useRef<string | null>(null)
  const surveyTypeBeforeConflictRef = useRef<SurveyType>("studios")
  const [state, dispatch] = useReducer(reducer, {
    surveyType: "studios",
    school: null,
    session: null,
    selectedRoomId: null,
    selectedLevelId: null,
    floorPlan: null,
    floorPlanLoading: false,
    allRooms: [],
    manualRooms: [],
    roomScores: {},
    roomScoreDetails: {},
    floorPlanRooms: {},
    view: "landing",
    submission: null,
    lastSavedAt: null,
    showResumeBanner: false,
    hydrated: false,
    weightOverrides: EMPTY_WEIGHT_OVERRIDES,
    assessorByType: {},
    submitValidation: null,
    pendingStudioType: null,
    preWalk: EMPTY_PREWALK,
    preWalkPromptPending: false,
    preWalkRequested: false,
  })

  useEffect(() => {
    let cancelled = false
    setSchoolsLoading(true)
    setSchoolsLoadError(null)

    loadAisdSchoolOptions()
      .then((options) => {
        if (cancelled) return
        setSchools(options)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error("Failed to load AISD schools", error)
        setSchools([])
        setSchoolsLoadError("Couldn't load the school list. Check your connection and try again.")
      })
      .finally(() => {
        if (!cancelled) setSchoolsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [schoolsReloadNonce])

  // Restore on reload after schools are ready (correct school identity is required for floor plans).
  // Keep !hydrated so the landing page never flashes while waiting.
  useLayoutEffect(() => {
    if (state.hydrated) return
    if (schoolsLoading) return

    runFieldDataResetIfNeeded()

    const assessors = loadAssessors()

    const resumable = loadResumableDraft()
    if (resumable) {
      markActiveVisit()
      const school =
        schools.find((s) => s.id === resumable.meta.schoolId) ?? schoolFromDraft(resumable.draft)
      dispatch({ type: "LOAD_ASSESSORS", assessors })
      dispatch({
        type: "RESTORE",
        school,
        draft: resumable.draft,
        showResumeBanner: false,
      })
      return
    }

    dispatch({ type: "LOAD_ASSESSORS", assessors })
  }, [schoolsLoading, schools, state.hydrated])

  // Replace provisional school (fallback only) with the full option once the list loads.
  useEffect(() => {
    if (!state.hydrated || !state.school || schoolsLoading || schools.length === 0) return
    const full = schools.find((s) => s.id === state.school!.id)
    if (!full) return
    if (
      full.hasFloorPlan === state.school.hasFloorPlan &&
      full.displayName === state.school.displayName &&
      full.schoolClass === state.school.schoolClass &&
      full.campusId === state.school.campusId &&
      full.name === state.school.name
    ) {
      return
    }
    dispatch({ type: "UPDATE_SCHOOL", school: full })
  }, [schools, schoolsLoading, state.hydrated, state.school])

  // Auto-save draft on every change (survives submit + browser close)
  useEffect(() => {
    if (!state.hydrated || !state.school || !state.session) return

    const savedAt = new Date().toISOString()
    saveDraft({
      schoolId: state.school.id,
      surveyType: state.surveyType,
      session: state.session,
      selectedLevelId: state.selectedLevelId,
      selectedRoomId: state.selectedRoomId,
      pendingStudioType: state.pendingStudioType,
      preWalk: state.preWalk,
      view:
        state.view === "admin" || state.view === "landing" ? "survey" : state.view,
      manualRooms: state.manualRooms,
      lastSubmission: state.submission,
      savedAt,
    })

    // Keep Studios ↔ Close Out drafts in sync when either side answers deferred items.
    if (state.surveyType === "closeout") {
      const sourceType =
        Object.values(state.session.rooms).find((r) => r.sourceSurveyType)?.sourceSurveyType ??
        "studios"
      const sourceDraft = loadDraft(state.school.id, sourceType)
      if (sourceDraft?.session) {
        const synced = syncCloseOutProgressToSource(state.session, sourceDraft.session)
        saveDraft(
          {
            ...sourceDraft,
            session: synced,
            savedAt,
          },
          { setActive: false },
        )
      }
    } else {
      const closeDraft = loadDraft(state.school.id, "closeout")
      if (closeDraft?.session) {
        const synced = syncSourceProgressToCloseOut(state.session, closeDraft.session)
        saveDraft(
          {
            ...closeDraft,
            session: synced,
            savedAt,
          },
          { setActive: false },
        )
      }
    }

    dispatch({ type: "MARK_SAVED", savedAt })
  }, [
    state.hydrated,
    state.school,
    state.session,
    state.surveyType,
    state.selectedLevelId,
    state.selectedRoomId,
    state.pendingStudioType,
    state.preWalk,
    state.view,
    state.manualRooms,
    state.submission,
  ])

  // Alert when another assessor has started/submitted this survey module online.
  useEffect(() => {
    if (!state.hydrated || !state.school) return

    const assessor = resolveCampusAssessor(state.assessorByType, state.surveyType)
    void fetchRemoteSurveyStatusClient({
      schoolId: state.school.id,
      surveyType: state.surveyType,
      assessorEmail: assessor?.email,
    }).then((status) => {
      if (status?.configured && status.conflict && status.hasRemote) {
        setRemoteConflict(status)
        setRemoteConflictOpen(true)
      }
    })
  }, [state.hydrated, state.school?.id, state.surveyType, state.assessorByType])

  const refreshRemoteSchoolDrafts = useCallback(async () => {
    if (!state.school || !isBrowserOnline()) {
      setRemoteSchoolDrafts(null)
      setRemoteDraftsConfigured(false)
      return
    }

    setRemoteSchoolDraftsLoading(true)
    try {
      const result = await pullRemoteDraftsForSchoolClient(state.school.id)
      if (result.configured) {
        hydrateLocalDraftsFromRemote(result.drafts, state.school.id)
        setRemoteDraftsConfigured(true)
        setRemoteSchoolDrafts(result.drafts)
      } else {
        setRemoteDraftsConfigured(false)
        setRemoteSchoolDrafts(null)
      }
    } finally {
      setRemoteSchoolDraftsLoading(false)
    }
  }, [state.school])

  useEffect(() => {
    if (!state.school) {
      setRemoteSchoolDrafts(null)
      setRemoteDraftsConfigured(false)
      return
    }
    void refreshRemoteSchoolDrafts()
  }, [state.school?.id, refreshRemoteSchoolDrafts])

  useEffect(() => {
    if (state.view !== "results" || !state.school) return
    void refreshRemoteSchoolDrafts()
  }, [state.view, state.school?.id, refreshRemoteSchoolDrafts])

  // Debounced cloud sync when online (localStorage remains primary for offline).
  useEffect(() => {
    if (!state.hydrated || !state.school || !state.session || !state.lastSavedAt) return
    if (!sessionHasRegisteredAssessor(state.session)) return

    const school = state.school
    const surveyType = state.surveyType
    const timer = window.setTimeout(() => {
      const draft = loadDraft(school.id, surveyType)
      if (!draft) return

      const writeSnapshot =
        !!draft.lastSubmission &&
        draft.lastSubmission.submittedAt !== lastSyncedSubmissionRef.current

      void pushSurveyDraftClient({
        school,
        draft,
        writeSnapshot,
      }).then(async (result) => {
        if (result === "pushed" && writeSnapshot && draft.lastSubmission) {
          lastSyncedSubmissionRef.current = draft.lastSubmission.submittedAt
        }
        if (result === "pushed") {
          await refreshRemoteSchoolDrafts()
        }
        if (result === "skipped_remote_newer") {
          const remote = await pullRemoteDraftClient({ schoolId: school.id, surveyType })
          if (remote && remote.savedAt > draft.savedAt) {
            const localAnswers = countSessionResponses(draft.session)
            const remoteAnswers = countSessionResponses(remote.session)
            if (remoteAnswers >= localAnswers) {
              saveDraft(remote)
              dispatch({ type: "RESTORE", school, draft: remote, showResumeBanner: false })
            }
          }
        }
        setPendingSyncCount(0)
      })

      queueSurveySync(school.id, surveyType, state.lastSavedAt!)
    }, 2500)

    return () => window.clearTimeout(timer)
  }, [
    state.hydrated,
    state.school,
    state.session,
    state.surveyType,
    state.lastSavedAt,
    state.submission,
    refreshRemoteSchoolDrafts,
  ])

  useEffect(() => {
    const syncPendingCount = () => {
      try {
        const raw = localStorage.getItem("aisd-survey-sync-queue")
        const queue = raw ? (JSON.parse(raw) as unknown[]) : []
        setPendingSyncCount(Array.isArray(queue) ? queue.length : 0)
      } catch {
        setPendingSyncCount(0)
      }
    }

    syncPendingCount()

    const onOnline = () => {
      void flushSurveySyncQueue({
        schools,
        loadDraft,
        onRemoteNewer: () => syncPendingCount(),
      }).then(syncPendingCount)
    }

    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [schools])

  const dismissRemoteConflict = useCallback(() => {
    setRemoteConflictOpen(false)
  }, [])

  const closeRemoteConflict = useCallback(() => {
    setRemoteConflictOpen(false)
    if (!state.school) return

    const previousType = surveyTypeBeforeConflictRef.current
    if (previousType === state.surveyType) return

    const draft = loadDraft(state.school.id, previousType)
    dispatch({
      type: "SET_SURVEY_TYPE",
      surveyType: previousType,
      draft,
    })
  }, [state.school, state.surveyType])

  const loadRemoteSurveyDraft = useCallback(async (): Promise<boolean> => {
    if (!state.school) return false
    const remote = await pullRemoteDraftClient({
      schoolId: state.school.id,
      surveyType: state.surveyType,
    })
    if (!remote) return false
    saveDraft(remote)
    dispatch({ type: "RESTORE", school: state.school, draft: remote, showResumeBanner: false })
    setRemoteConflictOpen(false)
    return true
  }, [state.school, state.surveyType])

  const plan = state.floorPlan
  const levelId = state.selectedLevelId ?? plan?.defaultLevelId

  useEffect(() => {
    if (!state.school) return
    if (!state.school.hasFloorPlan) {
      const manualsOnly = mergeManualRooms([], state.manualRooms)
      if (state.floorPlan || state.allRooms.length !== manualsOnly.length) {
        dispatch({ type: "SET_FLOOR_PLAN", plan: null, rooms: [] })
      }
      return
    }
    if (state.floorPlan && state.allRooms.length > 0) return

    let cancelled = false
    dispatch({ type: "SET_FLOOR_PLAN_LOADING", loading: true })

    loadSchoolRoomsForSchool(state.school)
      .then(({ plan: loadedPlan, rooms }) => {
        if (cancelled) return
        dispatch({ type: "SET_FLOOR_PLAN", plan: loadedPlan, rooms })
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) dispatch({ type: "SET_FLOOR_PLAN", plan: null, rooms: [] })
      })

    return () => {
      cancelled = true
    }
    // Re-run when the school object is upgraded (campus/name/hasFloorPlan) so rooms reload.
  }, [state.school])

  const requestFloorPlanDisplay = useCallback(() => {
    setFloorPlanDisplayRequests((count) => count + 1)
  }, [])

  const releaseFloorPlanDisplay = useCallback(() => {
    setFloorPlanDisplayRequests((count) => Math.max(0, count - 1))
  }, [])

  const ensureFloorPlanLevel = useCallback(
    async (levelId: string) => {
      const school = state.school
      const plan = state.floorPlan
      if (!school?.hasFloorPlan || !plan) return

      const existing = plan.levels.find((level) => level.id === levelId)
      const inlineStale =
        existing?.src &&
        isInlineFloorPlanSrc(existing.src) &&
        !hasFloorPlanDisplayCache(school.id, levelId)
      if (existing?.src && !inlineStale) return

      setFloorPlanDisplayLoading(true)
      try {
        revokeFloorPlanBlobUrls(school.id)
        const level = await loadFloorPlanLevelDisplay(school, levelId)
        if (level) dispatch({ type: "PATCH_FLOOR_PLAN_LEVEL", level })
      } catch (err) {
        console.error(err)
      } finally {
        setFloorPlanDisplayLoading(false)
      }
    },
    [state.school, state.floorPlan],
  )

  useEffect(() => {
    if (floorPlanDisplayRequests === 0) {
      dispatch({ type: "STRIP_FLOOR_PLAN_DISPLAY" })
      return
    }
    if (!state.school?.hasFloorPlan || !state.floorPlan) return

    const levelId = state.selectedLevelId ?? state.floorPlan.defaultLevelId
    void ensureFloorPlanLevel(levelId)
  }, [
    floorPlanDisplayRequests,
    state.school,
    state.floorPlan,
    state.selectedLevelId,
    ensureFloorPlanLevel,
  ])

  useEffect(() => {
    dispatch({ type: "RECALC_SCORES" })
  }, [state.session, state.allRooms, state.surveyType, state.weightOverrides])

  const hasCustomWeights = hasActiveWeightOverrides(state.weightOverrides)

  const levelRooms = useMemo(
    () => state.allRooms.filter((r) => r.levelId === levelId),
    [state.allRooms, levelId],
  )

  const classroomRooms = useMemo(() => {
    const rooms = levelRooms.filter(isClassroomRoom)
    if (state.surveyType !== "closeout" || !state.session) return rooms
    return rooms.filter((r) => {
      const rs = state.session!.rooms[r.id]
      return !!rs && roomNeedsCloseOut(rs)
    })
  }, [levelRooms, state.surveyType, state.session])

  const surveyedRooms = useMemo(() => buildScoredRoomEntries(state), [state])

  const scoringDrafts = useMemo(() => {
    if (!state.school) return undefined
    const local = loadDraftsForSchool(state.school.id)
    if (!remoteDraftsConfigured || remoteSchoolDrafts === null) {
      return local.length ? local : undefined
    }
    const merged = mergeSchoolDrafts(local, remoteSchoolDrafts)
    return merged.length ? merged : undefined
  }, [remoteDraftsConfigured, remoteSchoolDrafts, state.school?.id])

  const campusSnapshotInput = useMemo(
    () =>
      state.school
        ? {
            schoolId: state.school.id,
            schoolName: state.school.displayName,
            campusId: state.school.campusId,
            schoolClass: state.school.schoolClass,
            drafts: scoringDrafts,
            ...(state.view === "results"
              ? {}
              : {
                  liveSurveyType: state.surveyType,
                  liveSession: state.session,
                  liveRoomScoreDetails: state.roomScoreDetails,
                  liveNeighborhoodResolver: (roomId: string, roomSession: RoomSurveySession) => {
                    const fromSession = roomSession.neighborhood?.trim()
                    if (fromSession) return fromSession
                    return state.allRooms.find((r) => r.id === roomId)?.neighborhood?.trim()
                  },
                }),
          }
        : null,
    [
      state.school,
      state.view,
      scoringDrafts,
      state.surveyType,
      state.session,
      state.roomScoreDetails,
      state.allRooms,
    ],
  )

  const schoolHasResultsFlag = useMemo(
    () => (campusSnapshotInput ? schoolHasResults(campusSnapshotInput) : false),
    [campusSnapshotInput],
  )

  const schoolScoredRoomCountValue = useMemo(
    () => (campusSnapshotInput ? schoolScoredRoomCount(campusSnapshotInput) : 0),
    [campusSnapshotInput],
  )

  const findSubmittedRoomAssessmentForSchool = useCallback(
    (roomId: string) =>
      state.school
        ? findSubmittedRoomAssessment(state.school.id, roomId, scoringDrafts)
        : null,
    [state.school, scoringDrafts],
  )

  const currentRoomSession =
    state.selectedRoomId && state.session ? state.session.rooms[state.selectedRoomId] ?? null : null

  const traditionalStudioCopyOffer = useMemo(() => {
    if (!state.selectedRoomId || !currentRoomSession || !state.session) return null
    const offer = getTraditionalStudioCopyOffer({
      surveyType: state.surveyType,
      schoolClass: state.school?.schoolClass,
      session: state.session,
      allRooms: state.allRooms,
      roomId: state.selectedRoomId,
      room: currentRoomSession,
    })
    if (!offer) return null
    return {
      ...offer,
      sourceRoomName: roomDisplayName(state, offer.sourceRoomId),
    }
  }, [
    state.selectedRoomId,
    state.surveyType,
    state.school?.schoolClass,
    state.session,
    state.allRooms,
    currentRoomSession,
  ])

  const currentRoomScore = state.selectedRoomId
    ? state.roomScoreDetails[state.selectedRoomId] ?? null
    : null

  const canSubmit = surveyedRooms.length > 0
  const completeCount = surveyedRooms.filter((r) => r.complete).length
  const submitHint = canSubmit
    ? state.surveyType === "outdoor"
      ? `${completeCount ? "Outdoor survey complete" : "Outdoor survey in progress"} · auto-saved`
      : `${surveyedRooms.length} room${surveyedRooms.length === 1 ? "" : "s"} in progress${completeCount ? ` · ${completeCount} complete` : ""} · auto-saved`
    : state.surveyType === "outdoor"
      ? "Answer outdoor questions to save progress"
      : state.surveyType === "closeout"
        ? "Finish deferred questions below, then submit the campus assessment"
        : "Score at least one room to save progress"

  const closeOutPending = useMemo(() => {
    if (state.surveyType !== "closeout" || !state.session) {
      return { roomIds: [] as string[], roomLabels: [] as string[] }
    }
    const roomIds = Object.values(state.session.rooms)
      .filter((room) => roomNeedsCloseOut(room))
      .map((room) => room.roomId)
      .sort((a, b) => roomDisplayName(state, a).localeCompare(roomDisplayName(state, b)))
    return {
      roomIds,
      roomLabels: roomIds.map((roomId) => roomDisplayName(state, roomId)),
    }
  }, [state.surveyType, state.session, state.allRooms, state.manualRooms])

  const canSubmitCampus = useMemo(() => {
    if (state.surveyType !== "closeout" || !state.session || !state.school) return false
    if (state.session.campusSubmittedAt) return false
    if (!isCloseOutSurveyComplete(state.session)) return false
    const hasSourceProgress = loadDraftsForSchool(state.school.id).some(
      (draft) =>
        draft.surveyType !== "closeout" &&
        (Object.values(draft.session.rooms).some(
          (room) => room.responses.length > 0 || !!room.gradeType,
        ) ||
          !!draft.lastSubmission),
    )
    return hasSourceProgress
  }, [state.surveyType, state.session, state.school])

  const submitCampusHint = useMemo(() => {
    if (state.session?.campusSubmittedAt) return "Campus assessment submitted"
    const pending = countCloseOutPendingItems(state.session)
    if (pending.rooms > 0) {
      return `Answer remaining Close Out items before submitting (${pending.questions} unanswered question${pending.questions === 1 ? "" : "s"})`
    }
    if (state.school) {
      const hasSourceProgress = loadDraftsForSchool(state.school.id).some(
        (draft) =>
          draft.surveyType !== "closeout" &&
          Object.values(draft.session.rooms).some(
            (room) => room.responses.length > 0 || !!room.gradeType,
          ),
      )
      if (!hasSourceProgress) {
        return "Complete at least one survey section before submitting the campus assessment"
      }
    }
    return "Ready to submit the full campus assessment · auto-saved"
  }, [state.session, state.school])

  const flaggedQuestionIds = useMemo(() => {
    if (!state.submitValidation || !state.selectedRoomId) return []
    const room = state.submitValidation.rooms.find((r) => r.roomId === state.selectedRoomId)
    return room?.missingQuestionIds ?? []
  }, [state.submitValidation, state.selectedRoomId])

  const currentResults = useMemo(() => buildSubmission(state) ?? state.submission, [state])

  const peekSubmitValidation = useCallback((): SubmitValidationResult | null => {
    if (!canSubmit || !state.session) return null
    // Close Out / unanswered deferral is scoped to the current room.
    if (!state.selectedRoomId) return { valid: true, rooms: [], firstIncompleteRoomId: null, firstMissingQuestionId: null }
    return validateSurveyBeforeDeferral(state.session, state.allRooms, state.surveyType, {
      roomId: state.selectedRoomId,
      schoolClass: state.school?.schoolClass,
    })
  }, [canSubmit, state.session, state.allRooms, state.surveyType, state.selectedRoomId, state.school?.schoolClass])

  const applyCurrentRoomDeferral = useCallback((): boolean => {
    if (!state.session || !state.school || !state.selectedRoomId) return false
    if (state.surveyType === "closeout") {
      dispatch({ type: "CLEAR_SUBMIT_VALIDATION" })
      return true
    }

    const assessor =
      state.assessorByType[state.surveyType] ?? assessorFromSession(state.session) ?? null
    const existingCloseOut = loadDraft(state.school.id, "closeout")?.session ?? null
    const { sourceSession, closeOutSession } = deferIncompleteToCloseOut(
      state.session,
      state.allRooms,
      existingCloseOut,
      assessor,
      { roomIds: [state.selectedRoomId], schoolClass: state.school.schoolClass },
    )

    const savedAt = new Date().toISOString()
    saveDraft(
      {
        schoolId: state.school.id,
        surveyType: "closeout",
        session: closeOutSession,
        selectedLevelId: state.selectedLevelId,
        lastSubmission: null,
        savedAt,
      },
      { setActive: false },
    )

    dispatch({
      type: "APPLY_CLOSEOUT_DEFERRAL",
      session: sourceSession,
      assessor,
    })
    dispatch({ type: "CLEAR_SUBMIT_VALIDATION" })
    return true
  }, [
    state.session,
    state.school,
    state.selectedRoomId,
    state.surveyType,
    state.assessorByType,
    state.allRooms,
    state.selectedLevelId,
  ])

  const submitSurvey = useCallback(
    (options?: { deferIncomplete?: boolean }) => {
      if (!canSubmit || !state.session || !state.school) return false

      if (options?.deferIncomplete) {
        if (state.surveyType === "closeout" || !state.selectedRoomId) {
          dispatch({ type: "CLEAR_SUBMIT_VALIDATION" })
          dispatch({ type: "SUBMIT" })
          return true
        }
        if (!applyCurrentRoomDeferral()) return false
        dispatch({ type: "SUBMIT" })
        return true
      }

      const validation = validateSurveyBeforeDeferral(state.session, state.allRooms, state.surveyType, {
        roomId: state.selectedRoomId,
        schoolClass: state.school?.schoolClass,
      })
      if (!validation.valid) {
        return false
      }

      dispatch({ type: "CLEAR_SUBMIT_VALIDATION" })
      dispatch({ type: "SUBMIT" })
      return true
    },
    [
      canSubmit,
      state.session,
      state.school,
      state.allRooms,
      state.surveyType,
      state.selectedRoomId,
      applyCurrentRoomDeferral,
    ],
  )

  const saveAndContinueToNextRoom = useCallback(
    (options?: { deferIncomplete?: boolean }) => {
      if (!state.session || !state.selectedRoomId) return false

      const currentIdx = classroomRooms.findIndex((r) => r.id === state.selectedRoomId)
      const next = currentIdx >= 0 ? classroomRooms[currentIdx + 1] : null
      if (!next) return false

      if (options?.deferIncomplete) {
        applyCurrentRoomDeferral()
      } else {
        const validation = validateSurveyBeforeDeferral(state.session, state.allRooms, state.surveyType, {
          roomId: state.selectedRoomId,
          schoolClass: state.school?.schoolClass,
        })
        if (!validation.valid) return false
        dispatch({ type: "CLEAR_SUBMIT_VALIDATION" })
      }

      // Clear studio type so the next room requires a fresh selection.
      dispatch({ type: "SET_PENDING_STUDIO_TYPE", roomType: null })
      dispatch({ type: "SELECT_ROOM", roomId: next.id })
      return true
    },
    [
      state.session,
      state.selectedRoomId,
      state.allRooms,
      state.surveyType,
      state.school?.schoolClass,
      classroomRooms,
      applyCurrentRoomDeferral,
    ],
  )

  const submitCampusAssessment = useCallback(() => {
    if (!canSubmitCampus || !state.session || !state.school) return false
    dispatch({ type: "SUBMIT_CAMPUS" })
    return true
  }, [canSubmitCampus, state.session, state.school])

  const setFinalComment = useCallback((comment: string) => {
    dispatch({ type: "SET_FINAL_COMMENT", comment })
  }, [])

  const setSurveyType = useCallback(
    (t: SurveyType, options?: { pendingStudioType?: string | null }) => {
      if (state.school) {
        if (t !== state.surveyType) {
          surveyTypeBeforeConflictRef.current = state.surveyType
        }
        const draft = loadDraft(state.school.id, t)
        dispatch({
          type: "SET_SURVEY_TYPE",
          surveyType: t,
          draft,
          pendingStudioType: options?.pendingStudioType,
        })
      } else {
        dispatch({
          type: "SET_SURVEY_TYPE",
          surveyType: t,
          pendingStudioType: options?.pendingStudioType,
        })
      }
    },
    [state.school, state.surveyType],
  )

  const setSchool = useCallback(
    (s: AisdSchoolOption | null) => {
      if (!s) {
        dispatch({ type: "SET_SCHOOL", school: null })
        return
      }
      const nextType = surveyTypeAvailableForSchool(state.surveyType, s.schoolClass)
        ? state.surveyType
        : "studios"
      const draft = loadDraft(s.id, nextType)
      if (nextType === state.surveyType) {
        dispatch({ type: "SET_SCHOOL", school: s, draft })
        return
      }
      dispatch({ type: "SET_SCHOOL", school: s })
      dispatch({ type: "SET_SURVEY_TYPE", surveyType: nextType, draft })
    },
    [state.surveyType],
  )

  const setLevel = useCallback((levelId: string) => dispatch({ type: "SET_LEVEL", levelId }), [])
  const selectRoom = useCallback((roomId: string | null) => dispatch({ type: "SELECT_ROOM", roomId }), [])
  const addManualRoom = useCallback(
    (roomNumber: string, building?: string) =>
      dispatch({ type: "ADD_MANUAL_ROOM", roomNumber, building }),
    [],
  )
  const setGrade = useCallback(
    (roomId: string, grade: string) => dispatch({ type: "SET_GRADE", roomId, gradeType: grade }),
    [],
  )
  const setNeighborhood = useCallback(
    (roomId: string, neighborhood: string) =>
      dispatch({ type: "SET_NEIGHBORHOOD", roomId, neighborhood }),
    [],
  )
  const setSchoolRoomNumber = useCallback(
    (roomId: string, schoolRoomNumber: string) =>
      dispatch({ type: "SET_SCHOOL_ROOM_NUMBER", roomId, schoolRoomNumber }),
    [],
  )
  const setPreWalkSpaceTypePhoto = useCallback(
    (surveyType: SurveyType, spaceType: string, photo: string | undefined, roomId?: string) =>
      dispatch({ type: "SET_PREWALK_SPACE_TYPE_PHOTO", surveyType, spaceType, roomId, photo }),
    [],
  )
  const setPreWalkMapping = useCallback(
    (surveyType: SurveyType, roomId: string, spaceType: string) =>
      dispatch({ type: "SET_PREWALK_MAPPING", surveyType, roomId, spaceType }),
    [],
  )
  const updatePreWalkNotes = useCallback(
    (surveyType: SurveyType, roomId: string, note1: string, note2: string) =>
      dispatch({ type: "UPDATE_PREWALK_NOTES", surveyType, roomId, note1, note2 }),
    [],
  )
  const removePreWalkMapping = useCallback(
    (surveyType: SurveyType, roomId: string) =>
      dispatch({ type: "REMOVE_PREWALK_MAPPING", surveyType, roomId }),
    [],
  )
  const clearPreWalkMappingsForSurvey = useCallback(
    (surveyType: SurveyType) =>
      dispatch({ type: "CLEAR_PREWALK_MAPPINGS_FOR_SURVEY", surveyType }),
    [],
  )
  const completePreWalk = useCallback(() => dispatch({ type: "COMPLETE_PREWALK" }), [])
  const skipPreWalk = useCallback(() => dispatch({ type: "SKIP_PREWALK" }), [])
  const answerPreWalkPrompt = useCallback(
    (choice: "map" | "skip") => dispatch({ type: "ANSWER_PREWALK_PROMPT", choice }),
    [],
  )
  const setRoomType = useCallback(
    (roomId: string, roomType: string) => dispatch({ type: "SET_ROOM_TYPE", roomId, roomType }),
    [],
  )
  const setPendingStudioType = useCallback(
    (roomType: string | null) => dispatch({ type: "SET_PENDING_STUDIO_TYPE", roomType }),
    [],
  )
  const setResponse = useCallback(
    (roomId: string, response: RoomQuestionResponse) => dispatch({ type: "SET_RESPONSE", roomId, response }),
    [],
  )
  const acknowledgeTraditionalStudioCopyReview = useCallback(
    (roomId: string) => dispatch({ type: "ACK_TRADITIONAL_STUDIO_COPY_REVIEW", roomId }),
    [],
  )
  const applyTraditionalStudioCopy = useCallback(
    (roomId: string) => dispatch({ type: "APPLY_TRADITIONAL_STUDIO_COPY", roomId }),
    [],
  )
  const setView = useCallback((view: SurveyView) => dispatch({ type: "SET_VIEW", view }), [])
  const openResults = useCallback(
    (tab: "campus" | "room" | "neighborhood" | "compare" | "photos" = "campus") => {
      setResultsInitialTab(tab)
      dispatch({ type: "SET_VIEW", view: "results" })
      void refreshRemoteSchoolDrafts()
    },
    [refreshRemoteSchoolDrafts],
  )
  const clearResultsInitialTab = useCallback(() => setResultsInitialTab(null), [])
  const continueSurvey = useCallback(() => dispatch({ type: "CONTINUE_SURVEY" }), [])
  const resetSurvey = useCallback(() => dispatch({ type: "RESET_SURVEY" }), [])
  const dismissResumeBanner = useCallback(() => dispatch({ type: "DISMISS_RESUME_BANNER" }), [])

  const placeOutdoorElementPin = useCallback(
    (elementType: string, lng: number, lat: number) =>
      dispatch({ type: "PLACE_OUTDOOR_ELEMENT_PIN", elementType, lng, lat }),
    [],
  )
  const removeOutdoorElementPin = useCallback(
    (pinId: string) => dispatch({ type: "REMOVE_OUTDOOR_ELEMENT_PIN", pinId }),
    [],
  )

  const setCategoryWeight = useCallback((category: string, weight: number | null) => {
    dispatch({ type: "SET_WEIGHT_OVERRIDE", level: "category", key: category, weight })
  }, [])

  const setSubcategoryWeight = useCallback((category: string, subcategory: string, weight: number | null) => {
    dispatch({
      type: "SET_WEIGHT_OVERRIDE",
      level: "subcategory",
      key: subcategoryOverrideKey(category, subcategory),
      weight,
    })
  }, [])

  const setQuestionWeight = useCallback((questionId: string, weight: number | null) => {
    dispatch({ type: "SET_WEIGHT_OVERRIDE", level: "question", key: questionId, weight })
  }, [])

  const resetWeightOverrides = useCallback(() => dispatch({ type: "RESET_WEIGHT_OVERRIDES" }), [])

  const hasAssessorRegistered =
    hasActiveVisit() &&
    (!!resolveCampusAssessor(state.assessorByType) ||
      (state.surveyType === "closeout" && isAssessorRegistered(state.assessorByType.studios)))

  const registerAssessor = useCallback((name: string, email: string) => {
    markActiveVisit()
    dispatch({ type: "REGISTER_ASSESSOR", surveyType: state.surveyType, name, email })
  }, [state.surveyType])

  const logoutAssessor = useCallback(() => {
    dispatch({ type: "CLEAR_ASSESSOR", surveyType: state.surveyType })
  }, [state.surveyType])

  const surveyTypeInfos = useMemo(() => {
    const schoolId = state.school?.id ?? null
    const classroomRoomsForSchool = state.allRooms.filter(isClassroomRoom)
    return Object.fromEntries(
      SURVEY_TYPES.map((t) => [
        t,
        getSurveyTypeInfo(t, schoolId, state.assessorByType, {
          classroomRooms: classroomRoomsForSchool,
          liveSession: t === state.surveyType ? state.session : undefined,
          schoolClass: state.school?.schoolClass,
        }),
      ]),
    ) as Record<SurveyType, SurveyTypeInfo>
  }, [
    state.school?.id,
    state.school?.schoolClass,
    state.assessorByType,
    state.lastSavedAt,
    state.surveyType,
    state.session,
    state.allRooms,
    state.submission,
    remoteSchoolDrafts,
    remoteDraftsConfigured,
  ])

  return (
    <SurveyContext.Provider
      value={{
        state,
        submission: state.submission,
        schools,
        schoolsLoading,
        schoolsLoadError,
        reloadSchools,
        lastSavedAt: state.lastSavedAt,
        setSurveyType,
        setSchool,
        setLevel,
        selectRoom,
        addManualRoom,
        setGrade,
        setNeighborhood,
        setSchoolRoomNumber,
        setPreWalkMapping,
        setPreWalkSpaceTypePhoto,
        updatePreWalkNotes,
        removePreWalkMapping,
        clearPreWalkMappingsForSurvey,
        completePreWalk,
        skipPreWalk,
        answerPreWalkPrompt,
        setRoomType,
        setPendingStudioType,
        setResponse,
        applyTraditionalStudioCopy,
        acknowledgeTraditionalStudioCopyReview,
        traditionalStudioCopyOffer,
        submitSurvey,
        saveAndContinueToNextRoom,
        submitCampusAssessment,
        setFinalComment,
        peekSubmitValidation,
        setView,
        continueSurvey,
        resetSurvey,
        dismissResumeBanner,
        levelRooms,
        classroomRooms,
        surveyedRooms,
        currentRoomSession,
        currentRoomScore,
        canSubmit,
        submitHint,
        canSubmitCampus,
        submitCampusHint,
        closeOutPending,
        currentResults,
        hasCustomWeights,
        setCategoryWeight,
        setSubcategoryWeight,
        setQuestionWeight,
        resetWeightOverrides,
        hasAssessorRegistered,
        registerAssessor,
        logoutAssessor,
        surveyTypeInfos,
        flaggedQuestionIds,
        submitValidation: state.submitValidation,
        outdoorElementPins: state.session?.outdoorElementPins ?? [],
        placeOutdoorElementPin,
        removeOutdoorElementPin,
        remoteConflictOpen,
        remoteConflict,
        dismissRemoteConflict,
        closeRemoteConflict,
        loadRemoteSurveyDraft,
        pendingSyncCount,
        remoteSchoolDrafts,
        remoteDraftsConfigured,
        remoteSchoolDraftsLoading,
        refreshRemoteSchoolDrafts,
        scoringDrafts,
        schoolHasResults: schoolHasResultsFlag,
        schoolScoredRoomCount: schoolScoredRoomCountValue,
        findSubmittedRoomAssessment: findSubmittedRoomAssessmentForSchool,
        resultsInitialTab,
        openResults,
        clearResultsInitialTab,
        floorPlanDisplayLoading,
        requestFloorPlanDisplay,
        releaseFloorPlanDisplay,
        ensureFloorPlanLevel,
      }}
    >
      {children}
    </SurveyContext.Provider>
  )
}

export function useSurvey() {
  const ctx = useContext(SurveyContext)
  if (!ctx) throw new Error("useSurvey must be used within SurveyProvider")
  return ctx
}
