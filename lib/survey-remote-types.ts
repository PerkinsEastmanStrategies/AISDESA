import type { SurveyType } from "@aisd/shared"

export interface RemoteSurveyStatus {
  configured: boolean
  hasRemote: boolean
  conflict: boolean
  surveyLabel: string
  remoteAssessorName: string | null
  remoteAssessorEmail: string | null
  remoteStatus: "not_started" | "in_progress" | "submitted" | "campus_submitted"
  remoteUpdatedAt: string | null
  remoteSubmittedAt: string | null
  remoteCampusSubmittedAt: string | null
}

export interface SyncQueueEntry {
  schoolId: string
  surveyType: SurveyType
  savedAt: string
}
