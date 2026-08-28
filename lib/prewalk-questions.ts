import type { SurveyType } from "@aisd/shared"
import { spaceTypeRequiresExistenceGate } from "@aisd/shared"
import { preWalkSurveyAllowsSpaceTypeExists } from "@/lib/prewalk"

export type PreWalkQuestionId = "spaceTypeExists"

export interface PreWalkSpaceTypeQuestion {
  id: PreWalkQuestionId
  prompt: string
  help: string
}

/**
 * Pre-walk questions for a space type. Add new questions here so they appear in
 * the Pre-answer tab instead of on the mapping type list.
 */
export function preWalkQuestionsForSpaceType(
  surveyType: SurveyType,
  spaceType: string,
): PreWalkSpaceTypeQuestion[] {
  const questions: PreWalkSpaceTypeQuestion[] = []
  if (
    preWalkSurveyAllowsSpaceTypeExists(surveyType) &&
    spaceTypeRequiresExistenceGate(spaceType)
  ) {
    questions.push({
      id: "spaceTypeExists",
      prompt: "Does this space type exist in the building?",
      help: "If not, you can skip this space type for now. You can still open that survey later and change this.",
    })
  }
  return questions
}

export function spaceTypesWithPreWalkQuestions(
  surveyType: SurveyType,
  spaceTypes: readonly string[],
): string[] {
  return spaceTypes.filter((type) => preWalkQuestionsForSpaceType(surveyType, type).length > 0)
}
