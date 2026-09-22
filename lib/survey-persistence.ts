import type {
  AisdSchoolOption,
  SurveySession,
  SurveySubmission,
  SurveyType,
  AssessorInfo,
  ParsedPlanRoom,
  RoomSurveySession,
  PreWalkState,
} from "@aisd/shared"
import {
  SURVEY_TYPES,
  applyPreWalkSpaceTypeExistsToSession,
  isAbsentSpaceTypeRoomId,
  parseAbsentSpaceTypeRoomId,
  spaceTypeExistenceKey,
} from "@aisd/shared"
import {
  ART_RUBRIC_VERSION,
  EARLY_CHILDHOOD_RUBRIC_VERSION,
  EARLY_CHILDHOOD_SPED_RUBRIC_VERSION,
  LIFE_SKILLS_RUBRIC_VERSION,
  MUSIC_RUBRIC_VERSION,
  SCIENCE_RUBRIC_VERSION,
  SCIENCE_PREP_RUBRIC_VERSION,
  SENSORY_LAB_RUBRIC_VERSION,
  SPED_FLEX_RUBRIC_VERSION,
  TRADITIONAL_STUDIOS_RUBRIC_VERSION,
  VOCATIONAL_LAB_RUBRIC_VERSION,
} from "@aisd/shared"
import { mergeRoomLinkedPhotos } from "@/lib/response-photos"

const ACTIVE_KEY = "aisd-survey-active"
const ASSESSOR_KEY = "aisd-survey-assessors"
/** Survives reloads in the same tab; cleared when the tab/app is closed. */
const VISIT_KEY = "aisd-survey-visit"
const DRAFT_VERSION = 1

export type AssessorBySurveyType = Partial<Record<SurveyType, AssessorInfo>>

export interface PersistedSurveyDraft {
  version: typeof DRAFT_VERSION
  schoolId: string
  surveyType: SurveyType
  session: SurveySession
  selectedLevelId: string | null
  /** UI selection — restored on reload so the user returns to the same place */
  selectedRoomId?: string | null
  pendingStudioType?: string | null
  /** Neighborhoods survey: selected neighborhood before existence gate / room pick */
  pendingNeighborhood?: string | null
  view?: "home" | "survey" | "results"
  /** Rooms entered manually (not on the floor plan SVG) */
  manualRooms?: ParsedPlanRoom[]
  /** Building pre-walk room → space type mappings */
  preWalk?: PreWalkState
  lastSubmission: SurveySubmission | null
  savedAt: string
  /** Room ids removed on this device; cloud pull must not bring them back. */
  discardedRoomIds?: string[]
  /** Outdoor pin ids removed on this device. */
  discardedPinIds?: string[]
  /**
   * Room ids this device last saved from live survey state. Cloud pull may union
   * other people's rooms into localStorage; those must not be treated as discarded.
   */
  ownedRoomIds?: string[]
  /** Outdoor pin ids this device last saved from live survey state. */
  ownedPinIds?: string[]
  /**
   * Stamped after Traditional studio rooms are cleared for v3 rubric migration.
   * Drafts without this (or with a lower value) drop Traditional room answers on load.
   */
  traditionalStudiosRubricVersion?: number
  /**
   * Stamped after Sensory Lab rooms are cleared for the Sensory Lab package.
   */
  sensoryLabRubricVersion?: number
  /**
   * Stamped after Vocational Lab rooms are cleared for the Vocational Lab package.
   */
  vocationalLabRubricVersion?: number
  /**
   * Stamped after Life Skills Room rooms are cleared for the Life Skills package.
   */
  lifeSkillsRubricVersion?: number
  /**
   * Stamped after Sped Flex Studio rooms are cleared for the Sped Flex package.
   */
  spedFlexRubricVersion?: number
  /**
   * Stamped after Science rooms are cleared for the Science package.
   */
  scienceRubricVersion?: number
  /**
   * Stamped after Science Prep Room rooms are cleared for that package.
   */
  sciencePrepRubricVersion?: number
  /**
   * Stamped after Art rooms are cleared for the Art package.
   */
  artRubricVersion?: number
  /**
   * Stamped after Music rooms are cleared for the Music package.
   */
  musicRubricVersion?: number
  /**
   * Stamped after Early childhood studio rooms are cleared for that package.
   */
  earlyChildhoodRubricVersion?: number
  /**
   * Stamped after Early childhood special education studio rooms are cleared.
   */
  earlyChildhoodSpedRubricVersion?: number
  /**
   * Stamped when a seeded Pilot campus Results snapshot was wiped so carry-over
   * rooms do not reappear until they are Saved again.
   */
  pilotResultsResetAt?: string
  /**
   * Stamped after the PILOT Test cloud snapshot wipe succeeded. Until then,
   * cloud pull must not resurrect the old Results dump.
   */
  pilotResultsCloudResetAt?: string
  /**
   * Stamped after merge campuses auto-kept rooms over the shared percent
   * threshold so later devices do not re-filter in-progress rooms.
   */
  autoCarryOverAppliedAt?: string
}

