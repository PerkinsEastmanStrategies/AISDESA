import type { EsaQuestion, EsaQuestionOption } from "../types/survey"
import { isNotAbleToAssessOption } from "../data/not-able-to-assess"

/** Score IDs ending in "i" are inventory-only and excluded from scoring. */
export function isInventoryScoreId(scoreId: string): boolean {
  return scoreId.endsWith("i")
}

/** v3 ItemScoringMode Inventory (or legacy scoreId suffix) — excluded from scoring. */
export function isInventoryOption(opt: EsaQuestionOption): boolean {
  if (opt.itemScoringMode === "Inventory") return true
  if (opt.isExclusionOption && (opt.normalizedScore === null || opt.normalizedScore === undefined)) {
    // Exclusion alone is not inventory; scored via null normalizedScore in scoreForScoreId
  }
  return isInventoryScoreId(opt.scoreId)
}

export function isMultiSelectQuestionType(questionType: string): boolean {
  return questionType === "MultiSelect" || questionType.startsWith("MultiSelect")
}

export function isYesNoQuestionType(questionType: string): boolean {
  return questionType === "YesNoNA" || questionType === "YesNo"
}

/** Normalize CSV question types to app question types. */
export function normalizeQuestionType(raw: string): "YesNoNA" | "SingleSelect" | "MultiSelect" {
  if (raw === "YesNo") return "YesNoNA"
  if (raw.startsWith("MultiSelect")) return "MultiSelect"
  return raw as "YesNoNA" | "SingleSelect" | "MultiSelect"
}

export function optionsForQuestion(
  questionId: string,
  options: EsaQuestionOption[],
): EsaQuestionOption[] {
  return options
    .filter((o) => o.questionId === questionId)
    .sort((a, b) => a.displayOrder - b.displayOrder)
}

/**
 * Scorable units for a question.
 * - Inventory options never score.
 * - Prefer scoreGroupId grouping when present (v3); else scoreId (legacy).
 */
export function scorableScoreIdsForQuestion(
  questionId: string,
  options: EsaQuestionOption[],
): string[] {
  const ids = new Set<string>()
  for (const opt of optionsForQuestion(questionId, options)) {
    if (!opt.option?.trim()) continue
    if (isInventoryOption(opt)) continue
    if (opt.isExclusionOption && (opt.normalizedScore === null || opt.normalizedScore === undefined)) {
      // Exclusion options participate in the group but don't create a unit by themselves
      // — units come from scorable siblings sharing the group/scoreId.
      continue
    }
    const unitId = opt.scoreGroupId || opt.scoreId
    if (unitId) ids.add(unitId)
  }
  return [...ids]
}

export function totalScorableUnits(
  questions: EsaQuestion[],
  options: EsaQuestionOption[],
  skipQuestionIds?: ReadonlySet<string> | readonly string[],
): number {
  const skip =
    skipQuestionIds == null
      ? null
      : skipQuestionIds instanceof Set
        ? skipQuestionIds
        : new Set(skipQuestionIds)
  return questions.reduce((sum, q) => {
    if (skip?.has(q.questionId)) return sum
    return sum + scorableScoreIdsForQuestion(q.questionId, options).length
  }, 0)
}

/**
 * Score one scorable unit (scoreId or scoreGroupId).
 * Exclusion / Unable-to-assess (null normalizedScore) omit the unit from both
 * numerator and denominator (caller skips null).
 */
export function scoreForScoreId(
  scoreId: string,
  question: EsaQuestion,
  response: { value: string | string[] } | undefined,
  options: EsaQuestionOption[],
): number | null {
  if (isInventoryScoreId(scoreId)) return null

  const groupOpts = optionsForQuestion(question.questionId, options).filter(
    (o) => (o.scoreGroupId || o.scoreId) === scoreId && !isInventoryOption(o),
  )
  if (!groupOpts.length || !response) return null

  if (isMultiSelectQuestionType(question.questionType)) {
    const selected = Array.isArray(response.value) ? response.value : []
    if (!selected.length) return null

    const selectedInGroup = groupOpts.filter((o) =>
      selected.some(
        (v) =>
          o.option === v || (isNotAbleToAssessOption(o.option) && isNotAbleToAssessOption(v)),
      ),
    )
    if (!selectedInGroup.length) return 0

    // Exclusion selected alone → omit from scoring
    if (
      selectedInGroup.every(
        (o) => o.isExclusionOption || o.normalizedScore === null || o.normalizedScore === undefined,
      )
    ) {
      return null
    }

    const scores = selectedInGroup
      .map((o) => {
        if (o.normalizedScore !== null && o.normalizedScore !== undefined) return o.normalizedScore
        if (
          o.optionScore !== null &&
          o.optionScore !== undefined &&
          o.maxPoints !== null &&
          o.maxPoints !== undefined &&
          o.maxPoints > 0
        ) {
          return o.optionScore / o.maxPoints
        }
        return null
      })
      .filter((s): s is number => s !== null)
    return scores.length ? Math.max(...scores) : null
  }

  const value = Array.isArray(response.value) ? response.value[0] : response.value
  const opt =
    groupOpts.find((o) => o.option === value) ??
    (isNotAbleToAssessOption(value)
      ? groupOpts.find((o) => isNotAbleToAssessOption(o.option))
      : undefined)
  if (!opt) return null
  if (opt.isExclusionOption) return null
  if (opt.normalizedScore !== null && opt.normalizedScore !== undefined) return opt.normalizedScore
  if (
    opt.optionScore !== null &&
    opt.optionScore !== undefined &&
    opt.maxPoints !== null &&
    opt.maxPoints !== undefined &&
    opt.maxPoints > 0
  ) {
    return opt.optionScore / opt.maxPoints
  }
  return null
}
