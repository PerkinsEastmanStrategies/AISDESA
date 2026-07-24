/** Generated from AISD_ESA_TableofSurveys.csv — do not edit by hand. */
import type { SurveyType } from "../types/survey"

export type TableSchoolLevel = "ES" | "MS" | "HS"

export type ScoringFocusAreaId =
  | "arrival_main_office"
  | "admin"
  | "early_childhood"
  | "special_education"
  | "studio"
  | "specials"
  | "neighborhood"
  | "athletics_wellness"
  | "shared_spaces"
  | "outdoor_elements"
  | "cte"
  | "performing_arts"

export interface TableOfSurveyEntry {
  surveyFocus: string
  surveyType: SurveyType
  spaceType: string
  spaceTypeRaw: string
  schoolLevel: TableSchoolLevel
  required: boolean
  notes: string
  scoringFocusLabel: string
  scoringFocusAreaId: ScoringFocusAreaId
  spaceTypeWeight: number
  focusAreaWeight: number
}

export interface ScoringFocusAreaDef {
  id: ScoringFocusAreaId
  label: string
  focusAreaWeight: number
}

export const TABLE_OF_SURVEY_ENTRIES: TableOfSurveyEntry[] = [
  { surveyFocus: "Arrival/Main Office", surveyType: "arrival", spaceType: "Main Office", spaceTypeRaw: "Main Entry/Reception", schoolLevel: "ES", required: true, notes: "", scoringFocusLabel: "Arrival/Main Office", scoringFocusAreaId: "arrival_main_office", spaceTypeWeight: 12, focusAreaWeight: 6 },
  { surveyFocus: "Arrival/Main Office", surveyType: "arrival", spaceType: "Main Admin Suite", spaceTypeRaw: "Main Admin Suite", schoolLevel: "ES", required: true, notes: "", scoringFocusLabel: "Arrival/Main Office", scoringFocusAreaId: "arrival_main_office", spaceTypeWeight: 12, focusAreaWeight: 6 },
  { surveyFocus: "Arrival/Main Office", surveyType: "arrival", spaceType: "Community Partner Suite", spaceTypeRaw: "Community Partners Suite", schoolLevel: "ES", required: true, notes: "", scoringFocusLabel: "Arrival/Main Office", scoringFocusAreaId: "arrival_main_office", spaceTypeWeight: 6, focusAreaWeight: 6 },
  { surveyFocus: "Administration", surveyType: "administration", spaceType: "Admin Office", spaceTypeRaw: "Admin Offices", schoolLevel: "ES", required: true, notes: "Assess 2 offices or 3 if there are varying conditions", scoringFocusLabel: "Admin", scoringFocusAreaId: "admin", spaceTypeWeight: 9, focusAreaWeight: 6 },
  { surveyFocus: "Administration", surveyType: "administration", spaceType: "Professional Learning Center", spaceTypeRaw: "Professional Learning Center", schoolLevel: "ES", required: true, notes: "Should be assessed per neighborhood", scoringFocusLabel: "Admin", scoringFocusAreaId: "admin", spaceTypeWeight: 9, focusAreaWeight: 6 },
  { surveyFocus: "Administration", surveyType: "administration", spaceType: "Counseling Suite", spaceTypeRaw: "Mental Wellness and Counseling Suite", schoolLevel: "ES", required: true, notes: "", scoringFocusLabel: "Admin", scoringFocusAreaId: "admin", spaceTypeWeight: 12, focusAreaWeight: 6 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Early childhood studio", spaceTypeRaw: "Early childhood studio", schoolLevel: "ES", required: true, notes: "Assess 1 representative room. Include a 2nd room if conditions vary.", scoringFocusLabel: "Early Childhood", scoringFocusAreaId: "early_childhood", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Early childhood special education studio", spaceTypeRaw: "Early childhood special education studio", schoolLevel: "ES", required: true, notes: "Assess 1 representative room. Include a 2nd room if conditions vary.", scoringFocusLabel: "Special Education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Traditional studio", spaceTypeRaw: "Tranditional Studio", schoolLevel: "ES", required: true, notes: "Two per neighborhood based on medium sized school", scoringFocusLabel: "Studio", scoringFocusAreaId: "studio", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Sped flex studio", spaceTypeRaw: "Sped Flex Studio", schoolLevel: "ES", required: true, notes: "Assess 1 representative room. Include a 2nd room if conditions vary.", scoringFocusLabel: "Special education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Sensory Lab", spaceTypeRaw: "Sensory Lab", schoolLevel: "ES", required: true, notes: "", scoringFocusLabel: "Special education", scoringFocusAreaId: "special_education", spaceTypeWeight: 9, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Life Skills Room", spaceTypeRaw: "Life Skills Room", schoolLevel: "ES", required: false, notes: "", scoringFocusLabel: "Special education", scoringFocusAreaId: "special_education", spaceTypeWeight: 3, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Art", spaceTypeRaw: "Art", schoolLevel: "ES", required: true, notes: "The assessor should review the room that was designed to be an art room", scoringFocusLabel: "Specials", scoringFocusAreaId: "specials", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Music", spaceTypeRaw: "Music", schoolLevel: "ES", required: true, notes: "The assessor should review the room that was designed to be a music room", scoringFocusLabel: "Specials", scoringFocusAreaId: "specials", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Maker space", spaceTypeRaw: "Maker Space", schoolLevel: "ES", required: true, notes: "The assessor should review the room that was designed to be a maker space", scoringFocusLabel: "Specials", scoringFocusAreaId: "specials", spaceTypeWeight: 9, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Science", spaceTypeRaw: "Science", schoolLevel: "ES", required: false, notes: "The assessor should review the room that was designed to be a maker space", scoringFocusLabel: "Specials", scoringFocusAreaId: "specials", spaceTypeWeight: 3, focusAreaWeight: 12 },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Open Collaboration Space", spaceTypeRaw: "Open Collaboration", schoolLevel: "ES", required: true, notes: "Should be assessed per neighborhood", scoringFocusLabel: "Neighborhood", scoringFocusAreaId: "neighborhood", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Group Room", spaceTypeRaw: "Small Group Room", schoolLevel: "ES", required: true, notes: "Should be assessed per neighborhood", scoringFocusLabel: "Neighborhood", scoringFocusAreaId: "neighborhood", spaceTypeWeight: 9, focusAreaWeight: 9 },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Neighborhood", spaceTypeRaw: "Neighborhood", schoolLevel: "ES", required: true, notes: "The assessor should complete for each neighborhood", scoringFocusLabel: "Neighborhood", scoringFocusAreaId: "neighborhood", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Gym", spaceTypeRaw: "Gym", schoolLevel: "ES", required: true, notes: "", scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Media Center", spaceTypeRaw: "Media Center", schoolLevel: "ES", required: true, notes: "", scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Food Service", spaceTypeRaw: "Food Service", schoolLevel: "ES", required: true, notes: "", scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Empower Center", spaceTypeRaw: "Empower Center", schoolLevel: "ES", required: false, notes: "", scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 3, focusAreaWeight: 9 },
  { surveyFocus: "Outdoor Elements", surveyType: "outdoor", spaceType: "Outdoor Spaces", spaceTypeRaw: "Outdoor Spaces", schoolLevel: "ES", required: true, notes: "", scoringFocusLabel: "Outdoor Elements", scoringFocusAreaId: "outdoor_elements", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Arrival/Main Office", surveyType: "arrival", spaceType: "Main Office", spaceTypeRaw: "Main Entry/Reception", schoolLevel: "MS", required: true, notes: "", scoringFocusLabel: "Arrival/Main Office", scoringFocusAreaId: "arrival_main_office", spaceTypeWeight: 12, focusAreaWeight: 6 },
  { surveyFocus: "Arrival/Main Office", surveyType: "arrival", spaceType: "Main Admin Suite", spaceTypeRaw: "Main Admin Suite", schoolLevel: "MS", required: true, notes: "", scoringFocusLabel: "Arrival/Main Office", scoringFocusAreaId: "arrival_main_office", spaceTypeWeight: 12, focusAreaWeight: 6 },
  { surveyFocus: "Arrival/Main Office", surveyType: "arrival", spaceType: "Community Partner Suite", spaceTypeRaw: "Community Partners Suite", schoolLevel: "MS", required: true, notes: "", scoringFocusLabel: "Arrival/Main Office", scoringFocusAreaId: "arrival_main_office", spaceTypeWeight: 6, focusAreaWeight: 6 },
  { surveyFocus: "Administration", surveyType: "administration", spaceType: "Admin Office", spaceTypeRaw: "Admin Offices", schoolLevel: "MS", required: true, notes: "Assess 2 offices or 3 if there are varying conditions", scoringFocusLabel: "Admin", scoringFocusAreaId: "admin", spaceTypeWeight: 9, focusAreaWeight: 6 },
  { surveyFocus: "Administration", surveyType: "administration", spaceType: "Professional Learning Center", spaceTypeRaw: "Professional Learning Center", schoolLevel: "MS", required: true, notes: "Should be assessed per neighborhood", scoringFocusLabel: "Admin", scoringFocusAreaId: "admin", spaceTypeWeight: 9, focusAreaWeight: 6 },
  { surveyFocus: "Administration", surveyType: "administration", spaceType: "Counseling Suite", spaceTypeRaw: "Mental Wellness and Counseling Suite", schoolLevel: "MS", required: true, notes: "", scoringFocusLabel: "Admin", scoringFocusAreaId: "admin", spaceTypeWeight: 12, focusAreaWeight: 6 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Traditional studio", spaceTypeRaw: "Tranditional Studio", schoolLevel: "MS", required: true, notes: "Two per neighborhood", scoringFocusLabel: "Studio", scoringFocusAreaId: "studio", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Sped flex studio", spaceTypeRaw: "Sped Flex Studio", schoolLevel: "MS", required: true, notes: "1 represnetative room, 2 if conditions vary", scoringFocusLabel: "Special Education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Sensory Lab", spaceTypeRaw: "Sensory Lab", schoolLevel: "MS", required: true, notes: "Assess 1 representative room. Include a 2nd room if conditions vary.", scoringFocusLabel: "Special Education", scoringFocusAreaId: "special_education", spaceTypeWeight: 9, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Vocational Lab", spaceTypeRaw: "Vocational Lab", schoolLevel: "MS", required: true, notes: "", scoringFocusLabel: "Special education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Life Skills Room", spaceTypeRaw: "Life Skills Room", schoolLevel: "MS", required: true, notes: "", scoringFocusLabel: "Special education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Science", spaceTypeRaw: "Science", schoolLevel: "MS", required: true, notes: "Assess representative rooms, more if conditions vary", scoringFocusLabel: "Specials", scoringFocusAreaId: "specials", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Art", spaceTypeRaw: "Art", schoolLevel: "MS", required: true, notes: "Assess representative rooms, more if conditions vary", scoringFocusLabel: "Specials", scoringFocusAreaId: "specials", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Music", spaceTypeRaw: "Music", schoolLevel: "MS", required: false, notes: "", scoringFocusLabel: "Specials", scoringFocusAreaId: "specials", spaceTypeWeight: 6, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Maker space", spaceTypeRaw: "Maker Space", schoolLevel: "MS", required: true, notes: "Assess representative rooms, more if conditions vary", scoringFocusLabel: "Specials", scoringFocusAreaId: "specials", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "CTE", surveyType: "cte", spaceType: "CTE", spaceTypeRaw: "CTE", schoolLevel: "MS", required: true, notes: "Assess representative rooms, more if conditions vary", scoringFocusLabel: "CTE", scoringFocusAreaId: "cte", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Theater Arts", spaceTypeRaw: "Theater Arts", schoolLevel: "MS", required: true, notes: "Asses 1", scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Rehearsal Hall", spaceTypeRaw: "Rehersal Hall", schoolLevel: "MS", required: true, notes: "Assess representative rooms, more if conditions vary", scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Black Box", spaceTypeRaw: "Black Box", schoolLevel: "MS", required: false, notes: "", scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 3, focusAreaWeight: 9 },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Auditorium", spaceTypeRaw: "Auditorium", schoolLevel: "MS", required: false, notes: "", scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 3, focusAreaWeight: 9 },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Dance", spaceTypeRaw: "Dance", schoolLevel: "MS", required: false, notes: "", scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 3, focusAreaWeight: 9 },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Open Collaboration Space", spaceTypeRaw: "Open Collaboration", schoolLevel: "MS", required: true, notes: "Should be assessed per neighborhood", scoringFocusLabel: "Neighborhood", scoringFocusAreaId: "neighborhood", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Group Room", spaceTypeRaw: "Small Group Room", schoolLevel: "MS", required: true, notes: "Should be assessed per neighborhood", scoringFocusLabel: "Neighborhood", scoringFocusAreaId: "neighborhood", spaceTypeWeight: 9, focusAreaWeight: 9 },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Large Group Room", spaceTypeRaw: "Large Group Room", schoolLevel: "MS", required: false, notes: "Should be assessed per neighborhood", scoringFocusLabel: "Neighborhood", scoringFocusAreaId: "neighborhood", spaceTypeWeight: 3, focusAreaWeight: 9 },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Neighborhood", spaceTypeRaw: "Neighborhood", schoolLevel: "MS", required: true, notes: "Should be assessed per neighborhood", scoringFocusLabel: "Neighborhood", scoringFocusAreaId: "neighborhood", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Gym", spaceTypeRaw: "Gym", schoolLevel: "MS", required: true, notes: "", scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Competition Gym", spaceTypeRaw: "Competition Gym", schoolLevel: "MS", required: false, notes: "", scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 3, focusAreaWeight: 9 },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Locker Room", spaceTypeRaw: "Locker Room", schoolLevel: "MS", required: true, notes: "", scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 9, focusAreaWeight: 9 },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Weight Room", spaceTypeRaw: "Weight Room", schoolLevel: "MS", required: true, notes: "", scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 9, focusAreaWeight: 9 },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Wrestling", spaceTypeRaw: "Wrestling", schoolLevel: "MS", required: false, notes: "", scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 3, focusAreaWeight: 9 },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Athletics Wing", spaceTypeRaw: "Athletics Wing", schoolLevel: "MS", required: false, notes: "", scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 6, focusAreaWeight: 9 },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Media Center", spaceTypeRaw: "Media Center", schoolLevel: "MS", required: true, notes: "", scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Food Service", spaceTypeRaw: "Food Service", schoolLevel: "MS", required: true, notes: "", scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Empower Center", spaceTypeRaw: "Empower Center", schoolLevel: "MS", required: true, notes: "", scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 9, focusAreaWeight: 9 },
  { surveyFocus: "Outdoor Elements", surveyType: "outdoor", spaceType: "Outdoor Spaces", spaceTypeRaw: "Outdoor Spaces", schoolLevel: "MS", required: true, notes: "", scoringFocusLabel: "Outdoor Elements", scoringFocusAreaId: "outdoor_elements", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Outdoor Elements", surveyType: "outdoor", spaceType: "Outdoor Athletics", spaceTypeRaw: "Outdoor Athletics", schoolLevel: "MS", required: true, notes: "", scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Arrival/Main Office", surveyType: "arrival", spaceType: "Main Office", spaceTypeRaw: "Main Entry/Reception", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Arrival/Main Office", scoringFocusAreaId: "arrival_main_office", spaceTypeWeight: 12, focusAreaWeight: 6 },
  { surveyFocus: "Arrival/Main Office", surveyType: "arrival", spaceType: "Main Admin Suite", spaceTypeRaw: "Main Admin Suite", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Arrival/Main Office", scoringFocusAreaId: "arrival_main_office", spaceTypeWeight: 12, focusAreaWeight: 6 },
  { surveyFocus: "Arrival/Main Office", surveyType: "arrival", spaceType: "Community Partner Suite", spaceTypeRaw: "Community Partners Suite", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Arrival/Main Office", scoringFocusAreaId: "arrival_main_office", spaceTypeWeight: 6, focusAreaWeight: 6 },
  { surveyFocus: "Administration", surveyType: "administration", spaceType: "Admin Office", spaceTypeRaw: "Admin Offices", schoolLevel: "HS", required: true, notes: "Assess 2 offices or 3 if there are varying conditions", scoringFocusLabel: "Admin", scoringFocusAreaId: "admin", spaceTypeWeight: 9, focusAreaWeight: 6 },
  { surveyFocus: "Administration", surveyType: "administration", spaceType: "Professional Learning Center", spaceTypeRaw: "Professional Learning Center", schoolLevel: "HS", required: true, notes: "Per neighborhood", scoringFocusLabel: "Admin", scoringFocusAreaId: "admin", spaceTypeWeight: 9, focusAreaWeight: 6 },
  { surveyFocus: "Administration", surveyType: "administration", spaceType: "Counseling Suite", spaceTypeRaw: "Mental Wellness and Counseling Suite", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Admin", scoringFocusAreaId: "admin", spaceTypeWeight: 12, focusAreaWeight: 6 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Traditional studio", spaceTypeRaw: "Tranditional Studio", schoolLevel: "HS", required: true, notes: "Two per neighborhood based on medium sized school", scoringFocusLabel: "Studio", scoringFocusAreaId: "studio", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Sped flex studio", spaceTypeRaw: "Sped Flex Studio", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Special Education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Sensory Lab", spaceTypeRaw: "Sensory Lab", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Special Education", scoringFocusAreaId: "special_education", spaceTypeWeight: 9, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Vocational Lab", spaceTypeRaw: "Vocational Lab", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Special education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Life Skills Room", spaceTypeRaw: "Life Skills Room", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Special education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Science", spaceTypeRaw: "Science", schoolLevel: "HS", required: true, notes: "Assess representative rooms, more if conditions vary", scoringFocusLabel: "Specials", scoringFocusAreaId: "specials", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Maker space", spaceTypeRaw: "Maker Space", schoolLevel: "HS", required: true, notes: "Assess representative rooms, more if conditions vary", scoringFocusLabel: "Specials", scoringFocusAreaId: "specials", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Art", spaceTypeRaw: "Art", schoolLevel: "HS", required: true, notes: "Assess representative rooms, more if conditions vary", scoringFocusLabel: "Specials", scoringFocusAreaId: "specials", spaceTypeWeight: 12, focusAreaWeight: 12 },
  { surveyFocus: "CTE", surveyType: "cte", spaceType: "CTE", spaceTypeRaw: "CTE", schoolLevel: "HS", required: true, notes: "Assess representative rooms, more if conditions vary", scoringFocusLabel: "CTE", scoringFocusAreaId: "cte", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Rehearsal Hall", spaceTypeRaw: "Rehersal Hall", schoolLevel: "HS", required: true, notes: "Assess representative rooms, more if conditions vary", scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Theater Arts", spaceTypeRaw: "Theater Arts", schoolLevel: "HS", required: true, notes: "Assess 1 representative room. Include a 2nd room if conditions vary.", scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Black Box", spaceTypeRaw: "Black Box", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 3, focusAreaWeight: 9 },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Auditorium", spaceTypeRaw: "Auditorium", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 3, focusAreaWeight: 9 },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Dance", spaceTypeRaw: "Dance", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 3, focusAreaWeight: 9 },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Open Collaboration Space", spaceTypeRaw: "Open Collaboration", schoolLevel: "HS", required: true, notes: "Should be assessed per neighborhood", scoringFocusLabel: "Neighborhood", scoringFocusAreaId: "neighborhood", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Group Room", spaceTypeRaw: "Small Group Room", schoolLevel: "HS", required: true, notes: "Should be assessed per neighborhood", scoringFocusLabel: "Neighborhood", scoringFocusAreaId: "neighborhood", spaceTypeWeight: 9, focusAreaWeight: 9 },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Large Group Room", spaceTypeRaw: "Large Group Room", schoolLevel: "HS", required: true, notes: "Should be assessed per neighborhood", scoringFocusLabel: "Neighborhood", scoringFocusAreaId: "neighborhood", spaceTypeWeight: 9, focusAreaWeight: 9 },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Neighborhood", spaceTypeRaw: "Neighborhood", schoolLevel: "HS", required: true, notes: "Should be assessed per neighborhood", scoringFocusLabel: "Neighborhood", scoringFocusAreaId: "neighborhood", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Gym", spaceTypeRaw: "Gym", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Competition Gym", spaceTypeRaw: "Competition Gym", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 9, focusAreaWeight: 9 },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Locker Room", spaceTypeRaw: "Locker Room", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 9, focusAreaWeight: 9 },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Weight Room", spaceTypeRaw: "Weight Room", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 9, focusAreaWeight: 9 },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Wrestling", spaceTypeRaw: "Wrestling", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 6, focusAreaWeight: 9 },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Athletics Wing", spaceTypeRaw: "Athletics Wing", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 6, focusAreaWeight: 9 },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Media Center", spaceTypeRaw: "Media Center", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Food Service", spaceTypeRaw: "Food Service", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Empower Center", spaceTypeRaw: "Empower Center", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 9, focusAreaWeight: 9 },
  { surveyFocus: "Outdoor", surveyType: "outdoor", spaceType: "Outdoor Spaces", spaceTypeRaw: "Outdoor Spaces", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Outdoor Elements", scoringFocusAreaId: "outdoor_elements", spaceTypeWeight: 12, focusAreaWeight: 9 },
  { surveyFocus: "Outdoor", surveyType: "outdoor", spaceType: "Outdoor Athletics", spaceTypeRaw: "Outdoor Athletics", schoolLevel: "HS", required: true, notes: "", scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 12, focusAreaWeight: 9 },
]