export interface ActiveDraftMeta {
  schoolId: string
  surveyType: SurveyType
}

function draftKey(schoolId: string, surveyType: SurveyType): string {
  return `aisd-survey-draft-${schoolId}-${surveyType}`
}

/** True when this browser tab already started a survey visit (survives reload). */
export function hasActiveVisit(): boolean {
  if (typeof window === "undefined") return false
  try {
    return sessionStorage.getItem(VISIT_KEY) === "1"
  } catch {
    return false
  }
}

/** Mark that the user left the landing page in this tab session. */
export function markActiveVisit(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(VISIT_KEY, "1")
  } catch {
    /* private browsing */
  }
}

/** True when this page load was a browser reload (vs a fresh open/navigation). */
export function isPageReload(): boolean {
  if (typeof window === "undefined") return false
  try {
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined
    if (nav?.type === "reload") return true
    // Legacy fallback
    const legacy = (performance as Performance & { navigation?: { type?: number } }).navigation
    return legacy?.type === 1
  } catch {
    return false
  }
}

/**
 * Whether this load should continue an in-progress survey UI (reload / same tab)
 * instead of starting at the landing page.
 */
export function shouldContinueSurveyVisit(): boolean {
  if (hasActiveVisit()) return true
  if (isPageReload()) {
    markActiveVisit()
    return true
  }
  return false
}

export function loadAssessors(): AssessorBySurveyType {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(ASSESSOR_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as AssessorBySurveyType
  } catch {
    return {}
  }
}

export function saveAssessors(assessors: AssessorBySurveyType): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(ASSESSOR_KEY, JSON.stringify(assessors))
  } catch {
    /* quota or private browsing */
  }
}

export function loadActiveDraftMeta(): ActiveDraftMeta | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ActiveDraftMeta
  } catch {
    return null
  }
}

/**
 * Last in-progress survey from localStorage — used on every app open so iOS tab
 * kills (which clear sessionStorage) still restore the same school, room, and answers.
 */
export function loadResumableDraft(): {
  meta: ActiveDraftMeta
  draft: PersistedSurveyDraft
} | null {
  const meta = loadActiveDraftMeta()
  if (!meta) return null
  const draft = loadDraft(meta.schoolId, meta.surveyType)
  if (!draft?.session) return null
  return { meta, draft }
}

function stripRoomsByType(
  rooms: Record<string, RoomSurveySession>,
  roomType: string,
): { rooms: Record<string, RoomSurveySession>; removed: boolean } {
  const next: Record<string, RoomSurveySession> = {}
  let removed = false
  for (const [id, room] of Object.entries(rooms)) {
    if (room.roomType === roomType) {
      removed = true
      continue
    }
    next[id] = room
  }
  return { rooms: next, removed }
}

function stripStudioTypeFromDraft(
  draft: PersistedSurveyDraft,
  roomType: string,
): PersistedSurveyDraft {
  if (draft.surveyType !== "studios" && draft.surveyType !== "closeout") {
    return draft
  }

  const sessionStrip = stripRoomsByType(draft.session.rooms, roomType)
  let lastSubmission = draft.lastSubmission
  if (lastSubmission?.session) {
    const subStrip = stripRoomsByType(lastSubmission.session.rooms, roomType)
    if (subStrip.removed) {
      lastSubmission = {
        ...lastSubmission,
        session: { ...lastSubmission.session, rooms: subStrip.rooms },
      }
    }
  }

  const selectedWasStripped =
    !!draft.selectedRoomId && draft.session.rooms[draft.selectedRoomId]?.roomType === roomType

  const pendingStudioType = draft.pendingStudioType === roomType ? null : draft.pendingStudioType

  return {
    ...draft,
    session: { ...draft.session, rooms: sessionStrip.rooms },
    lastSubmission,
    selectedRoomId: selectedWasStripped ? null : draft.selectedRoomId,
    pendingStudioType,
  }
}

function packageVersionNeedsStrip(
  draftVersion: number | undefined,
  current: number,
): boolean {
  // Missing stamps are first-time bookkeeping — do not wipe field answers.
  // Only strip when a stored version is older than the current package.
  return typeof draftVersion === "number" && draftVersion !== current
}

/**
 * Clear package studio room drafts when their rubrics land
 * (answers from the shared rubric — or older packages — are invalid).
 */
