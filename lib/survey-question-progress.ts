import type { EsaQuestion, RoomQuestionResponse } from "@aisd/shared"
import { isSkippedDependentQuestion } from "@/lib/question-dependencies"
import { isQuestionFullyAnswered } from "@/lib/survey-validation"

export interface RoomQuestionProgress {
  answered: number
  total: number
  percent: number
}

/** Count answered vs applicable questions for the current room survey. */
export function computeRoomQuestionProgress(
  questions: EsaQuestion[],
  responses: RoomQuestionResponse[],
): RoomQuestionProgress {
  const responseMap = new Map(responses.map((r) => [r.questionId, r]))
  const applicable = questions.filter(
    (q) => !isSkippedDependentQuestion(q.questionId, responses, questions),
  )
  const answered = applicable.filter((q) =>
    isQuestionFullyAnswered(q, responseMap.get(q.questionId)),
  ).length
  const total = applicable.length
  const percent = total > 0 ? Math.round((answered / total) * 100) : 0
  return { answered, total, percent }
}
