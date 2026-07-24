import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type ScoreBand = "good" | "fair" | "poor" | "none"

/** Same thresholds as shared conditionFromScore (70 / 45). */
export function scoreBand(score: number | null): ScoreBand {
  if (score === null) return "none"
  if (score >= 70) return "good"
  if (score >= 45) return "fair"
  return "poor"
}

export function scoreColor(score: number | null): string {
  switch (scoreBand(score)) {
    case "good":
      return "bg-[var(--color-good)]"
    case "fair":
      return "bg-[var(--color-fair)]"
    case "poor":
      return "bg-[var(--color-poor)]"
    default:
      return "bg-slate-300"
  }
}

/** Darker text for readable % values on white / light backgrounds. */
export function scoreTextColor(score: number | null): string {
  switch (scoreBand(score)) {
    case "good":
      return "text-emerald-800"
    case "fair":
      return "text-amber-900"
    case "poor":
      return "text-rose-800"
    default:
      return "text-slate-400"
  }
}

export function scoreBadgeClass(score: number | null): string {
  switch (scoreBand(score)) {
    case "good":
      return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/90"
    case "fair":
      return "bg-amber-100 text-amber-950 ring-1 ring-amber-200/90"
    case "poor":
      return "bg-rose-100 text-rose-900 ring-1 ring-rose-200/90"
    default:
      return "bg-slate-100 text-slate-400 ring-1 ring-slate-200/80"
  }
}

export function scoreBarFillClass(score: number | null): string {
  switch (scoreBand(score)) {
    case "good":
      return "bg-emerald-600"
    case "fair":
      return "bg-amber-500"
    case "poor":
      return "bg-rose-600"
    default:
      return "bg-slate-300"
  }
}

export function scoreCardTintClass(score: number | null): string {
  switch (scoreBand(score)) {
    case "good":
      return "border-emerald-200 from-emerald-50 to-white"
    case "fair":
      return "border-amber-200 from-amber-50 to-white"
    case "poor":
      return "border-rose-200 from-rose-50 to-white"
    default:
      return "border-slate-200/90 from-white to-slate-50"
  }
}

export function scoreBandLabel(score: number | null): string | null {
  switch (scoreBand(score)) {
    case "good":
      return "Good"
    case "fair":
      return "Fair"
    case "poor":
      return "Needs attention"
    default:
      return null
  }
}

const SCORE_FILL_RGB: Record<Exclude<ScoreBand, "none">, [number, number, number]> = {
  good: [5, 150, 105],
  fair: [245, 158, 11],
  poor: [225, 29, 72],
}

/** Semi-transparent fill for SVG floor plan overlays (matches score bands). */
export function scoreFillRgba(score: number | null, alpha = 0.45): string {
  const band = scoreBand(score)
  if (band === "none") return `rgba(148, 163, 184, ${Math.min(alpha, 0.18)})`
  const [r, g, b] = SCORE_FILL_RGB[band]
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function scoreStrokeRgba(score: number | null, alpha = 0.85): string {
  const band = scoreBand(score)
  if (band === "none") return `rgba(148, 163, 184, ${alpha * 0.35})`
  const [r, g, b] = SCORE_FILL_RGB[band]
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
