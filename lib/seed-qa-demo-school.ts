import type {
  CategoryScore,
  RoomQuestionResponse,
  ScoredRoomEntry,
  SurveySession,
  SurveySubmission,
  SurveyType,
} from "@aisd/shared"
import {
  getRoomSurveyRubric,
  getSurveyRubric,
  OUTDOOR_SURVEY_ROOM_ID,
  surveyTypeAvailableForSchool,
  SURVEY_TYPES,
} from "@aisd/shared"
import { isSkippedDependentQuestion } from "@/lib/question-dependencies"
import { clearQaFinalization, saveQaFinalization } from "@/lib/admin-qa"
import { clearDraft, saveDraft } from "@/lib/survey-persistence"

export interface QaDemoSchoolConfig {
  schoolId: string
  schoolName: string
  campusId: string
  schoolClass: string
  assessorName: string
  assessorEmail: string
  neighborhood: string
  demoPrefix: string
  surveyScores: Partial<Record<SurveyType, number>>
  /** When set, school appears in the Finalized bucket after seeding. */
  qaReview?: {
    reviewerName: string
    reviewerEmail: string
    finalizedDaysAgo?: number
  }
}

function demoCategories(surveyType: SurveyType, overall: number): CategoryScore[] {
  const rubric = getSurveyRubric(surveyType)
  if (!rubric?.categories.length) {
    return [{ category: "Overall", score: overall, weight: 1 }]
  }
  return rubric.categories.map((cat, index) => ({
    category: cat.category,
    score: Math.min(100, Math.max(55, overall + ((index % 3) - 1) * 5)),
    weight: cat.categoryWeight,
  }))
}

function demoScoredRoom(
  config: QaDemoSchoolConfig,
  roomId: string,
  roomName: string,
  overall: number,
  categoryScores: CategoryScore[],
): ScoredRoomEntry {
  return {
    roomId,
    roomName,
    schoolRoomNumber: roomId,
    neighborhood: config.neighborhood,
    levelId: "floor-1",
    gradeType: "3",
    overallScore: overall,
    categoryScores,
    answeredCount: 12,
    totalCount: 12,
    complete: true,
  }
}

function demoCampus(config: QaDemoSchoolConfig, surveyType: SurveyType, overall: number) {
  const categoryScores = demoCategories(surveyType, overall)
  const roomId =
    surveyType === "outdoor"
      ? OUTDOOR_SURVEY_ROOM_ID
      : `${surveyType}-demo-room`
  const roomName =
    surveyType === "outdoor" ? "Outdoor Spaces" : `${surveyType} demo room`
  const rooms = [demoScoredRoom(config, roomId, roomName, overall, categoryScores)]

  return {
    schoolId: config.schoolId,
    schoolName: config.schoolName,
    campusId: config.campusId,
    roomCount: rooms.length,
    scoredRoomCount: rooms.length,
    completeRoomCount: rooms.length,
    overallScore: overall,
    categoryScores,
    neighborhoods: [
      {
        neighborhoodId: config.neighborhood,
        neighborhoodLabel: config.neighborhood,
        roomCount: rooms.length,
        scoredRoomCount: rooms.length,
        overallScore: overall,
        categoryScores,
        rooms,
      },
    ],
    rooms,
  }
}

function demoRoomType(surveyType: SurveyType): string {
  switch (surveyType) {
    case "studios":
      return "Traditional studio"
    case "outdoor":
      return "Outdoor Spaces"
    case "administration":
      return "Admin Office"
    case "arrival":
      return "Main Admin Suite"
    case "neighborhoods":
      return "Neighborhood"
    default:
      return "Athletics"
  }
}

