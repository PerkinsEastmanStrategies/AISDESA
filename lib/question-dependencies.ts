import type { EsaQuestion, RoomQuestionResponse } from "@aisd/shared"

/** When answered "No", all following questions in the rubric are skipped. */
export const SPACE_TYPE_PRESENT_QUESTION = "Is this space type present at the school?"

export function isSpaceTypePresentQuestion(
  question: Pick<EsaQuestion, "question">,
): boolean {
  return question.question.trim() === SPACE_TYPE_PRESENT_QUESTION
}

export function isDedicatedSpaceAvailabilityQuestion(
  question: Pick<EsaQuestion, "question">,
): boolean {
  const text = question.question.trim()
  if (text.toLowerCase().includes("peace center")) return false
  return text.startsWith("Is there a dedicated")
}

/** When answered "No", all following questions in the rubric are skipped. */
export function skipsAllRemainingQuestionsOnNo(
  question: Pick<EsaQuestion, "question">,
): boolean {
  return (
    isSpaceTypePresentQuestion(question) ||
    isDedicatedSpaceAvailabilityQuestion(question)
  )
}

/** Parent answer → auto-fill a dependent question (kept in scoring; locked in UI). */
const AUTO_ANSWER_RULES: ReadonlyArray<{
  parentId: string
  parentValue: string
  dependentId: string
  dependentValue: string
  reason: string
}> = [
  {
    parentId: "ST-009",
    parentValue: "No permanent whiteboards or writable surfaces are present",
    dependentId: "ST-010",
    dependentValue: "Less than 6 linear feet",
    reason: "Auto-answered — no permanent whiteboards or writable surfaces.",
  },
]

function normalizeQuestionText(text: string): string {
  return text.trim().toLowerCase()
}

/** Yes/No gate: "Are there exterior windows?" / "Does … have exterior windows?" */
export function isExteriorWindowsParentQuestion(
  question: Pick<EsaQuestion, "question">,
): boolean {
  const q = normalizeQuestionText(question.question)
  if (!q.includes("exterior window")) return false
  return (
    q.startsWith("are there") ||
    q.startsWith("does ") ||
    q.startsWith("is there")
  )
}

/** Follow-up questions about exterior windows or coverings (immediately after parent). */
function isExteriorWindowsFollowUpQuestion(
  question: Pick<EsaQuestion, "question">,
): boolean {
  if (isExteriorWindowsParentQuestion(question)) return false
  const q = normalizeQuestionText(question.question)
  if (!q.includes("exterior window") && !q.includes("window covering")) return false
  return (
    q.includes("select all") ||
    q.includes("window covering") ||
    q.includes("coverings are provided")
  )
}

/** Yes/No gate: interior visibility into the space. */
export function isInteriorVisibilityParentQuestion(
  question: Pick<EsaQuestion, "question">,
): boolean {
  const q = normalizeQuestionText(question.question)
  return q.includes("visibility provided into") && q.endsWith("?")
}

/** Follow-up about type of interior visibility. */
function isInteriorVisibilityFollowUpQuestion(
  question: Pick<EsaQuestion, "question">,
): boolean {
  if (isInteriorVisibilityParentQuestion(question)) return false
  const q = normalizeQuestionText(question.question)
  if (q.startsWith("what type of visibility")) return true
  return q.includes("select all") && q.includes("visibility")
}

interface SkipRule {
  parentId: string
  dependentIds: readonly string[]
  skipReason: string
}

function consecutiveDependents(
  questions: readonly EsaQuestion[],
  startIndex: number,
  isDependent: (question: Pick<EsaQuestion, "question">) => boolean,
): string[] {
  const ids: string[] = []
  for (let i = startIndex + 1; i < questions.length; i++) {
    if (!isDependent(questions[i])) break
    ids.push(questions[i].questionId)
  }
  return ids
}