export const SCORING_FOCUS_AREAS_FROM_TABLE: ScoringFocusAreaDef[] = [
  { id: "arrival_main_office", label: "Arrival/Main Office", focusAreaWeight: 6 },
  { id: "admin", label: "Admin", focusAreaWeight: 6 },
  { id: "early_childhood", label: "Early Childhood", focusAreaWeight: 12 },
  { id: "special_education", label: "Special Education", focusAreaWeight: 12 },
  { id: "studio", label: "Studio", focusAreaWeight: 12 },
  { id: "specials", label: "Specials", focusAreaWeight: 12 },
  { id: "neighborhood", label: "Neighborhood", focusAreaWeight: 9 },
  { id: "athletics_wellness", label: "Athletics and Wellness", focusAreaWeight: 9 },
  { id: "shared_spaces", label: "Shared Spaces", focusAreaWeight: 9 },
  { id: "outdoor_elements", label: "Outdoor Elements", focusAreaWeight: 9 },
  { id: "cte", label: "CTE", focusAreaWeight: 9 },
  { id: "performing_arts", label: "Performing Arts", focusAreaWeight: 9 },
]

export const SURVEY_MODULE_ORDER: SurveyType[] = [
  "arrival",
  "administration",
  "studios",
  "neighborhoods",
  "shared_spaces",
  "athletics",
  "outdoor",
  "performing_arts",
  "cte",
  "closeout",
]