function migratePackageStudioDrafts(draft: PersistedSurveyDraft): PersistedSurveyDraft {
  let next = draft
  let changed = false

  if (next.traditionalStudiosRubricVersion !== TRADITIONAL_STUDIOS_RUBRIC_VERSION) {
    if (packageVersionNeedsStrip(next.traditionalStudiosRubricVersion, TRADITIONAL_STUDIOS_RUBRIC_VERSION)) {
      next = stripStudioTypeFromDraft(next, "Traditional studio")
    }
    next = { ...next, traditionalStudiosRubricVersion: TRADITIONAL_STUDIOS_RUBRIC_VERSION }
    changed = true
  }

  if (next.sensoryLabRubricVersion !== SENSORY_LAB_RUBRIC_VERSION) {
    if (packageVersionNeedsStrip(next.sensoryLabRubricVersion, SENSORY_LAB_RUBRIC_VERSION)) {
      next = stripStudioTypeFromDraft(next, "Sensory Lab")
    }
    next = { ...next, sensoryLabRubricVersion: SENSORY_LAB_RUBRIC_VERSION }
    changed = true
  }

  if (next.vocationalLabRubricVersion !== VOCATIONAL_LAB_RUBRIC_VERSION) {
    if (packageVersionNeedsStrip(next.vocationalLabRubricVersion, VOCATIONAL_LAB_RUBRIC_VERSION)) {
      next = stripStudioTypeFromDraft(next, "Vocational lab")
      next = stripStudioTypeFromDraft(next, "Vocational Lab")
    }
    next = { ...next, vocationalLabRubricVersion: VOCATIONAL_LAB_RUBRIC_VERSION }
    changed = true
  }

  if (next.lifeSkillsRubricVersion !== LIFE_SKILLS_RUBRIC_VERSION) {
    if (packageVersionNeedsStrip(next.lifeSkillsRubricVersion, LIFE_SKILLS_RUBRIC_VERSION)) {
      next = stripStudioTypeFromDraft(next, "Life Skills Room")
    }
    next = { ...next, lifeSkillsRubricVersion: LIFE_SKILLS_RUBRIC_VERSION }
    changed = true
  }

  if (next.spedFlexRubricVersion !== SPED_FLEX_RUBRIC_VERSION) {
    if (packageVersionNeedsStrip(next.spedFlexRubricVersion, SPED_FLEX_RUBRIC_VERSION)) {
      next = stripStudioTypeFromDraft(next, "Sped flex studio")
    }
    next = { ...next, spedFlexRubricVersion: SPED_FLEX_RUBRIC_VERSION }
    changed = true
  }

  if (next.scienceRubricVersion !== SCIENCE_RUBRIC_VERSION) {
    if (packageVersionNeedsStrip(next.scienceRubricVersion, SCIENCE_RUBRIC_VERSION)) {
      next = stripStudioTypeFromDraft(next, "Science")
    }
    next = { ...next, scienceRubricVersion: SCIENCE_RUBRIC_VERSION }
    changed = true
  }

  if (next.sciencePrepRubricVersion !== SCIENCE_PREP_RUBRIC_VERSION) {
    if (packageVersionNeedsStrip(next.sciencePrepRubricVersion, SCIENCE_PREP_RUBRIC_VERSION)) {
      next = stripStudioTypeFromDraft(next, "Science Prep Room")
    }
    next = { ...next, sciencePrepRubricVersion: SCIENCE_PREP_RUBRIC_VERSION }
    changed = true
  }

  if (next.artRubricVersion !== ART_RUBRIC_VERSION) {
    if (packageVersionNeedsStrip(next.artRubricVersion, ART_RUBRIC_VERSION)) {
      next = stripStudioTypeFromDraft(next, "Art")
    }
    next = { ...next, artRubricVersion: ART_RUBRIC_VERSION }
    changed = true
  }

  if (next.musicRubricVersion !== MUSIC_RUBRIC_VERSION) {
    if (packageVersionNeedsStrip(next.musicRubricVersion, MUSIC_RUBRIC_VERSION)) {
      next = stripStudioTypeFromDraft(next, "Music")
    }
    next = { ...next, musicRubricVersion: MUSIC_RUBRIC_VERSION }
    changed = true
  }

  if (next.earlyChildhoodRubricVersion !== EARLY_CHILDHOOD_RUBRIC_VERSION) {
    if (packageVersionNeedsStrip(next.earlyChildhoodRubricVersion, EARLY_CHILDHOOD_RUBRIC_VERSION)) {
      next = stripStudioTypeFromDraft(next, "Early childhood studio")
    }
    next = { ...next, earlyChildhoodRubricVersion: EARLY_CHILDHOOD_RUBRIC_VERSION }
    changed = true
  }

  if (next.earlyChildhoodSpedRubricVersion !== EARLY_CHILDHOOD_SPED_RUBRIC_VERSION) {
    if (packageVersionNeedsStrip(next.earlyChildhoodSpedRubricVersion, EARLY_CHILDHOOD_SPED_RUBRIC_VERSION)) {
      next = stripStudioTypeFromDraft(next, "Early childhood special education studio")
    }
    next = { ...next, earlyChildhoodSpedRubricVersion: EARLY_CHILDHOOD_SPED_RUBRIC_VERSION }
    changed = true
  }

  return changed ? next : draft
}

