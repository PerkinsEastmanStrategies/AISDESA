import type { RoomQuestionResponse } from "@aisd/shared"

/** Parent → dependent skip rules (answer "No" clears / skips dependents). */
const DEPENDENCY_RULES: ReadonlyArray<{
  parentId: string
  dependentIds: readonly string[]
}> = [
  { parentId: "ST-004", dependentIds: ["ST-005", "ST-006"] },
  { parentId: "ST-016", dependentIds: ["ST-017"] },
  { parentId: "SL-005", dependentIds: ["SL-006", "SL-007"] },
  { parentId: "SL-013", dependentIds: ["SL-014"] },
  { parentId: "VL-005", dependentIds: ["VL-006", "VL-007"] },
  { parentId: "VL-013", dependentIds: ["VL-014"] },
  { parentId: "LS-005", dependentIds: ["LS-006", "LS-007"] },
  { parentId: "LS-013", dependentIds: ["LS-014"] },
  { parentId: "SF-005", dependentIds: ["SF-006", "SF-007"] },
  { parentId: "SF-013", dependentIds: ["SF-014"] },
]

/**
 * Parent answer → auto-fill a dependent question (kept in scoring; locked in UI).
 */
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

/** @deprecated Prefer DEPENDENCY_RULES — kept for callers that import these IDs */
export const EXTERIOR_WINDOWS_QUESTION_ID = "ST-004"
export const EXTERIOR_WINDOWS_DEPENDENT_IDS = ["ST-005", "ST-006"] as const
export const INTERIOR_VISIBILITY_QUESTION_ID = "ST-016"
export const INTERIOR_VISIBILITY_DEPENDENT_IDS = ["ST-017"] as const

function responseValue(response: RoomQuestionResponse | undefined): string | undefined {
  if (!response) return undefined
  return Array.isArray(response.value) ? response.value[0] : response.value
}

function isParentAnsweredNo(parentId: string, responses: RoomQuestionResponse[]): boolean {
  const parent = responses.find((r) => r.questionId === parentId)
  return responseValue(parent) === "No"
}

export function isExteriorWindowsNo(responses: RoomQuestionResponse[]): boolean {
  return isParentAnsweredNo(EXTERIOR_WINDOWS_QUESTION_ID, responses)
}

export function isInteriorVisibilityNo(responses: RoomQuestionResponse[]): boolean {
  return isParentAnsweredNo(INTERIOR_VISIBILITY_QUESTION_ID, responses)
}

export function isSkippedDependentQuestion(
  questionId: string,
  responses: RoomQuestionResponse[],
): boolean {
  for (const rule of DEPENDENCY_RULES) {
    if (!(rule.dependentIds as readonly string[]).includes(questionId)) continue
    if (isParentAnsweredNo(rule.parentId, responses)) return true
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

export function dependentQuestionDisabledReason(
  questionId: string,
  responses: RoomQuestionResponse[],
): string | undefined {
  for (const rule of AUTO_ANSWER_RULES) {
    if (rule.dependentId !== questionId) continue
    const parent = responses.find((r) => r.questionId === rule.parentId)
    if (responseValue(parent) === rule.parentValue) return rule.reason
  }

  if (!isSkippedDependentQuestion(questionId, responses)) return undefined

  if (
    questionId === "ST-005" ||
    questionId === "ST-006" ||
    questionId === "SL-006" ||
    questionId === "SL-007" ||
    questionId === "VL-006" ||
    questionId === "VL-007" ||
    questionId === "LS-006" ||
    questionId === "LS-007" ||
    questionId === "SF-006" ||
    questionId === "SF-007"
  ) {
    return "Skipped — no exterior windows in this space."
  }
  return "Skipped — no interior visibility into this space."
}

/** @deprecated Use isSkippedDependentQuestion */
export function isExteriorWindowsDependentQuestion(questionId: string): boolean {
  return (EXTERIOR_WINDOWS_DEPENDENT_IDS as readonly string[]).includes(questionId)
}

export function applyQuestionDependencies(
  existing: RoomQuestionResponse[],
  incoming: RoomQuestionResponse,
): RoomQuestionResponse[] {
  const map = new Map(existing.map((r) => [r.questionId, r]))
  map.set(incoming.questionId, incoming)

  const value = responseValue(incoming)
  if (value === "No") {
    for (const rule of DEPENDENCY_RULES) {
      if (incoming.questionId !== rule.parentId) continue
      for (const id of rule.dependentIds) {
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