export function schoolLevelFromSchoolClass(
  schoolClass: string | null | undefined,
): TableSchoolLevel | null {
  switch (schoolClass) {
    case "ELEM":
      return "ES"
    case "MID":
      return "MS"
    case "HIGH":
      return "HS"
    default:
      return null
  }
}

export function tableEntriesForSchool(
  schoolClass: string | null | undefined,
): TableOfSurveyEntry[] {
  const level = schoolLevelFromSchoolClass(schoolClass)
  if (!level) return TABLE_OF_SURVEY_ENTRIES
  return TABLE_OF_SURVEY_ENTRIES.filter((entry) => entry.schoolLevel === level)
}

export function surveyTypesForSchool(
  schoolClass: string | null | undefined,
): SurveyType[] {
  const level = schoolLevelFromSchoolClass(schoolClass)
  const seen = new Set<SurveyType>()
  const types: SurveyType[] = []
  for (const entry of TABLE_OF_SURVEY_ENTRIES) {
    if (level && entry.schoolLevel !== level) continue
    if (entry.surveyType === "closeout" || seen.has(entry.surveyType)) continue
    seen.add(entry.surveyType)
    types.push(entry.surveyType)
  }
  return types.sort(
    (a, b) => SURVEY_MODULE_ORDER.indexOf(a) - SURVEY_MODULE_ORDER.indexOf(b),
  )
}