export function loadDraft(schoolId: string, surveyType: SurveyType): PersistedSurveyDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(draftKey(schoolId, surveyType))
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedSurveyDraft
    if (parsed.version !== DRAFT_VERSION) return null
    const migrated = migratePackageStudioDrafts(parsed)
    if (migrated !== parsed) {
      localStorage.setItem(draftKey(schoolId, surveyType), JSON.stringify(migrated))
    }
    return migrated
  } catch {
    return null
  }
}

export function saveDraft(
  draft: Omit<PersistedSurveyDraft, "version">,
  options?: { setActive?: boolean },
): boolean {
  if (typeof window === "undefined") return false
  try {
    const payload: PersistedSurveyDraft = {
      ...draft,
      version: DRAFT_VERSION,
      traditionalStudiosRubricVersion:
        draft.traditionalStudiosRubricVersion ?? TRADITIONAL_STUDIOS_RUBRIC_VERSION,
      sensoryLabRubricVersion: draft.sensoryLabRubricVersion ?? SENSORY_LAB_RUBRIC_VERSION,
      vocationalLabRubricVersion:
        draft.vocationalLabRubricVersion ?? VOCATIONAL_LAB_RUBRIC_VERSION,
      lifeSkillsRubricVersion: draft.lifeSkillsRubricVersion ?? LIFE_SKILLS_RUBRIC_VERSION,
      spedFlexRubricVersion: draft.spedFlexRubricVersion ?? SPED_FLEX_RUBRIC_VERSION,
      scienceRubricVersion: draft.scienceRubricVersion ?? SCIENCE_RUBRIC_VERSION,
      sciencePrepRubricVersion: draft.sciencePrepRubricVersion ?? SCIENCE_PREP_RUBRIC_VERSION,
      artRubricVersion: draft.artRubricVersion ?? ART_RUBRIC_VERSION,
      musicRubricVersion: draft.musicRubricVersion ?? MUSIC_RUBRIC_VERSION,
      earlyChildhoodRubricVersion:
        draft.earlyChildhoodRubricVersion ?? EARLY_CHILDHOOD_RUBRIC_VERSION,
      earlyChildhoodSpedRubricVersion:
        draft.earlyChildhoodSpedRubricVersion ?? EARLY_CHILDHOOD_SPED_RUBRIC_VERSION,
    }
    localStorage.setItem(draftKey(draft.schoolId, draft.surveyType), JSON.stringify(payload))
    // Only the survey currently being viewed should become the restore target on reload.
    // Sibling sync writes must not steal the "active" pointer (e.g. Close Out while on Studios).
    if (options?.setActive !== false) {
      localStorage.setItem(
        ACTIVE_KEY,
        JSON.stringify({
          schoolId: draft.schoolId,
          surveyType: draft.surveyType,
        } satisfies ActiveDraftMeta),
      )
    }
    // Keep submission snapshot for dashboard sync / history
    if (draft.lastSubmission) {
      localStorage.setItem(
        `aisd-survey-${draft.session.surveyId}`,
        JSON.stringify(draft.lastSubmission),
      )
    } else {
      localStorage.removeItem(`aisd-survey-${draft.session.surveyId}`)
    }
    return true
  } catch {
    /* quota or private browsing */
    return false
  }
}

function isInlineSurveyPhoto(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.startsWith("data:") || trimmed.startsWith("blob:")
}

function stripInlinePhotosFromSession(session: SurveySession): SurveySession {
  const rooms: SurveySession["rooms"] = {}
  for (const [roomId, room] of Object.entries(session.rooms ?? {})) {
    const responses = (room.responses ?? []).map((response) => {
      const photos = (response.photos ?? [])
        .map((photo) => String(photo ?? "").trim())
        .filter((photo) => photo.length > 0 && !isInlineSurveyPhoto(photo))
      const photoRaw = String(response.photo ?? "").trim()
      const photo =
        photoRaw && !isInlineSurveyPhoto(photoRaw) ? photoRaw : photos[0]
      return { ...response, photos, photo }
    })
    rooms[roomId] = { ...room, responses }
  }
  return { ...session, rooms }
}

/** Drop device-only blobs so the database POST stays under host body limits. */
export function draftForCloudSync(draft: PersistedSurveyDraft): PersistedSurveyDraft {
  const session = stripInlinePhotosFromSession(draft.session)
  return {
    ...draft,
    session,
    preWalk: undefined,
    lastSubmission: draft.lastSubmission
      ? {
          ...draft.lastSubmission,
          session,
          floorPlanRooms: [],
        }
      : null,
  }
}

