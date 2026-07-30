/** Generated from AISD_ESA_Categories.csv — do not edit by hand. */
import type { SurveyType } from "../types/survey"

export type TableSchoolLevel = "ES" | "MS" | "HS"

export type ScoringFocusAreaId =
  | "arrival_administration"
  | "studios"
  | "special_education"
  | "neighborhoods"
  | "athletics_wellness"
  | "shared_spaces"
  | "outdoor_elements"
  | "cte"
  | "performing_arts"

export type QuestionSetStatus = "ready" | "pending" | "placeholder"

export interface TableOfSurveyEntry {
  surveyFocus: string
  surveyType: SurveyType
  spaceType: string
  spaceTypeRaw: string
  schoolLevel: TableSchoolLevel
  required: boolean
  scoringFocusLabel: string
  scoringFocusAreaId: ScoringFocusAreaId
  spaceTypeWeight: number
  focusAreaWeight: number
  scoreCode: string
  questionSetStatus: QuestionSetStatus
}

export interface ScoringFocusAreaDef {
  id: ScoringFocusAreaId
  label: string
  focusAreaWeight: number
}

export const TABLE_OF_SURVEY_ENTRIES: TableOfSurveyEntry[] = [
  { surveyFocus: "Arrival/Administration", surveyType: "arrival", spaceType: "Main Office", spaceTypeRaw: "Main Entry/Reception", schoolLevel: "ES", required: true, scoringFocusLabel: "Arrival/Administration", scoringFocusAreaId: "arrival_administration", spaceTypeWeight: 12, focusAreaWeight: 6, scoreCode: "ME", questionSetStatus: "ready" },
  { surveyFocus: "Arrival/Administration", surveyType: "arrival", spaceType: "Main Admin Suite", spaceTypeRaw: "Main Admin Suite", schoolLevel: "ES", required: true, scoringFocusLabel: "Arrival/Administration", scoringFocusAreaId: "arrival_administration", spaceTypeWeight: 12, focusAreaWeight: 6, scoreCode: "MA", questionSetStatus: "ready" },
  { surveyFocus: "Arrival/Administration", surveyType: "arrival", spaceType: "Community Partner Suite", spaceTypeRaw: "Community Partners Suite", schoolLevel: "ES", required: true, scoringFocusLabel: "Arrival/Administration", scoringFocusAreaId: "arrival_administration", spaceTypeWeight: 12, focusAreaWeight: 6, scoreCode: "CP", questionSetStatus: "ready" },
  { surveyFocus: "Arrival/Administration", surveyType: "administration", spaceType: "Admin Office", spaceTypeRaw: "Admin Offices", schoolLevel: "ES", required: true, scoringFocusLabel: "Arrival/Administration", scoringFocusAreaId: "arrival_administration", spaceTypeWeight: 12, focusAreaWeight: 6, scoreCode: "AD", questionSetStatus: "ready" },
  { surveyFocus: "Arrival/Administration", surveyType: "administration", spaceType: "Professional Learning Center", spaceTypeRaw: "Professional Learning Center", schoolLevel: "ES", required: true, scoringFocusLabel: "Arrival/Administration", scoringFocusAreaId: "arrival_administration", spaceTypeWeight: 12, focusAreaWeight: 6, scoreCode: "PL", questionSetStatus: "ready" },
  { surveyFocus: "Arrival/Administration", surveyType: "administration", spaceType: "Counseling Suite", spaceTypeRaw: "Mental Wellness and Counseling Suite", schoolLevel: "ES", required: true, scoringFocusLabel: "Arrival/Administration", scoringFocusAreaId: "arrival_administration", spaceTypeWeight: 12, focusAreaWeight: 6, scoreCode: "CO", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Early childhood studio", spaceTypeRaw: "Early childhood studio", schoolLevel: "ES", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "PK", questionSetStatus: "ready" },
  { surveyFocus: "Special Education", surveyType: "special_education", spaceType: "Early childhood special education studio", spaceTypeRaw: "Early childhood special education studio", schoolLevel: "ES", required: true, scoringFocusLabel: "Special Education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "PS", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Traditional studio", spaceTypeRaw: "Tranditional Studio", schoolLevel: "ES", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "ST", questionSetStatus: "ready" },
  { surveyFocus: "Special Education", surveyType: "special_education", spaceType: "Sped flex studio", spaceTypeRaw: "SPED Flex Studio", schoolLevel: "ES", required: true, scoringFocusLabel: "Special education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "SP", questionSetStatus: "ready" },
  { surveyFocus: "Special Education", surveyType: "special_education", spaceType: "Special Education Suite", spaceTypeRaw: "Special Education Suite", schoolLevel: "ES", required: true, scoringFocusLabel: "Special Education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "SE", questionSetStatus: "ready" },
  { surveyFocus: "Special Education", surveyType: "special_education", spaceType: "Sensory Lab", spaceTypeRaw: "Sensory Motor Lab", schoolLevel: "ES", required: true, scoringFocusLabel: "Special education", scoringFocusAreaId: "special_education", spaceTypeWeight: 9, focusAreaWeight: 12, scoreCode: "SN", questionSetStatus: "ready" },
  { surveyFocus: "Special Education", surveyType: "special_education", spaceType: "Life Skills Room", spaceTypeRaw: "Life Skills Studio", schoolLevel: "ES", required: false, scoringFocusLabel: "Special education", scoringFocusAreaId: "special_education", spaceTypeWeight: 3, focusAreaWeight: 12, scoreCode: "LS", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Art", spaceTypeRaw: "Art", schoolLevel: "ES", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "EA", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Music Studio", spaceTypeRaw: "Music Studio", schoolLevel: "ES", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "MU", questionSetStatus: "pending" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Maker space", spaceTypeRaw: "Maker Space", schoolLevel: "ES", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "MS", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Science", spaceTypeRaw: "Science", schoolLevel: "ES", required: false, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 3, focusAreaWeight: 12, scoreCode: "SC", questionSetStatus: "ready" },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Open Collaboration Space", spaceTypeRaw: "Open Collaboration", schoolLevel: "ES", required: true, scoringFocusLabel: "Neighborhoods", scoringFocusAreaId: "neighborhoods", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "OC", questionSetStatus: "placeholder" },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Group Room", spaceTypeRaw: "Small Group Room", schoolLevel: "ES", required: true, scoringFocusLabel: "Neighborhoods", scoringFocusAreaId: "neighborhoods", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "SG", questionSetStatus: "placeholder" },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Neighborhood", spaceTypeRaw: "Neighborhood", schoolLevel: "ES", required: true, scoringFocusLabel: "Neighborhoods", scoringFocusAreaId: "neighborhoods", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "NE", questionSetStatus: "placeholder" },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Gym", spaceTypeRaw: "Gym", schoolLevel: "ES", required: true, scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "GY", questionSetStatus: "ready" },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Media Center", spaceTypeRaw: "Library Media Center", schoolLevel: "ES", required: true, scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "MC", questionSetStatus: "ready" },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Food Service", spaceTypeRaw: "Food Service", schoolLevel: "ES", required: true, scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "FS", questionSetStatus: "pending" },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Empower Center", spaceTypeRaw: "Empower Center", schoolLevel: "ES", required: false, scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 3, focusAreaWeight: 9, scoreCode: "EC", questionSetStatus: "pending" },
  { surveyFocus: "Outdoor Elements", surveyType: "outdoor", spaceType: "Outdoor Spaces", spaceTypeRaw: "Outdoor Spaces", schoolLevel: "ES", required: true, scoringFocusLabel: "Outdoor Elements", scoringFocusAreaId: "outdoor_elements", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "OS", questionSetStatus: "ready" },
  { surveyFocus: "Arrival/Administration", surveyType: "arrival", spaceType: "Main Office", spaceTypeRaw: "Main Entry/Reception", schoolLevel: "MS", required: true, scoringFocusLabel: "Arrival/Administration", scoringFocusAreaId: "arrival_administration", spaceTypeWeight: 12, focusAreaWeight: 6, scoreCode: "ME", questionSetStatus: "ready" },
  { surveyFocus: "Arrival/Administration", surveyType: "arrival", spaceType: "Main Admin Suite", spaceTypeRaw: "Main Admin Suite", schoolLevel: "MS", required: true, scoringFocusLabel: "Arrival/Administration", scoringFocusAreaId: "arrival_administration", spaceTypeWeight: 12, focusAreaWeight: 6, scoreCode: "MA", questionSetStatus: "ready" },
  { surveyFocus: "Arrival/Administration", surveyType: "arrival", spaceType: "Community Partner Suite", spaceTypeRaw: "Community Partners Suite", schoolLevel: "MS", required: true, scoringFocusLabel: "Arrival/Administration", scoringFocusAreaId: "arrival_administration", spaceTypeWeight: 12, focusAreaWeight: 6, scoreCode: "CP", questionSetStatus: "ready" },
  { surveyFocus: "Arrival/Administration", surveyType: "administration", spaceType: "Admin Office", spaceTypeRaw: "Admin Offices", schoolLevel: "MS", required: true, scoringFocusLabel: "Arrival/Administration", scoringFocusAreaId: "arrival_administration", spaceTypeWeight: 12, focusAreaWeight: 6, scoreCode: "AD", questionSetStatus: "ready" },
  { surveyFocus: "Arrival/Administration", surveyType: "administration", spaceType: "Professional Learning Center", spaceTypeRaw: "Professional Learning Center", schoolLevel: "MS", required: true, scoringFocusLabel: "Arrival/Administration", scoringFocusAreaId: "arrival_administration", spaceTypeWeight: 12, focusAreaWeight: 6, scoreCode: "PL", questionSetStatus: "ready" },
  { surveyFocus: "Arrival/Administration", surveyType: "administration", spaceType: "Counseling Suite", spaceTypeRaw: "Mental Wellness and Counseling Suite", schoolLevel: "MS", required: true, scoringFocusLabel: "Arrival/Administration", scoringFocusAreaId: "arrival_administration", spaceTypeWeight: 12, focusAreaWeight: 6, scoreCode: "CO", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Traditional studio", spaceTypeRaw: "Tranditional Studio", schoolLevel: "MS", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "ST", questionSetStatus: "ready" },
  { surveyFocus: "Special Education", surveyType: "special_education", spaceType: "Sped flex studio", spaceTypeRaw: "SPED Flex Studio", schoolLevel: "MS", required: true, scoringFocusLabel: "Special Education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "SP", questionSetStatus: "ready" },
  { surveyFocus: "Special Education", surveyType: "special_education", spaceType: "Special Education Suite", spaceTypeRaw: "Special Education Suite", schoolLevel: "MS", required: true, scoringFocusLabel: "Special Education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "SE", questionSetStatus: "ready" },
  { surveyFocus: "Special Education", surveyType: "special_education", spaceType: "Sensory Lab", spaceTypeRaw: "Sensory Motor Lab", schoolLevel: "MS", required: true, scoringFocusLabel: "Special Education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "SN", questionSetStatus: "ready" },
  { surveyFocus: "Special Education", surveyType: "special_education", spaceType: "Vocational Lab", spaceTypeRaw: "Vocational Lab", schoolLevel: "MS", required: true, scoringFocusLabel: "Special education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "VO", questionSetStatus: "ready" },
  { surveyFocus: "Special Education", surveyType: "special_education", spaceType: "Life Skills Room", spaceTypeRaw: "Life Skills Studio", schoolLevel: "MS", required: true, scoringFocusLabel: "Special education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "LS", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Science", spaceTypeRaw: "Science", schoolLevel: "MS", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "SC", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Science Prep Room", spaceTypeRaw: "Science Prep Room", schoolLevel: "MS", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "SI", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "2D Art Studio", spaceTypeRaw: "2D Art Studio", schoolLevel: "MS", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "TW", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "3D Art Studio", spaceTypeRaw: "3D Art Studio", schoolLevel: "MS", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "TH", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Digital Art Studio", spaceTypeRaw: "Digital Art Studio", schoolLevel: "MS", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "DA", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Music", spaceTypeRaw: "Music", schoolLevel: "MS", required: false, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 3, focusAreaWeight: 12, scoreCode: "MU", questionSetStatus: "pending" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Maker space", spaceTypeRaw: "Maker Space", schoolLevel: "MS", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "MS", questionSetStatus: "ready" },
  { surveyFocus: "CTE", surveyType: "cte", spaceType: "CTE", spaceTypeRaw: "CTE", schoolLevel: "MS", required: true, scoringFocusLabel: "CTE", scoringFocusAreaId: "cte", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "CT", questionSetStatus: "pending" },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Theater Arts", spaceTypeRaw: "Theater Arts Studio", schoolLevel: "MS", required: true, scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "TA", questionSetStatus: "ready" },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Rehearsal Hall", spaceTypeRaw: "Rehersal Hall", schoolLevel: "MS", required: true, scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "RH", questionSetStatus: "pending" },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Music Suite", spaceTypeRaw: "Music Suite", schoolLevel: "MS", required: true, scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "MT", questionSetStatus: "pending" },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Black Box", spaceTypeRaw: "Black Box", schoolLevel: "MS", required: false, scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 3, focusAreaWeight: 9, scoreCode: "BB", questionSetStatus: "ready" },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Auditorium", spaceTypeRaw: "Auditorium", schoolLevel: "MS", required: false, scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 3, focusAreaWeight: 9, scoreCode: "AU", questionSetStatus: "ready" },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Dance", spaceTypeRaw: "Dance", schoolLevel: "MS", required: false, scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 3, focusAreaWeight: 9, scoreCode: "DN", questionSetStatus: "ready" },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Open Collaboration Space", spaceTypeRaw: "Open Collaboration", schoolLevel: "MS", required: true, scoringFocusLabel: "Neighborhoods", scoringFocusAreaId: "neighborhoods", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "OC", questionSetStatus: "placeholder" },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Group Room", spaceTypeRaw: "Small Group Room", schoolLevel: "MS", required: true, scoringFocusLabel: "Neighborhoods", scoringFocusAreaId: "neighborhoods", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "SG", questionSetStatus: "placeholder" },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Large Group Room", spaceTypeRaw: "Large Group Room", schoolLevel: "MS", required: false, scoringFocusLabel: "Neighborhoods", scoringFocusAreaId: "neighborhoods", spaceTypeWeight: 3, focusAreaWeight: 9, scoreCode: "LG", questionSetStatus: "placeholder" },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Neighborhood", spaceTypeRaw: "Neighborhood", schoolLevel: "MS", required: true, scoringFocusLabel: "Neighborhoods", scoringFocusAreaId: "neighborhoods", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "NE", questionSetStatus: "placeholder" },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Multi-Purpose Gym", spaceTypeRaw: "Multi-Purpose Gym", schoolLevel: "MS", required: true, scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "MG", questionSetStatus: "ready" },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Practice Gym", spaceTypeRaw: "Practice Gym", schoolLevel: "MS", required: true, scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "PG", questionSetStatus: "ready" },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Locker Room", spaceTypeRaw: "Locker Room", schoolLevel: "MS", required: true, scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "LR", questionSetStatus: "ready" },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Weight Room", spaceTypeRaw: "Weight Room", schoolLevel: "MS", required: true, scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "WE", questionSetStatus: "ready" },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Wrestling", spaceTypeRaw: "Wrestling", schoolLevel: "MS", required: false, scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 3, focusAreaWeight: 9, scoreCode: "WR", questionSetStatus: "ready" },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "PE Fitness Room", spaceTypeRaw: "PE Fitness Room", schoolLevel: "MS", required: false, scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 3, focusAreaWeight: 9, scoreCode: "PF", questionSetStatus: "ready" },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Athletics Wing", spaceTypeRaw: "Athletics Wing", schoolLevel: "MS", required: false, scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 3, focusAreaWeight: 9, scoreCode: "AT", questionSetStatus: "ready" },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Media Center", spaceTypeRaw: "Library Media Center", schoolLevel: "MS", required: true, scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "MC", questionSetStatus: "ready" },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Food Service", spaceTypeRaw: "Food Service", schoolLevel: "MS", required: true, scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "FS", questionSetStatus: "pending" },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Empower Center", spaceTypeRaw: "Empower Center", schoolLevel: "MS", required: true, scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "EC", questionSetStatus: "pending" },
  { surveyFocus: "Outdoor Elements", surveyType: "outdoor", spaceType: "Outdoor Spaces", spaceTypeRaw: "Outdoor Spaces", schoolLevel: "MS", required: true, scoringFocusLabel: "Outdoor Elements", scoringFocusAreaId: "outdoor_elements", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "OS", questionSetStatus: "ready" },
  { surveyFocus: "Outdoor Elements", surveyType: "outdoor", spaceType: "Outdoor Athletics", spaceTypeRaw: "Outdoor Athletics", schoolLevel: "MS", required: true, scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "OA", questionSetStatus: "ready" },
  { surveyFocus: "Arrival/Administration", surveyType: "arrival", spaceType: "Main Office", spaceTypeRaw: "Main Entry/Reception", schoolLevel: "HS", required: true, scoringFocusLabel: "Arrival/Administration", scoringFocusAreaId: "arrival_administration", spaceTypeWeight: 12, focusAreaWeight: 6, scoreCode: "ME", questionSetStatus: "ready" },
  { surveyFocus: "Arrival/Administration", surveyType: "arrival", spaceType: "Main Admin Suite", spaceTypeRaw: "Main Admin Suite", schoolLevel: "HS", required: true, scoringFocusLabel: "Arrival/Administration", scoringFocusAreaId: "arrival_administration", spaceTypeWeight: 12, focusAreaWeight: 6, scoreCode: "MA", questionSetStatus: "ready" },
  { surveyFocus: "Arrival/Administration", surveyType: "arrival", spaceType: "Community Partner Suite", spaceTypeRaw: "Community Partners Suite", schoolLevel: "HS", required: true, scoringFocusLabel: "Arrival/Administration", scoringFocusAreaId: "arrival_administration", spaceTypeWeight: 12, focusAreaWeight: 6, scoreCode: "CP", questionSetStatus: "ready" },
  { surveyFocus: "Arrival/Administration", surveyType: "administration", spaceType: "Admin Office", spaceTypeRaw: "Admin Offices", schoolLevel: "HS", required: true, scoringFocusLabel: "Arrival/Administration", scoringFocusAreaId: "arrival_administration", spaceTypeWeight: 12, focusAreaWeight: 6, scoreCode: "AD", questionSetStatus: "ready" },
  { surveyFocus: "Arrival/Administration", surveyType: "administration", spaceType: "Professional Learning Center", spaceTypeRaw: "Professional Learning Center", schoolLevel: "HS", required: true, scoringFocusLabel: "Arrival/Administration", scoringFocusAreaId: "arrival_administration", spaceTypeWeight: 12, focusAreaWeight: 6, scoreCode: "PL", questionSetStatus: "ready" },
  { surveyFocus: "Arrival/Administration", surveyType: "administration", spaceType: "Counseling Suite", spaceTypeRaw: "Mental Wellness and Counseling Suite", schoolLevel: "HS", required: true, scoringFocusLabel: "Arrival/Administration", scoringFocusAreaId: "arrival_administration", spaceTypeWeight: 12, focusAreaWeight: 6, scoreCode: "CO", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Traditional studio", spaceTypeRaw: "Tranditional Studio", schoolLevel: "HS", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "ST", questionSetStatus: "ready" },
  { surveyFocus: "Special Education", surveyType: "special_education", spaceType: "Sped flex studio", spaceTypeRaw: "SPED Flex Studio", schoolLevel: "HS", required: true, scoringFocusLabel: "Special Education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "SP", questionSetStatus: "ready" },
  { surveyFocus: "Special Education", surveyType: "special_education", spaceType: "Special Education Suite", spaceTypeRaw: "Special Education Suite", schoolLevel: "HS", required: true, scoringFocusLabel: "Special Education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "SE", questionSetStatus: "ready" },
  { surveyFocus: "Special Education", surveyType: "special_education", spaceType: "Sensory Lab", spaceTypeRaw: "Sensory Motor Lab", schoolLevel: "HS", required: true, scoringFocusLabel: "Special Education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "SN", questionSetStatus: "ready" },
  { surveyFocus: "Special Education", surveyType: "special_education", spaceType: "Vocational Lab", spaceTypeRaw: "Vocational Lab", schoolLevel: "HS", required: true, scoringFocusLabel: "Special education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "VO", questionSetStatus: "ready" },
  { surveyFocus: "Special Education", surveyType: "special_education", spaceType: "Life Skills Room", spaceTypeRaw: "Life Skills Studio", schoolLevel: "HS", required: true, scoringFocusLabel: "Special education", scoringFocusAreaId: "special_education", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "LS", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Science", spaceTypeRaw: "Science", schoolLevel: "HS", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "SC", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Science Prep Room", spaceTypeRaw: "Science Prep Room", schoolLevel: "HS", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "SI", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Maker space", spaceTypeRaw: "Maker Space", schoolLevel: "HS", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "MS", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "2D Art Studio", spaceTypeRaw: "2D Art Studio", schoolLevel: "HS", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "TW", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "3D Art Studio", spaceTypeRaw: "3D Art Studio", schoolLevel: "HS", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "TH", questionSetStatus: "ready" },
  { surveyFocus: "Studios", surveyType: "studios", spaceType: "Digital Art Studio", spaceTypeRaw: "Digital Art Studio", schoolLevel: "HS", required: true, scoringFocusLabel: "Studios", scoringFocusAreaId: "studios", spaceTypeWeight: 12, focusAreaWeight: 12, scoreCode: "DA", questionSetStatus: "ready" },
  { surveyFocus: "CTE", surveyType: "cte", spaceType: "CTE", spaceTypeRaw: "CTE", schoolLevel: "HS", required: true, scoringFocusLabel: "CTE", scoringFocusAreaId: "cte", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "CT", questionSetStatus: "pending" },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Rehearsal Hall", spaceTypeRaw: "Rehersal Hall", schoolLevel: "HS", required: true, scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "RH", questionSetStatus: "pending" },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Music Suite", spaceTypeRaw: "Music Suite", schoolLevel: "HS", required: true, scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "MT", questionSetStatus: "pending" },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Theater Arts", spaceTypeRaw: "Theater Arts Studio", schoolLevel: "HS", required: true, scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "TA", questionSetStatus: "ready" },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Black Box", spaceTypeRaw: "Black Box", schoolLevel: "HS", required: true, scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "BB", questionSetStatus: "ready" },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Auditorium", spaceTypeRaw: "Auditorium", schoolLevel: "HS", required: true, scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "AU", questionSetStatus: "ready" },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Dance", spaceTypeRaw: "Dance", schoolLevel: "HS", required: true, scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "DA", questionSetStatus: "ready" },
  { surveyFocus: "Performing Arts", surveyType: "performing_arts", spaceType: "Theater Arts Suite", spaceTypeRaw: "Theater Arts Suite", schoolLevel: "HS", required: true, scoringFocusLabel: "Performing Arts", scoringFocusAreaId: "performing_arts", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "TS", questionSetStatus: "ready" },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Open Collaboration Space", spaceTypeRaw: "Open Collaboration", schoolLevel: "HS", required: true, scoringFocusLabel: "Neighborhoods", scoringFocusAreaId: "neighborhoods", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "OC", questionSetStatus: "placeholder" },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Group Room", spaceTypeRaw: "Small Group Room", schoolLevel: "HS", required: true, scoringFocusLabel: "Neighborhoods", scoringFocusAreaId: "neighborhoods", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "SG", questionSetStatus: "placeholder" },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Large Group Room", spaceTypeRaw: "Large Group Room", schoolLevel: "HS", required: true, scoringFocusLabel: "Neighborhoods", scoringFocusAreaId: "neighborhoods", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "LG", questionSetStatus: "placeholder" },
  { surveyFocus: "Neighborhoods", surveyType: "neighborhoods", spaceType: "Neighborhood", spaceTypeRaw: "Neighborhood", schoolLevel: "HS", required: true, scoringFocusLabel: "Neighborhoods", scoringFocusAreaId: "neighborhoods", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "NE", questionSetStatus: "placeholder" },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Multi-Purpose Gym", spaceTypeRaw: "Multi-Purpose Gym", schoolLevel: "HS", required: true, scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "MG", questionSetStatus: "ready" },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Competition Gym", spaceTypeRaw: "Competition Gym", schoolLevel: "HS", required: true, scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "CG", questionSetStatus: "ready" },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Locker Room", spaceTypeRaw: "Locker Room", schoolLevel: "HS", required: true, scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "LR", questionSetStatus: "ready" },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Weight Room", spaceTypeRaw: "Weight Room", schoolLevel: "HS", required: true, scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "WE", questionSetStatus: "ready" },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Wrestling", spaceTypeRaw: "Wrestling", schoolLevel: "HS", required: true, scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "WR", questionSetStatus: "ready" },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "PE Fitness Room", spaceTypeRaw: "PE Fitness Room", schoolLevel: "HS", required: true, scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "PF", questionSetStatus: "ready" },
  { surveyFocus: "Athletics and Wellness", surveyType: "athletics", spaceType: "Athletics Wing", spaceTypeRaw: "Athletics Wing", schoolLevel: "HS", required: true, scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "AT", questionSetStatus: "ready" },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Media Center", spaceTypeRaw: "Library Media Center", schoolLevel: "HS", required: true, scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "MC", questionSetStatus: "ready" },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Food Service", spaceTypeRaw: "Food Service", schoolLevel: "HS", required: true, scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "FS", questionSetStatus: "pending" },
  { surveyFocus: "Shared Spaces", surveyType: "shared_spaces", spaceType: "Empower Center", spaceTypeRaw: "Empower Center", schoolLevel: "HS", required: true, scoringFocusLabel: "Shared Spaces", scoringFocusAreaId: "shared_spaces", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "EC", questionSetStatus: "pending" },
  { surveyFocus: "Outdoor", surveyType: "outdoor", spaceType: "Outdoor Spaces", spaceTypeRaw: "Outdoor Spaces", schoolLevel: "HS", required: true, scoringFocusLabel: "Outdoor Elements", scoringFocusAreaId: "outdoor_elements", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "OS", questionSetStatus: "ready" },
  { surveyFocus: "Outdoor", surveyType: "outdoor", spaceType: "Outdoor Athletics", spaceTypeRaw: "Outdoor Athletics", schoolLevel: "HS", required: true, scoringFocusLabel: "Athletics and Wellness", scoringFocusAreaId: "athletics_wellness", spaceTypeWeight: 12, focusAreaWeight: 9, scoreCode: "OA", questionSetStatus: "ready" },
]

