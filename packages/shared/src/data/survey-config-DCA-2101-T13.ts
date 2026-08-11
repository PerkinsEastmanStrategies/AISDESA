import type { GradeType, SurveyType } from "../types/survey"
import {
  STUDIO_CATEGORIES,
  STUDIO_QUESTION_OPTIONS,
  STUDIO_QUESTIONS,
  STUDIO_SUBCATEGORIES,
} from "../data/studio-rubric"
import {
  SENSORY_LAB_CATEGORIES,
  SENSORY_LAB_QUESTION_OPTIONS,
  SENSORY_LAB_QUESTIONS,
  SENSORY_LAB_RUBRIC_VERSION,
  SENSORY_LAB_SUBCATEGORIES,
  TRADITIONAL_STUDIO_CATEGORIES,
  TRADITIONAL_STUDIO_QUESTION_OPTIONS,
  TRADITIONAL_STUDIO_QUESTIONS,
  TRADITIONAL_STUDIO_SUBCATEGORIES,
  TRADITIONAL_STUDIOS_RUBRIC_VERSION,
} from "../data/traditional-studio-rubric"
import {
  ADMIN_OFFICE_CATEGORIES,
  ADMIN_OFFICE_QUESTION_OPTIONS,
  ADMIN_OFFICE_QUESTIONS,
  ADMIN_OFFICE_RUBRIC_VERSION,
  ADMIN_OFFICE_SUBCATEGORIES,
  COUNSELING_SUITE_CATEGORIES,
  COUNSELING_SUITE_QUESTION_OPTIONS,
  COUNSELING_SUITE_QUESTIONS,
  COUNSELING_SUITE_RUBRIC_VERSION,
  COUNSELING_SUITE_SUBCATEGORIES,
} from "../data/admin-rubric"
import {
  COMMUNITY_PARTNER_CATEGORIES,
  COMMUNITY_PARTNER_QUESTION_OPTIONS,
  COMMUNITY_PARTNER_QUESTIONS,
  COMMUNITY_PARTNER_RUBRIC_VERSION,
  COMMUNITY_PARTNER_SUBCATEGORIES,
  MAIN_OFFICE_CATEGORIES,
  MAIN_OFFICE_QUESTION_OPTIONS,
  MAIN_OFFICE_QUESTIONS,
  MAIN_OFFICE_RUBRIC_VERSION,
  MAIN_OFFICE_SUBCATEGORIES,
  PLC_CATEGORIES,
  PLC_QUESTION_OPTIONS,
  PLC_QUESTIONS,
  PLC_RUBRIC_VERSION,
  PLC_SUBCATEGORIES,
} from "../data/arrival-admin-rubric"
import {
  GROUP_ROOM_CATEGORIES,
  GROUP_ROOM_QUESTION_OPTIONS,
  GROUP_ROOM_QUESTIONS,
  GROUP_ROOM_RUBRIC_VERSION,
  GROUP_ROOM_SUBCATEGORIES,
  NEIGHBORHOOD_SPACE_CATEGORIES,
  NEIGHBORHOOD_SPACE_QUESTION_OPTIONS,
  NEIGHBORHOOD_SPACE_QUESTIONS,
  NEIGHBORHOOD_SPACE_RUBRIC_VERSION,
  NEIGHBORHOOD_SPACE_SUBCATEGORIES,
  OPEN_COLLAB_CATEGORIES,
  OPEN_COLLAB_QUESTION_OPTIONS,
  OPEN_COLLAB_QUESTIONS,
  OPEN_COLLAB_RUBRIC_VERSION,
  OPEN_COLLAB_SUBCATEGORIES,
} from "../data/neighborhood-rubric"
import { ensureNotAbleToAssessOptions } from "../data/not-able-to-assess"

export {
  TRADITIONAL_STUDIOS_RUBRIC_VERSION,
  SENSORY_LAB_RUBRIC_VERSION,
  ADMIN_OFFICE_RUBRIC_VERSION,
  COUNSELING_SUITE_RUBRIC_VERSION,
  MAIN_OFFICE_RUBRIC_VERSION,
  COMMUNITY_PARTNER_RUBRIC_VERSION,
  PLC_RUBRIC_VERSION,
  NEIGHBORHOOD_SPACE_RUBRIC_VERSION,
  GROUP_ROOM_RUBRIC_VERSION,
  OPEN_COLLAB_RUBRIC_VERSION,
}

