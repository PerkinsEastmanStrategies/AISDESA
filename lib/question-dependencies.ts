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
  if (!text.startsWith("Is there a dedicated")) return false
  // In-room features (Peace Center within a studio) are scored normally — "No" must not skip the rubric.
  if (/\bwithin\b/i.test(text)) return false
  return true
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

/** Yes/No parent: "Are there exterior windows?" (or community-room variant). */
export function isExteriorWindowsParentQuestion(
  question: Pick<EsaQuestion, "question">,
): boolean {
  const text = question.question.trim()
  return (
    text === "Are there exterior windows?" ||
    text.startsWith("Does the community room have exterior windows?")
  )
}

/** Dependent questions skipped when the parent exterior-windows answer is "No". */
export function isExteriorWindowsSkipWhenNoDependent(
  question: Pick<EsaQuestion, "question">,
): boolean {
  const text = question.question.trim()
  return /^Select all that apply \(exterior windows/i.test(text)
}

/**
 * Parent answer → auto-fill a dependent question (kept in scoring; locked in UI).
 */
const AUTO_ANSWER_RULES: ReadonlyArray<{
  parentId: string
  parentValue: string
  dependentId: string
  dependentValue: string
  reason: string
}> = []

/** @deprecated Prefer isExteriorWindowsParentQuestion — kept for legacy callers */
export const EXTERIOR_WINDOWS_QUESTION_ID = "ST-006"

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

function exteriorWindowsSkipDependentIds(
  parentId: string,
  questions: readonly EsaQuestion[],
): readonly string[] {
  const parentIndex = questions.findIndex((q) => q.questionId === parentId)
  if (parentIndex < 0) return []

  const ids: string[] = []
  for (let i = parentIndex + 1; i < questions.length; i++) {
    const q = questions[i]
    if (isExteriorWindowsParentQuestion(q)) break
    if (isExteriorWindowsSkipWhenNoDependent(q)) {
      ids.push(q.questionId)
      continue
    }
    if (ids.length > 0) break
  }
  return ids
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

function isSkippedByExteriorWindowsNo(
  questionId: string,
  responses: RoomQuestionResponse[],
  questions: readonly EsaQuestion[],
): boolean {
  for (const question of questions) {
    if (!isExteriorWindowsParentQuestion(question)) continue
    if (!isParentAnsweredNo(question.questionId, responses)) continue
    if (exteriorWindowsSkipDependentIds(question.questionId, questions).includes(questionId)) {
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
    return questions.some(
      (q) => isExteriorWindowsParentQuestion(q) && isParentAnsweredNo(q.questionId, responses),
    )
  }
  return isParentAnsweredNo(EXTERIOR_WINDOWS_QUESTION_ID, responses)
}

export function isSkippedDependentQuestion(
  questionId: string,
  responses: RoomQuestionResponse[],
  questions?: readonly EsaQuestion[],
): boolean {
  if (isSkippedAfterAvailabilityNo(questionId, responses, questions)) return true
  if (questions?.length && isSkippedByExteriorWindowsNo(questionId, responses, questions)) {
    return true
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

  if (
    questions?.length &&
    isSkippedByExteriorWindowsNo(questionId, responses, questions)
  ) {
    return "Skipped — no exterior windows in this space."
  }

  if (!isSkippedDependentQuestion(questionId, responses, questions)) return undefined
  return "Skipped — this question does not apply based on a previous answer."
}

/** @deprecated Prefer isExteriorWindowsSkipWhenNoDependent with rubric context */
export function isExteriorWindowsDependentQuestion(
  questionId: string,
  questions?: readonly EsaQuestion[],
): boolean {
  if (questions?.length) {
    return questions.some(
      (q) =>
        isExteriorWindowsSkipWhenNoDependent(q) && q.questionId === questionId,
    )
  }
  return false
}

export function applyQuestionDependencies(
  existing: RoomQuestionResponse[],
  incoming: RoomQuestionResponse,
  questions?: readonly EsaQuestion[],
): RoomQuestionResponse[] {
  const map = new Map(existing.map((r) => [r.questionId, r]))
  map.set(incoming.questionId, incoming)

  const value = responseValue(incoming)
  if (value === "No" && questions?.length) {
    const incomingQuestion = questions.find((q) => q.questionId === incoming.questionId)
    if (incomingQuestion && isExteriorWindowsParentQuestion(incomingQuestion)) {
      for (const id of exteriorWindowsSkipDependentIds(incoming.questionId, questions)) {
        map.delete(id)
      }
    }

    if (incomingQuestion && skipsAllRemainingQuestionsOnNo(incomingQuestion)) {
      for (const id of questionIdsAfterParent(incoming.questionId, questions)) {
        map.delete(id)
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