export function saveDraftWithQuotaFallback(
  draft: Omit<PersistedSurveyDraft, "version">,
  options?: { setActive?: boolean },
): boolean {
  if (saveDraft(draft, options)) return true
  const slimmer = draftForCloudSync({ ...draft, version: DRAFT_VERSION })
  return saveDraft(slimmer, options)
}

export function clearDraft(schoolId: string, surveyType: SurveyType): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(draftKey(schoolId, surveyType))
    const active = loadActiveDraftMeta()
    if (active?.schoolId === schoolId && active.surveyType === surveyType) {
      localStorage.removeItem(ACTIVE_KEY)
    }
  } catch {
    /* ignore */
  }
}

/** All persisted drafts in this browser (admin / district overview). */
export function listAllDrafts(): PersistedSurveyDraft[] {
  if (typeof window === "undefined") return []
  const drafts: PersistedSurveyDraft[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith("aisd-survey-draft-")) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw) as PersistedSurveyDraft
        if (parsed.version !== DRAFT_VERSION) continue
        if (!parsed.schoolId || !parsed.surveyType || !parsed.session) continue
        drafts.push(migratePackageStudioDrafts(parsed))
      } catch {
        /* skip corrupt entry */
      }
    }
  } catch {
    return []
  }
  return drafts.sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""))
}

/** All saved survey drafts for one school (one per survey module, excluding closeout). */
export function loadDraftsForSchool(schoolId: string): PersistedSurveyDraft[] {
  return SURVEY_TYPES.filter((t) => t !== "closeout")
    .map((surveyType) => loadDraft(schoolId, surveyType))
    .filter((d): d is PersistedSurveyDraft => d != null)
}

export function nextDiscardedRoomIds(
  previous: PersistedSurveyDraft | null | undefined,
  session: SurveySession,
): string[] {
  const discarded = new Set(previous?.discardedRoomIds ?? [])
  // Only rooms this device previously owned. A cloud pull may union other
  // assessors' rooms into the stored draft; those must not be deleted on save.
  const previousOwned = previous?.ownedRoomIds
  if (previousOwned) {
    for (const roomId of previousOwned) {
      if (!session.rooms[roomId]) discarded.add(roomId)
    }
  }
  for (const roomId of Object.keys(session.rooms)) discarded.delete(roomId)
  return [...discarded]
}

export function nextDiscardedPinIds(
  previous: PersistedSurveyDraft | null | undefined,
  session: SurveySession,
): string[] {
  const discarded = new Set(previous?.discardedPinIds ?? [])
  const currentIds = new Set((session.outdoorElementPins ?? []).map((pin) => pin.id))
  const previousOwned = previous?.ownedPinIds
  if (previousOwned) {
    for (const pinId of previousOwned) {
      if (!currentIds.has(pinId)) discarded.add(pinId)
    }
  }
  for (const id of currentIds) discarded.delete(id)
  return [...discarded]
}

function submittedRoomCount(draft: PersistedSurveyDraft | null | undefined): number {
  return draft?.lastSubmission?.campus?.rooms?.length ?? 0
}

export function roomAssessmentWeight(room: RoomSurveySession): number {
  let count = room.responses?.length ?? 0
  for (const response of room.responses ?? []) {
    if (response.comment?.trim()) count += 1
    count += response.photos?.length ?? 0
    if (response.photo) count += 1
  }
  if (room.gradeType) count += 1
  if (room.deferredToCloseOut) count += 1
  if (room.spaceTypeMarkedAbsent || isAbsentSpaceTypeRoomId(room.roomId)) count += 1
  return count
}

export function roomHasAssessmentProgress(room: RoomSurveySession | null | undefined): boolean {
  if (!room) return false
  return roomAssessmentWeight(room) > 0
}

/** Responses plus existence / absent-space answers so DNE work is not treated as empty. */
export function sessionAssessmentWeight(session: SurveySession | null | undefined): number {
  if (!session) return 0
  let count = session.outdoorElementPins?.length ?? 0
  for (const room of Object.values(session.rooms)) {
    count += roomAssessmentWeight(room)
  }
  count += Object.keys(session.spaceTypeExistsAtSchool ?? {}).length
  return count
}

/**
 * Combine two sessions without dropping completed rooms or "does not exist" answers.
 * Rooms are unioned. The richer copy of the same room wins. Discarded rooms stay gone.
 */
