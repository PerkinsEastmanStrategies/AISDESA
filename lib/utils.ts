import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { scoreBandId, scoreBandDef, scoreBandLabel as sharedScoreBandLabel, type ScoreBandId } from "@aisd/shared"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type ScoreBand = ScoreBandId | "none"

export { SCORE_BANDS } from "@aisd/shared"

/** Same five bands as the QA portal: Excellent >90, Good 80–90, Fair 70–80, Poor 60–70, Critical <60. */
export function scoreBand(score: number | null): ScoreBand {
  return scoreBandId(score) ?? "none"
}

export function scoreColor(score: number | null): string {
  switch (scoreBand(score)) {
    case "excellent":
      return "bg-[var(--color-excellent)]"
    case "good":
      return "bg-[var(--color-good)]"
    case "fair":
      return "bg-[var(--color-fair)]"
    case "poor":
      return "bg-[var(--color-poor)]"
    case "critical":
      return "bg-[var(--color-critical)]"
    default:
      return "bg-slate-300"
  }
}

/** Darker text for readable % values on white / light backgrounds. */
export function scoreTextColor(score: number | null): string {
  switch (scoreBand(score)) {
    case "excellent":
      return "text-teal-800"
    case "good":
      return "text-emerald-800"
    case "fair":
      return "text-amber-900"
    case "poor":
      return "text-orange-800"
    case "critical":
      return "text-rose-800"
    default:
      return "text-slate-400"
  }
}

export function scoreBadgeClass(score: number | null): string {
  switch (scoreBand(score)) {
    case "excellent":
      return "bg-teal-100 text-teal-900 ring-1 ring-teal-200/90"
    case "good":
      return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/90"
    case "fair":
      return "bg-amber-100 text-amber-950 ring-1 ring-amber-200/90"
    case "poor":
      return "bg-orange-100 text-orange-950 ring-1 ring-orange-200/90"
    case "critical":
      return "bg-rose-100 text-rose-900 ring-1 ring-rose-200/90"
    default:
      return "bg-slate-100 text-slate-400 ring-1 ring-slate-200/80"
  }
}

export function scoreBarFillClass(score: number | null): string {
  switch (scoreBand(score)) {
    case "excellent":
      return "bg-teal-600"
    case "good":
      return "bg-emerald-600"
    case "fair":
      return "bg-amber-500"
    case "poor":
      return "bg-orange-500"
    case "critical":
      return "bg-rose-600"
    default:
      return "bg-slate-300"
  }
}

export function scoreCardTintClass(score: number | null): string {
  switch (scoreBand(score)) {
    case "excellent":
      return "border-teal-200 from-teal-50 to-white"
    case "good":
      return "border-emerald-200 from-emerald-50 to-white"
    case "fair":
      return "border-amber-200 from-amber-50 to-white"
    case "poor":
      return "border-orange-200 from-orange-50 to-white"
    case "critical":
      return "border-rose-200 from-rose-50 to-white"
    default:
      return "border-slate-200/90 from-white to-slate-50"
  }
}

export function scoreBandLabel(score: number | null): string | null {
  return sharedScoreBandLabel(score)
}

/** Semi-transparent fill for SVG floor plan overlays (matches score bands). */
export function scoreFillRgba(score: number | null, alpha = 0.45): string {
  const band = scoreBandDef(score)
  if (!band) return `rgba(148, 163, 184, ${Math.min(alpha, 0.18)})`
  const [r, g, b] = band.rgb
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function scoreStrokeRgba(score: number | null, alpha = 0.85): string {
  const band = scoreBandDef(score)
  if (!band) return `rgba(148, 163, 184, ${alpha * 0.35})`
  const [r, g, b] = band.rgb
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