export interface SurveyRubric {
  assessmentArea: string
  categories: typeof STUDIO_CATEGORIES
  subcategories: typeof STUDIO_SUBCATEGORIES
  questions: typeof STUDIO_QUESTIONS
  options: typeof STUDIO_QUESTION_OPTIONS
}

const STUDIOS_RUBRIC: SurveyRubric = {
  assessmentArea: "Studios",
  categories: STUDIO_CATEGORIES,
  subcategories: STUDIO_SUBCATEGORIES,
  questions: STUDIO_QUESTIONS,
  options: STUDIO_QUESTION_OPTIONS,
}

const TRADITIONAL_STUDIOS_RUBRIC: SurveyRubric = {
  assessmentArea: "Studios",
  categories: TRADITIONAL_STUDIO_CATEGORIES,
  subcategories: TRADITIONAL_STUDIO_SUBCATEGORIES,
  questions: TRADITIONAL_STUDIO_QUESTIONS as SurveyRubric["questions"],
  options: TRADITIONAL_STUDIO_QUESTION_OPTIONS as SurveyRubric["options"],
}

const SENSORY_LAB_RUBRIC: SurveyRubric = {
  assessmentArea: "Studios",
  categories: SENSORY_LAB_CATEGORIES,
  subcategories: SENSORY_LAB_SUBCATEGORIES,
  questions: SENSORY_LAB_QUESTIONS as SurveyRubric["questions"],
  options: SENSORY_LAB_QUESTION_OPTIONS as SurveyRubric["options"],
}

const ADMIN_OFFICE_RUBRIC: SurveyRubric = {
  assessmentArea: "Administration",
  categories: ADMIN_OFFICE_CATEGORIES,
  subcategories: ADMIN_OFFICE_SUBCATEGORIES,
  questions: ADMIN_OFFICE_QUESTIONS as SurveyRubric["questions"],
  options: ADMIN_OFFICE_QUESTION_OPTIONS as SurveyRubric["options"],
}

const COUNSELING_SUITE_RUBRIC: SurveyRubric = {
  assessmentArea: "Administration",
  categories: COUNSELING_SUITE_CATEGORIES,
  subcategories: COUNSELING_SUITE_SUBCATEGORIES,
  questions: COUNSELING_SUITE_QUESTIONS as SurveyRubric["questions"],
  options: COUNSELING_SUITE_QUESTION_OPTIONS as SurveyRubric["options"],
}

const PLC_RUBRIC: SurveyRubric = {
  assessmentArea: "Administration",
  categories: PLC_CATEGORIES,
  subcategories: PLC_SUBCATEGORIES,
  questions: PLC_QUESTIONS as SurveyRubric["questions"],
  options: PLC_QUESTION_OPTIONS as SurveyRubric["options"],
}

const MAIN_OFFICE_RUBRIC: SurveyRubric = {
  assessmentArea: "Arrival/Main Office",
  categories: MAIN_OFFICE_CATEGORIES,
  subcategories: MAIN_OFFICE_SUBCATEGORIES,
  questions: MAIN_OFFICE_QUESTIONS as SurveyRubric["questions"],
  options: MAIN_OFFICE_QUESTION_OPTIONS as SurveyRubric["options"],
}

const COMMUNITY_PARTNER_RUBRIC: SurveyRubric = {
  assessmentArea: "Arrival/Main Office",
  categories: COMMUNITY_PARTNER_CATEGORIES,
  subcategories: COMMUNITY_PARTNER_SUBCATEGORIES,
  questions: COMMUNITY_PARTNER_QUESTIONS as SurveyRubric["questions"],
  options: COMMUNITY_PARTNER_QUESTION_OPTIONS as SurveyRubric["options"],
}

const NEIGHBORHOOD_SPACE_RUBRIC: SurveyRubric = {
  assessmentArea: "Neighborhoods",
  categories: NEIGHBORHOOD_SPACE_CATEGORIES,
  subcategories: NEIGHBORHOOD_SPACE_SUBCATEGORIES,
  questions: NEIGHBORHOOD_SPACE_QUESTIONS as SurveyRubric["questions"],
  options: NEIGHBORHOOD_SPACE_QUESTION_OPTIONS as SurveyRubric["options"],
}

