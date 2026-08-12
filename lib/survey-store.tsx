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
  isCampusScopedSurveyType,
  isElementaryGrade,
  isKnownSurveySpaceType,
  isOutdoorSpaceType,
  isNeighborhoodSurveyRoomId,
  isOutdoorSurveyRoomId,
  isAbsentSpaceTypeRoomId,
  absentSpaceTypeRoomId,
  absentSpaceTypeRoomDisplayName,
  parseAbsentSpaceTypeRoomId,
  spaceTypeExistenceKey,
  readSpaceTypeExistsAtSchool,
  isNeighborhoodOnlySpaceType,
  neighborhoodSurveyRoomId,
  spaceTypeFromNeighborhoodSurveyRoomId,
  isRoomComplete,
  isSecondaryGrade,
  neighborhoodFromSurveyRoomId,
  neighborhoodSurveyRoomDisplayName,
  OUTDOOR_SURVEY_ROOM_ID,
  outdoorSurveyRoomDisplayName,
  subcategoryOverrideKey,
  toFloorPlanRoom,
  isClassroomRoom,
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
  propagatePreWalkToSchoolDrafts,
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
  assessorEmailsMatch,
  assessorFromSession,
  assessorSessionFields,
  isAssessorRegistered,
  resolveCampusAssessor,
  sessionHasRegisteredAssessor,
  shouldStampSessionAssessor,
  withCampusAssessorOnSession,
} from "@/lib/assessor"
import { getSurveyTypeInfo, type SurveyTypeInfo } from "@/lib/survey-status"
import { SURVEY_TYPES } from "@aisd/shared"
import { validateSurveyBeforeDeferral, validateRoomSession, type SubmitValidationResult } from "@/lib/survey-validation"
import {
  loadFloorPlanLevelDisplay,
  hasFloorPlanDisplayCache,
  isInlineFloorPlanSrc,
  loadSchoolRoomsForSchool,
  releaseFloorPlanDisplayMemory,
  restoreFloorPlanLevelFromCache,
  revokeFloorPlanBlobUrls,
} from "@/lib/floor-plan-loader"
import { deferFloorPlanDisplayWork, preferMobileFloorPlan, useMobileFloorPlanFiles } from "@/lib/floor-plans"
import { loadAisdSchoolOptions } from "@/lib/load-aisd-schools"
import {
  deferIncompleteToCloseOut,
  countCloseOutPendingItems,
  isCloseOutSurveyComplete,
  rebuildCloseOutFromSourceSurveys,
  refreshCloseOutDraftFromSources,
  roomNeedsCloseOut,
  syncCloseOutProgressToSource,
  syncSourceProgressToCloseOut,
  withPendingUpdatedForGrade,
  withPendingUpdatedForResponse,
} from "@/lib/closeout"
import { buildCampusScoringSnapshot } from "@/lib/campus-scoring-tree"
import { EMPTY_PREWALK, getPreWalkMappingForSurveyModule, migratePreWalkState, preWalkHasAssignments, preWalkHasCloudState, preWalkMappingKey, preWalkRoomIdsForSurvey, preWalkRoomSpaceTypePhotoKey, preWalkSpaceTypeForRoom, preWalkSpaceTypePhotoKey } from "@/lib/prewalk"
import { applyTraditionalStudioCopyToRoom, getTraditionalStudioCopyOffer } from "@/lib/traditional-studio-copy"
import { scoreRoomSessionWithMetadata, scoreAbsentSpaceTypeRoom } from "@/lib/traditional-studio-room-score"
import {
  fetchRemoteSurveyStatusClient,
  flushSurveySyncQueue,
  isBrowserOnline,
  pullRemoteDraftClient,
  pullRemoteDraftsForSchoolClient,
  pushSurveyDraftClient,
  pushPrewalkClient,
  pullPrewalkClient,
  getPendingSyncCount,
} from "@/lib/survey-remote-sync"
import type { RemoteSurveyStatus } from "@/lib/survey-remote-types"
import {
  findSubmittedRoomAssessment,
  roomHasAssessmentProgress,
  schoolHasResults,
  schoolScoredRoomCount,
  type SubmittedRoomAssessment,
} from "@/lib/school-assessment-index"
import {
  mergeSchoolDrafts,
} from "@/lib/school-draft-merge"

export type SurveyView = "landing" | "admin" | "home" | "survey" | "results"

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
  pendingNeighborhood: string | null
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
  | { type: "MERGE_PREWALK"; preWalk: PreWalkState }
  | { type: "PREWALK_PULL_DONE" }
  | { type: "SET_ROOM_TYPE"; roomId: string; roomType: string }
  | { type: "SET_PENDING_STUDIO_TYPE"; roomType: string | null }
  | { type: "SET_PENDING_NEIGHBORHOOD"; neighborhood: string | null }
  | { type: "SET_SPACE_TYPE_EXISTS"; spaceType: string; exists: boolean }
  | { type: "SET_RESPONSE"; roomId: string; response: RoomQuestionResponse }
  | { type: "APPLY_TRADITIONAL_STUDIO_COPY"; roomId: string }
  | { type: "ACK_TRADITIONAL_STUDIO_COPY_REVIEW"; roomId: string }
  | { type: "RECALC_SCORES" }
  | { type: "SUBMIT" }
  | { type: "SUBMIT_AND_CONTINUE" }
  | { type: "DISCARD_CURRENT_ASSESSMENT" }
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
  | { type: "SUBMIT_CAMPUS"; allowIncomplete?: boolean }

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

/** Space type covers Studios types plus dedicated module space types (admin, athletics, CTE, …). */
function isPendingSpaceType(value: string | null | undefined): boolean {
  return isKnownSurveySpaceType(value)
}

function roomHasSurveyStarted(session: RoomSurveySession): boolean {
  return (
    session.responses.length > 0 ||
    !!session.gradeType ||
    !!session.deferredToCloseOut
  )
}

function currentAssessmentSpaceType(state: SurveyState): string {
  if (state.pendingStudioType && isPendingSpaceType(state.pendingStudioType)) {
    return state.pendingStudioType
  }
  if (state.selectedRoomId && state.session) {
    const existing = state.session.rooms[state.selectedRoomId]
    if (existing?.roomType && isPendingSpaceType(existing.roomType)) {
      return existing.roomType
    }
  }
  return ""
}

