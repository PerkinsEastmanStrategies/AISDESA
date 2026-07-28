"use client"

import { AlertTriangle, X } from "lucide-react"
import type { RemoteSurveyStatus } from "@/lib/survey-remote-types"
import { cn } from "@/lib/utils"

function remoteActivityPhrase(status: RemoteSurveyStatus["remoteStatus"]): string {
  switch (status) {
    case "campus_submitted":
      return "has already submitted the campus assessment for"
    case "submitted":
      return "has already submitted"
    case "in_progress":
      return "has already started"
    default:
      return "has already started"
  }
}

interface SurveyRemoteConflictModalProps {
  open: boolean
  status: RemoteSurveyStatus | null
  onClose: () => void
  onContinue: () => void
  onLoadRemote?: () => void
  showLoadRemote?: boolean
}

export default function SurveyRemoteConflictModal({
  open,
  status,
  onClose,
  onContinue,
  onLoadRemote,
  showLoadRemote = false,
}: SurveyRemoteConflictModalProps) {
  if (!open || !status?.conflict) return null

  const who = status.remoteAssessorName?.trim() || status.remoteAssessorEmail || "Another assessor"
  const when = status.remoteUpdatedAt
    ? new Date(status.remoteUpdatedAt).toLocaleString()
    : null

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/45" aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remote-conflict-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-700" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="remote-conflict-title" className="text-base font-semibold text-slate-900">
              Someone else is working on this survey
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              <span className="font-medium text-slate-800">{who}</span>{" "}
              {remoteActivityPhrase(status.remoteStatus)} the{" "}
              <span className="font-medium text-slate-800">{status.surveyLabel}</span> survey for
              this campus.
            </p>
            {when ? (
              <p className="mt-2 text-xs text-slate-500">Last updated {when}</p>
            ) : null}
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              You can continue locally while offline. When you reconnect, the most recent save
              wins if you both sync.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 active:bg-slate-50"
          >
            Close
          </button>
          {showLoadRemote && onLoadRemote ? (
            <button
              type="button"
              onClick={onLoadRemote}
              className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 active:bg-slate-50"
            >
              Load their version
            </button>
          ) : null}
          <button
            type="button"
            onClick={onContinue}
            className={cn(
              "min-h-[44px] rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white active:opacity-90",
            )}
          >
            Continue my survey
          </button>
        </div>
      </div>
    </div>
  )
}
