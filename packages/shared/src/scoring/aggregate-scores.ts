import type { CategoryScore, RoomScoreResult, SurveySession } from "../types/survey"
import type { FloorPlanRoom } from "../types/floor-plan-room"
import { isOutdoorSurveyRoomId, studioTypeRequiresGrade } from "../data/survey-config"

export const UNASSIGNED_NEIGHBORHOOD_ID = "__unassigned__" as const
export const OUTDOOR_NEIGHBORHOOD_ID = "Outdoor" as const

export interface ScoredRoomEntry {
  roomId: string
  roomName: string
  /** School room number when it differs from the floor plan id */
  schoolRoomNumber?: string
  building?: string
  /** Learning neighborhood (from session or floor plan lookup). */
  neighborhood?: string
  levelId: string
  gradeType: string
  overallScore: number | null
  categoryScores: CategoryScore[]
  answeredCount: number
  totalCount: number
  complete: boolean
}

export interface NeighborhoodScoreSummary {
  neighborhoodId: string
  neighborhoodLabel: string
  roomCount: number
  scoredRoomCount: number
  overallScore: number | null
  categoryScores: CategoryScore[]
  rooms: ScoredRoomEntry[]
}

export interface CampusScoreSummary {
  schoolId: string
  schoolName: string
  campusId: string
  roomCount: number
  scoredRoomCount: number
  completeRoomCount: number
  overallScore: number | null
  categoryScores: CategoryScore[]
  neighborhoods: NeighborhoodScoreSummary[]
  rooms: ScoredRoomEntry[]
}

export interface SurveySubmission {
  session: SurveySession
  submittedAt: string
  campus: CampusScoreSummary
  floorPlanRooms: FloorPlanRoom[]
}

function average(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function averageCategoryScores(rooms: ScoredRoomEntry[]): CategoryScore[] {
  const byCat = new Map<string, { scores: number[]; weight: number }>()
  for (const room of rooms) {
    if (room.overallScore === null) continue
    for (const cat of room.categoryScores) {
      const entry = byCat.get(cat.category) ?? { scores: [], weight: cat.weight }
      entry.scores.push(cat.score)
      byCat.set(cat.category, entry)
    }
  }
  return Array.from(byCat.entries()).map(([category, { scores, weight }]) => ({
    category,
    score: average(scores) ?? 0,
    weight,
  }))
}

export function neighborhoodGroupId(
  raw: string | null | undefined,
  roomId?: string | null,
): string {
  if (roomId && isOutdoorSurveyRoomId(roomId)) return OUTDOOR_NEIGHBORHOOD_ID
  const trimmed = raw?.trim()
  return trimmed ? trimmed : UNASSIGNED_NEIGHBORHOOD_ID
}

export function neighborhoodGroupLabel(id: string): string {
  if (id === UNASSIGNED_NEIGHBORHOOD_ID) return "Unassigned"
  if (id === OUTDOOR_NEIGHBORHOOD_ID) return "Outdoor"
  return id
}

function compareNeighborhoodIds(a: string, b: string): number {
  if (a === UNASSIGNED_NEIGHBORHOOD_ID) return 1
  if (b === UNASSIGNED_NEIGHBORHOOD_ID) return -1
  if (a === OUTDOOR_NEIGHBORHOOD_ID) return 1
  if (b === OUTDOOR_NEIGHBORHOOD_ID) return -1
  const aNum = Number(a)
  const bNum = Number(b)
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum
  return a.localeCompare(b, undefined, { numeric: true })
}

export function aggregateCampusScores(
  rooms: ScoredRoomEntry[],
  meta: { schoolId: string; schoolName: string; campusId: string },
): CampusScoreSummary {
  const scored = rooms.filter((r) => r.overallScore !== null)
  const complete = rooms.filter((r) => r.complete)

  const byNeighborhood = new Map<string, ScoredRoomEntry[]>()
  for (const room of rooms) {
    const nid = neighborhoodGroupId(room.neighborhood, room.roomId)
    const list = byNeighborhood.get(nid) ?? []
    list.push(room)
    byNeighborhood.set(nid, list)
  }

  const neighborhoods: NeighborhoodScoreSummary[] = Array.from(byNeighborhood.entries())
    .map(([neighborhoodId, neighborhoodRooms]) => {
      const neighborhoodScored = neighborhoodRooms.filter((r) => r.overallScore !== null)
      return {
        neighborhoodId,
        neighborhoodLabel: neighborhoodGroupLabel(neighborhoodId),
        roomCount: neighborhoodRooms.length,
        scoredRoomCount: neighborhoodScored.length,
        overallScore: average(neighborhoodScored.map((r) => r.overallScore!)),
        categoryScores: averageCategoryScores(neighborhoodScored),
        rooms: neighborhoodRooms.sort((a, b) => a.roomName.localeCompare(b.roomName)),
      }
    })
    .sort((a, b) => compareNeighborhoodIds(a.neighborhoodId, b.neighborhoodId))

  return {
    schoolId: meta.schoolId,
    schoolName: meta.schoolName,
    campusId: meta.campusId,
    roomCount: rooms.length,
    scoredRoomCount: scored.length,
    completeRoomCount: complete.length,
    overallScore: average(scored.map((r) => r.overallScore!)),
    categoryScores: averageCategoryScores(scored),
    neighborhoods,
    rooms: [...rooms].sort((a, b) => a.roomName.localeCompare(b.roomName)),
  }
}

export function isRoomComplete(
  score: RoomScoreResult,
  gradeType: string,
  roomType?: string | null,
  schoolClass?: string | null,
): boolean {
  const gradeOk = !studioTypeRequiresGrade(roomType, schoolClass) || !!gradeType
  return (
    gradeOk &&
    score.totalCount > 0 &&
    score.answeredCount >= score.totalCount &&
    score.overallScore !== null
  )
}
