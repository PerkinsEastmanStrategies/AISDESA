/** Shared with AISD dashboard — lib/dashboard-data.ts FloorPlanRoom */

import { SCORE_BANDS, scoreBandId, type ScoreBandId } from "../scoring/score-bands"

export type RoomCondition = ScoreBandId

export interface RoomEAMetric {
  name: string
  score: number
  subCriteria?: { name: string; met: boolean; note?: string }[]
}

export interface RoomSystemCondition {
  name: string
  condition: RoomCondition
}

export interface FloorPlanRoom {
  id: string
  name: string
  x: number
  y: number
  condition: RoomCondition
  eaScore: number
  sqft: number
  capacity: number
  metrics: RoomEAMetric[]
  note: string
  fci: number
  fcaCondition: RoomCondition
  systems: RoomSystemCondition[]
  fcaNote: string
  building?: string
  /** Survey-only: floor level id when rooms span multiple plans */
  levelId?: string
}

export function conditionFromScore(score: number): RoomCondition {
  return scoreBandId(score) ?? "fair"
}

export const ROOM_CONDITION_FILL: Record<RoomCondition, string> = Object.fromEntries(
  SCORE_BANDS.map((band) => [band.id, band.hex]),
) as Record<RoomCondition, string>