export function surveyTypeAvailableForSchoolFromTable(
  type: SurveyType,
  schoolClass: string | null | undefined,
): boolean {
  if (type === "closeout") return true
  return surveyTypesForSchool(schoolClass).includes(type)
}

export function spaceTypesForSurveyModule(
  surveyType: SurveyType,
  schoolClass: string | null | undefined,
): TableOfSurveyEntry[] {
  const level = schoolLevelFromSchoolClass(schoolClass)
  const rows = TABLE_OF_SURVEY_ENTRIES.filter((entry) => {
    if (entry.surveyType !== surveyType) return false
    if (level && entry.schoolLevel !== level) return false
    return true
  })
  const seen = new Set<string>()
  return rows.filter((entry) => {
    if (seen.has(entry.spaceType)) return false
    seen.add(entry.spaceType)
    return true
  })
}

export function lookupTableEntry(
  surveyType: SurveyType,
  spaceType: string | null | undefined,
  schoolClass: string | null | undefined,
): TableOfSurveyEntry | null {
  const level = schoolLevelFromSchoolClass(schoolClass)
  const normalized = spaceType?.trim()
  if (!normalized) return null
  return (
    TABLE_OF_SURVEY_ENTRIES.find(
      (entry) =>
        entry.surveyType === surveyType &&
        entry.spaceType === normalized &&
        (!level || entry.schoolLevel === level),
    ) ?? null
  )
}

