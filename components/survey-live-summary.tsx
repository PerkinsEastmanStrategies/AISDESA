"use client"

import { useMemo } from "react"
import { useSurvey } from "@/lib/survey-store"
import { aggregateCampusScores, getSurveyRubric } from "@aisd/shared"
import { ScoreBadge } from "@/components/score-display"

/** Running campus + neighborhood averages while surveying multiple rooms. */
export default function SurveyLiveSummary() {
  const { state, surveyedRooms } = useSurvey()

  const campus = useMemo(() => {
    if (!state.school || !surveyedRooms.length) return null
    return aggregateCampusScores(surveyedRooms, {
      schoolId: state.school.id,
      schoolName: state.school.displayName,
      campusId: state.school.campusId,
    })
  }, [state.school, surveyedRooms])

  if (!campus || state.view === "results") return null

  const rubric = getSurveyRubric(state.surveyType)
  if (!rubric) return null

  const neighborhoods = campus.neighborhoods ?? []

  return (
    <div className="border-b border-[var(--color-border)] bg-slate-50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Running campus score
          </p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {campus.scoredRoomCount} room{campus.scoredRoomCount === 1 ? "" : "s"} ·{" "}
            {neighborhoods.length} neighborhood{neighborhoods.length === 1 ? "" : "s"}
          </p>
        </div>
        <ScoreBadge score={campus.overallScore} size="lg" />
      </div>
      {neighborhoods.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {neighborhoods.map((n) => (
            <span
              key={n.neighborhoodId}
              className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs ring-1 ring-[var(--color-border)]"
            >
              {n.neighborhoodLabel}
              <ScoreBadge score={n.overallScore} />
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
