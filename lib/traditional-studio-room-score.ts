import type {
  EsaQuestion,
  EsaQuestionOption,
  RoomQuestionResponse,
  RoomScoreResult,
  RoomSurveySession,
} from "@aisd/shared"
import {
  isTraditionalStudioRoomType,
  mergeTraditionalStudioSizeScore,
  mergeRubricWeights,
  scoreRoom,
  type EsaCategory,
  type EsaSubcategory,
  type WeightOverrides,
} from "@aisd/shared"
import { isSkippedDependentQuestion } from "@/lib/question-dependencies"

export function resolveRoomAreaSqft(
  roomSession: RoomSurveySession,
  planRoom?: { areaSqft?: number | null },
): number | null {
  if (roomSession.areaSqft != null && roomSession.areaSqft > 0) return roomSession.areaSqft
  if (planRoom?.areaSqft != null && planRoom.areaSqft > 0) return planRoom.areaSqft
  return null
}

/** Zero score for a space type marked not present at the school or neighborhood. */
export function scoreAbsentSpaceTypeRoom(roomId: string): RoomScoreResult {
  return {
    roomId,
    overallScore: 0,
    categoryScores: [],
    subcategoryScores: [],
    questionScores: [],
    answeredCount: 1,
    totalCount: 1,
  }
}

export function scoreRoomSessionWithMetadata(
  roomSession: RoomSurveySession,
  rubric: {
    assessmentArea: string
    categories: EsaCategory[]
    subcategories: EsaSubcategory[]
    questions: EsaQuestion[]
    options: EsaQuestionOption[]
  },
  weightOverrides: WeightOverrides,
  planRoom?: { areaSqft?: number | null },
): RoomScoreResult {
  const weights = mergeRubricWeights(rubric, weightOverrides)
  const skippedQuestionIds = rubric.questions
    .filter((q) => isSkippedDependentQuestion(q.questionId, roomSession.responses, rubric.questions))
    .map((q) => q.questionId)

  let result = scoreRoom(
    roomSession.responses,
    weights.questions,
    weights.categories,
    weights.subcategories,
    rubric.options,
    rubric.assessmentArea,
    skippedQuestionIds,
  )

  if (isTraditionalStudioRoomType(roomSession.roomType)) {
    result = mergeTraditionalStudioSizeScore(
      result,
      resolveRoomAreaSqft(roomSession, planRoom),
      weights.categories,
      weights.subcategories,
    )
  }

  return result
}
