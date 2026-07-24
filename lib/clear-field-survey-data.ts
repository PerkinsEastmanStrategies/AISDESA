import { SURVEY_TYPES } from "@aisd/shared"
import { ALLISON_ES_DEMO_SCHOOL_ID } from "@/lib/seed-allison-es-demo"
import { DAVIS_ES_DEMO_SCHOOL_ID } from "@/lib/seed-davis-es-demo"
import { loadActiveDraftMeta } from "@/lib/survey-persistence"

const DEMO_SCHOOL_IDS = new Set([DAVIS_ES_DEMO_SCHOOL_ID, ALLISON_ES_DEMO_SCHOOL_ID])

const ACTIVE_KEY = "aisd-survey-active"
const QA_KEY = "aisd-survey-qa-finalizations"
const FIELD_DATA_RESET_KEY = "aisd-survey-field-data-reset-v"

/** Bump when a one-time browser cleanup should run for all users. */
export const FIELD_DATA_RESET_VERSION = 1

const PRESERVED_PREFIXES = [
  "aisd-survey-draft-",
  ACTIVE_KEY,
  "aisd-survey-assessors",
  QA_KEY,
  FIELD_DATA_RESET_KEY,
  "aisd-survey-visit",
] as const

function isDemoSchoolId(schoolId: string): boolean {
  return DEMO_SCHOOL_IDS.has(schoolId)
}

function schoolIdFromDraftKey(key: string): string | null {
  if (!key.startsWith("aisd-survey-draft-")) return null
  const rest = key.slice("aisd-survey-draft-".length)
  for (const surveyType of SURVEY_TYPES) {
    const suffix = `-${surveyType}`
    if (rest.endsWith(suffix)) return rest.slice(0, -suffix.length)
  }
  return rest
}

function isDemoSubmissionStorageKey(key: string): boolean {
  if (!key.startsWith("aisd-survey-")) return false
  const surveyId = key.slice("aisd-survey-".length)
  const upper = surveyId.toUpperCase()
  return upper.startsWith("AISD-DEMO-DAVIS-") || upper.startsWith("AISD-DEMO-ALLISON-")
}

function isPreservedSurveyStorageKey(key: string): boolean {
  if (PRESERVED_PREFIXES.some((prefix) => key === prefix || key.startsWith(prefix))) {
    if (key.startsWith("aisd-survey-draft-")) {
      const schoolId = schoolIdFromDraftKey(key)
      return !!schoolId && isDemoSchoolId(schoolId)
    }
    if (key === QA_KEY) return true
    if (key === ACTIVE_KEY) {
      const active = loadActiveDraftMeta()
      return !active || isDemoSchoolId(active.schoolId)
    }
    return true
  }
  return isDemoSubmissionStorageKey(key)
}

/** Remove all saved survey drafts and submissions except Davis + Allison demo schools. */
export function clearAllFieldSurveyDataExceptDemos(): number {
  if (typeof window === "undefined") return 0

  let removed = 0

  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (!key?.startsWith("aisd-survey-")) continue
      if (isPreservedSurveyStorageKey(key)) continue
      localStorage.removeItem(key)
      removed += 1
    }

    const active = loadActiveDraftMeta()
    if (active && !isDemoSchoolId(active.schoolId)) {
      localStorage.removeItem(ACTIVE_KEY)
      removed += 1
    }

    const qaRaw = localStorage.getItem(QA_KEY)
    if (qaRaw) {
      const qa = JSON.parse(qaRaw) as Record<string, unknown>
      let changed = false
      for (const schoolId of Object.keys(qa)) {
        if (schoolId !== ALLISON_ES_DEMO_SCHOOL_ID) {
          delete qa[schoolId]
          changed = true
        }
      }
      if (changed) {
        localStorage.setItem(QA_KEY, JSON.stringify(qa))
        removed += 1
      }
    }
  } catch {
    /* private browsing / corrupt storage */
  }

  return removed
}

/** One-time cleanup so prior field-school drafts (e.g. CASIS) do not linger in the admin UI. */
export function runFieldDataResetIfNeeded(): { ran: boolean; removed: number } {
  if (typeof window === "undefined") return { ran: false, removed: 0 }

  try {
    if (localStorage.getItem(FIELD_DATA_RESET_KEY) === String(FIELD_DATA_RESET_VERSION)) {
      return { ran: false, removed: 0 }
    }
    const removed = clearAllFieldSurveyDataExceptDemos()
    localStorage.setItem(FIELD_DATA_RESET_KEY, String(FIELD_DATA_RESET_VERSION))
    return { ran: true, removed }
  } catch {
    return { ran: false, removed: 0 }
  }
}