export function scoringFocusAreaForRoomFromTable(
  surveyType: SurveyType,
  spaceType: string | null | undefined,
  schoolClass: string | null | undefined,
): ScoringFocusAreaId | null {
  return lookupTableEntry(surveyType, spaceType, schoolClass)?.scoringFocusAreaId ?? null
}

export function scoringFocusAreaLabel(id: ScoringFocusAreaId): string {
  return SCORING_FOCUS_AREAS_FROM_TABLE.find((area) => area.id === id)?.label ?? id
}

export function focusAreaWeightForSchool(
  focusAreaId: ScoringFocusAreaId,
  schoolClass: string | null | undefined,
): number {
  const level = schoolLevelFromSchoolClass(schoolClass)
  const match = TABLE_OF_SURVEY_ENTRIES.find(
    (entry) =>
      entry.scoringFocusAreaId === focusAreaId && (!level || entry.schoolLevel === level),
  )
  return match?.focusAreaWeight ?? 0
}

export function requiredSurveyTypesForSchool(
  schoolClass: string | null | undefined,
): SurveyType[] {
  const level = schoolLevelFromSchoolClass(schoolClass)
  const required = new Set<SurveyType>()
  for (const entry of TABLE_OF_SURVEY_ENTRIES) {
    if (level && entry.schoolLevel !== level) continue
    if (entry.required) required.add(entry.surveyType)
  }
  return [...required].sort(
    (a, b) => SURVEY_MODULE_ORDER.indexOf(a) - SURVEY_MODULE_ORDER.indexOf(b),
  )
}

export function isSpaceTypeRequiredForSchool(
  surveyType: SurveyType,
  spaceType: string,
  schoolClass: string | null | undefined,
): boolean {
  return lookupTableEntry(surveyType, spaceType, schoolClass)?.required ?? false
}