/** Derive parent → dependent skip rules from question text (works across all v4 rubrics). */
export function buildSkipRulesFromQuestions(
  questions: readonly EsaQuestion[],
): SkipRule[] {
  const rules: SkipRule[] = []
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i]
    if (isExteriorWindowsParentQuestion(question)) {
      const dependentIds = consecutiveDependents(
        questions,
        i,
        isExteriorWindowsFollowUpQuestion,
      )
      if (dependentIds.length) {
        rules.push({
          parentId: question.questionId,
          dependentIds,
          skipReason: "Skipped — no exterior windows in this space.",
        })
      }
      continue
    }
    if (isInteriorVisibilityParentQuestion(question)) {
      const dependentIds = consecutiveDependents(
        questions,
        i,
        isInteriorVisibilityFollowUpQuestion,
      )
      if (dependentIds.length) {
        rules.push({
          parentId: question.questionId,
          dependentIds,
          skipReason: "Skipped — no interior visibility into this space.",
        })
      }
    }
  }
  return rules
}

function skipReasonForQuestion(
  questionId: string,
  responses: RoomQuestionResponse[],
  questions: readonly EsaQuestion[],
): string | undefined {
  for (const rule of buildSkipRulesFromQuestions(questions)) {
    if (!(rule.dependentIds as readonly string[]).includes(questionId)) continue
    if (isParentAnsweredNo(rule.parentId, responses)) return rule.skipReason
  }
  return undefined
}

/** @deprecated Prefer isExteriorWindowsParentQuestion — IDs vary by rubric */
export const EXTERIOR_WINDOWS_QUESTION_ID = "ST-004"
/** @deprecated Prefer buildSkipRulesFromQuestions */
export const EXTERIOR_WINDOWS_DEPENDENT_IDS = ["ST-005", "ST-006"] as const
/** @deprecated Prefer isInteriorVisibilityParentQuestion */
export const INTERIOR_VISIBILITY_QUESTION_ID = "ST-016"
/** @deprecated Prefer buildSkipRulesFromQuestions */
export const INTERIOR_VISIBILITY_DEPENDENT_IDS = ["ST-017"] as const

function responseValue(response: RoomQuestionResponse | undefined): string | undefined {
  if (!response) return undefined
  return Array.isArray(response.value) ? response.value[0] : response.value
}

function isParentAnsweredNo(parentId: string, responses: RoomQuestionResponse[]): boolean {
  const parent = responses.find((r) => r.questionId === parentId)
  return responseValue(parent) === "No"
}

function questionIdsAfterParent(
  parentId: string,
  questions: readonly EsaQuestion[],
): readonly string[] {
  const parentIndex = questions.findIndex((q) => q.questionId === parentId)
  if (parentIndex < 0) return []
  return questions.slice(parentIndex + 1).map((q) => q.questionId)
}

function isSkippedAfterAvailabilityNo(
  questionId: string,
  responses: RoomQuestionResponse[],
  questions?: readonly EsaQuestion[],
): boolean {
  if (!questions?.length) return false
  for (const question of questions) {
    if (!skipsAllRemainingQuestionsOnNo(question)) continue
    if (!isParentAnsweredNo(question.questionId, responses)) continue
    if ((questionIdsAfterParent(question.questionId, questions) as readonly string[]).includes(questionId)) {
      return true
    }
  }
  return false
}

export function isExteriorWindowsNo(
  responses: RoomQuestionResponse[],
  questions?: readonly EsaQuestion[],
): boolean {
  if (questions?.length) {
    for (const rule of buildSkipRulesFromQuestions(questions)) {
      if (rule.skipReason.includes("exterior windows") && isParentAnsweredNo(rule.parentId, responses)) {
        return true
      }
    }
  }
  return isParentAnsweredNo(EXTERIOR_WINDOWS_QUESTION_ID, responses)
}

export function isInteriorVisibilityNo(
  responses: RoomQuestionResponse[],
  questions?: readonly EsaQuestion[],
): boolean {
  if (questions?.length) {
    for (const rule of buildSkipRulesFromQuestions(questions)) {
      if (rule.skipReason.includes("interior visibility") && isParentAnsweredNo(rule.parentId, responses)) {
        return true
      }
    }
  }
  return isParentAnsweredNo(INTERIOR_VISIBILITY_QUESTION_ID, responses)
}

