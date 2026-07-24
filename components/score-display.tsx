"use client"

import { cn, scoreTextColor } from "@/lib/utils"
import { formatWeightShare, sumPositiveWeights } from "@/lib/weight-display"
import type { CategoryScore } from "@aisd/shared"

export function ScoreBadge({ score, size = "sm" }: { score: number | null; size?: "sm" | "lg" }) {
  if (score === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-slate-200/80">
        —
      </span>
    )
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold tabular-nums",
        size === "lg" ? "px-3 py-1 text-base" : "px-2.5 py-0.5 text-xs",
        score >= 70
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80"
          : score >= 45
            ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200/80"
            : "bg-red-50 text-red-700 ring-1 ring-red-200/80",
      )}
    >
      {Math.round(score)}%
    </span>
  )
}

export function ScoreBar({
  score,
  label,
  compact = false,
  weight,
  weightTotal,
}: {
  score: number | null
  label: string
  compact?: boolean
  weight?: number | null
  /** Sum of sibling weights at this level; used to show weight as %. */
  weightTotal?: number | null
}) {
  return (
    <div>
      <div
        className={cn(
          "mb-1 flex justify-between gap-2",
          compact ? "text-[11px]" : "text-xs",
        )}
      >
        <span className="font-medium text-slate-700">
          {label}
          <WeightLabel weight={weight} weightTotal={weightTotal} />
        </span>
        <span
          className={cn(
            "shrink-0 tabular-nums font-semibold",
            score === null ? "text-slate-400" : scoreTextColor(score),
          )}
        >
          {score !== null ? `${Math.round(score)}%` : "—"}
        </span>
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200/60",
          compact ? "h-1.5" : "h-2",
        )}
      >
        {score !== null && (
          <div
            className={cn(
              "h-full rounded-full transition-all",
              score >= 70 ? "bg-emerald-500" : score >= 45 ? "bg-amber-500" : "bg-red-500",
            )}
            style={{ width: `${Math.min(100, score)}%` }}
          />
        )}
      </div>
    </div>
  )
}

export function WeightLabel({
  weight,
  weightTotal,
  className,
}: {
  weight?: number | null
  weightTotal?: number | null
  className?: string
}) {
  if (weight == null || weight <= 0 || weightTotal == null || weightTotal <= 0) return null
  const formatted = formatWeightShare(weight, weightTotal)
  if (!formatted) return null
  return (
    <span className={cn("font-normal text-slate-400", className)}>
      {" "}
      · {formatted}
    </span>
  )
}

export function CategoryScoreList({ scores }: { scores: CategoryScore[] }) {
  if (!scores.length) {
    return <p className="text-sm text-slate-500">No category scores yet.</p>
  }
  const categoryWeightTotal = sumPositiveWeights(scores.map((cat) => cat.weight))
  return (
    <div className="space-y-3">
      {scores.map((cat) => (
        <ScoreBar
          key={cat.category}
          score={cat.score}
          label={cat.category}
          weight={cat.weight}
          weightTotal={categoryWeightTotal}
        />
      ))}
    </div>
  )
}

export function OverallScoreDisplay({ score, label }: { score: number | null; label: string }) {
  return (
    <div className="mt-1.5 shrink-0 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50 px-5 py-4 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={cn("mt-1 text-4xl font-bold tabular-nums tracking-tight", scoreTextColor(score))}>
        {score !== null ? `${Math.round(score)}%` : "—"}
      </p>
    </div>
  )
}