function fillDemoResponses(
  config: QaDemoSchoolConfig,
  surveyType: SurveyType,
  roomType: string,
  gradeType: string,
  targetOverall: number,
): RoomQuestionResponse[] {
  const rubric = getRoomSurveyRubric(surveyType, roomType, gradeType, config.schoolClass)
  if (!rubric) return [{ questionId: "DEMO-001", value: "Yes" }]

  const responses: RoomQuestionResponse[] = []
  for (const question of rubric.questions) {
    if (isSkippedDependentQuestion(question.questionId, responses, rubric.questions)) continue

    const options = rubric.options
      .filter((option) => option.questionId === question.questionId && !option.isExclusionOption)
      .sort((a, b) => a.displayOrder - b.displayOrder)

    if (!options.length) continue

    const pickIndex = Math.min(
      options.length - 1,
      Math.max(0, Math.floor((targetOverall / 100) * options.length)),
    )
    responses.push({
      questionId: question.questionId,
      value: options[pickIndex].option,
    })
  }

  return responses
}

function demoSession(
  config: QaDemoSchoolConfig,
  surveyType: SurveyType,
  submittedAt: string,
): SurveySession {
  const roomId =
    surveyType === "outdoor" ? OUTDOOR_SURVEY_ROOM_ID : `${surveyType}-demo-room`
  const roomType = demoRoomType(surveyType)
  const gradeType = surveyType === "studios" ? "3" : ""
  const overall = config.surveyScores[surveyType] ?? 80

  return {
    surveyId: `AISD-DEMO-${config.demoPrefix}-${surveyType.toUpperCase()}`,
    surveyType,
    schoolId: config.schoolId,
    schoolName: config.schoolName,
    campusId: config.campusId,
    building: "Main",
    assessorName: config.assessorName,
    assessorEmail: config.assessorEmail,
    assessorRegisteredAt: submittedAt,
    startedAt: submittedAt,
    updatedAt: submittedAt,
    submittedAt,
    rooms: {
      [roomId]: {
        roomId,
        roomNumber: roomId,
        roomType,
        gradeType,
        neighborhood: config.neighborhood,
        levelId: "floor-1",
        responses: fillDemoResponses(config, surveyType, roomType, gradeType, overall),
      },
    },
  }
}

function demoSubmission(
  config: QaDemoSchoolConfig,
  surveyType: SurveyType,
  daysAgo: number,
): SurveySubmission {
  const submittedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
  const overall = config.surveyScores[surveyType] ?? 80
  const session = demoSession(config, surveyType, submittedAt)
  return {
    session,
    submittedAt,
    campus: demoCampus(config, surveyType, overall),
    floorPlanRooms: [],
  }
}

function requiredDemoSurveyTypes(schoolClass: string): SurveyType[] {
  return SURVEY_TYPES.filter(
    (type) => type !== "closeout" && surveyTypeAvailableForSchool(type, schoolClass),
  )
}

/** Remove prior demo drafts for a school (does not clear QA finalization). */
export function clearQaDemoSchoolData(schoolId: string): void {
  for (const surveyType of SURVEY_TYPES) {
    clearDraft(schoolId, surveyType)
  }
}

/** Seed local drafts for admin demo data. Clears QA finalization unless `qaReview` is set. */
export function seedQaDemoSchool(config: QaDemoSchoolConfig): void {
  if (typeof window === "undefined") return

  clearQaDemoSchoolData(config.schoolId)
  clearQaFinalization(config.schoolId)

  const surveyTypes = requiredDemoSurveyTypes(config.schoolClass)
  surveyTypes.forEach((surveyType, index) => {
    const submission = demoSubmission(config, surveyType, surveyTypes.length - index)
    saveDraft(
      {
        schoolId: config.schoolId,
        surveyType,
        session: submission.session,
        selectedLevelId: "floor-1",
        lastSubmission: submission,
        savedAt: submission.submittedAt,
      },
      { setActive: false },
    )
  })

  if (config.qaReview) {
    const daysAgo = config.qaReview.finalizedDaysAgo ?? 0
    saveQaFinalization({
      schoolId: config.schoolId,
      reviewerName: config.qaReview.reviewerName,
      reviewerEmail: config.qaReview.reviewerEmail,
      finalizedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    })
  }
}