export function mergeSurveySessions(
  local: SurveySession,
  remote: SurveySession,
  localNewer: boolean,
  options?: { includeOtherOnlyRooms?: boolean; excludeRoomIds?: string[] },
): SurveySession {
  const primary = localNewer ? local : remote
  const secondary = localNewer ? remote : local
  const rooms: Record<string, RoomSurveySession> = { ...primary.rooms }
  const allowSecondaryOnly = options?.includeOtherOnlyRooms ?? true
  const excluded = new Set(options?.excludeRoomIds ?? [])

  for (const id of excluded) {
    delete rooms[id]
  }

  for (const [roomId, room] of Object.entries(secondary.rooms)) {
    if (excluded.has(roomId)) continue
    const existing = rooms[roomId]
    if (!existing) {
      if (allowSecondaryOnly && roomHasAssessmentProgress(room)) rooms[roomId] = room
      continue
    }
    const preferred = roomAssessmentWeight(room) > roomAssessmentWeight(existing) ? room : existing
    const other = preferred === room ? existing : room
    rooms[roomId] = mergeRoomLinkedPhotos(preferred, other)
  }

  const spaceTypeExistsAtSchool = {
    ...(secondary.spaceTypeExistsAtSchool ?? {}),
    ...(primary.spaceTypeExistsAtSchool ?? {}),
  }
  for (const roomId of excluded) {
    const parsed = parseAbsentSpaceTypeRoomId(roomId)
    if (parsed) {
      const key = spaceTypeExistenceKey(parsed.spaceType, parsed.neighborhood)
      if (primary.spaceTypeExistsAtSchool?.[key] !== true) {
        delete spaceTypeExistsAtSchool[key]
      }
      continue
    }
    const room = secondary.rooms[roomId] ?? primary.rooms[roomId]
    if (room?.spaceTypeMarkedAbsent && room.roomType) {
      const key = spaceTypeExistenceKey(room.roomType, room.neighborhood)
      if (primary.spaceTypeExistsAtSchool?.[key] !== true) {
        delete spaceTypeExistsAtSchool[key]
      }
    }
  }

  // Live “Yes it exists” (or discarded DNE) must not be overwritten by an old placeholder.
  for (const [roomId, room] of Object.entries(rooms)) {
    const parsed = parseAbsentSpaceTypeRoomId(roomId)
    if (!parsed && !room.spaceTypeMarkedAbsent) continue
    const spaceType = (parsed?.spaceType || room.roomType || "").trim()
    if (!spaceType) continue
    const key = spaceTypeExistenceKey(
      spaceType,
      parsed?.neighborhood ?? room.neighborhood,
    )
    const unscoped = spaceTypeExistenceKey(spaceType, null)
    if (spaceTypeExistsAtSchool[key] === true || spaceTypeExistsAtSchool[unscoped] === true) {
      delete rooms[roomId]
    }
  }

  const primaryPins = primary.outdoorElementPins ?? []
  const secondaryPins = secondary.outdoorElementPins ?? []
  const pinsById = new Map(secondaryPins.map((pin) => [pin.id, pin]))
  for (const pin of primaryPins) pinsById.set(pin.id, pin)
  const outdoorElementPins = [...pinsById.values()]

  const primaryUpdated = Date.parse(primary.updatedAt || "") || 0
  const secondaryUpdated = Date.parse(secondary.updatedAt || "") || 0
  const updatedAt =
    primaryUpdated >= secondaryUpdated ? primary.updatedAt : secondary.updatedAt

  return {
    ...primary,
    rooms,
    outdoorElementPins: outdoorElementPins.length > 0 ? outdoorElementPins : primary.outdoorElementPins,
    spaceTypeExistsAtSchool:
      Object.keys(spaceTypeExistsAtSchool).length > 0 ? spaceTypeExistsAtSchool : undefined,
    submittedAt: primary.submittedAt ?? secondary.submittedAt,
    moduleCompletedAt: primary.moduleCompletedAt ?? secondary.moduleCompletedAt,
    completionSemanticsVersion:
      primary.completionSemanticsVersion ?? secondary.completionSemanticsVersion,
    updatedAt: updatedAt || primary.updatedAt,
  }
}

/** True when `cover` already includes the answers from `local` that were actually saved. */
export function sessionCoversLocalProgress(
  cover: SurveySession | null | undefined,
  local: SurveySession | null | undefined,
): boolean {
  if (!local) return true
  if (!cover) return false
  for (const [roomId, room] of Object.entries(local.rooms)) {
    const localAnswers = (room.responses ?? []).filter((response) => {
      if (response.value != null && String(response.value).trim() !== "") return true
      if (response.comment?.trim()) return true
      if ((response.photos ?? []).some(Boolean)) return true
      return !!response.photo
    })
    const absent = !!room.spaceTypeMarkedAbsent || isAbsentSpaceTypeRoomId(roomId)
    if (localAnswers.length === 0 && !absent) continue
    const other = cover.rooms[roomId]
    if (!other) return false
    if (absent) continue
    const remoteIds = new Set((other.responses ?? []).map((response) => response.questionId))
    for (const response of localAnswers) {
      if (!remoteIds.has(response.questionId)) return false
    }
  }
  for (const [key, exists] of Object.entries(local.spaceTypeExistsAtSchool ?? {})) {
    // "Does not exist" is stored as an absent room. "Yes it exists" is stored as a
    // real room, so a pull will not always echo the true flag until reconstructed.
    if (exists === false && cover.spaceTypeExistsAtSchool?.[key] !== false) return false
  }
  return true
}

