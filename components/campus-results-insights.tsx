"use client"

import { useMemo } from "react"
import { TrendingUp } from "lucide-react"
import type { ScoringFocusAreaId } from "@aisd/shared"
import FocusAreaRadarChart from "@/components/focus-area-radar-chart"
import { CategoryScoreList, ScoreBadge, ScoreBar } from "@/components/score-display"
import { cn } from "@/lib/utils"
import { sumPositiveWeights } from "@/lib/weight-display"
import type { CampusScoringSnapshot } from "@/lib/campus-scoring-tree"
import { campusCategoryScoresFromSnapshot } from "@/lib/qa-peer-comparison"

function focusAreaScoreMap(
  focusAreas: CampusScoringSnapshot["focusAreas"],
): Record<ScoringFocusAreaId, number | null> {
  const map = {} as Record<ScoringFocusAreaId, number | null>
  for (const area of focusAreas) {
    map[area.id] = area.overallScore
  }
  return map
}

export default function CampusResultsInsights({
  snapshot,
}: {
  snapshot: CampusScoringSnapshot
}) {
  const rankedSpaceTypes = useMemo(
    () =>
      snapshot.focusAreas
        .flatMap((area) =>
          area.spaceTypes.map((spaceType) => ({
            ...spaceType,
            focusAreaLabel: area.label,
          })),
        )
        .filter((entry) => entry.overallScore !== null && entry.scoredRoomCount > 0)
        .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0)),
    [snapshot.focusAreas],
  )

  const chartAxes = useMemo(
    () =>
      snapshot.focusAreas
        .filter((area) => area.overallScore !== null || area.scoredRoomCount > 0)
        .map((area) => ({ id: area.id, label: area.label })),
    [snapshot.focusAreas],
  )

  const radarSeries = useMemo(
    () => [
      {
        id: "current",
        label: snapshot.schoolName,
        color: "#2563eb",
        scores: focusAreaScoreMap(snapshot.focusAreas),
      },
    ],
    [snapshot.focusAreas, snapshot.schoolName],
  )

  const categories = useMemo(
    () => campusCategoryScoresFromSnapshot(snapshot),
    [snapshot],
  )

  const focusAreasWithScores = snapshot.focusAreas.filter((area) => area.overallScore !== null)
  const focusAreaWeightTotal = sumPositiveWeights(
    snapshot.focusAreas.map((area) => area.focusAreaWeight),
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="mb-3 flex items-start gap-2">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" aria-hidden />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Campus ESA profile</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                How this school performs across scoring focus areas — a balanced campus shows a
                fuller shape.
              </p>
            </div>
          </div>
          <FocusAreaRadarChart axes={chartAxes} series={radarSeries} size={280} />
        </section>

        {focusAreasWithScores.length > 0 ? (
          <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <h3 className="text-sm font-semibold text-slate-900">Focus area scores</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Weighted averages for each major part of the campus assessment.
            </p>
            <div className="mt-4 space-y-3">
              {focusAreasWithScores.map((area) => (
                <ScoreBar
                  key={area.id}
                  score={area.overallScore}
                  label={area.label}
                  weight={area.focusAreaWeight}
                  weightTotal={focusAreaWeightTotal}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">
              Score rooms to see focus area breakdowns next to the campus profile.
            </p>
          </section>
        )}
      </div>

      <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <h3 className="text-sm font-semibold text-slate-900">Scores by space type</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Ranked highest to lowest across all assessed space types on campus.
        </p>

        {rankedSpaceTypes.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Score rooms to see space type rankings here.
          </p>
        ) : (
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {rankedSpaceTypes.map((entry, index) => (
              <li
                key={`${entry.focusAreaLabel}:${entry.spaceType}`}
                className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold tabular-nums text-slate-400">
                        #{index + 1}
                      </span>
                      <p className="truncate text-sm font-medium text-slate-900">
                        {entry.spaceType}
                      </p>
                    </div>
                    <p className="mt-0.5 pl-6 text-[11px] text-slate-500">
                      {entry.focusAreaLabel}
                      {entry.scoredRoomCount > 1
                        ? ` · ${entry.scoredRoomCount} spaces scored`
                        : " · 1 space scored"}
                    </p>
                  </div>
                  <ScoreBadge score={entry.overallScore} />
                </div>
                {entry.overallScore !== null && (
                  <div className="mt-2 pl-6 h-1.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200/60">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        entry.overallScore >= 70
                          ? "bg-emerald-500"
                          : entry.overallScore >= 45
                            ? "bg-amber-500"
                            : "bg-red-500",
                      )}
                      style={{ width: `${Math.min(100, entry.overallScore)}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {categories.length > 0 && (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <h3 className="text-sm font-semibold text-slate-900">Campus-wide categories</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Aggregated across every scored space on campus.
          </p>
          <div className="mt-4">
            <CategoryScoreList scores={categories} />
          </div>
        </section>
      )}
    </div>
  )
}
