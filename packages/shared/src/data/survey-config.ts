import type { GradeType, SurveySession, SurveyType } from "../types/survey"
import {
  SCORING_FOCUS_AREAS_FROM_TABLE,
  SURVEY_MODULE_ORDER,
  TABLE_OF_SURVEY_ENTRIES,
  isSpaceTypeRequiredForSchool,
  lookupTableEntry,
  lookupTableEntryBySpaceType,
  requiredSurveyTypesForSchool,
  scoringFocusAreaForRoomFromTable,
  scoringFocusAreaLabel,
  spaceTypeDisplayLabel,
  spaceTypesForSurveyModule,
  surveyFocusForSurveyType,
  surveyTypeAvailableForSchoolFromTable,
  surveyTypesForSchool,
  surveyTypesInSameNavGroup,
  questionSetStatusForSpaceType,
  isPendingQuestionSet,
  isPlaceholderQuestionSet,
  type QuestionSetStatus,
  type ScoringFocusAreaId,
  type TableOfSurveyEntry,
} from "../data/table-of-surveys"
import {
  GRADE_OPTIONS,
  STUDIO_CATEGORIES,
  STUDIO_QUESTION_OPTIONS,
  STUDIO_QUESTIONS,
  STUDIO_SUBCATEGORIES,
} from "../data/studio-rubric"
import {
  LIFE_SKILLS_CATEGORIES,
  LIFE_SKILLS_QUESTION_OPTIONS,
  LIFE_SKILLS_QUESTIONS,
  LIFE_SKILLS_RUBRIC_VERSION,
  LIFE_SKILLS_SUBCATEGORIES,
  MAKER_SPACE_CATEGORIES,
  MAKER_SPACE_QUESTION_OPTIONS,
  MAKER_SPACE_QUESTIONS,
  MAKER_SPACE_RUBRIC_VERSION,
  MAKER_SPACE_SUBCATEGORIES,
  SENSORY_LAB_CATEGORIES,
  SENSORY_LAB_QUESTION_OPTIONS,
  SENSORY_LAB_QUESTIONS,
  SENSORY_LAB_RUBRIC_VERSION,
  SENSORY_LAB_SUBCATEGORIES,
  SPED_FLEX_CATEGORIES,
  SPED_FLEX_QUESTION_OPTIONS,
  SPED_FLEX_QUESTIONS,
  SPED_FLEX_RUBRIC_VERSION,
  SPED_FLEX_SUBCATEGORIES,
  TRADITIONAL_STUDIO_CATEGORIES,
  TRADITIONAL_STUDIO_QUESTION_OPTIONS,
  TRADITIONAL_STUDIO_QUESTIONS,
  TRADITIONAL_STUDIO_SUBCATEGORIES,
  TRADITIONAL_STUDIOS_RUBRIC_VERSION,
  VOCATIONAL_LAB_CATEGORIES,
  VOCATIONAL_LAB_QUESTION_OPTIONS,
  VOCATIONAL_LAB_QUESTIONS,
  VOCATIONAL_LAB_RUBRIC_VERSION,
  VOCATIONAL_LAB_SUBCATEGORIES,
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
  PLC_CATEGORIES,
  PLC_QUESTION_OPTIONS,
  PLC_QUESTIONS,
  PLC_RUBRIC_VERSION,
  PLC_SUBCATEGORIES,
} from "../data/admin-rubric"
import {
  COMMUNITY_PARTNER_CATEGORIES,
  COMMUNITY_PARTNER_QUESTION_OPTIONS,
  COMMUNITY_PARTNER_QUESTIONS,
  COMMUNITY_PARTNER_RUBRIC_VERSION,
  COMMUNITY_PARTNER_SUBCATEGORIES,
  MAIN_ADMIN_SUITE_CATEGORIES,
  MAIN_ADMIN_SUITE_QUESTION_OPTIONS,
  MAIN_ADMIN_SUITE_QUESTIONS,
  MAIN_ADMIN_SUITE_RUBRIC_VERSION,
  MAIN_ADMIN_SUITE_SUBCATEGORIES,
  MAIN_OFFICE_CATEGORIES,
  MAIN_OFFICE_QUESTION_OPTIONS,
  MAIN_OFFICE_QUESTIONS,
  MAIN_OFFICE_RUBRIC_VERSION,
  MAIN_OFFICE_SUBCATEGORIES,
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
import {
  OUTDOOR_SPACES_CATEGORIES,
  OUTDOOR_SPACES_QUESTION_OPTIONS,
  OUTDOOR_SPACES_QUESTIONS,
  OUTDOOR_SPACES_RUBRIC_VERSION,
  OUTDOOR_SPACES_SUBCATEGORIES,
} from "../data/outdoor-rubric"
import { ensureSyntheticQuestionOptions } from "../data/not-able-to-assess"
import { roomRubricForSpaceType } from "../data/room-rubric-map"

export {
  TRADITIONAL_STUDIOS_RUBRIC_VERSION,
  MAKER_SPACE_RUBRIC_VERSION,
  OUTDOOR_SPACES_RUBRIC_VERSION,
  SENSORY_LAB_RUBRIC_VERSION,
  VOCATIONAL_LAB_RUBRIC_VERSION,
  LIFE_SKILLS_RUBRIC_VERSION,
  SPED_FLEX_RUBRIC_VERSION,
  ADMIN_OFFICE_RUBRIC_VERSION,
  COUNSELING_SUITE_RUBRIC_VERSION,
  MAIN_OFFICE_RUBRIC_VERSION,
  MAIN_ADMIN_SUITE_RUBRIC_VERSION,
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

const MAKER_SPACE_RUBRIC: SurveyRubric = {
  assessmentArea: "Studios",
  categories: MAKER_SPACE_CATEGORIES,
  subcategories: MAKER_SPACE_SUBCATEGORIES,
  questions: MAKER_SPACE_QUESTIONS as SurveyRubric["questions"],
  options: MAKER_SPACE_QUESTION_OPTIONS as SurveyRubric["options"],
}

const SENSORY_LAB_RUBRIC: SurveyRubric = {
  assessmentArea: "Studios",
  categories: SENSORY_LAB_CATEGORIES,
  subcategories: SENSORY_LAB_SUBCATEGORIES,
  questions: SENSORY_LAB_QUESTIONS as SurveyRubric["questions"],
  options: SENSORY_LAB_QUESTION_OPTIONS as SurveyRubric["options"],
}

const VOCATIONAL_LAB_RUBRIC: SurveyRubric = {
  assessmentArea: "Studios",
  categories: VOCATIONAL_LAB_CATEGORIES,
  subcategories: VOCATIONAL_LAB_SUBCATEGORIES,
  questions: VOCATIONAL_LAB_QUESTIONS as SurveyRubric["questions"],
  options: VOCATIONAL_LAB_QUESTION_OPTIONS as SurveyRubric["options"],
}

const LIFE_SKILLS_RUBRIC: SurveyRubric = {
  assessmentArea: "Studios",
  categories: LIFE_SKILLS_CATEGORIES,
  subcategories: LIFE_SKILLS_SUBCATEGORIES,
  questions: LIFE_SKILLS_QUESTIONS as SurveyRubric["questions"],
  options: LIFE_SKILLS_QUESTION_OPTIONS as SurveyRubric["options"],
}

const SPED_FLEX_RUBRIC: SurveyRubric = {
  assessmentArea: "Studios",
  categories: SPED_FLEX_CATEGORIES,
  subcategories: SPED_FLEX_SUBCATEGORIES,
  questions: SPED_FLEX_QUESTIONS as SurveyRubric["questions"],
  options: SPED_FLEX_QUESTION_OPTIONS as SurveyRubric["options"],
}

const OUTDOOR_SPACES_RUBRIC: SurveyRubric = {
  assessmentArea: "Outdoor",
  categories: OUTDOOR_SPACES_CATEGORIES,
  subcategories: OUTDOOR_SPACES_SUBCATEGORIES,
  questions: OUTDOOR_SPACES_QUESTIONS as SurveyRubric["questions"],
  options: OUTDOOR_SPACES_QUESTION_OPTIONS as SurveyRubric["options"],
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

const MAIN_ADMIN_SUITE_RUBRIC: SurveyRubric = {
  assessmentArea: "Arrival/Main Office",
  categories: MAIN_ADMIN_SUITE_CATEGORIES,
  subcategories: MAIN_ADMIN_SUITE_SUBCATEGORIES,
  questions: MAIN_ADMIN_SUITE_QUESTIONS as SurveyRubric["questions"],
  options: MAIN_ADMIN_SUITE_QUESTION_OPTIONS as SurveyRubric["options"],
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
  special_education: null,
  /** Close Out reuses Studios questions for deferred unfinished items */
  closeout: STUDIOS_RUBRIC,
  outdoor: OUTDOOR_SPACES_RUBRIC,
  neighborhoods: NEIGHBORHOOD_SPACE_RUBRIC,
  arrival: MAIN_OFFICE_RUBRIC,
  administration: ADMIN_OFFICE_RUBRIC,
  athletics: null,
  performing_arts: null,
  cte: null,
  shared_spaces: null,
}

export function getSurveyRubric(type: SurveyType): SurveyRubric | null {
  const rubric = RUBRICS[type]
  return rubric ? ensureSyntheticQuestionOptions(rubric) : null
}

export function isElementaryGrade(grade: string | null | undefined): boolean {
  return grade === "PK" || grade === "K" || grade === "1" || grade === "2" || grade === "3" || grade === "4" || grade === "5"
}

export function isSecondaryGrade(grade: string | null | undefined): boolean {
  return grade === "MS" || grade === "HS"
}

/** Map app GradeType bands to package GradeApplicability tokens. */
export function gradeApplicabilityForGrade(
  grade: string | null | undefined,
): "ES" | "MS+HS" | null {
  if (!grade) return null
  if (isElementaryGrade(grade)) return "ES"
  if (isSecondaryGrade(grade)) return "MS+HS"
  return null
}

/**
 * Normalize CSV GradeApplicability strings (ALL, ES, MS+HS, "MS, HS", "MS/HS", …).
 */
export function normalizeGradeApplicability(
  raw: string | null | undefined,
): "ALL" | "ES" | "MS+HS" {
  const s = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
  if (!s || s === "ALL") return "ALL"
  if (s === "ES") return "ES"
  if (s.includes("MS") && s.includes("HS")) return "MS+HS"
  if (s === "MS+HS" || s === "SECONDARY") return "MS+HS"
  return "ALL"
}

/**
 * Whether a CSV SchoolLevel / gradeApplicability value applies to the school's CLASS.
 * Supports ALL, ES, MS, HS, MS+HS, and comma-separated combos (e.g. "ES, MS").
 */
export function questionAppliesToSchoolClass(
  gradeApplicability: string | null | undefined,
  schoolClass?: string | null,
): boolean {
  const raw = String(gradeApplicability ?? "ALL").trim()
  if (!raw || raw.toUpperCase() === "ALL") return true
  if (!schoolClass) return false

  const isElem = schoolClass === "ELEM"
  const isMid = schoolClass === "MID"
  const isHigh = schoolClass === "HIGH"

  const tokens = raw
    .toUpperCase()
    .split(/[,/]+/)
    .flatMap((part) => part.trim().split(/\s+/))
    .map((t) => t.trim())
    .filter(Boolean)

  const checkToken = (token: string): boolean => {
    if (token === "ALL") return true
    if (token === "ES" || token === "ELEM" || token === "ELEMENTARY") return isElem
    if (token === "MS" || token === "MID" || token === "MIDDLE") return isMid
    if (token === "HS" || token === "HIGH") return isHigh
    if (token === "MS+HS" || token === "SECONDARY") return isMid || isHigh
    if (token.includes("MS") && token.includes("HS")) return isMid || isHigh
    return false
  }

  if (tokens.length === 0) {
    return checkToken(raw.toUpperCase().replace(/\s+/g, ""))
  }
  return tokens.some(checkToken)
}

/**
 * Filter package questions by school level (CLASS from AISD schools data).
 * ES-only questions show at ELEM; MS+HS questions show at MID/HIGH; ALL always show.
 */
export function filterRubricBySchoolLevel(
  rubric: SurveyRubric,
  schoolClass?: string | null,
): SurveyRubric {
  const questions = rubric.questions.filter((q) =>
    questionAppliesToSchoolClass(q.gradeApplicability, schoolClass),
  )
  const ids = new Set(questions.map((q) => q.questionId))
  const options = rubric.options.filter((o) => ids.has(o.questionId))
  return { ...rubric, questions, options }
}

/**
 * @deprecated Prefer filterRubricBySchoolLevel — room grade no longer drives question visibility.
 */
export function filterRubricByGrade(
  rubric: SurveyRubric,
  gradeType?: string | null,
): SurveyRubric {
  const band = gradeApplicabilityForGrade(gradeType)
  const questions = rubric.questions.filter((q) => {
    const appl = normalizeGradeApplicability(q.gradeApplicability)
    if (appl === "ALL") return true
    if (!band) return false
    return appl === band
  })
  const ids = new Set(questions.map((q) => q.questionId))
  const options = rubric.options.filter((o) => ids.has(o.questionId))
  return { ...rubric, questions, options }
}

/** @deprecated Use filterRubricBySchoolLevel */
export function filterTraditionalRubricByGrade(
  rubric: SurveyRubric,
  gradeType?: string | null,
): SurveyRubric {
  return filterRubricByGrade(rubric, gradeType)
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

/**
 * Filter Neighborhood questions by ES / MS / HS / MS+HS applicability.
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
    if (appl === "MS+HS") return band === "MS" || band === "HS"
    return appl === band
  })
  const ids = new Set(questions.map((q) => q.questionId))
  const options = rubric.options.filter((o) => ids.has(o.questionId))
  return { ...rubric, questions, options }
}

/**
 * Room-aware rubric: package studio types use v3 CSV packages filtered by school CLASS;
 * all other studio types keep the shared Studios rubric.
 * Arrival / Administration / Neighborhoods pick by room type.
 * Close Out uses sourceSurveyType when set; otherwise falls back to roomType (studios path).
 */
export function getRoomSurveyRubric(
  surveyType: SurveyType,
  roomType?: string | null,
  gradeType?: string | GradeType | null,
  schoolClass?: string | null,
  sourceSurveyType?: SurveyType | null,
): SurveyRubric | null {
  const effectiveType =
    surveyType === "closeout" && sourceSurveyType ? sourceSurveyType : surveyType
  let rubric: SurveyRubric | null = null

  if (
    roomType &&
    isPendingQuestionSet(effectiveType, roomType, schoolClass)
  ) {
    return null
  }

  if (effectiveType === "neighborhoods") {
    let base: SurveyRubric | null = null
    if (roomType === "Neighborhood") base = NEIGHBORHOOD_SPACE_RUBRIC
    else if (roomType === "Group Room" || roomType === "Large Group Room") base = GROUP_ROOM_RUBRIC
    else if (roomType === "Open Collaboration Space") base = OPEN_COLLAB_RUBRIC
    if (!base) return null
    const neighborhoodGrade =
      gradeType ||
      (schoolClass === "ELEM" ? "K" : schoolClass === "MID" ? "MS" : schoolClass === "HIGH" ? "HS" : null)
    rubric = filterNeighborhoodRubricByGrade(base, neighborhoodGrade)
  } else if (effectiveType === "arrival") {
    if (roomType === "Main Office") rubric = MAIN_OFFICE_RUBRIC
    else if (roomType === "Main Admin Suite") rubric = MAIN_ADMIN_SUITE_RUBRIC
    else if (roomType === "Community Partner Suite") rubric = COMMUNITY_PARTNER_RUBRIC
    else return null
  } else if (effectiveType === "administration") {
    if (roomType === "Counseling Suite") rubric = COUNSELING_SUITE_RUBRIC
    else if (roomType === "Admin Office") rubric = ADMIN_OFFICE_RUBRIC
    else if (roomType === "Professional Learning Center") rubric = PLC_RUBRIC
    else return null
  } else if (effectiveType === "outdoor") {
    if (roomType === "Outdoor Spaces") {
      rubric = filterRubricBySchoolLevel(OUTDOOR_SPACES_RUBRIC, schoolClass)
    } else if (roomType === "Outdoor Athletics") {
      const parts = roomRubricForSpaceType("Outdoor Athletics")
      rubric = parts
        ? filterRubricBySchoolLevel(
            {
              assessmentArea: parts.assessmentArea,
              categories: parts.categories,
              subcategories: parts.subcategories,
              questions: parts.questions as SurveyRubric["questions"],
              options: parts.options as SurveyRubric["options"],
            },
            schoolClass,
          )
        : null
    } else {
      return null
    }
  } else if (
    effectiveType === "studios" ||
    effectiveType === "special_education" ||
    effectiveType === "athletics" ||
    effectiveType === "performing_arts" ||
    effectiveType === "cte" ||
    effectiveType === "shared_spaces" ||
    effectiveType === "closeout"
  ) {
    const parts = roomType ? roomRubricForSpaceType(roomType) : null
    if (parts) {
      rubric = filterRubricBySchoolLevel(
        {
          assessmentArea: parts.assessmentArea,
          categories: parts.categories,
          subcategories: parts.subcategories,
          questions: parts.questions as SurveyRubric["questions"],
          options: parts.options as SurveyRubric["options"],
        },
        schoolClass,
      )
    } else if (effectiveType === "studios" || effectiveType === "closeout") {
      rubric = STUDIOS_RUBRIC
    } else {
      return null
    }
  } else {
    rubric = RUBRICS[effectiveType]
  }

  return rubric ? ensureSyntheticQuestionOptions(rubric) : null
}

export function surveyTypeLabel(type: SurveyType): string {
  switch (type) {
    case "studios":
      return "Studios"
    case "special_education":
      return "Special Education"
    case "outdoor":
      return "Outdoor Elements"
    case "neighborhoods":
      return "Neighborhoods"
    case "arrival":
      return "Arrival/Administration"
    case "administration":
      return "Arrival/Administration"
    case "athletics":
      return "Athletics and Wellness"
    case "performing_arts":
      return "Performing Arts"
    case "cte":
      return "CTE"
    case "shared_spaces":
      return "Shared Spaces"
    case "closeout":
      return "Close Out"
  }
}

/** Primary survey modules shown in the sidebar (Close Out is always last). */
export const SURVEY_TYPES: SurveyType[] = [...SURVEY_MODULE_ORDER]

/** Survey types limited to middle and high schools (legacy helper — prefer table lookups). */
export const MS_HS_ONLY_SURVEY_TYPES: readonly SurveyType[] = ["performing_arts", "cte"]

export function isMsHsOnlySurveyType(type: SurveyType): boolean {
  return (MS_HS_ONLY_SURVEY_TYPES as readonly SurveyType[]).includes(type)
}

export function isMiddleOrHighSchool(schoolClass: string | null | undefined): boolean {
  return schoolClass === "MID" || schoolClass === "HIGH"
}

export function isElementarySchool(schoolClass: string | null | undefined): boolean {
  return schoolClass === "ELEM"
}

/** Map school CLASS → GradeApplicability band used in package CSVs. */
export function gradeApplicabilityForSchoolClass(
  schoolClass: string | null | undefined,
): "ES" | "MS+HS" | null {
  if (isElementarySchool(schoolClass)) return "ES"
  if (isMiddleOrHighSchool(schoolClass)) return "MS+HS"
  return null
}

/** Map school CLASS (from AISD schools data) to survey GradeType for MS/HS campuses. */
export function gradeTypeFromSchoolClass(
  schoolClass: string | null | undefined,
): GradeType | null {
  if (schoolClass === "MID") return "MS"
  if (schoolClass === "HIGH") return "HS"
  return null
}

export function surveyTypeAvailableForSchool(
  type: SurveyType,
  schoolClass: string | null | undefined,
): boolean {
  return surveyTypeAvailableForSchoolFromTable(type, schoolClass)
}

/** Space types configured for a survey module at this school (from Categories CSV). */
export function spaceTypeOptionsForSurvey(
  surveyType: SurveyType,
  schoolClass?: string | null,
): readonly string[] {
  const seen = new Set<string>()
  const types: string[] = []
  for (const moduleType of surveyTypesInSameNavGroup(surveyType, schoolClass)) {
    for (const entry of spaceTypesForSurveyModule(moduleType, schoolClass)) {
      if (seen.has(entry.spaceType)) continue
      seen.add(entry.spaceType)
      types.push(entry.spaceType)
    }
  }
  return types
}

export function tableEntryForSpaceType(
  surveyType: SurveyType,
  spaceType: string,
  schoolClass?: string | null,
): TableOfSurveyEntry | null {
  return (
    lookupTableEntry(surveyType, spaceType, schoolClass) ??
    lookupTableEntryBySpaceType(spaceType, schoolClass)
  )
}

/** Survey module that owns a space type for this school (from Categories CSV). */
export function surveyTypeForSpaceType(
  spaceType: string,
  schoolClass?: string | null,
): SurveyType | null {
  return lookupTableEntryBySpaceType(spaceType, schoolClass)?.surveyType ?? null
}

/** Sidebar label from CSV survey focus area. */
export function surveyNavLabel(
  surveyType: SurveyType,
  schoolClass?: string | null,
): string {
  return surveyFocusForSurveyType(surveyType, schoolClass) ?? surveyTypeLabel(surveyType)
}

/** Whether this survey module shows a space-type picker (from Categories CSV). */
export function surveyModuleUsesSpaceTypePicker(
  surveyType: SurveyType,
  schoolClass?: string | null,
): boolean {
  if (surveyType === "closeout") return false
  return spaceTypeOptionsForSurvey(surveyType, schoolClass).length > 0
}

/** Whether a value is a configured space type for this survey at this school. */
export function isSpaceTypeForSurveyModule(
  surveyType: SurveyType,
  value: string,
  schoolClass?: string | null,
): boolean {
  for (const moduleType of surveyTypesInSameNavGroup(surveyType, schoolClass)) {
    if ((spaceTypeOptionsForSurvey(moduleType, schoolClass) as readonly string[]).includes(value)) {
      return true
    }
  }
  return false
}

export const STUDIO_TYPE_OPTIONS = [
  "Traditional studio",
  "Sensory Lab",
  "Life Skills Room",
  "Early childhood studio",
  "Early childhood special education studio",
  "Science",
  "Sped flex studio",
  "Vocational Lab",
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

export const ARRIVAL_SPACE_TYPE_OPTIONS = [
  "Main Admin Suite",
  "Community Partner Suite",
] as const

export type ArrivalSpaceType = (typeof ARRIVAL_SPACE_TYPE_OPTIONS)[number]

export function isArrivalSpaceType(value: string): value is ArrivalSpaceType {
  return (ARRIVAL_SPACE_TYPE_OPTIONS as readonly string[]).includes(value)
}

export const NEIGHBORHOOD_SPACE_TYPE_OPTIONS = [
  "Neighborhood",
  "Group Room",
  "Large Group Room",
  "Open Collaboration Space",
] as const

export type NeighborhoodSpaceType = (typeof NEIGHBORHOOD_SPACE_TYPE_OPTIONS)[number]

export function isNeighborhoodSpaceType(value: string): value is NeighborhoodSpaceType {
  return (NEIGHBORHOOD_SPACE_TYPE_OPTIONS as readonly string[]).includes(value)
}

export const OUTDOOR_SPACE_TYPE_OPTIONS = ["Outdoor Spaces"] as const

export type OutdoorSpaceType = (typeof OUTDOOR_SPACE_TYPE_OPTIONS)[number]

export function isOutdoorSpaceType(value: string): value is OutdoorSpaceType {
  return (OUTDOOR_SPACE_TYPE_OPTIONS as readonly string[]).includes(value)
}

/** Outdoor and Traditional studio skip the "does this space exist?" gate. */
export function spaceTypeRequiresExistenceGate(spaceType: string | null | undefined): boolean {
  if (!spaceType?.trim()) return false
  if (spaceType === "Traditional studio") return false
  if (isOutdoorSpaceType(spaceType) || spaceType === "Outdoor Athletics") return false
  return true
}

/** Composite key when existence is scoped to a neighborhood (Neighborhoods survey). */
export function spaceTypeExistenceKey(
  spaceType: string,
  neighborhood?: string | null,
): string {
  const nh = neighborhood?.trim()
  return nh ? `${spaceType}::${nh}` : spaceType
}

export function readSpaceTypeExistsAtSchool(
  session: Pick<SurveySession, "spaceTypeExistsAtSchool"> | null | undefined,
  spaceType: string,
  neighborhood?: string | null,
): boolean | null {
  const record = session?.spaceTypeExistsAtSchool
  if (!record) return null
  const scopedKey = spaceTypeExistenceKey(spaceType, neighborhood)
  if (scopedKey in record) return record[scopedKey] ?? null
  if (!neighborhood?.trim() && spaceType in record) return record[spaceType] ?? null
  return null
}

export function isSpaceTypeMarkedAbsentAtSchool(
  session: Pick<SurveySession, "spaceTypeExistsAtSchool"> | null | undefined,
  spaceType: string,
  neighborhood?: string | null,
): boolean {
  return readSpaceTypeExistsAtSchool(session, spaceType, neighborhood) === false
}

export function isSpaceTypeConfirmedAtSchool(
  session: Pick<SurveySession, "spaceTypeExistsAtSchool"> | null | undefined,
  spaceType: string,
  neighborhood?: string | null,
): boolean {
  return readSpaceTypeExistsAtSchool(session, spaceType, neighborhood) === true
}

/** Synthetic session key for a space type marked not present (scores 0). */
export const ABSENT_SPACE_TYPE_ROOM_PREFIX = "__absent-space-type__:" as const

export function absentSpaceTypeRoomId(
  spaceType: string,
  neighborhood?: string | null,
): string {
  const type = spaceType.trim()
  const nh = neighborhood?.trim()
  return nh
    ? `${ABSENT_SPACE_TYPE_ROOM_PREFIX}${type}::${nh}`
    : `${ABSENT_SPACE_TYPE_ROOM_PREFIX}${type}`
}

export function isAbsentSpaceTypeRoomId(roomId: string | null | undefined): boolean {
  return !!roomId?.startsWith(ABSENT_SPACE_TYPE_ROOM_PREFIX)
}

export function parseAbsentSpaceTypeRoomId(
  roomId: string,
): { spaceType: string; neighborhood?: string } | null {
  if (!isAbsentSpaceTypeRoomId(roomId)) return null
  const rest = roomId.slice(ABSENT_SPACE_TYPE_ROOM_PREFIX.length)
  const sep = rest.indexOf("::")
  if (sep >= 0) {
    return {
      spaceType: rest.slice(0, sep),
      neighborhood: rest.slice(sep + 2) || undefined,
    }
  }
  return { spaceType: rest }
}

export function absentSpaceTypeRoomDisplayName(
  spaceType: string,
  neighborhood?: string | null,
): string {
  const nh = neighborhood?.trim()
  return nh
    ? `${spaceType} — not present (Neighborhood ${nh})`
    : `${spaceType} — not present`
}

/** Synthetic session key for campus-wide Outdoor Elements scoring (not a floor-plan room). */
export const OUTDOOR_SURVEY_ROOM_ID = "__outdoor-spaces__" as const

export function isOutdoorSurveyRoomId(roomId: string | null | undefined): boolean {
  return roomId === OUTDOOR_SURVEY_ROOM_ID
}

export function outdoorSurveyRoomDisplayName(): string {
  return "Outdoor Spaces"
}

/** Synthetic session keys for Neighborhood space-type scoring (one per identified neighborhood). */
export const NEIGHBORHOOD_SURVEY_ROOM_PREFIX = "__neighborhood-survey__:" as const

export function neighborhoodSurveyRoomId(neighborhood: string): string {
  return `${NEIGHBORHOOD_SURVEY_ROOM_PREFIX}${neighborhood.trim()}`
}

export function isNeighborhoodSurveyRoomId(roomId: string | null | undefined): boolean {
  return !!roomId?.startsWith(NEIGHBORHOOD_SURVEY_ROOM_PREFIX)
}

export function neighborhoodFromSurveyRoomId(roomId: string): string | null {
  if (!isNeighborhoodSurveyRoomId(roomId)) return null
  const label = roomId.slice(NEIGHBORHOOD_SURVEY_ROOM_PREFIX.length).trim()
  return label || null
}

export function neighborhoodSurveyRoomDisplayName(neighborhood: string): string {
  const trimmed = neighborhood.trim()
  return trimmed ? `Neighborhood ${trimmed}` : "Neighborhood"
}

/** Synthetic session key when a space type is assessed without a specific floor-plan room. */
export const NA_SURVEY_ROOM_PREFIX = "__na-room__:" as const

export function naSurveyRoomId(spaceType: string, neighborhood?: string | null): string {
  const type = spaceType.trim()
  const nh = neighborhood?.trim()
  return nh ? `${NA_SURVEY_ROOM_PREFIX}${type}::${nh}` : `${NA_SURVEY_ROOM_PREFIX}${type}`
}

export function isNaSurveyRoomId(roomId: string | null | undefined): boolean {
  return !!roomId?.startsWith(NA_SURVEY_ROOM_PREFIX)
}

export function parseNaSurveyRoomId(
  roomId: string,
): { spaceType: string; neighborhood?: string } | null {
  if (!isNaSurveyRoomId(roomId)) return null
  const rest = roomId.slice(NA_SURVEY_ROOM_PREFIX.length)
  const sep = rest.indexOf("::")
  if (sep >= 0) {
    return {
      spaceType: rest.slice(0, sep),
      neighborhood: rest.slice(sep + 2) || undefined,
    }
  }
  return { spaceType: rest }
}

export function naSurveyRoomDisplayName(): string {
  return "N/A — no room assigned"
}

/** Neighborhoods module: the Neighborhood space type is scored per neighborhood, not per room. */
export function isNeighborhoodOnlySpaceType(
  surveyType: SurveyType,
  spaceType: string | null | undefined,
): boolean {
  return surveyType === "neighborhoods" && spaceType === "Neighborhood"
}

/** Survey types scored once per campus rather than per room. */
export function isCampusScopedSurveyType(surveyType: SurveyType): boolean {
  return surveyType === "outdoor"
}

/** Studio types that use a dedicated CSV package rubric (not the shared Studios questions). */
export function usesPackageStudioRubric(roomType: string | null | undefined): boolean {
  return (
    roomType === "Traditional studio" ||
    roomType === "Maker space" ||
    roomType === "Sensory Lab" ||
    roomType === "Vocational Lab" ||
    roomType === "Vocational lab" ||
    roomType === "Life Skills Room" ||
    roomType === "Sped flex studio"
  )
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
  return (
    roomType === "Main Admin Suite" ||
    roomType === "Community Partner Suite"
  )
}

/** Neighborhood space types that use dedicated CSV package rubrics. */
export function usesPackageNeighborhoodRubric(roomType: string | null | undefined): boolean {
  return (
    roomType === "Neighborhood" ||
    roomType === "Group Room" ||
    roomType === "Large Group Room" ||
    roomType === "Open Collaboration Space"
  )
}

/** Outdoor space types that use dedicated CSV package rubrics. */
export function usesPackageOutdoorRubric(roomType: string | null | undefined): boolean {
  return roomType === "Outdoor Spaces"
}

/** Dedicated package rubrics that should clear answers when switching types. */
export function usesDedicatedSpaceRubric(roomType: string | null | undefined): boolean {
  return (
    usesPackageStudioRubric(roomType) ||
    usesPackageAdminRubric(roomType) ||
    usesPackageArrivalRubric(roomType) ||
    usesPackageNeighborhoodRubric(roomType) ||
    usesPackageOutdoorRubric(roomType)
  )
}

/**
 * Per-room grade is no longer collected; package questions filter by school CLASS instead.
 */
export function studioTypeRequiresGrade(
  _roomType?: string | null,
  _schoolClass?: string | null,
): boolean {
  return false
}

/** Grade picker removed — kept for call-site compatibility. */
export function studioTypeShowsGradePicker(
  _roomType?: string | null,
  _schoolClass?: string | null | undefined,
): boolean {
  return false
}

/** Grade choices for the picker — elementary Traditional: PK–5 only. */
export function gradeOptionsForSchool(
  schoolClass: string | null | undefined,
): readonly (typeof GRADE_OPTIONS)[number][] {
  return GRADE_OPTIONS.filter((g) => g !== "MS" && g !== "HS")
}

/** Campus rollup buckets aligned with ESA scoring focus areas (Table of Surveys). */
export type { ScoringFocusAreaDef, ScoringFocusAreaId, QuestionSetStatus } from "../data/table-of-surveys"

/** Ordered list shown on the campus results rollup. */
export const SCORING_FOCUS_AREAS = SCORING_FOCUS_AREAS_FROM_TABLE

export { scoringFocusAreaLabel }

/** Space types configured under each scoring focus area for the school level. */
export function spaceTypesForScoringFocusArea(
  id: ScoringFocusAreaId,
  schoolClass?: string | null,
): readonly string[] {
  const seen = new Set<string>()
  const types: string[] = []
  for (const surveyType of surveyTypesForSchool(schoolClass)) {
    for (const entry of spaceTypesForSurveyModule(surveyType, schoolClass)) {
      if (entry.scoringFocusAreaId !== id || seen.has(entry.spaceType)) continue
      seen.add(entry.spaceType)
      types.push(entry.spaceType)
    }
  }
  return types
}

/** Map an assessed room to its campus scoring focus area using the Table of Surveys. */
export function scoringFocusAreaForRoom(
  surveyType: SurveyType,
  roomType: string | null | undefined,
  schoolClass?: string | null,
): ScoringFocusAreaId | null {
  return scoringFocusAreaForRoomFromTable(surveyType, roomType, schoolClass)
}

export function surveyTypeForScoringFocusArea(id: ScoringFocusAreaId): SurveyType {
  const match = TABLE_OF_SURVEY_ENTRIES.find((entry) => entry.scoringFocusAreaId === id)
  return match?.surveyType ?? "studios"
}

export {
  isSpaceTypeRequiredForSchool,
  requiredSurveyTypesForSchool,
  spaceTypesForSurveyModule,
  surveyTypesForSchool,
  surveyTypesInSameNavGroup,
  spaceTypeDisplayLabel,
  questionSetStatusForSpaceType,
  isPendingQuestionSet,
  isPlaceholderQuestionSet,
}