function currentAssessmentNeighborhood(state: SurveyState): string {
  if (state.surveyType !== "neighborhoods") return ""
  const pending = state.pendingNeighborhood?.trim()
  if (pending) return pending
  if (state.selectedRoomId && state.session) {
    return state.session.rooms[state.selectedRoomId]?.neighborhood?.trim() ?? ""
  }
  return ""
}

function hasCurrentAssessmentToDiscard(state: SurveyState): boolean {
  if (!state.session) return false
  if (state.surveyType === "outdoor") {
    return Object.values(state.session.rooms).some((room) => roomHasAssessmentProgress(room))
  }
  const spaceType = currentAssessmentSpaceType(state)
  const neighborhood = currentAssessmentNeighborhood(state)
  if (spaceType) {
    const existenceKey = spaceTypeExistenceKey(spaceType, neighborhood || null)
    if (state.session.spaceTypeExistsAtSchool?.[existenceKey] !== undefined) return true
    const absentId = absentSpaceTypeRoomId(spaceType, neighborhood || null)
    if (state.session.rooms[absentId]) return true
  }
  if (state.selectedRoomId) {
    const room = state.session.rooms[state.selectedRoomId]
    if (room && (roomHasAssessmentProgress(room) || room.spaceTypeMarkedAbsent)) return true
  }
  if (state.pendingStudioType || state.pendingNeighborhood?.trim()) return true
  return false
}

