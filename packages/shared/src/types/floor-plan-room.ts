/** Shared with AISD dashboard — lib/dashboard-data.ts FloorPlanRoom */

export type RoomCondition = "good" | "fair" | "poor"

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
  if (score >= 70) return "good"
  if (score >= 45) return "fair"
  return "poor"
}

export const ROOM_CONDITION_FILL: Record<RoomCondition, string> = {
  good: "#22c55e",
  fair: "#f59e0b",
  poor: "#ef4444",
}