const GROUP_ROOM_RUBRIC: SurveyRubric = {
  assessmentArea: "Neighborhoods",
  categories: GROUP_ROOM_CATEGORIES,
  subcategories: GROUP_ROOM_SUBCATEGORIES,
  questions: GROUP_ROOM_QUESTIONS as SurveyRubric["questions"],
  options: GROUP_ROOM_QUESTION_OPTIONS as SurveyRubric["options"],
}

const OPEN_COLLAB_RUBRIC: SurveyRubric = {
  assessmentArea: "Neighborhoods",
  categories: OPEN_COLLAB_CATEGORIES,
  subcategories: OPEN_COLLAB_SUBCATEGORIES,
  questions: OPEN_COLLAB_QUESTIONS as SurveyRubric["questions"],
  options: OPEN_COLLAB_QUESTION_OPTIONS as SurveyRubric["options"],
}

const RUBRICS: Record<SurveyType, SurveyRubric | null> = {
  studios: STUDIOS_RUBRIC,
  /** Close Out reuses Studios questions for deferred unfinished items */
  closeout: STUDIOS_RUBRIC,
  outdoor: null,
  /** Default Neighborhoods package; room type selects Neighborhood / Group Room / Open Collab */
  neighborhoods: NEIGHBORHOOD_SPACE_RUBRIC,
  /** Default Arrival package; room type selects Main Office vs Community Partner Suite */
  arrival: MAIN_OFFICE_RUBRIC,
  /** Default Administration package; room type selects Admin Office / Counseling / PLC */
  administration: ADMIN_OFFICE_RUBRIC,
  athletics: null,
  performing_arts: null,
  cte: null,
}

export function getSurveyRubric(type: SurveyType): SurveyRubric | null {
  const rubric = RUBRICS[type]
  return rubric ? ensureNotAbleToAssessOptions(rubric) : null
}

export function isElementaryGrade(grade: string | null | undefined): boolean {
  return grade === "PK" || grade === "K" || grade === "1" || grade === "2" || grade === "3" || grade === "4" || grade === "5"
}

export function isSecondaryGrade(grade: string | null | undefined): boolean {
  return grade === "MS" || grade === "HS"
}

/** Map app GradeType bands to Traditional v3 GradeApplicability tokens. */
export function gradeApplicabilityForGrade(
  grade: string | null | undefined,
): "ES" | "MS+HS" | null {
  if (!grade) return null
  if (isElementaryGrade(grade)) return "ES"
  if (isSecondaryGrade(grade)) return "MS+HS"
  return null
}

/**
 * Filter Traditional questions by grade band.
 * ST-009-ES / ST-009-MSHS stay hidden until a grade is selected.
 */
export function filterTraditionalRubricByGrade(
  rubric: SurveyRubric,
  gradeType?: string | null,
): SurveyRubric {
  const band = gradeApplicabilityForGrade(gradeType)
  const questions = rubric.questions.filter((q) => {
    const appl = q.gradeApplicability ?? "ALL"
    if (appl === "ALL" || !appl) return true
    if (!band) return false
    return appl === band
  })
  const ids = new Set(questions.map((q) => q.questionId))
  const options = rubric.options.filter((o) => ids.has(o.questionId))
  return { ...rubric, questions, options }
}

/** Map GradeType / school-derived grade to Neighborhood ES | MS | HS bands. */
export function neighborhoodGradeBand(
  grade: string | null | undefined,
): "ES" | "MS" | "HS" | null {
  if (!grade) return null
  if (isElementaryGrade(grade)) return "ES"
  if (grade === "MS") return "MS"
  if (grade === "HS") return "HS"
  return null
}

/** Derive a GradeType from AISD school CLASS for Neighborhood grade filtering. */
export function gradeTypeFromSchoolClass(
  schoolClass: string | null | undefined,
): GradeType | "" {
  if (schoolClass === "ELEM") return "K"
  if (schoolClass === "MID") return "MS"
  if (schoolClass === "HIGH") return "HS"
  return ""
}

