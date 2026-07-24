import type { SurveyType } from "@aisd/shared"
import { clearQaDemoSchoolData, seedQaDemoSchool, type QaDemoSchoolConfig } from "@/lib/seed-qa-demo-school"

export const DAVIS_ES_DEMO_SCHOOL_ID = "davis"

const DAVIS_CONFIG: QaDemoSchoolConfig = {
  schoolId: DAVIS_ES_DEMO_SCHOOL_ID,
  schoolName: "Davis Elementary",
  campusId: "179",
  schoolClass: "ELEM",
  assessorName: "Jordan Rivera",
  assessorEmail: "jrivera@example.com",
  neighborhood: "A",
  demoPrefix: "DAVIS",
  surveyScores: {
    studios: 78,
    outdoor: 84,
    neighborhoods: 81,
    arrival: 76,
    administration: 88,
    athletics: 72,
  } satisfies Partial<Record<SurveyType, number>>,
}

/** Remove any prior Davis ES demo drafts (does not clear QA finalization). */
export function clearDavisEsDemoData(): void {
  clearQaDemoSchoolData(DAVIS_ES_DEMO_SCHOOL_ID)
}

/** Seed local drafts so Davis ES appears in the admin QA queue (Ready for QA). */
export function seedDavisEsQaDemo(): void {
  seedQaDemoSchool(DAVIS_CONFIG)
}
