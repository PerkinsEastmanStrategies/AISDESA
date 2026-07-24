import type { SurveyType } from "@aisd/shared"
import { clearQaDemoSchoolData, seedQaDemoSchool, type QaDemoSchoolConfig } from "@/lib/seed-qa-demo-school"

export const ALLISON_ES_DEMO_SCHOOL_ID = "allison"

const ALLISON_CONFIG: QaDemoSchoolConfig = {
  schoolId: ALLISON_ES_DEMO_SCHOOL_ID,
  schoolName: "Allison Elementary",
  campusId: "101",
  schoolClass: "ELEM",
  assessorName: "Maria Chen",
  assessorEmail: "mchen@example.com",
  neighborhood: "B",
  demoPrefix: "ALLISON",
  surveyScores: {
    studios: 64,
    outdoor: 79,
    neighborhoods: 87,
    arrival: 71,
    administration: 83,
    athletics: 69,
  } satisfies Partial<Record<SurveyType, number>>,
  qaReview: {
    reviewerName: "Alex Morgan",
    reviewerEmail: "amorgan@example.com",
    finalizedDaysAgo: 3,
  },
}

/** Remove any prior Allison ES demo drafts (does not clear QA finalization). */
export function clearAllisonEsDemoData(): void {
  clearQaDemoSchoolData(ALLISON_ES_DEMO_SCHOOL_ID)
}

/** Seed local drafts so Allison ES appears in the Finalized bucket. */
export function seedAllisonEsFinalizedDemo(): void {
  seedQaDemoSchool(ALLISON_CONFIG)
}
