"use client"

import type { AisdSchoolOption, SurveyType } from "@aisd/shared"
import type { PersistedSurveyDraft } from "@/lib/survey-persistence"
import type { RemoteSurveyStatus } from "@/lib/survey-remote-types"

const SYNC_QUEUE_KEY = "aisd-survey-sync-queue"
const LAST_SYNCED_KEY = "aisd-survey-last-synced"

export function isBrowserOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true
}

export function isSurveySyncAvailable(): boolean {
  return typeof window !== "undefined"
}

interface SyncQueueEntry {
  schoolId: string
  surveyType: SurveyType
  savedAt: string
}

function readQueue(): SyncQueueEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SyncQueueEntry[]
  } catch {
    return []
  }
}

function writeQueue(entries: SyncQueueEntry[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(entries))
}

export function queueSurveySync(schoolId: string, surveyType: SurveyType, savedAt: string): void {
  const queue = readQueue().filter(
    (entry) => !(entry.schoolId === schoolId && entry.surveyType === surveyType),
  )
  queue.push({ schoolId, surveyType, savedAt })
  writeQueue(queue)
}

function lastSyncedKey(schoolId: string, surveyType: SurveyType): string {
  return `${LAST_SYNCED_KEY}:${schoolId}:${surveyType}`
}

export function markSurveySynced(schoolId: string, surveyType: SurveyType, savedAt: string): void {
  localStorage.setItem(lastSyncedKey(schoolId, surveyType), savedAt)
}

export async function fetchRemoteSurveyStatusClient(input: {
  schoolId: string
  surveyType: SurveyType
  assessorEmail?: string | null
}): Promise<RemoteSurveyStatus | null> {
  if (!isBrowserOnline()) return null

  const params = new URLSearchParams({
    schoolId: input.schoolId,
    surveyType: input.surveyType,
  })
  if (input.assessorEmail?.trim()) {
    params.set("assessorEmail", input.assessorEmail.trim())
  }

  try {
    const response = await fetch(`/api/survey/status?${params.toString()}`, { cache: "no-store" })
    if (!response.ok) return null
    return (await response.json()) as RemoteSurveyStatus
  } catch {
    return null
  }
}

export async function pullRemoteDraftClient(input: {
  schoolId: string
  surveyType: SurveyType
}): Promise<PersistedSurveyDraft | null> {
  if (!isBrowserOnline()) return null

  const params = new URLSearchParams({
    schoolId: input.schoolId,
    surveyType: input.surveyType,
  })

  try {
    const response = await fetch(`/api/survey/sync?${params.toString()}`, { cache: "no-store" })
    if (!response.ok) return null
    const payload = (await response.json()) as { draft: PersistedSurveyDraft | null }
    return payload.draft
  } catch {
    return null
  }
}

export async function pushSurveyDraftClient(input: {
  school: AisdSchoolOption
  draft: PersistedSurveyDraft
  writeSnapshot?: boolean
}): Promise<"pushed" | "skipped_remote_newer" | "offline" | "error"> {
  if (!isBrowserOnline()) {
    queueSurveySync(input.draft.schoolId, input.draft.surveyType, input.draft.savedAt)
    return "offline"
  }

  try {
    const response = await fetch("/api/survey/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    if (!response.ok) {
      queueSurveySync(input.draft.schoolId, input.draft.surveyType, input.draft.savedAt)
      return "error"
    }
    const payload = (await response.json()) as {
      action?: "pushed" | "skipped_remote_newer" | "offline"
    }
    if (payload.action === "pushed") {
      markSurveySynced(input.draft.schoolId, input.draft.surveyType, input.draft.savedAt)
      const queue = readQueue().filter(
        (entry) =>
          !(
            entry.schoolId === input.draft.schoolId &&
            entry.surveyType === input.draft.surveyType
          ),
      )
      writeQueue(queue)
      return "pushed"
    }
    if (payload.action === "skipped_remote_newer") {
      return "skipped_remote_newer"
    }
    return "error"
  } catch {
    queueSurveySync(input.draft.schoolId, input.draft.surveyType, input.draft.savedAt)
    return "offline"
  }
}

let flushPromise: Promise<void> | null = null

export async function flushSurveySyncQueue(input: {
  schools: AisdSchoolOption[]
  loadDraft: (schoolId: string, surveyType: SurveyType) => PersistedSurveyDraft | null
  onRemoteNewer?: (entry: SyncQueueEntry) => void
}): Promise<void> {
  if (!isBrowserOnline()) return
  if (flushPromise) return flushPromise

  flushPromise = (async () => {
    const queue = readQueue()
    for (const entry of queue) {
      const draft = input.loadDraft(entry.schoolId, entry.surveyType)
      const school = input.schools.find((s) => s.id === entry.schoolId)
      if (!draft || !school) continue

      const result = await pushSurveyDraftClient({ school, draft })
      if (result === "skipped_remote_newer") {
        input.onRemoteNewer?.(entry)
      }
    }
  })().finally(() => {
    flushPromise = null
  })

  return flushPromise
}

export function getPendingSyncCount(): number {
  return readQueue().length
}
