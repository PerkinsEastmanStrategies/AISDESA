/** Shared ESA / QA score color bands. Excellent is strictly above 90. */

export const SCORE_EXCELLENT = 90
export const SCORE_GOOD = 80
export const SCORE_FAIR = 70
export const SCORE_POOR = 60

export type ScoreBandId = "excellent" | "good" | "fair" | "poor" | "critical"

export interface ScoreBandDef {
  id: ScoreBandId
  label: string
  rangeLabel: string
  legend: string
  sampleScore: number
  rgb: [number, number, number]
  hex: string
  strokeHex: string
}

export const SCORE_BANDS: ScoreBandDef[] = [
  {
    id: "excellent",
    label: "Excellent",
    rangeLabel: ">90%",
    legend: "Excellent (>90%)",
    sampleScore: 95,
    rgb: [13, 148, 136],
    hex: "#0d9488",
    strokeHex: "#0f766e",
  },
  {
    id: "good",
    label: "Good",
    rangeLabel: "80–90%",
    legend: "Good (80–90%)",
    sampleScore: 85,
    rgb: [5, 150, 105],
    hex: "#059669",
    strokeHex: "#047857",
  },
  {
    id: "fair",
    label: "Fair",
    rangeLabel: "70–80%",
    legend: "Fair (70–80%)",
    sampleScore: 75,
    rgb: [217, 119, 6],
    hex: "#d97706",
    strokeHex: "#b45309",
  },
  {
    id: "poor",
    label: "Poor",
    rangeLabel: "60–70%",
    legend: "Poor (60–70%)",
    sampleScore: 65,
    rgb: [234, 88, 12],
    hex: "#ea580c",
    strokeHex: "#c2410c",
  },
  {
    id: "critical",
    label: "Critical",
    rangeLabel: "<60%",
    legend: "Critical (<60%)",
    sampleScore: 50,
    rgb: [225, 29, 72],
    hex: "#e11d48",
    strokeHex: "#be123c",
  },
]

export const SCORE_BAND_TICKS = [0, 60, 70, 80, 90, 100] as const

export function scoreBandId(score: number | null | undefined): ScoreBandId | null {
  if (score == null || Number.isNaN(score)) return null
  if (score > SCORE_EXCELLENT) return "excellent"
  if (score >= SCORE_GOOD) return "good"
  if (score >= SCORE_FAIR) return "fair"
  if (score >= SCORE_POOR) return "poor"
  return "critical"
}

export function scoreBandDef(score: number | null | undefined): ScoreBandDef | null {
  const id = scoreBandId(score)
  if (!id) return null
  return SCORE_BANDS.find((band) => band.id === id) ?? null
}

export function scoreBandLabel(score: number | null | undefined): string | null {
  return scoreBandDef(score)?.legend ?? null
}
