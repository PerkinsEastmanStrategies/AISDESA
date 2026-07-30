"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import WeightTunerPanel from "@/components/weight-tuner-panel"
import { cn, scoreColor, scoreTextColor } from "@/lib/utils"

const CATEGORY_ORDER = ["Function", "Infrastructure", "Occupant Experience", "Amenities"]

export default function ScorePanel() {
  const { currentRoomScore, state, hasCustomWeights } = useSurvey()
  const [expanded, setExpanded] = useState(false)

  const sortedCategories = useMemo(() => {
    if (!currentRoomScore) return []
    return [...currentRoomScore.categoryScores].sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.category)
      const bi = CATEGORY_ORDER.indexOf(b.category)
      if (ai === -1 && bi === -1) return a.category.localeCompare(b.category)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }, [currentRoomScore])

  if (!currentRoomScore || !state.selectedRoomId) return null

  const { answeredCount, totalCount } = currentRoomScore
  const showScore = currentRoomScore.overallScore !== null

  return (
    <div className="border-b border-[var(--color-border)] bg-[var(--color-card)]">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--color-muted-foreground)]">
            Survey progress
            {hasCustomWeights && (
              <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                Custom weights
              </span>
            )}
          </p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {showScore ? (
              <p className={cn("text-xl font-bold tabular-nums", scoreTextColor(currentRoomScore.overallScore))}>
                {currentRoomScore.overallScore !== null ? `${Math.round(currentRoomScore.overallScore)}%` : "—"}
              </p>
            ) : (
              <p className="text-sm font-medium text-slate-700">Scores appear after Save</p>
            )}
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {answeredCount} / {totalCount} answered
            </p>
          </div>
        </div>
        <span className="shrink-0 text-xs font-medium text-[var(--color-muted-foreground)]">
          {expanded ? "Hide" : "Details"}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" aria-hidden />
        )}
      </button>

      {expanded && (
        <div className="border-t border-[var(--color-border)] px-3 pb-3 pt-2">
          {sortedCategories.length > 0 ? (
            <div className="space-y-2">
              {sortedCategories.map((cat) => (
                <div key={cat.category}>
                  <div className="mb-0.5 flex justify-between gap-2 text-xs">
                    <span className="font-medium">{cat.category}</span>
                    <span className={cn("shrink-0 tabular-nums", scoreTextColor(cat.score))}>
                      {Math.round(cat.score)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        scoreColor(cat.score),
                      )}
                      style={{ width: `${Math.min(100, cat.score)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-muted-foreground)]">No category scores yet.</p>
          )}
          <WeightTunerPanel />
        </div>
      )}
    </div>
  )
}