/**
 * Filter Neighborhood questions by ES / MS / HS / ES+MS / MS+HS applicability.
 * Unbanded (ALL) questions always show; banded ones wait until a grade band is known.
 */
export function filterNeighborhoodRubricByGrade(
  rubric: SurveyRubric,
  gradeType?: string | null,
): SurveyRubric {
  const band = neighborhoodGradeBand(gradeType)
  const questions = rubric.questions.filter((q) => {
    const appl = String(q.gradeApplicability ?? "ALL").trim().toUpperCase() || "ALL"
    if (appl === "ALL") return true
    if (!band) return false
    if (appl === "ES+MS") return band === "ES" || band === "MS"
    if (appl === "MS+HS") return band === "MS" || band === "HS"
    return appl === band
  })
  const ids = new Set(questions.map((q) => q.questionId))
  const options = rubric.options.filter((o) => ids.has(o.questionId))
  return { ...rubric, questions, options }
}

/**
 * Room-aware rubric: Traditional / Sensory Lab use their v3 packages;
 * all other studio types keep the shared Studios rubric.
 * Arrival picks Main Office vs Community Partner Suite by room type.
 * Administration picks Admin Office / Counseling Suite / PLC by room type.
 * Neighborhoods picks Neighborhood / Group Room / Open Collaboration by room type.
 * Close Out uses sourceSurveyType when set; otherwise falls back to roomType (studios path).
 */
export function getRoomSurveyRubric(
  surveyType: SurveyType,
  roomType?: string | null,
  gradeType?: string | GradeType | null,
  sourceSurveyType?: SurveyType | null,
): SurveyRubric | null {
  const effectiveType =
    surveyType === "closeout" && sourceSurveyType ? sourceSurveyType : surveyType
  let rubric: SurveyRubric | null = null

  if (effectiveType === "neighborhoods") {
    let base: SurveyRubric | null = null
    if (roomType === "Neighborhood") base = NEIGHBORHOOD_SPACE_RUBRIC
    else if (roomType === "Group Room") base = GROUP_ROOM_RUBRIC
    else if (roomType === "Open Collaboration Space") base = OPEN_COLLAB_RUBRIC
    if (!base) return null
    rubric = filterNeighborhoodRubricByGrade(base, gradeType)
  } else if (effectiveType === "arrival") {
    if (roomType === "Main Office") rubric = MAIN_OFFICE_RUBRIC
    else if (roomType === "Community Partner Suite") rubric = COMMUNITY_PARTNER_RUBRIC
    else return null
  } else if (effectiveType === "administration") {
    if (roomType === "Counseling Suite") rubric = COUNSELING_SUITE_RUBRIC
    else if (roomType === "Admin Office") rubric = ADMIN_OFFICE_RUBRIC
    else if (roomType === "Professional Learning Center") rubric = PLC_RUBRIC
    // Require a space type before showing questions
    else return null
  } else if (effectiveType !== "studios" && effectiveType !== "closeout") {
    rubric = RUBRICS[effectiveType]
  } else if (roomType === "Traditional studio") {
    rubric = filterTraditionalRubricByGrade(TRADITIONAL_STUDIOS_RUBRIC, gradeType)
  } else if (roomType === "Sensory Lab") {
    rubric = SENSORY_LAB_RUBRIC
  } else {
    rubric = STUDIOS_RUBRIC
  }

  return rubric ? ensureNotAbleToAssessOptions(rubric) : null
}

export function surveyTypeLabel(type: SurveyType): string {
  switch (type) {
    case "studios":
      return "Studios"
    case "outdoor":
      return "Outdoor Elements"
    case "neighborhoods":
      return "Neighborhoods"
    case "arrival":
      return "Arrival/Main Office"
    case "administration":
      return "Administration"
    case "athletics":
      return "Athletics and Wellness"
    case "performing_arts":
      return "Performing Arts"
    case "cte":
      return "CTE"
    case "closeout":
      return "Close Out"
  }
}

/** Primary survey modules shown in the sidebar (Close Out appears when used). */
export const SURVEY_TYPES: SurveyType[] = [
  "studios",
  "outdoor",
  "neighborhoods",
  "arrival",
  "administration",
  "athletics",
  "performing_arts",
  "cte",
  "closeout",
]