export function isSkippedDependentQuestion(
  questionId: string,
  responses: RoomQuestionResponse[],
  questions?: readonly EsaQuestion[],
): boolean {
  if (isSkippedAfterAvailabilityNo(questionId, responses, questions)) return true
  if (questions?.length) {
    for (const rule of buildSkipRulesFromQuestions(questions)) {
      if (!(rule.dependentIds as readonly string[]).includes(questionId)) continue
      if (isParentAnsweredNo(rule.parentId, responses)) return true
    }
  }
  return false
}

/** True when a parent answer forces this question to a fixed value. */
export function isAutoAnsweredQuestion(
  questionId: string,
  responses: RoomQuestionResponse[],
): boolean {
  for (const rule of AUTO_ANSWER_RULES) {
    if (rule.dependentId !== questionId) continue
    const parent = responses.find((r) => r.questionId === rule.parentId)
    if (responseValue(parent) === rule.parentValue) return true
  }
  return false
}

function availabilitySkipDisabledReason(
  questionId: string,
  responses: RoomQuestionResponse[],
  questions: readonly EsaQuestion[],
): string | undefined {
  for (const question of questions) {
    if (!skipsAllRemainingQuestionsOnNo(question)) continue
    if (!isParentAnsweredNo(question.questionId, responses)) continue
    if (!(questionIdsAfterParent(question.questionId, questions) as readonly string[]).includes(questionId)) {
      continue
    }
    if (isDedicatedSpaceAvailabilityQuestion(question)) {
      return "Skipped — this dedicated space is not present at the school."
    }
    return "Skipped — this space type is not present at the school."
  }
  return undefined
}

export function dependentQuestionDisabledReason(
  questionId: string,
  responses: RoomQuestionResponse[],
  questions?: readonly EsaQuestion[],
): string | undefined {
  if (questions?.length) {
    const availabilityReason = availabilitySkipDisabledReason(questionId, responses, questions)
    if (availabilityReason) return availabilityReason
  }

  for (const rule of AUTO_ANSWER_RULES) {
    if (rule.dependentId !== questionId) continue
    const parent = responses.find((r) => r.questionId === rule.parentId)
    if (responseValue(parent) === rule.parentValue) return rule.reason
  }

  if (!questions?.length) return undefined

  const skipReason = skipReasonForQuestion(questionId, responses, questions)
  if (skipReason) return skipReason

  return undefined
}

/** @deprecated Use isSkippedDependentQuestion */
export function isExteriorWindowsDependentQuestion(questionId: string): boolean {
  return (EXTERIOR_WINDOWS_DEPENDENT_IDS as readonly string[]).includes(questionId)
}

export function applyQuestionDependencies(
  existing: RoomQuestionResponse[],
  incoming: RoomQuestionResponse,
  questions?: readonly EsaQuestion[],
): RoomQuestionResponse[] {
  const map = new Map(existing.map((r) => [r.questionId, r]))
  map.set(incoming.questionId, incoming)

  const value = responseValue(incoming)
  if (value === "No") {
    if (questions?.length) {
      for (const rule of buildSkipRulesFromQuestions(questions)) {
        if (incoming.questionId !== rule.parentId) continue
        for (const id of rule.dependentIds) {
          map.delete(id)
        }
      }

      const incomingQuestion = questions.find((q) => q.questionId === incoming.questionId)
      if (incomingQuestion && skipsAllRemainingQuestionsOnNo(incomingQuestion)) {
        for (const id of questionIdsAfterParent(incoming.questionId, questions)) {
          map.delete(id)
        }
      }
    }
  }

  for (const rule of AUTO_ANSWER_RULES) {
    if (incoming.questionId !== rule.parentId) continue
    if (value === rule.parentValue) {
      const existingDep = map.get(rule.dependentId)
      map.set(rule.dependentId, {
        questionId: rule.dependentId,
        value: rule.dependentValue,
        comment: existingDep?.comment,
        photos: existingDep?.photos ?? (existingDep?.photo ? [existingDep.photo] : undefined),
      })
    } else if (responseValue(map.get(rule.dependentId)) === rule.dependentValue) {
      map.delete(rule.dependentId)
    }
  }

  return Array.from(map.values())
}
