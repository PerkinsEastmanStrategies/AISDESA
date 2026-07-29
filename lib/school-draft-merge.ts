import type { SurveySession, SurveyType } from "@aisd/shared"
import { SURVEY_TYPES } from "@aisd/shared"
import { loadDraft, saveDraft, type PersistedSurveyDraft } from "@/lib/survey-persistence"

export function countDraftResponses(draft: PersistedSurveyDraft): number {
  return countSessionResponses(draft.session)
}

export function countSessionResponses(session: SurveySession | null | undefined): number {
  if (!session) return 0
  let count = session.outdoorElementPins?.length ?? 0
  for (const room of Object.values(session.rooms)) {
    count += room.responses.length
    if (room.gradeType) count += 1
  }
  return count
}

function draftRichness(draft: PersistedSurveyDraft): number {
  let score = countDraftResponses(draft)
  if (draft.lastSubmission) score += 1000
  if (draft.session.submittedAt) score += 500
  return score
}

/** Prefer the draft with more assessment data; tie-break with savedAt. */
export function pickRicherDraft(
  local: PersistedSurveyDraft,
  remote: PersistedSurveyDraft,
): PersistedSurveyDraft {
  const localRichness = draftRichness(local)
  const remoteRichness = draftRichness(remote)
  if (remoteRichness !== localRichness) {
    return remoteRichness > localRichness ? remote : local
  }
  return remote.savedAt >= local.savedAt ? remote : local
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
      merged.push(pickRicherDraft(local, remote))
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
    const merged = local ? pickRicherDraft(local, remote) : remote
    saveDraft(merged, { setActive: false })
  }
}
