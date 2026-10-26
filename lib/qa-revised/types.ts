export type CategorySchemeId = "original" | "revised"

export type SchoolLevel = "ES" | "MS" | "HS"

export interface ScoredUnit {
  questionId: string
  unitId: string
  question: string
  category: string
  subcategory: string
  score: number
  itemLabel?: string | null
  answer?: string | null
}

export interface ScoredRoom {
  roomId: string
  roomName: string
  surveyType: string
  spaceType: string
  focusAreaId: string
  focusAreaLabel: string
  neighborhood?: string
  gradeType?: string
  markedAbsent: boolean
  units: ScoredUnit[]
}

export interface SchoolSnapshot {
  schoolId: string
  schoolName: string
  campusId: string
  schoolClass: string
  schoolLevel: SchoolLevel
  exportedAt: string
  roomCount: number
  scoredUnitCount: number
  rooms: ScoredRoom[]
}

export interface WeightRowFocus {
  schoolLevel: string
  focusArea: string
  weight: number
}

export interface WeightRowSpace {
  schoolLevel: string
  focusArea: string
  spaceType: string
  weight: number
}

export interface WeightRowCategory {
  schoolLevel: string
  focusArea: string
  spaceType: string
  category: string
  weight: number
}

export interface WeightRowSubcategory {
  schoolLevel: string
  focusArea: string
  spaceType: string
  category: string
  subcategory: string
  weight: number
}

export interface WeightRowQuestion {
  schoolLevel: string
  focusArea: string
  spaceType: string
  category: string
  subcategory: string
  questionId: string
  question: string
  weight: number
}

export interface WeightFile {
  schoolLevelDefault: SchoolLevel
  focusAreas: WeightRowFocus[]
  spaceTypes: WeightRowSpace[]
  categories: WeightRowCategory[]
  subcategories: WeightRowSubcategory[]
  questions: WeightRowQuestion[]
}

export interface WeightOverrides {
  focus: Record<string, number>
  space: Record<string, number>
  category: Record<string, number>
  subcategory: Record<string, number>
  question: Record<string, number>
}

export type ScoreNodeKind = "group" | "room" | "question"

export interface ScoreNode {
  id: string
  kind?: ScoreNodeKind
  label: string
  score: number | null
  baseline: number | null
  weight: number
  children?: ScoreNode[]
  scoredCount?: number
  totalCount?: number
  countLabel?: string
  questionId?: string
  roomId?: string
  itemLabel?: string | null
  answer?: string | null
}

export interface ScoredRoomSummary {
  roomId: string
  roomName: string
  spaceType: string
  focusAreaLabel?: string
  neighborhood?: string
  score: number | null
}

export interface SchoolIndexEntry {
  schoolId: string
  schoolName: string
  campusId: string
  schoolClass?: string
  schoolLevel: SchoolLevel
  roomCount: number
  scoredUnitCount: number
  exportedAt: string
}

export interface SchoolScorecard {
  schoolId: string
  schoolName: string
  campusId: string
  overall: number | null
  overallBaseline: number | null
  existingOnly: number | null
  existingOnlyBaseline: number | null
  scoredRoomCount: number
  absentCount: number
  categories: ScoreNode[]
  focusAreas: ScoreNode[]
  rooms: ScoredRoomSummary[]
}
