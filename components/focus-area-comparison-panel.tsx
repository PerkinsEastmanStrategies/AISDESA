"use client"

import { useMemo, useState } from "react"
import { Plus, X } from "lucide-react"
import type { AisdSchoolOption } from "@aisd/shared"
import type { CampusScoringSnapshot } from "@/lib/campus-scoring-tree"
import {
  buildFocusAreaComparison,
  listWalkedSchools,
} from "@/lib/walked-schools-comparison"
import FocusAreaRadarChart from "@/components/focus-area-radar-chart"
import { ScoreBadge } from "@/components/score-display"
import { cn } from "@/lib/utils"

const MAX_COMPARISON_SCHOOLS = 3

interface FocusAreaComparisonPanelProps {
  snapshot: CampusScoringSnapshot
  schools: AisdSchoolOption[]
}

export default function FocusAreaComparisonPanel({
  snapshot,
  schools,
}: FocusAreaComparisonPanelProps) {
  const [comparisonSchoolIds, setComparisonSchoolIds] = useState<string[]>([])

  const walkedSchools = useMemo(() => listWalkedSchools(schools), [schools])

  const comparison = useMemo(
    () =>
      buildFocusAreaComparison({
        currentSchoolId: snapshot.schoolId,
        currentSnapshot: snapshot,
        schools,
        comparisonSchoolIds,
      }),
    [snapshot, schools, comparisonSchoolIds],
  )

  const addableSchools = walkedSchools.filter(
    (school) =>
      school.schoolId !== snapshot.schoolId &&
      !comparisonSchoolIds.includes(school.schoolId),
  )

  const chartAxes = comparison.axes.map((axis) => ({
    id: axis.id,
    label: axis.label,
  }))

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Add a school to compare</h4>
          <p className="mt-1 text-xs text-slate-500">
            Pick another school from your walk list to overlay on the chart.
          </p>
        </div>

        <label className="mt-3 flex w-full items-center gap-2">
          <span className="sr-only">Add comparison school</span>
          <select
            defaultValue=""
            disabled={
              comparisonSchoolIds.length >= MAX_COMPARISON_SCHOOLS || addableSchools.length === 0
            }
            onChange={(event) => {
              const schoolId = event.target.value
              if (!schoolId) return
              setComparisonSchoolIds((current) =>
                current.includes(schoolId) ? current : [...current, schoolId],
              )
              event.target.value = ""
            }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">
              {comparisonSchoolIds.length >= MAX_COMPARISON_SCHOOLS
                ? `Maximum ${MAX_COMPARISON_SCHOOLS} comparison schools selected`
                : addableSchools.length === 0
                  ? "No more walked schools to add"
                  : "Select a walked school…"}
            </option>
            {addableSchools.map((school) => (
              <option key={school.schoolId} value={school.schoolId}>
                {school.schoolName}
              </option>
            ))}
          </select>
          <Plus className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        </label>

        {comparisonSchoolIds.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {comparisonSchoolIds.map((schoolId) => {
              const school = walkedSchools.find((entry) => entry.schoolId === schoolId)
              if (!school) return null
              return (
                <button
                  key={schoolId}
                  type="button"
                  onClick={() =>
                    setComparisonSchoolIds((current) => current.filter((id) => id !== schoolId))
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 active:bg-slate-100"
                >
                  {school.schoolName}
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Focus area comparison
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Compare this school&apos;s focus area scores against the average of other schools
              you&apos;ve walked on this device
              {comparison.benchmarkSchoolCount > 0
                ? ` (${comparison.benchmarkSchoolCount} school${comparison.benchmarkSchoolCount === 1 ? "" : "s"}).`
                : "."}
            </p>
          </div>
          {comparison.benchmarkSchoolCount === 0 && walkedSchools.length <= 1 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Walk at least one more school to see a walked average benchmark.
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {comparison.series.map((entry) => (
            <span
              key={entry.id}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              <span
                className={cn("h-2.5 w-2.5 rounded-full", entry.dashed && "border border-slate-500 bg-transparent")}
                style={entry.dashed ? undefined : { backgroundColor: entry.color }}
              />
              {entry.label}
            </span>
          ))}
        </div>

        <div className="mt-5">
          <FocusAreaRadarChart axes={chartAxes} series={comparison.series} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Focus area</th>
                <th className="px-4 py-3">This school</th>
                <th className="px-4 py-3">Walked avg</th>
                {comparison.axes[0]?.comparisonScores.map((entry) => (
                  <th key={entry.schoolId} className="px-4 py-3">
                    {entry.schoolName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.axes.map((axis) => (
                <tr key={axis.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-4 py-3 font-medium text-slate-800">{axis.label}</td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={axis.currentScore} />
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={axis.walkedAverage} />
                  </td>
                  {axis.comparisonScores.map((entry) => (
                    <td key={entry.schoolId} className="px-4 py-3">
                      <ScoreBadge score={entry.score} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