function submissionAnsweredCount(draft: PersistedSurveyDraft | null | undefined): number {
  if (!draft?.lastSubmission?.campus?.rooms) return 0
  return draft.lastSubmission.campus.rooms.reduce(
    (sum, room) => sum + (room.answeredCount ?? 0),
    0,
  )
}

/**
 * Prefer cloud when it is the richer copy, but keep local when this device just
 * saved (including Close Out score updates and "does not exist") and the pull is still stale.
 */
export function mergePulledDraftWithLocal(
  remote: PersistedSurveyDraft,
  local: PersistedSurveyDraft | null,
): PersistedSurveyDraft {
  if (!local) return remote

  const localAnswered = submissionAnsweredCount(local)
  const remoteAnswered = submissionAnsweredCount(remote)
  const localNewer = (local.savedAt || "") > (remote.savedAt || "")

  const keepLocalSnapshot =
    localAnswered > remoteAnswered ||
    (submittedRoomCount(local) > 0 && submittedRoomCount(remote) === 0) ||
    (localNewer && localAnswered >= remoteAnswered && submittedRoomCount(local) > 0)

  const session = mergeSurveySessions(local.session, remote.session, localNewer, {
    includeOtherOnlyRooms: true,
    excludeRoomIds: local.discardedRoomIds,
  })
  if (local.pilotResultsResetAt && !local.session.campusSubmittedAt) {
    session.campusSubmittedAt = undefined
  }
  if (local.pilotResultsResetAt && !local.lastSubmission && !local.session.submittedAt) {
    session.submittedAt = undefined
  }
  const discardedPinIds = new Set(local.discardedPinIds ?? [])
  if (session.outdoorElementPins) {
    session.outdoorElementPins = session.outdoorElementPins.filter((pin) => !discardedPinIds.has(pin.id))
  }

  const autoCarryOverAppliedAt =
    local.autoCarryOverAppliedAt ??
    remote.autoCarryOverAppliedAt ??
    session.autoCarryOverAppliedAt ??
    local.session.autoCarryOverAppliedAt ??
    remote.session.autoCarryOverAppliedAt ??
    local.lastSubmission?.session.autoCarryOverAppliedAt ??
    remote.lastSubmission?.session.autoCarryOverAppliedAt
  if (autoCarryOverAppliedAt) {
    session.autoCarryOverAppliedAt = autoCarryOverAppliedAt
  }

  return {
    ...remote,
    ...local,
    session,
    discardedRoomIds: local.discardedRoomIds,
    discardedPinIds: local.discardedPinIds,
    ownedRoomIds: local.ownedRoomIds,
    ownedPinIds: local.ownedPinIds,
    lastSubmission: local.pilotResultsResetAt && !local.pilotResultsCloudResetAt
      ? local.lastSubmission
      : keepLocalSnapshot
        ? (local.lastSubmission ?? remote.lastSubmission)
        : (remote.lastSubmission ?? local.lastSubmission),
    pilotResultsResetAt: local.pilotResultsResetAt ?? remote.pilotResultsResetAt,
    pilotResultsCloudResetAt: local.pilotResultsCloudResetAt ?? remote.pilotResultsCloudResetAt,
    autoCarryOverAppliedAt,
    pendingStudioType:
      local.pendingStudioType !== undefined ? local.pendingStudioType : remote.pendingStudioType,
    pendingNeighborhood:
      local.pendingNeighborhood !== undefined
        ? local.pendingNeighborhood
        : remote.pendingNeighborhood,
    selectedRoomId:
      local.selectedRoomId !== undefined ? local.selectedRoomId : remote.selectedRoomId,
    selectedLevelId:
      local.selectedLevelId !== undefined ? local.selectedLevelId : remote.selectedLevelId,
    view: local.view ?? remote.view,
    preWalk: local.preWalk ?? remote.preWalk,
    savedAt: localNewer ? local.savedAt : remote.savedAt,
  }
}

/**
 * Results should include the in-memory Save even before the cloud pull catches up.
 * Remote drafts still win as the base so deleted rooms are not resurrected.
 */
