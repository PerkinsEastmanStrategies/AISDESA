import { campusUsesSeededWalkedRooms, SURVEY_TYPES } from "@aisd/shared"
import {
  loadDraft,
  saveDraft,
  type PersistedSurveyDraft,
} from "@/lib/survey-persistence"

/** Bump to force another one-shot Results wipe on seeded Pilot campuses. */
export const PILOT_RESULTS_RESET_VERSION = 1

const LOCAL_KEY_PREFIX = "esa-pilot-results-reset:"
const CLOUD_KEY_PREFIX = "esa-pilot-results-reset-cloud:"

function localKey(schoolId: string): string {
  return `${LOCAL_KEY_PREFIX}${schoolId}`
}

function cloudKey(schoolId: string): string {
  return `${CLOUD_KEY_PREFIX}${schoolId}`
}

export function isPilotResultsResetSchool(
  school: { id?: string | null; name?: string | null; campusId?: string | null } | null | undefined,
): boolean {
  return campusUsesSeededWalkedRooms(school)
}

export function shouldWipeLocalPilotResults(schoolId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(localKey(schoolId)) !== String(PILOT_RESULTS_RESET_VERSION)
  } catch {
    return true
  }
}

export function markLocalPilotResultsWiped(schoolId: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(localKey(schoolId), String(PILOT_RESULTS_RESET_VERSION))
  } catch {
    /* private browsing */
  }
}

export function shouldWipeCloudPilotResults(schoolId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    if (localStorage.getItem(cloudKey(schoolId)) === String(PILOT_RESULTS_RESET_VERSION)) {
      return false
    }
  } catch {
    return true
  }
  return true
}

export function markCloudPilotResultsWiped(schoolId: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(cloudKey(schoolId), String(PILOT_RESULTS_RESET_VERSION))
  } catch {
    /* private browsing */
  }
}

export function stampPilotResultsCloudReset(schoolId: string): void {
  const now = new Date().toISOString()
  markCloudPilotResultsWiped(schoolId)
  for (const surveyType of SURVEY_TYPES) {
    const draft = loadDraft(schoolId, surveyType)
    if (!draft) continue
    saveDraft(
      {
        ...draft,
        pilotResultsCloudResetAt: draft.pilotResultsCloudResetAt ?? now,
      },
      { setActive: false },
    )
  }
}

function clearHistoricSubmissionCopy(surveyId: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(`aisd-survey-${surveyId}`)
  } catch {
    /* ignore */
  }
}

/** Drop Results snapshots on this device. Carry-over room answers stay. */
export function wipeLocalPilotResultSnapshots(schoolId: string): PersistedSurveyDraft[] {
  const now = new Date().toISOString()
  const next: PersistedSurveyDraft[] = []
  for (const surveyType of SURVEY_TYPES) {
    const draft = loadDraft(schoolId, surveyType)
    if (!draft) continue
    clearHistoricSubmissionCopy(draft.session.surveyId)
    const wiped: PersistedSurveyDraft = {
      ...draft,
      lastSubmission: null,
      pilotResultsResetAt: now,
      savedAt: now,
      session: {
        ...draft.session,
        submittedAt: undefined,
        campusSubmittedAt: undefined,
        updatedAt: now,
      },
    }
    saveDraft(wiped, { setActive: false })
    next.push(wiped)
  }
  markLocalPilotResultsWiped(schoolId)
  return next
}
