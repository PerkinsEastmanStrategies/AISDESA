import type {
  SurveySession,
  SurveySubmission,
  SurveyType,
  AssessorInfo,
  ParsedPlanRoom,
  RoomSurveySession,
  PreWalkState,
} from "@aisd/shared"
import { SURVEY_TYPES } from "@aisd/shared"
import { EMPTY_PREWALK, mergePreWalkStates, migratePreWalkState } from "@/lib/prewalk"
import {
  LIFE_SKILLS_RUBRIC_VERSION,
  SENSORY_LAB_RUBRIC_VERSION,
  SPED_FLEX_RUBRIC_VERSION,
  TRADITIONAL_STUDIOS_RUBRIC_VERSION,
  VOCATIONAL_LAB_RUBRIC_VERSION,
} from "@aisd/shared"

const ACTIVE_KEY = "aisd-survey-active"
const ASSESSOR_KEY = "aisd-survey-assessors"
/** Survives reloads in the same tab; cleared when the tab/app is closed. */
const VISIT_KEY = "aisd-survey-visit"
const PREWALK_SCHOOL_KEY_PREFIX = "aisd-survey-prewalk-"
const DRAFT_VERSION = 1

function preWalkSchoolKey(schoolId: string): string {
  return `${PREWALK_SCHOOL_KEY_PREFIX}${schoolId}`
}

/** School-scoped pre-walk store (shared across all survey modules for one school). */
export function saveSchoolPreWalk(schoolId: string, preWalk: PreWalkState): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(preWalkSchoolKey(schoolId), JSON.stringify(preWalk))
  } catch {
    /* quota or private browsing */
  }
}

export function loadSchoolPreWalk(schoolId: string): PreWalkState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(preWalkSchoolKey(schoolId))
    if (!raw) return null
    return JSON.parse(raw) as PreWalkState
  } catch {
    return null
  }
}

/** Merge pre-walk from the school store and every module draft for this school. */
export function collectSchoolPreWalkFromDrafts(schoolId: string): PreWalkState {
  const fromDrafts = loadDraftsForSchool(schoolId).map((draft) => draft.preWalk)
  return mergePreWalkStates(...fromDrafts)
}

export function resolveSchoolPreWalk(
  schoolId: string,
  schoolClass?: string | null,
  ...extra: (PreWalkState | null | undefined)[]
): PreWalkState {
  return migratePreWalkState(
    mergePreWalkStates(loadSchoolPreWalk(schoolId), collectSchoolPreWalkFromDrafts(schoolId), ...extra),
    schoolClass,
  )
}

/** Keep every module draft aligned with the school-level pre-walk map. */
export function syncSchoolPreWalkToDrafts(
  schoolId: string,
  preWalk: PreWalkState,
  options?: { activeSurveyType?: SurveyType },
): void {
  saveSchoolPreWalk(schoolId, preWalk)
  const savedAt = new Date().toISOString()
  for (const surveyType of SURVEY_TYPES) {
    if (surveyType === "closeout") continue
    const draft = loadDraft(schoolId, surveyType)
    if (!draft) continue
    saveDraft(
      { ...draft, preWalk, savedAt },
      { setActive: options?.activeSurveyType ? surveyType === options.activeSurveyType : false },
    )
  }
}

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
  view?: "survey" | "results"
  /** Rooms entered manually (not on the floor plan SVG) */
  manualRooms?: ParsedPlanRoom[]
  /** Building pre-walk room → space type mappings */
  preWalk?: PreWalkState
  lastSubmission: SurveySubmission | null
  savedAt: string
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

export function setActiveDraftMeta(meta: ActiveDraftMeta): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(meta))
  } catch {
    /* quota or private browsing */
  }
}

/** True when a saved draft has enough state to resume after an iOS tab kill. */
export function draftHasResumeContent(draft: PersistedSurveyDraft): boolean {
  if (!draft.session || !draft.schoolId) return false
  if (draft.savedAt) return true
  if (Object.keys(draft.session.rooms).length > 0) return true
  if (draft.selectedRoomId) return true
  if (draft.lastSubmission) return true
  const preWalk = draft.preWalk ?? loadSchoolPreWalk(draft.schoolId)
  if (preWalk && Object.keys(preWalk.mappings ?? {}).length > 0) return true
  const name = draft.session.assessorName?.trim()
  const email = draft.session.assessorEmail?.trim()
  if (name && email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return true
  return false
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
  if (meta) {
    const draft = loadDraft(meta.schoolId, meta.surveyType)
    if (draft?.session && draftHasResumeContent(draft)) {
      return { meta, draft }
    }
  }

  const fallback = listAllDrafts()
    .filter(draftHasResumeContent)
    .sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""))[0]
  if (!fallback?.session) return null

  const fallbackMeta = {
    schoolId: fallback.schoolId,
    surveyType: fallback.surveyType,
  } satisfies ActiveDraftMeta
  setActiveDraftMeta(fallbackMeta)
  return { meta: fallbackMeta, draft: fallback }
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

/**
 * Clear package studio room drafts when their rubrics land
 * (answers from the shared rubric — or older packages — are invalid).
 */
function migratePackageStudioDrafts(draft: PersistedSurveyDraft): PersistedSurveyDraft {
  let next = draft
  let changed = false

  if (next.traditionalStudiosRubricVersion !== TRADITIONAL_STUDIOS_RUBRIC_VERSION) {
    next = {
      ...stripStudioTypeFromDraft(next, "Traditional studio"),
      traditionalStudiosRubricVersion: TRADITIONAL_STUDIOS_RUBRIC_VERSION,
    }
    changed = true
  }

  if (next.sensoryLabRubricVersion !== SENSORY_LAB_RUBRIC_VERSION) {
    next = {
      ...stripStudioTypeFromDraft(next, "Sensory Lab"),
      sensoryLabRubricVersion: SENSORY_LAB_RUBRIC_VERSION,
    }
    changed = true
  }

  if (next.vocationalLabRubricVersion !== VOCATIONAL_LAB_RUBRIC_VERSION) {
    // Strip both casings (legacy "Vocational lab" + package "Vocational Lab")
    next = stripStudioTypeFromDraft(next, "Vocational lab")
    next = {
      ...stripStudioTypeFromDraft(next, "Vocational Lab"),
      vocationalLabRubricVersion: VOCATIONAL_LAB_RUBRIC_VERSION,
    }
    changed = true
  }

  if (next.lifeSkillsRubricVersion !== LIFE_SKILLS_RUBRIC_VERSION) {
    next = {
      ...stripStudioTypeFromDraft(next, "Life Skills Room"),
      lifeSkillsRubricVersion: LIFE_SKILLS_RUBRIC_VERSION,
    }
    changed = true
  }

  if (next.spedFlexRubricVersion !== SPED_FLEX_RUBRIC_VERSION) {
    next = {
      ...stripStudioTypeFromDraft(next, "Sped flex studio"),
      spedFlexRubricVersion: SPED_FLEX_RUBRIC_VERSION,
    }
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
): void {
  if (typeof window === "undefined") return
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
    }
  } catch {
    /* quota or private browsing */
  }
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