export function mergeDraftsForScoring(input: {
  remote: PersistedSurveyDraft[] | null
  remoteConfigured: boolean
  local: PersistedSurveyDraft[]
  live?: {
    schoolId: string
    surveyType: SurveyType
    session: SurveySession
    submission: SurveySubmission | null
  }
}): PersistedSurveyDraft[] | undefined {
  const byType = new Map<SurveyType, PersistedSurveyDraft>()
  const remoteReady = input.remoteConfigured && input.remote !== null
  const base = remoteReady ? (input.remote ?? []) : input.local

  for (const draft of base) byType.set(draft.surveyType, draft)

  if (remoteReady) {
    for (const local of input.local) {
      const remote = byType.get(local.surveyType)
      byType.set(local.surveyType, mergePulledDraftWithLocal(remote ?? local, local))
    }
  }

  const live = input.live
  const liveRooms = live?.submission?.campus?.rooms?.length ?? 0
  if (live && live.submission && liveRooms > 0) {
    const existing = byType.get(live.surveyType)
    byType.set(live.surveyType, {
      version: DRAFT_VERSION,
      schoolId: live.schoolId,
      surveyType: live.surveyType,
      session: live.session,
      selectedLevelId: existing?.selectedLevelId ?? null,
      selectedRoomId: existing?.selectedRoomId,
      pendingStudioType: existing?.pendingStudioType,
      pendingNeighborhood: existing?.pendingNeighborhood,
      view: existing?.view,
      manualRooms: existing?.manualRooms,
      preWalk: existing?.preWalk,
      lastSubmission: live.submission,
      savedAt: live.submission.submittedAt,
    })
  }

  const list = [...byType.values()]
  return list.length ? list : undefined
}

/** Copy school-level pre-walk data onto every local draft for that school. */
export function propagatePreWalkToSchoolDrafts(
  schoolId: string,
  preWalk: PreWalkState,
): void {
  for (const surveyType of SURVEY_TYPES) {
    if (surveyType === "closeout") continue
    const draft = loadDraft(schoolId, surveyType)
    if (!draft) continue
    saveDraft(
      {
        ...draft,
        preWalk,
      },
      { setActive: false },
    )
  }
}

/**
 * Write pre-walk “space type exists?” answers onto each matching survey draft so
 * assessors can skip that space type later. Creates a draft when something is marked
 * as not present. Returns survey types that were written (for cloud sync).
 */
export function persistPreWalkSpaceTypeExistsToSchoolDrafts(input: {
  school: AisdSchoolOption
  preWalk: PreWalkState
  skipSurveyType?: SurveyType
  assessor?: AssessorInfo | null
}): SurveyType[] {
  const answers = input.preWalk.spaceTypeExists ?? {}
  const written: SurveyType[] = []
  const bySurvey = new Map<SurveyType, boolean[]>()

  for (const key of Object.keys(answers)) {
    const sep = key.indexOf("::")
    if (sep < 0) continue
    const surveyType = key.slice(0, sep) as SurveyType
    if (!SURVEY_TYPES.includes(surveyType)) continue
    if (surveyType === input.skipSurveyType) continue
    if (surveyType === "neighborhoods" || surveyType === "outdoor" || surveyType === "closeout") {
      continue
    }
    const list = bySurvey.get(surveyType) ?? []
    list.push(answers[key] === true)
    bySurvey.set(surveyType, list)
  }

  const savedAt = new Date().toISOString()
  for (const surveyType of bySurvey.keys()) {
    const flags = bySurvey.get(surveyType) ?? []
    const hasAbsent = flags.some((exists) => exists === false)
    const existing = loadDraft(input.school.id, surveyType)
    if (!existing && !hasAbsent) continue

    const now = new Date().toISOString()
    const baseSession: SurveySession = existing?.session ?? {
      surveyId: `AISD-${Date.now()}-${surveyType}`,
      surveyType,
      schoolId: input.school.id,
      schoolName: input.school.displayName,
      campusId: input.school.campusId,
      building: existing?.session.building ?? "Main",
      rooms: {},
      startedAt: now,
      updatedAt: now,
      ...(input.assessor
        ? {
            assessorName: input.assessor.name,
            assessorEmail: input.assessor.email,
            assessorRegisteredAt: input.assessor.registeredAt,
          }
        : {}),
    }

    const session = applyPreWalkSpaceTypeExistsToSession(
      baseSession,
      answers,
      surveyType,
    )

    saveDraft(
      existing
        ? {
            ...existing,
            session,
            preWalk: input.preWalk,
            savedAt,
          }
        : {
            schoolId: input.school.id,
            surveyType,
            session,
            selectedLevelId: null,
            preWalk: input.preWalk,
            lastSubmission: null,
            savedAt,
          },
      { setActive: false },
    )
    written.push(surveyType)
  }

  return written
}

export function draftRetainsSession(
  schoolId: string,
  surveyType: SurveyType,
  session: SurveySession,
): boolean {
  const loaded = loadDraft(schoolId, surveyType)
  return !!loaded && sessionCoversLocalProgress(loaded.session, session)
}

export function formatSavedAt(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  }
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}
