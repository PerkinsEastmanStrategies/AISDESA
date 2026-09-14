import type { SurveySession, SurveyType } from "@aisd/shared"
import { SURVEY_TYPES } from "@aisd/shared"
import {
  loadDraft,
  saveDraft,
  mergePulledDraftWithLocal,
  sessionAssessmentWeight,
  type PersistedSurveyDraft,
} from "@/lib/survey-persistence"

export function countDraftResponses(draft: PersistedSurveyDraft): number {
  return sessionAssessmentWeight(draft.session)
}

export function countSessionResponses(session: SurveySession | null | undefined): number {
  return sessionAssessmentWeight(session)
}

/** Prefer the draft with more assessment data; tie-break with savedAt. */
export function pickRicherDraft(
  local: PersistedSurveyDraft,
  remote: PersistedSurveyDraft,
): PersistedSurveyDraft {
  return mergePulledDraftWithLocal(remote, local)
}

/** Merge local and remote drafts per survey module (all SURVEY_TYPES except closeout). */
export function mergeSchoolDrafts(
  localDrafts: PersistedSurveyDraft[],
  remoteDrafts: PersistedSurveyDraft[],
): PersistedSurveyDraft[] {
  const localByType = new Map(localDrafts.map((draft) => [draft.surveyType, draft]))
  const remoteByType = new Map(remoteDrafts.map((draft) => [draft.surveyType, draft]))
  const merged: PersistedSurveyDraft[] = []

  for (const surveyType of SURVEY_TYPES) {
    if (surveyType === "closeout") continue
    const local = localByType.get(surveyType)
    const remote = remoteByType.get(surveyType)
    if (local && remote) {
      merged.push(mergePulledDraftWithLocal(remote, local))
    } else if (remote) {
      merged.push(remote)
    } else if (local) {
      merged.push(local)
    }
  }

  return merged
}

/** Write Supabase drafts into localStorage so sidebar, status, and offline views stay aligned. */
export function hydrateLocalDraftsFromRemote(
  remoteDrafts: PersistedSurveyDraft[],
  schoolId?: string,
): void {
  for (const remote of remoteDrafts) {
    if (schoolId && remote.schoolId !== schoolId) continue
    const local = loadDraft(remote.schoolId, remote.surveyType)
    const merged = local ? mergePulledDraftWithLocal(remote, local) : remote
    saveDraft(merged, { setActive: false })
  }
}
