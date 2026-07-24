"use client"

import { X } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import { formatSavedAt } from "@/lib/survey-persistence"

export default function ResumeBanner() {
  const { state, surveyedRooms, lastSavedAt, dismissResumeBanner, submission } = useSurvey()

  if (!state.showResumeBanner || !state.school || !lastSavedAt) return null

  const roomCount = Object.keys(state.session?.rooms ?? {}).length
  const scoredCount = surveyedRooms.filter((r) => r.overallScore !== null).length

  return (
    <div className="flex items-start gap-2 border-b border-blue-200 bg-blue-50 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-blue-900">Survey resumed</p>
        <p className="text-xs text-blue-700">
          {state.school.displayName} · {scoredCount} room{scoredCount === 1 ? "" : "s"} scored
          {roomCount > scoredCount ? ` · ${roomCount - scoredCount} in progress` : ""}
          {submission ? " · results saved" : ""}
          {" · "}last saved {formatSavedAt(lastSavedAt)}
        </p>
      </div>
      <button
        type="button"
        onClick={dismissResumeBanner}
        className="shrink-0 rounded p-1 text-blue-600 active:bg-blue-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
