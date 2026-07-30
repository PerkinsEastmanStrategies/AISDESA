export type SurveyType =
  | "studios"
  | "special_education"
  | "outdoor"
  | "neighborhoods"
  | "arrival"
  | "administration"
  | "athletics"
  | "performing_arts"
  | "cte"
  | "shared_spaces"
  | "closeout"

export type QuestionType = "YesNoNA" | "SingleSelect" | "MultiSelect"

export interface EsaCategory {
  assessmentArea: string
  category: string
  categoryWeight: number
}

export interface EsaSubcategory {
  category: string
  subcategory: string
  subcategoryWeight: number
}

export type GradeApplicability = "ALL" | "ES" | "MS+HS"
export type ItemScoringMode = "Inventory" | "SingleResponse" | "Composite"
export type ParentScoringPattern = "SingleResponse" | "MixedItemScoring"

export interface EsaQuestion {
  questionId: string
  assessmentArea: string
  category: string
  subcategory: string
  question: string
  questionType: QuestionType
  weight: number
  required: boolean
  /** Optional subtext from the CSV Context column (shown when enabled in the UI). */
  context?: string
  /** Traditional v3: which grade band this question applies to */
  gradeApplicability?: GradeApplicability | string
  /** Traditional v3: SingleResponse vs MixedItemScoring parent pattern */
  parentScoringPattern?: ParentScoringPattern | string
}

export interface EsaQuestionOption {
  questionId: string
  option: string
  normalizedScore: number | null
  displayOrder: number
  /** Scoring unit ID — may differ from questionId for multi-select items. Ends in "i" = inventory only. */
  scoreId: string
  /** Traditional v3 scoring mode for this option/field item */
  itemScoringMode?: ItemScoringMode | string
  /** Traditional v3 score group for mutual exclusion / composite rollup */
  scoreGroupId?: string
  optionScore?: number | null
  maxPoints?: number | null
  itemWeight?: number
  isExclusionOption?: boolean
}

/** One answer value — string for single/yes-no, string[] for multi-select */
export interface RoomQuestionResponse {
  questionId: string
  value: string | string[]
  comment?: string
  /** @deprecated Use `photos` — kept for backward compatibility with older drafts */
  photo?: string
  /** Supabase public URLs or local data URLs — optional field photos */
  photos?: string[]
}

export type GradeType = "PK" | "K" | "1" | "2" | "3" | "4" | "5" | "MS" | "HS"

export type NeighborhoodId =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"

export const NEIGHBORHOOD_OPTIONS: readonly NeighborhoodId[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
]

export interface AssessorInfo {
  name: string
  email: string
  registeredAt: string
}

/** Assessor-placed pin for an outdoor element on the campus map. */
export interface OutdoorElementPin {
  id: string
  elementType: string
  lng: number
  lat: number
  placedAt: string
}

export interface RoomSurveySession {
  roomId: string
  roomNumber: string
  roomType: string
  gradeType: GradeType | ""
  /** Learning neighborhood from the live room lookup sheet (e.g. A–N or 1–14). */
  neighborhood?: string
  /** Room area in square feet from the live room lookup sheet (Area column). */
  areaSqft?: number
  /** Optional override when the school's room number differs from the floor plan id */
  schoolRoomNumber?: string
  /** Notes captured during the building pre-walk */
  preWalkNote1?: string
  preWalkNote2?: string
  building?: string
  levelId: string
  responses: RoomQuestionResponse[]
  /** Source survey that deferred unanswered items into Close Out */
  sourceSurveyType?: Exclude<SurveyType, "closeout">
  /** Questions still outstanding in Close Out for this room */
  pendingQuestionIds?: string[]
  /** Grade still needs to be chosen in Close Out */
  pendingGrade?: boolean
  /** On the source survey: questions deferred to Close Out */
  deferredQuestionIds?: string[]
  /** On the source survey: room was deferred (may include missing grade) */
  deferredToCloseOut?: boolean
  /** Traditional studio: room responses were copied from another studio in the same neighborhood */
  traditionalStudioCopiedFromRoomId?: string
  /** Traditional studio: assessor must verify copied responses before continuing */
  traditionalStudioCopyReviewPending?: boolean
  /** Space type marked not present at school/neighborhood — scores as 0 without room questions. */
  spaceTypeMarkedAbsent?: boolean
}

/** Room → space type assignment from a building walk-through before scoring. */
export interface PreWalkRoomMapping {
  roomId: string
  /** Survey module this mapping belongs to (e.g. studios, arrival). */
  surveyType: SurveyType
  spaceType: string
  note1?: string
  note2?: string
  mappedAt?: string
}

export interface PreWalkState {
  mappings: Record<string, PreWalkRoomMapping>
  /** General overview photo per survey space type (Supabase URL or local data URL). */
  spaceTypePhotos?: Record<string, string>
  completedAt?: string | null
  skippedAt?: string | null
}

/** Room label used in reports — prefers school override, then stored room number, then plan id. */
export function displayRoomNumberInSchool(
  session: Pick<RoomSurveySession, "roomId" | "roomNumber" | "schoolRoomNumber">,
): string {
  const override = session.schoolRoomNumber?.trim()
  if (override) return override
  const num = session.roomNumber?.trim()
  if (num) return num
  return session.roomId
}

export interface SurveySession {
  surveyId: string
  surveyType: SurveyType
  schoolId: string
  schoolName: string
  campusId: string
  building: string
  rooms: Record<string, RoomSurveySession>
  /** Outdoor Elements survey: campus map pins keyed by element type. */
  outdoorElementPins?: OutdoorElementPin[]
  assessorName?: string
  assessorEmail?: string
  assessorRegisteredAt?: string
  startedAt: string
  updatedAt: string
  submittedAt?: string
  /** Assessor closing remarks submitted with the campus assessment from Close Out. */
  finalComment?: string
  /** Set when the assessor submits the full campus assessment from Close Out. */
  campusSubmittedAt?: string
  /** Per space type: false = space not present at this school (skip room survey). */
  spaceTypeExistsAtSchool?: Record<string, boolean>
}

export interface CategoryScore {
  category: string
  score: number
  weight: number
}

export interface SubcategoryScore {
  category: string
  subcategory: string
  score: number
  weight: number
}

export interface QuestionScore {
  questionId: string
  category: string
  subcategory: string
  score: number
  weight: number
}

export interface RoomScoreResult {
  roomId: string
  overallScore: number | null
  categoryScores: CategoryScore[]
  subcategoryScores: SubcategoryScore[]
  questionScores: QuestionScore[]
  answeredCount: number
  totalCount: number
}