function resolveRoomType(
  state: SurveyState,
  roomId: string,
  existing?: RoomSurveySession,
): string {
  if (isOutdoorSurveyRoomId(roomId) && state.surveyType === "outdoor") {
    return "Outdoor Spaces"
  }
  if (isNeighborhoodSurveyRoomId(roomId) && state.surveyType === "neighborhoods") {
    return (
      spaceTypeFromNeighborhoodSurveyRoomId(roomId) ??
      (isNeighborhoodOnlySpaceType(state.surveyType, state.pendingStudioType)
        ? state.pendingStudioType!
        : "Neighborhood")
    )
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
  const absent = parseAbsentSpaceTypeRoomId(roomId)
  if (absent) return absentSpaceTypeRoomDisplayName(absent.spaceType, absent.neighborhood)
  const neighborhoodLabel = neighborhoodFromSurveyRoomId(roomId)
  if (neighborhoodLabel) return neighborhoodSurveyRoomDisplayName(neighborhoodLabel)
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
  const absentParsed = parseAbsentSpaceTypeRoomId(roomId)
  if (absentParsed) {
    const label = absentSpaceTypeRoomDisplayName(absentParsed.spaceType, absentParsed.neighborhood)
    return {
      ...(existing ?? {}),
      roomId,
      roomNumber: label,
      roomType: absentParsed.spaceType,
      gradeType: existing?.gradeType ?? "",
      neighborhood: absentParsed.neighborhood ?? existing?.neighborhood ?? "",
      preWalkNote1: existing?.preWalkNote1 ?? "",
      preWalkNote2: existing?.preWalkNote2 ?? "",
      levelId: "campus",
      responses: existing?.spaceTypeMarkedAbsent ? existing.responses : [],
      spaceTypeMarkedAbsent: true,
    }
  }

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

  const neighborhoodLabel = neighborhoodFromSurveyRoomId(roomId)
  if (neighborhoodLabel && state.surveyType === "neighborhoods") {
    const label = neighborhoodSurveyRoomDisplayName(neighborhoodLabel)
    const roomType =
      spaceTypeFromNeighborhoodSurveyRoomId(roomId) ??
      (isNeighborhoodOnlySpaceType(state.surveyType, state.pendingStudioType)
        ? state.pendingStudioType!
        : "Neighborhood")
    if (existing) {
      return {
        ...existing,
        roomType: existing.roomType?.trim() || roomType,
        roomNumber: existing.roomNumber?.trim() || label,
        neighborhood: neighborhoodLabel,
        levelId: "campus",
      }
    }
    return {
      roomId,
      roomNumber: label,
      roomType,
      gradeType: "",
      neighborhood: neighborhoodLabel,
      preWalkNote1: "",
      preWalkNote2: "",
      levelId: "campus",
      responses: [],
    }
  }

  const planRoom = state.allRooms.find((r) => r.id === roomId)
  const lookupNeighborhood = lookupNeighborhoodFromPlan(planRoom)
  const pendingNeighborhood = state.pendingNeighborhood?.trim() ?? ""
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
        : pendingNeighborhood || lookupNeighborhood || existing.neighborhood || "",
      preWalkNote1: existing.preWalkNote1 ?? preWalkMapping?.note1 ?? "",
      preWalkNote2: existing.preWalkNote2 ?? preWalkMapping?.note2 ?? "",
    }
  }
  return {
    roomId,
    roomNumber: roomId,
    roomType,
    gradeType: "",
    neighborhood: pendingNeighborhood || lookupNeighborhood,
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
  // Keep this browser's logged-in user. Draft session.assessor* is document
  // authorship, not a login — copying it here logged people in as whoever started the survey.
  const stamped = withCampusAssessorOnSession(
    draft.session,
    assessorByType,
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
    pendingNeighborhood: draft.pendingNeighborhood ?? null,
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

  const newlyComplete: ScoredRoomEntry[] = []
  for (const [roomId, roomSession] of Object.entries(state.session.rooms)) {
    if (!roomSurveyComplete(state, roomId, roomSession)) continue
    const detail = state.roomScoreDetails[roomId]
    newlyComplete.push({
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
      complete: true,
    })
  }

  const priorRooms = state.submission?.campus?.rooms ?? []
  const merged = new Map<string, ScoredRoomEntry>()
  for (const room of priorRooms) {
    if (room.complete !== false) merged.set(room.roomId, room)
  }
  for (const room of newlyComplete) {
    merged.set(room.roomId, room)
  }

  const mergedRooms = [...merged.values()]
  if (mergedRooms.length === 0) return null

  const campus = aggregateCampusScores(mergedRooms, {
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
      const restored = stateFromDraft(
        action.school,
        action.draft,
        action.showResumeBanner ?? false,
        state.assessorByType,
        sameSchool ? state.allRooms : [],
        sameSchool ? state.floorPlan : null,
      )
      // Keep in-progress picker choices when a background sync restores an older remote draft.
      return {
        ...restored,
        pendingStudioType: state.pendingStudioType ?? restored.pendingStudioType,
        pendingNeighborhood: state.pendingNeighborhood ?? restored.pendingNeighborhood,
      }
    }
    case "UPDATE_SCHOOL": {
      if (!state.school || state.school.id !== action.school.id) return state
      const identityChanged =
        state.school.campusId !== action.school.campusId ||
        state.school.name !== action.school.name ||
        state.school.hasFloorPlan !== action.school.hasFloorPlan
      // Do not wipe an in-flight floor-plan load when metadata (e.g. schoolClass) catches up.
      const shouldReloadPlan =
        (identityChanged && action.school.hasFloorPlan) ||
        (action.school.hasFloorPlan &&
          state.allRooms.length === 0 &&
          !state.floorPlan &&
          !state.floorPlanLoading)
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
      const previousForType = state.assessorByType[action.surveyType]
      const assessorByType = { ...state.assessorByType, [action.surveyType]: info }
      saveAssessors(assessorByType)

      const session =
        state.session && shouldStampSessionAssessor(state.session, info, previousForType)
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

      return {
        ...state,
        assessorByType,
        view: state.school ? "home" : "landing",
      }
    }
    case "SET_SURVEY_TYPE": {
      if (!state.school) {
        return { ...state, surveyType: action.surveyType, submission: null, showResumeBanner: false }
      }
      if (action.surveyType === "closeout") {
        const existingDraft = action.draft ?? loadDraft(state.school.id, "closeout")
        const hasCloseOutProgress =
          !!existingDraft?.session &&
          (Object.keys(existingDraft.session.rooms).length > 0 ||
            !!existingDraft.session.finalComment?.trim())

        let prepared: PersistedSurveyDraft
        if (hasCloseOutProgress && existingDraft) {
          const sourceSessions = loadDraftsForSchool(state.school.id).map((draft) => draft.session)
          const session = refreshCloseOutDraftFromSources({
            existingCloseOut: existingDraft.session,
            sourceSessions,
            allRooms: state.allRooms,
            schoolClass: state.school.schoolClass,
          })
          prepared = {
            ...existingDraft,
            session,
            savedAt: new Date().toISOString(),
          }
        } else {
          prepared = prepareCloseOutDraft(
            state.school,
            existingDraft,
            state.allRooms,
            state.assessorByType,
          )
        }

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
        pendingNeighborhood: null,
        preWalk: state.preWalk,
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
          view: "landing",
          submission: null,
          showResumeBanner: false,
          weightOverrides: EMPTY_WEIGHT_OVERRIDES,
          pendingStudioType: null,
          pendingNeighborhood: null,
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
        // School switch lands on campus home unless the draft was mid-module work.
        const draftView = restored.view === "survey" || restored.view === "results" ? restored.view : "home"
        return bootstrapCampusScopedSurvey({ ...restored, view: draftView })
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
        view: "home",
        submission: null,
        showResumeBanner: false,
        weightOverrides: EMPTY_WEIGHT_OVERRIDES,
        pendingStudioType: null,
        pendingNeighborhood: null,
        preWalk: EMPTY_PREWALK,
        preWalkPromptPending: false,
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
            level.id === action.level.id ? action.level : level,
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
        return { ...state, selectedRoomId: null, view: "survey" }
      }
      const campusRoom =
        isOutdoorSurveyRoomId(action.roomId) && state.surveyType === "outdoor"
      const neighborhoodSurveyRoom =
        isNeighborhoodSurveyRoomId(action.roomId) && state.surveyType === "neighborhoods"
      const room =
        campusRoom || neighborhoodSurveyRoom
          ? undefined
          : state.allRooms.find((r) => r.id === action.roomId)
      const closeOutSessionRoom =
        state.surveyType === "closeout" ? state.session?.rooms[action.roomId] : undefined
      if (!campusRoom && !neighborhoodSurveyRoom && !room && state.session && !closeOutSessionRoom) {
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
      const clearNeighborhood = action.roomType !== state.pendingStudioType
      const switchingNeighborhoodOnly =
        isNeighborhoodSurveyRoomId(state.selectedRoomId) ||
        isNeighborhoodOnlySpaceType(state.surveyType, action.roomType) ||
        isNeighborhoodOnlySpaceType(state.surveyType, state.pendingStudioType)
      if (switchingNeighborhoodOnly && clearNeighborhood) {
        return {
          ...state,
          pendingStudioType: action.roomType,
          pendingNeighborhood: null,
          selectedRoomId: null,
        }
      }
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
          pendingNeighborhood: clearNeighborhood ? null : state.pendingNeighborhood,
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
      return {
        ...state,
        pendingStudioType: action.roomType,
        pendingNeighborhood: clearNeighborhood ? null : state.pendingNeighborhood,
        ...(clearNeighborhood && state.surveyType === "neighborhoods"
          ? { selectedRoomId: null }
          : {}),
      }
    }
    case "SET_PENDING_NEIGHBORHOOD": {
      const neighborhood = action.neighborhood?.trim() ?? ""
      const nextNeighborhood = neighborhood || null
      const neighborhoodOnly =
        state.surveyType === "neighborhoods" &&
        isNeighborhoodOnlySpaceType(state.surveyType, state.pendingStudioType)
      if (!neighborhoodOnly) {
        return { ...state, pendingNeighborhood: nextNeighborhood }
      }
      if (!nextNeighborhood || !state.pendingStudioType) {
        return { ...state, pendingNeighborhood: nextNeighborhood, selectedRoomId: null }
      }
      const exists = readSpaceTypeExistsAtSchool(
        state.session,
        state.pendingStudioType,
        nextNeighborhood,
      )
      if (exists !== true || !state.session) {
        return { ...state, pendingNeighborhood: nextNeighborhood, selectedRoomId: null }
      }
      const roomId = neighborhoodSurveyRoomId(nextNeighborhood, state.pendingStudioType)
      const ensured = ensureRoomSession(
        { ...state, pendingNeighborhood: nextNeighborhood },
        roomId,
        state.session.rooms[roomId],
      )
      return {
        ...state,
        pendingNeighborhood: nextNeighborhood,
        selectedRoomId: roomId,
        session: {
          ...state.session,
          updatedAt: new Date().toISOString(),
          rooms: {
            ...state.session.rooms,
            [roomId]: {
              ...ensured,
              neighborhood: nextNeighborhood,
              roomType: state.pendingStudioType,
            },
          },
        },
      }
    }
    case "SET_SPACE_TYPE_EXISTS": {
      if (!state.session) return state
      const neighborhood =
        state.surveyType === "neighborhoods" ? state.pendingNeighborhood?.trim() ?? "" : ""
      const existenceKey = spaceTypeExistenceKey(action.spaceType, neighborhood || null)
      const spaceTypeExistsAtSchool = {
        ...(state.session.spaceTypeExistsAtSchool ?? {}),
        [existenceKey]: action.exists,
      }
      let selectedRoomId = state.selectedRoomId
      const absentRoomId = absentSpaceTypeRoomId(action.spaceType, neighborhood || null)

      let session: SurveySession = {
        ...state.session,
        spaceTypeExistsAtSchool,
        updatedAt: new Date().toISOString(),
        rooms: { ...state.session.rooms },
      }

      if (!action.exists) {
        const ensured = ensureRoomSession({ ...state, session }, absentRoomId)
        session = {
          ...session,
          rooms: {
            ...session.rooms,
            [absentRoomId]: {
              ...ensured,
              roomType: action.spaceType,
              neighborhood: neighborhood || ensured.neighborhood || "",
              spaceTypeMarkedAbsent: true,
              responses: [],
            },
          },
        }
        // Keep the absent synthetic room selected so Save scopes to it (complete / score 0)
        // instead of clearing selection and failing validation against other unfinished rooms.
        selectedRoomId = absentRoomId
      } else {
        if (session.rooms[absentRoomId]?.spaceTypeMarkedAbsent) {
          const { [absentRoomId]: _removed, ...restRooms } = session.rooms
          session = { ...session, rooms: restRooms }
        }

        const activeSpaceType = action.spaceType || state.pendingStudioType

        if (
          state.surveyType === "neighborhoods" &&
          neighborhood &&
          activeSpaceType &&
          isNeighborhoodOnlySpaceType(state.surveyType, activeSpaceType)
        ) {
          const roomId = neighborhoodSurveyRoomId(neighborhood, activeSpaceType)
          selectedRoomId = roomId
          const ensured = ensureRoomSession({ ...state, session }, roomId, session.rooms[roomId])
          session = {
            ...session,
            rooms: {
              ...session.rooms,
              [roomId]: { ...ensured, neighborhood, roomType: activeSpaceType },
            },
          }
        }
      }

      return reducer(
        {
          ...state,
          selectedRoomId,
          session,
        },
        { type: "RECALC_SCORES" },
      )
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
          ? withPendingUpdatedForGrade(gradedBase, action.gradeType, state.school?.schoolClass)
          : { ...gradedBase, gradeType: action.gradeType as RoomSurveySession["gradeType"] }
      const clearSelection =
        state.surveyType === "closeout" &&
        state.selectedRoomId === action.roomId &&
        !roomNeedsCloseOut(graded, state.school?.schoolClass)
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
      if (!state.session || action.surveyType !== state.surveyType) {
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
    case "MERGE_PREWALK": {
      const incoming = migratePreWalkState(action.preWalk, state.school?.schoolClass)
      const mappings = { ...incoming.mappings, ...state.preWalk.mappings }
      const spaceTypePhotos = {
        ...(incoming.spaceTypePhotos ?? {}),
        ...(state.preWalk.spaceTypePhotos ?? {}),
      }
      const preWalk = {
        mappings,
        spaceTypePhotos,
        completedAt: state.preWalk.completedAt ?? incoming.completedAt,
        skippedAt: state.preWalk.skippedAt ?? incoming.skippedAt,
      }
      // Campus home offers pre-walk — do not auto-prompt on school select.
      return {
        ...state,
        preWalk,
        preWalkPromptPending: false,
      }
    }
    case "PREWALK_PULL_DONE": {
      return {
        ...state,
        preWalkPromptPending: false,
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
        nextRoom = withPendingUpdatedForResponse(
          nextRoom,
          action.response,
          rubric.questions,
          state.school?.schoolClass,
        )
      } else if (rubric && (base.deferredQuestionIds?.length ?? 0) > 0) {
        const cleared = withPendingUpdatedForResponse(
          { ...nextRoom, pendingQuestionIds: [...(base.deferredQuestionIds ?? [])] },
          action.response,
          rubric.questions,
          state.school?.schoolClass,
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
        !roomNeedsCloseOut(nextRoom, state.school?.schoolClass)
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
        const neighborhoodSurveyRoom = isNeighborhoodSurveyRoomId(roomId)
        const absentRoom = isAbsentSpaceTypeRoomId(roomId) || roomSession.spaceTypeMarkedAbsent
        const parsed =
          campusRoom || neighborhoodSurveyRoom || absentRoom
            ? undefined
            : state.allRooms.find((r) => r.id === roomId)
        if (!parsed && !campusRoom && !neighborhoodSurveyRoom && !absentRoom) continue

        if (absentRoom) {
          const result = scoreAbsentSpaceTypeRoom(roomId)
          roomScoreDetails[roomId] = result
          roomScores[roomId] = 0
          continue
        }

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
    case "SUBMIT":
    case "SUBMIT_AND_CONTINUE": {
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
        view: action.type === "SUBMIT_AND_CONTINUE" ? "survey" : "results",
        submission,
        selectedRoomId: null,
        pendingStudioType: null,
        pendingNeighborhood: null,
        submitValidation: null,
        session: submission.session,
      }
    }
    case "DISCARD_CURRENT_ASSESSMENT": {
      if (!state.session || !state.school) return state

      const spaceType = currentAssessmentSpaceType(state)
      const neighborhood = currentAssessmentNeighborhood(state)
      const rooms = { ...state.session.rooms }
      const roomScores = { ...state.roomScores }
      const roomScoreDetails = { ...state.roomScoreDetails }
      const spaceTypeExistsAtSchool = { ...(state.session.spaceTypeExistsAtSchool ?? {}) }

      if (state.selectedRoomId) {
        delete rooms[state.selectedRoomId]
        delete roomScores[state.selectedRoomId]
        delete roomScoreDetails[state.selectedRoomId]
      }

      if (spaceType) {
        const absentId = absentSpaceTypeRoomId(spaceType, neighborhood || null)
        if (rooms[absentId]) {
          delete rooms[absentId]
          delete roomScores[absentId]
          delete roomScoreDetails[absentId]
        }
        delete spaceTypeExistsAtSchool[spaceTypeExistenceKey(spaceType, neighborhood || null)]
        if (neighborhood && isNeighborhoodOnlySpaceType(state.surveyType, spaceType)) {
          const nhId = neighborhoodSurveyRoomId(neighborhood, spaceType)
          delete rooms[nhId]
          delete roomScores[nhId]
          delete roomScoreDetails[nhId]
        }
      }

      if (state.surveyType === "outdoor") {
        for (const roomId of Object.keys(rooms)) {
          if (!isOutdoorSurveyRoomId(roomId)) continue
          delete rooms[roomId]
          delete roomScores[roomId]
          delete roomScoreDetails[roomId]
        }
      }

      const session: SurveySession = {
        ...state.session,
        rooms,
        updatedAt: new Date().toISOString(),
        spaceTypeExistsAtSchool:
          Object.keys(spaceTypeExistsAtSchool).length > 0 ? spaceTypeExistsAtSchool : undefined,
      }

      return bootstrapCampusScopedSurvey({
        ...state,
        session,
        selectedRoomId: null,
        pendingStudioType: null,
        pendingNeighborhood: null,
        roomScores,
        roomScoreDetails,
        submitValidation: null,
      })
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
        pendingNeighborhood: null,
        manualRooms: [],
        preWalk: state.preWalk,
        preWalkPromptPending: false,
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
      if (!action.allowIncomplete && !isCloseOutSurveyComplete(state.session)) return state
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
  savePreWalkToCloud: (patch?: Partial<PreWalkState>) => Promise<"pushed" | "offline" | "error">
  skipPreWalk: () => void
  answerPreWalkPrompt: (choice: "map" | "skip") => void
  setRoomType: (roomId: string, roomType: string) => void
  setPendingStudioType: (roomType: string | null) => void
  setPendingNeighborhood: (neighborhood: string | null) => void
  setSpaceTypeExists: (spaceType: string, exists: boolean) => void
  setResponse: (roomId: string, response: RoomQuestionResponse) => void
  applyTraditionalStudioCopy: (roomId: string) => void
  acknowledgeTraditionalStudioCopyReview: (roomId: string) => void
  traditionalStudioCopyOffer: { sourceRoomId: string; sourceRoomName: string; neighborhood: string } | null
  submitSurvey: (options?: { deferIncomplete?: boolean; continue?: boolean }) => boolean
  saveAndCompleteAnotherSurvey: (options?: { deferIncomplete?: boolean }) => boolean
  discardCurrentAssessment: () => void
  /** @deprecated Use saveAndCompleteAnotherSurvey */
  saveAndContinueToNextRoom: (options?: { deferIncomplete?: boolean }) => boolean
  submitCampusAssessment: (options?: { allowIncomplete?: boolean }) => boolean
  setFinalComment: (comment: string) => void
  peekSubmitValidation: () => SubmitValidationResult | null
  setView: (view: SurveyView) => void
  /** Enter a survey module from campus home (loads that module and enables conflict checks). */
  enterSurveyModule: (t: SurveyType, options?: { pendingStudioType?: string | null }) => void
  continueSurvey: () => void
  resetSurvey: () => void
  dismissResumeBanner: () => void
  levelRooms: ParsedPlanRoom[]
  classroomRooms: ParsedPlanRoom[]
  surveyedRooms: ScoredRoomEntry[]
  currentRoomSession: RoomSurveySession | null
  currentRoomScore: RoomScoreResult | null
  canSubmit: boolean
  canDiscard: boolean
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
  ensureFloorPlanLevel: (levelId: string, options?: { preferMobile?: boolean }) => Promise<void>
}

const SurveyContext = createContext<SurveyContextValue | null>(null)

function roomSurveyComplete(
  state: SurveyState,
  roomId: string,
  roomSession: RoomSurveySession,
): boolean {
  if (roomSession.spaceTypeMarkedAbsent || isAbsentSpaceTypeRoomId(roomId)) return true
  const pendingDone = !roomNeedsCloseOut(roomSession)
  const rubric = getRoomSurveyRubric(
    state.surveyType,
    roomSession.roomType,
    roomSession.gradeType,
    state.school?.schoolClass,
    roomSession.sourceSurveyType,
  )
  if (!rubric) return false
  const validation = validateRoomSession(roomId, roomId, roomSession, rubric.questions, {
    schoolClass: state.school?.schoolClass,
    forSubmit: true,
  })
  return validation.complete && (state.surveyType !== "closeout" || pendingDone)
}

function buildScoredRoomEntries(state: SurveyState): ScoredRoomEntry[] {
  if (!state.session) return []
  return Object.entries(state.session.rooms)
    .filter(([, rs]) => {
      if (rs.spaceTypeMarkedAbsent) return true
      if (roomHasAssessmentProgress(rs)) return true
      return roomNeedsCloseOut(rs)
    })
    .map(([roomId, roomSession]) => {
      const campusRoom = isOutdoorSurveyRoomId(roomId)
      const neighborhoodSurveyRoom = isNeighborhoodSurveyRoomId(roomId)
      const absentRoom = isAbsentSpaceTypeRoomId(roomId) || roomSession.spaceTypeMarkedAbsent
      const parsed =
        campusRoom || neighborhoodSurveyRoom || absentRoom
          ? undefined
          : state.allRooms.find((r) => r.id === roomId)
      const rubric = getRoomSurveyRubric(
        state.surveyType,
        roomSession.roomType,
        roomSession.gradeType,
        state.school?.schoolClass,
        roomSession.sourceSurveyType,
      )
      let answeredCount = 0
      let totalCount = 0
      if (absentRoom) {
        const detail = state.roomScoreDetails[roomId]
        answeredCount = detail?.answeredCount ?? 1
        totalCount = detail?.totalCount ?? 1
      } else if (rubric) {
        const progress = scoreRoomSessionWithMetadata(
          roomSession,
          rubric,
          state.weightOverrides,
          parsed,
        )
        answeredCount = progress.answeredCount
        totalCount = progress.totalCount
      }
      const detail = state.roomScoreDetails[roomId]
      const pendingDone = !roomNeedsCloseOut(roomSession)
      return {
        roomId,
        roomName: roomDisplayName(state, roomId),
        schoolRoomNumber: roomSession.schoolRoomNumber?.trim() || undefined,
        building: campusRoom
          ? undefined
          : roomSession.building ?? state.allRooms.find((r) => r.id === roomId)?.building,
        neighborhood: resolveRoomNeighborhood(state, roomId, roomSession),
        levelId: roomSession.levelId,
        gradeType: roomSession.gradeType,
        overallScore: absentRoom ? (detail?.overallScore ?? 0) : (detail?.overallScore ?? null),
        categoryScores: detail?.categoryScores ?? [],
        answeredCount,
        totalCount,
        complete: absentRoom
          ? true
          : detail
            ? isRoomComplete(
                detail,
                roomSession.gradeType,
                roomSession.roomType,
                state.school?.schoolClass,
              ) && (state.surveyType !== "closeout" || pendingDone)
            : roomSurveyComplete(state, roomId, roomSession),
      }
    })
    .sort((a, b) => a.roomName.localeCompare(b.roomName))
}

function persistDraftFromState(state: SurveyState): string | null {
  if (!state.school || !state.session) return null

  const savedAt = new Date().toISOString()
  saveDraft({
    schoolId: state.school.id,
    surveyType: state.surveyType,
    session: state.session,
    selectedLevelId: state.selectedLevelId,
    selectedRoomId: state.selectedRoomId,
    pendingStudioType: state.pendingStudioType,
    pendingNeighborhood: state.pendingNeighborhood,
    preWalk: state.preWalk,
    view:
      state.view === "admin" || state.view === "landing"
        ? "home"
        : state.view === "home" || state.view === "survey" || state.view === "results"
          ? state.view
          : "home",
    manualRooms: state.manualRooms,
    lastSubmission: state.submission,
    savedAt,
  })
  if (preWalkHasCloudState(state.preWalk)) {
    propagatePreWalkToSchoolDrafts(state.school.id, state.preWalk)
  }

  if (state.surveyType === "closeout") {
    const sourceTypes = new Set(
      Object.values(state.session.rooms)
        .map((room) => room.sourceSurveyType)
        .filter((surveyType): surveyType is Exclude<SurveyType, "closeout"> => !!surveyType),
    )
    if (sourceTypes.size === 0) sourceTypes.add("studios")

    for (const sourceType of sourceTypes) {
      const sourceDraft = loadDraft(state.school.id, sourceType)
      if (!sourceDraft?.session) continue
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

  return savedAt
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
  const floorPlanDisplayRequestsRef = useRef(0)
  const lastSyncedSubmissionRef = useRef<string | null>(null)
  const floorPlanLevelInflightRef = useRef(new Map<string, Promise<void>>())
  const roomsLoadAttemptedKeyRef = useRef<string | null>(null)
  const preWalkRef = useRef(EMPTY_PREWALK)
  const preWalkCloudReadySchoolIdRef = useRef<string | null>(null)
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
    pendingNeighborhood: null,
    preWalk: EMPTY_PREWALK,
    preWalkPromptPending: false,
    preWalkRequested: false,
  })
  preWalkRef.current = state.preWalk

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

    const savedAt = persistDraftFromState(state)
    if (!savedAt) return
    dispatch({ type: "MARK_SAVED", savedAt })
  }, [
    state.hydrated,
    state.school,
    state.session,
    state.surveyType,
    state.selectedLevelId,
    state.selectedRoomId,
    state.pendingStudioType,
    state.pendingNeighborhood,
    state.preWalk,
    state.view,
    state.manualRooms,
    state.submission,
  ])

  // Alert when another assessor has started/submitted this survey module online.
  // Only check after the user intentionally enters a module (not on campus home / login).
  useEffect(() => {
    if (!state.hydrated || !state.school || state.view !== "survey") return

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
  }, [state.hydrated, state.school?.id, state.surveyType, state.assessorByType, state.view])

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
        const localDrafts = SURVEY_TYPES.filter((t) => t !== "closeout").flatMap((surveyType) => {
          const draft = loadDraft(state.school!.id, surveyType)
          return draft ? [draft] : []
        })
        const merged = mergeSchoolDrafts(localDrafts, result.drafts)
        for (const draft of merged) {
          saveDraft(draft, { setActive: false })
        }
        setRemoteDraftsConfigured(true)
        setRemoteSchoolDrafts(merged)
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

  // Load school pre-walk assignments from Supabase (shared across devices/modules).
  useEffect(() => {
    if (!state.hydrated || !state.school) {
      preWalkCloudReadySchoolIdRef.current = null
      return
    }
    const schoolId = state.school.id
    preWalkCloudReadySchoolIdRef.current = null
    let cancelled = false
    void pullPrewalkClient(schoolId).then((remote) => {
      if (cancelled) return
      preWalkCloudReadySchoolIdRef.current = schoolId
      if (remote && preWalkHasCloudState(remote)) {
        dispatch({ type: "MERGE_PREWALK", preWalk: remote })
      } else {
        dispatch({ type: "PREWALK_PULL_DONE" })
      }
    })
    return () => {
      cancelled = true
    }
  }, [state.school?.id, state.hydrated])

  // Push school-level pre-walk independently of survey drafts so other users see it.
  useEffect(() => {
    if (!state.hydrated || !state.school) return
    if (preWalkCloudReadySchoolIdRef.current !== state.school.id) return
    if (!preWalkHasAssignments(state.preWalk) && !state.preWalk.completedAt) return

    const school = state.school
    const preWalk = state.preWalk
    const timer = window.setTimeout(() => {
      propagatePreWalkToSchoolDrafts(school.id, preWalk)
      void pushPrewalkClient({ school, preWalk })
    }, 800)
    return () => window.clearTimeout(timer)
  }, [state.hydrated, state.school, state.preWalk])

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
    const currentAssessorEmail = resolveCampusAssessor(state.assessorByType, surveyType)?.email
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
            const remoteAuthor = assessorFromSession(remote.session)
            const sameAuthor = assessorEmailsMatch(currentAssessorEmail, remoteAuthor?.email)
            if (sameAuthor) {
              const localAnswers = countSessionResponses(draft.session)
              const remoteAnswers = countSessionResponses(remote.session)
              if (remoteAnswers >= localAnswers) {
                const merged = {
                  ...remote,
                  pendingStudioType: draft.pendingStudioType ?? remote.pendingStudioType,
                  pendingNeighborhood: draft.pendingNeighborhood ?? remote.pendingNeighborhood,
                }
                saveDraft(merged)
                dispatch({ type: "RESTORE", school, draft: merged, showResumeBanner: false })
              }
            }
          }
        }
        setPendingSyncCount(getPendingSyncCount())
      })
    }, 2500)

    return () => window.clearTimeout(timer)
  }, [
    state.hydrated,
    state.school,
    state.session,
    state.surveyType,
    state.lastSavedAt,
    state.submission,
    state.assessorByType,
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

    if (isBrowserOnline()) {
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
    if (!state.school) {
      roomsLoadAttemptedKeyRef.current = null
      return
    }
    if (!state.school.hasFloorPlan) {
      roomsLoadAttemptedKeyRef.current = null
      const manualsOnly = mergeManualRooms([], state.manualRooms)
      if (state.floorPlan || state.allRooms.length !== manualsOnly.length) {
        dispatch({ type: "SET_FLOOR_PLAN", plan: null, rooms: [] })
      }
      return
    }

    // Keep the pre-walk yes/no dialog responsive — Bear Creek parses 3 floors on select.
    if (state.preWalkPromptPending) return

    const attemptKey = [
      state.school.id,
      state.school.hasFloorPlan,
      state.school.campusId ?? "",
      state.school.name,
    ].join("|")

    if (state.floorPlan && state.allRooms.length > 0) return
    if (roomsLoadAttemptedKeyRef.current === attemptKey) return

    roomsLoadAttemptedKeyRef.current = attemptKey

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
    // Re-run when floor-plan identity changes, or after a cleared/failed load — not on metadata-only school upgrades.
  }, [
    state.school?.id,
    state.school?.hasFloorPlan,
    state.school?.campusId,
    state.school?.name,
    state.floorPlan,
    state.allRooms.length,
    state.manualRooms,
    state.preWalkPromptPending,
  ])

  const requestFloorPlanDisplay = useCallback(() => {
    setFloorPlanDisplayRequests((count) => {
      const next = count + 1
      floorPlanDisplayRequestsRef.current = next
      return next
    })
  }, [])

  const releaseFloorPlanDisplay = useCallback(() => {
    setFloorPlanDisplayRequests((count) => {
      const next = Math.max(0, count - 1)
      floorPlanDisplayRequestsRef.current = next
      return next
    })
  }, [])

  const ensureFloorPlanLevel = useCallback(
    async (levelId: string, options?: { preferMobile?: boolean }) => {
      const school = state.school
      const plan = state.floorPlan
      if (!school?.hasFloorPlan || !plan) return

      const existing = plan.levels.find((level) => level.id === levelId)
      const preferMobileFiles = options?.preferMobile ?? useMobileFloorPlanFiles()
      const inlineStale =
        existing?.src &&
        isInlineFloorPlanSrc(existing.src) &&
        !hasFloorPlanDisplayCache(school.id, levelId)
      if (existing?.src && !inlineStale) return

      const key = `${school.id}::${levelId}:mobile`
      const inflight = floorPlanLevelInflightRef.current.get(key)
      if (inflight) return inflight

      const promise = (async () => {
        if (preferMobileFloorPlan()) {
          await deferFloorPlanDisplayWork(300)
          if (floorPlanDisplayRequestsRef.current === 0) return
        }
        setFloorPlanDisplayLoading(true)
        try {
          if (hasFloorPlanDisplayCache(school.id, levelId) && existing) {
            const restored = restoreFloorPlanLevelFromCache(school.id, existing)
            if (restored) {
              dispatch({ type: "PATCH_FLOOR_PLAN_LEVEL", level: restored })
              return
            }
          }

          const level = await loadFloorPlanLevelDisplay(school, levelId, {
            preferMobile: preferMobileFiles,
          })
          if (level && floorPlanDisplayRequestsRef.current > 0) {
            dispatch({ type: "PATCH_FLOOR_PLAN_LEVEL", level })
          }
        } catch (err) {
          console.error(err)
        } finally {
          setFloorPlanDisplayLoading(false)
        }
      })().finally(() => {
        floorPlanLevelInflightRef.current.delete(key)
      })

      floorPlanLevelInflightRef.current.set(key, promise)
      return promise
    },
    [state.school, state.floorPlan],
  )

  useEffect(() => {
    floorPlanDisplayRequestsRef.current = floorPlanDisplayRequests
  }, [floorPlanDisplayRequests])

  useEffect(() => {
    if (floorPlanDisplayRequests === 0) {
      const timer = window.setTimeout(() => {
        if (floorPlanDisplayRequestsRef.current === 0) {
          dispatch({ type: "STRIP_FLOOR_PLAN_DISPLAY" })
        }
      }, 150)
      return () => window.clearTimeout(timer)
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
          }
        : null,
    [state.school, scoringDrafts],
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
        ? findSubmittedRoomAssessment(state.school.id, roomId, scoringDrafts, {
            surveyType: state.surveyType,
          })
        : null,
    [state.school, state.surveyType, scoringDrafts],
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

  const completeSurveyedRooms = useMemo(
    () => surveyedRooms.filter((r) => r.complete),
    [surveyedRooms],
  )

  const canSubmit = surveyedRooms.length > 0
  const canDiscard = hasCurrentAssessmentToDiscard(state)
  const completeCount = completeSurveyedRooms.length
  const inProgressCount = surveyedRooms.length - completeCount
  const submitHint = canSubmit
    ? state.surveyType === "outdoor"
      ? "Outdoor survey ready to save"
      : completeCount > 0
        ? `${completeCount} complete room${completeCount === 1 ? "" : "s"} ready to save`
        : `${inProgressCount} room${inProgressCount === 1 ? "" : "s"} in progress — unanswered items can go to Close Out`
    : state.surveyType === "outdoor"
      ? "Answer outdoor questions to begin scoring"
      : state.surveyType === "closeout"
        ? "Finish deferred questions below, then submit the campus assessment"
        : "Score at least one room to save"

  const closeOutPending = useMemo(() => {
    if (state.surveyType !== "closeout" || !state.session) {
      return { roomIds: [] as string[], roomLabels: [] as string[] }
    }
    const roomIds = Object.values(state.session.rooms)
      .filter((room) => roomNeedsCloseOut(room, state.school?.schoolClass))
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
    return loadDraftsForSchool(state.school.id).some(
      (draft) =>
        draft.surveyType !== "closeout" &&
        (Object.values(draft.session.rooms).some(
          (room) => room.responses.length > 0 || !!room.gradeType,
        ) ||
          !!draft.lastSubmission),
    )
  }, [state.surveyType, state.session, state.school])

  const submitCampusHint = useMemo(() => {
    if (state.session?.campusSubmittedAt) return "Campus assessment submitted"
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
    const pending = countCloseOutPendingItems(state.session)
    if (pending.rooms > 0) {
      return `You can submit now · ${pending.questions} Close Out item${pending.questions === 1 ? "" : "s"} still open`
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
    (options?: { deferIncomplete?: boolean; continue?: boolean }) => {
      if (!canSubmit || !state.session || !state.school) return false

      const submitAction = options?.continue ? "SUBMIT_AND_CONTINUE" : "SUBMIT"

      if (options?.deferIncomplete) {
        if (state.surveyType === "closeout" || !state.selectedRoomId) {
          dispatch({ type: "CLEAR_SUBMIT_VALIDATION" })
          dispatch({ type: submitAction })
          return true
        }
        if (!applyCurrentRoomDeferral()) return false
        dispatch({ type: submitAction })
        return true
      }

      // No selected room (or absent-only save): persist complete rooms and continue.
      // Do not validate every unfinished room in the draft — that caused Save to no-op
      // after marking a space type absent (selection was cleared, peek said valid, submit failed).
      if (!state.selectedRoomId) {
        dispatch({ type: "CLEAR_SUBMIT_VALIDATION" })
        dispatch({ type: submitAction })
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
      dispatch({ type: submitAction })
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

  const saveAndCompleteAnotherSurvey = useCallback(
    (options?: { deferIncomplete?: boolean }) => submitSurvey({ ...options, continue: true }),
    [submitSurvey],
  )

  const discardCurrentAssessment = useCallback(() => {
    dispatch({ type: "DISCARD_CURRENT_ASSESSMENT" })
  }, [])

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

  const submitCampusAssessment = useCallback(
    (options?: { allowIncomplete?: boolean }) => {
      if (!canSubmitCampus || !state.session || !state.school) return false
      dispatch({ type: "SUBMIT_CAMPUS", allowIncomplete: options?.allowIncomplete })
      return true
    },
    [canSubmitCampus, state.session, state.school],
  )

  const setFinalComment = useCallback((comment: string) => {
    dispatch({ type: "SET_FINAL_COMMENT", comment })
  }, [])

  const setSurveyType = useCallback(
    (t: SurveyType, options?: { pendingStudioType?: string | null }) => {
      if (state.school) {
        if (t !== state.surveyType && state.session) {
          persistDraftFromState(state)
        }
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
    [state.school, state.session, state.surveyType],
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

  const stripFloorPlanForRoomSelect = useCallback((schoolId: string | undefined) => {
    floorPlanLevelInflightRef.current.clear()
    floorPlanDisplayRequestsRef.current = 0
    setFloorPlanDisplayRequests(0)
    if (schoolId) releaseFloorPlanDisplayMemory(schoolId)
    dispatch({ type: "STRIP_FLOOR_PLAN_DISPLAY" })
  }, [])

  const setLevel = useCallback((levelId: string) => dispatch({ type: "SET_LEVEL", levelId }), [])
  const selectRoom = useCallback(
    (roomId: string | null) => {
      if (roomId) stripFloorPlanForRoomSelect(state.school?.id)
      dispatch({ type: "SELECT_ROOM", roomId })
    },
    [state.school?.id, stripFloorPlanForRoomSelect],
  )
  const addManualRoom = useCallback(
    (roomNumber: string, building?: string) => {
      stripFloorPlanForRoomSelect(state.school?.id)
      dispatch({ type: "ADD_MANUAL_ROOM", roomNumber, building })
    },
    [state.school?.id, stripFloorPlanForRoomSelect],
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
  const savePreWalkToCloud = useCallback(
    async (patch?: Partial<PreWalkState>): Promise<"pushed" | "offline" | "error"> => {
      if (!state.school) return "error"
      const preWalk = { ...preWalkRef.current, ...patch }
      preWalkRef.current = preWalk
      preWalkCloudReadySchoolIdRef.current = state.school.id
      propagatePreWalkToSchoolDrafts(state.school.id, preWalk)
      return pushPrewalkClient({ school: state.school, preWalk })
    },
    [state.school],
  )
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
  const setPendingNeighborhood = useCallback(
    (neighborhood: string | null) =>
      dispatch({ type: "SET_PENDING_NEIGHBORHOOD", neighborhood }),
    [],
  )
  const setSpaceTypeExists = useCallback(
    (spaceType: string, exists: boolean) =>
      dispatch({ type: "SET_SPACE_TYPE_EXISTS", spaceType, exists }),
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
  const enterSurveyModule = useCallback(
    (t: SurveyType, options?: { pendingStudioType?: string | null }) => {
      if (state.school) {
        if (t !== state.surveyType && state.session) {
          persistDraftFromState(state)
        }
        const draft = loadDraft(state.school.id, t)
        dispatch({
          type: "SET_SURVEY_TYPE",
          surveyType: t,
          draft: draft ?? undefined,
          pendingStudioType: options?.pendingStudioType,
        })
      } else {
        dispatch({
          type: "SET_SURVEY_TYPE",
          surveyType: t,
          pendingStudioType: options?.pendingStudioType,
        })
      }
      dispatch({ type: "SET_VIEW", view: "survey" })
    },
    [state],
  )
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

  // Login is this browser's assessor record only — never the draft's document author.
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
        savePreWalkToCloud,
        skipPreWalk,
        answerPreWalkPrompt,
        setRoomType,
        setPendingStudioType,
        setPendingNeighborhood,
        setSpaceTypeExists,
        setResponse,
        applyTraditionalStudioCopy,
        acknowledgeTraditionalStudioCopyReview,
        traditionalStudioCopyOffer,
        submitSurvey,
        saveAndCompleteAnotherSurvey,
        discardCurrentAssessment,
        saveAndContinueToNextRoom,
        submitCampusAssessment,
        setFinalComment,
        peekSubmitValidation,
        setView,
        enterSurveyModule,
        continueSurvey,
        resetSurvey,
        dismissResumeBanner,
        levelRooms,
        classroomRooms,
        surveyedRooms,
        currentRoomSession,
        currentRoomScore,
        canSubmit,
        canDiscard,
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
