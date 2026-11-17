import type { TableOfSurveyEntry } from "./table-of-surveys"

/** Campus identity used to attach one-off space types without changing every ES/MS/HS table. */
export type SchoolTableRef = {
  id?: string | null
  name?: string | null
  campusId?: string | null
}

export function isRosedaleSchool(school?: SchoolTableRef | string | null): boolean {
  if (!school) return false
  if (typeof school === "string") {
    const key = school.trim().toUpperCase()
    return key === "ROSEDALE" || key === "ROSEDALE SCHOOL" || key === "251"
  }
  const id = school.id?.trim().toLowerCase() ?? ""
  const campusId = school.campusId?.trim() ?? ""
  const name = school.name?.trim().toUpperCase() ?? ""
  return (
    id === "rosedale" ||
    campusId === "251" ||
    name === "ROSEDALE" ||
    name === "ROSEDALE SCHOOL"
  )
}

/**
 * Vocational Lab is an MS/HS studio in the Table of Surveys. Rosedale uses the ES module
 * set and still needs this one secondary space type in Studios.
 */
const ROSEDALE_VOCATIONAL_LAB: TableOfSurveyEntry = {
  surveyFocus: "Special Education",
  surveyType: "studios",
  spaceType: "Vocational Lab",
  spaceTypeRaw: "Vocational Lab",
  schoolLevel: "ES",
  required: true,
  minimumSurveyCount: 1,
  scoringFocusLabel: "Special education",
  scoringFocusAreaId: "special_education",
  spaceTypeWeight: 12,
  focusAreaWeight: 12,
  scoreCode: "VO",
}

export function extraTableEntriesForSchool(
  school?: SchoolTableRef | null,
): TableOfSurveyEntry[] {
  if (!isRosedaleSchool(school)) return []
  return [ROSEDALE_VOCATIONAL_LAB]
}