/** Survey types limited to middle and high schools. */
export const MS_HS_ONLY_SURVEY_TYPES: readonly SurveyType[] = ["performing_arts", "cte"]

export function isMsHsOnlySurveyType(type: SurveyType): boolean {
  return (MS_HS_ONLY_SURVEY_TYPES as readonly SurveyType[]).includes(type)
}

export function isMiddleOrHighSchool(schoolClass: string | null | undefined): boolean {
  return schoolClass === "MID" || schoolClass === "HIGH"
}

export function surveyTypeAvailableForSchool(
  type: SurveyType,
  schoolClass: string | null | undefined,
): boolean {
  if (!isMsHsOnlySurveyType(type)) return true
  // Before a school is chosen, still list MS/HS modules so assessors can see them.
  if (!schoolClass) return true
  return isMiddleOrHighSchool(schoolClass)
}

export const STUDIO_TYPE_OPTIONS = [
  "Traditional studio",
  "Sensory Lab",
  "Early childhood studio",
  "Science",
  "Sped flex studio",
  "Vocational lab",
  "Maker space",
  "Art",
  "Music",
] as const

export type StudioType = (typeof STUDIO_TYPE_OPTIONS)[number]

export function isStudioType(value: string): value is StudioType {
  return (STUDIO_TYPE_OPTIONS as readonly string[]).includes(value)
}

export const ADMIN_SPACE_TYPE_OPTIONS = [
  "Admin Office",
  "Counseling Suite",
  "Professional Learning Center",
] as const

export type AdminSpaceType = (typeof ADMIN_SPACE_TYPE_OPTIONS)[number]

export function isAdminSpaceType(value: string): value is AdminSpaceType {
  return (ADMIN_SPACE_TYPE_OPTIONS as readonly string[]).includes(value)
}

export const ARRIVAL_SPACE_TYPE_OPTIONS = ["Community Partner Suite"] as const

export type ArrivalSpaceType = (typeof ARRIVAL_SPACE_TYPE_OPTIONS)[number]

export function isArrivalSpaceType(value: string): value is ArrivalSpaceType {
  return (ARRIVAL_SPACE_TYPE_OPTIONS as readonly string[]).includes(value)
}

export const NEIGHBORHOOD_SPACE_TYPE_OPTIONS = [
  "Neighborhood",
  "Group Room",
  "Open Collaboration Space",
] as const

export type NeighborhoodSpaceType = (typeof NEIGHBORHOOD_SPACE_TYPE_OPTIONS)[number]

export function isNeighborhoodSpaceType(value: string): value is NeighborhoodSpaceType {
  return (NEIGHBORHOOD_SPACE_TYPE_OPTIONS as readonly string[]).includes(value)
}

/** Studio types that use a dedicated CSV package rubric (not the shared Studios questions). */
export function usesPackageStudioRubric(roomType: string | null | undefined): boolean {
  return roomType === "Traditional studio" || roomType === "Sensory Lab"
}

/** Admin space types that use dedicated CSV package rubrics. */
export function usesPackageAdminRubric(roomType: string | null | undefined): boolean {
  return (
    roomType === "Admin Office" ||
    roomType === "Counseling Suite" ||
    roomType === "Professional Learning Center"
  )
}

/** Arrival space types that use dedicated CSV package rubrics. */
export function usesPackageArrivalRubric(roomType: string | null | undefined): boolean {
  return roomType === "Community Partner Suite"
}

/** Neighborhood space types that use dedicated CSV package rubrics. */
export function usesPackageNeighborhoodRubric(roomType: string | null | undefined): boolean {
  return (
    roomType === "Neighborhood" ||
    roomType === "Group Room" ||
    roomType === "Open Collaboration Space"
  )
}

/** Dedicated package rubrics that should clear answers when switching types. */
export function usesDedicatedSpaceRubric(roomType: string | null | undefined): boolean {
  return (
    usesPackageStudioRubric(roomType) ||
    usesPackageAdminRubric(roomType) ||
    usesPackageArrivalRubric(roomType) ||
    usesPackageNeighborhoodRubric(roomType)
  )
}

/** Per-room grade is no longer collected. */
export function studioTypeRequiresGrade(_roomType?: string | null | undefined): boolean {
  return false
}