export const SCORING_FOCUS_AREAS_FROM_TABLE: ScoringFocusAreaDef[] = [
  { id: "arrival_administration", label: "Arrival/Administration", focusAreaWeight: 6 },
  { id: "studios", label: "Studios", focusAreaWeight: 12 },
  { id: "special_education", label: "Special Education", focusAreaWeight: 12 },
  { id: "neighborhoods", label: "Neighborhoods", focusAreaWeight: 9 },
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
  "special_education",
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

const SPACE_TYPE_ALIASES = {
  Gym: "Multi-Purpose Gym",
  "Competition Gym": "Multi-Purpose Gym",
} as const

export function lookupTableEntry(
  surveyType: SurveyType,
  spaceType: string | null | undefined,
  schoolClass: string | null | undefined,
): TableOfSurveyEntry | null {
  const level = schoolLevelFromSchoolClass(schoolClass)
  const normalized = spaceType?.trim()
  if (!normalized) return null

  const candidates = [normalized]
  const alias = SPACE_TYPE_ALIASES[normalized as keyof typeof SPACE_TYPE_ALIASES]
  if (alias) candidates.push(alias)

  for (const candidate of candidates) {
    const match = TABLE_OF_SURVEY_ENTRIES.find(
      (entry) =>
        entry.surveyType === surveyType &&
        entry.spaceType === candidate &&
        (!level || entry.schoolLevel === level),
    )
    if (match) return match
  }

  return null
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

export function scoreCodeForSpaceType(
  surveyType: SurveyType,
  spaceType: string,
  schoolClass: string | null | undefined,
): string | null {
  return lookupTableEntry(surveyType, spaceType, schoolClass)?.scoreCode ?? null
}

export function surveyFocusForSurveyType(
  surveyType: SurveyType,
  schoolClass: string | null | undefined,
): string | null {
  const level = schoolLevelFromSchoolClass(schoolClass)
  const entry = TABLE_OF_SURVEY_ENTRIES.find(
    (row) => row.surveyType === surveyType && (!level || row.schoolLevel === level),
  )
  return entry?.surveyFocus ?? null
}

/** Internal survey modules that share one sidebar entry (CSV survey focus area). */
export function surveyTypesInSameNavGroup(
  surveyType: SurveyType,
  schoolClass: string | null | undefined,
): SurveyType[] {
  const focus = surveyFocusForSurveyType(surveyType, schoolClass)?.trim()
  if (!focus) return [surveyType]
  const level = schoolLevelFromSchoolClass(schoolClass)
  const types = new Set<SurveyType>()
  for (const entry of TABLE_OF_SURVEY_ENTRIES) {
    if (entry.surveyFocus.trim() !== focus) continue
    if (level && entry.schoolLevel !== level) continue
    types.add(entry.surveyType)
  }
  const ordered = SURVEY_MODULE_ORDER.filter((type) => types.has(type))
  return ordered.length ? ordered : [surveyType]
}

/** One sidebar item per CSV survey focus area. */
export function surveyNavTypesForSchool(
  schoolClass: string | null | undefined,
): SurveyType[] {
  const level = schoolLevelFromSchoolClass(schoolClass)
  const primaryTypeByFocus = new Map<string, SurveyType>()

  for (const type of SURVEY_MODULE_ORDER) {
    const hasEntry = TABLE_OF_SURVEY_ENTRIES.some(
      (entry) => entry.surveyType === type && (!level || entry.schoolLevel === level),
    )
    if (!hasEntry) continue

    const focus = surveyFocusForSurveyType(type, schoolClass)?.trim()
    if (!focus) {
      primaryTypeByFocus.set(`__${type}`, type)
      continue
    }

    if (!primaryTypeByFocus.has(focus)) {
      primaryTypeByFocus.set(focus, type)
    }
  }

  const navTypes: SurveyType[] = []
  for (const type of SURVEY_MODULE_ORDER) {
    const focus = surveyFocusForSurveyType(type, schoolClass)?.trim()
    if (!focus) {
      if (primaryTypeByFocus.get(`__${type}`) === type) navTypes.push(type)
      continue
    }
    if (primaryTypeByFocus.get(focus) === type) navTypes.push(type)
  }

  if (!navTypes.includes("closeout")) {
    navTypes.push("closeout")
  }

  return navTypes
}

export function questionSetStatusForSpaceType(
  surveyType: SurveyType,
  spaceType: string,
  schoolClass: string | null | undefined,
): QuestionSetStatus {
  return lookupTableEntry(surveyType, spaceType, schoolClass)?.questionSetStatus ?? "ready"
}

export function spaceTypeDisplayLabel(
  surveyType: SurveyType,
  spaceType: string,
  schoolClass: string | null | undefined,
): string {
  const entry = lookupTableEntry(surveyType, spaceType, schoolClass)
  if (!entry) return spaceType
  if (entry.questionSetStatus === "placeholder") {
    return `${spaceType} (placeholder questions)`
  }
  if (entry.questionSetStatus === "pending") {
    return `${spaceType} (pending)`
  }
  return spaceType
}

export function isPendingQuestionSet(
  surveyType: SurveyType,
  spaceType: string,
  schoolClass: string | null | undefined,
): boolean {
  return questionSetStatusForSpaceType(surveyType, spaceType, schoolClass) === "pending"
}

export function isPlaceholderQuestionSet(
  surveyType: SurveyType,
  spaceType: string,
  schoolClass: string | null | undefined,
): boolean {
  return questionSetStatusForSpaceType(surveyType, spaceType, schoolClass) === "placeholder"
}

export function lookupTableEntryBySpaceType(
  spaceType: string | null | undefined,
  schoolClass: string | null | undefined,
): TableOfSurveyEntry | null {
  const level = schoolLevelFromSchoolClass(schoolClass)
  const normalized = spaceType?.trim()
  if (!normalized) return null

  const candidates = [normalized]
  const alias = SPACE_TYPE_ALIASES[normalized as keyof typeof SPACE_TYPE_ALIASES]
  if (alias) candidates.push(alias)

  for (const candidate of candidates) {
    const match = TABLE_OF_SURVEY_ENTRIES.find(
      (entry) =>
        entry.spaceType === candidate && (!level || entry.schoolLevel === level),
    )
    if (match) return match
  }

  return null
}
