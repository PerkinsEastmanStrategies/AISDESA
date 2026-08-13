import type { EsaQuestionOption, RoomQuestionResponse } from "../types/survey"

/** Canonical label for the unable / not-able-to-assess exclusion choice. */
export const NOT_ABLE_TO_ASSESS_OPTION = "Not Able to Assess"

/**
 * True for current and legacy wordings.
 * Matches "Not Able to Assess", "Unable to assess", "Unable to assess (note reason)", etc.
 */
export function isNotAbleToAssessOption(optionLabel: string | null | undefined): boolean {
  if (!optionLabel) return false
  const t = optionLabel.trim().toLowerCase()
  return (
    t === "not able to assess" ||
    t.startsWith("not able to assess ") ||
    t === "unable to assess" ||
    t.startsWith("unable to assess")
  )
}

/** Map a stored response value onto the canonical option label when needed. */
export function canonicalizeResponseValue(value: string): string {
  return isNotAbleToAssessOption(value) ? NOT_ABLE_TO_ASSESS_OPTION : value
}

export function canonicalizeResponseValues(
  value: string | string[] | null | undefined,
): string | string[] | undefined {
  if (value == null) return undefined
  if (Array.isArray(value)) return value.map(canonicalizeResponseValue)
  return canonicalizeResponseValue(value)
}

/**
 * Coerce multi-select response values to a string array.
 * Legacy / buggy saves sometimes store a single selection as a plain string; treating that
 * as `[]` in the UI made multi-select behave like single-select and fail "answered" checks.
 */
export function asMultiSelectValues(
  value: string | string[] | null | undefined,
): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.length > 0)
  }
  if (typeof value === "string" && value.length > 0) return [value]
  return []
}

/** True when the selected value(s) include a not/unable-to-assess option. */
export function responseRequiresUnableToAssessNote(
  value: string | string[] | null | undefined,
): boolean {
  if (value == null || value === "") return false
  const values = Array.isArray(value) ? value : [value]
  return values.some((v) => typeof v === "string" && isNotAbleToAssessOption(v))
}

export function hasRequiredUnableToAssessNote(
  response: Pick<RoomQuestionResponse, "value" | "comment"> | null | undefined,
): boolean {
  if (!responseRequiresUnableToAssessNote(response?.value)) return true
  return !!response?.comment?.trim()
}

function optionMatchesValue(optionLabel: string, value: string): boolean {
  if (optionLabel === value) return true
  return isNotAbleToAssessOption(optionLabel) && isNotAbleToAssessOption(value)
}

/** Whether a rubric option is selected given a stored response value (supports legacy labels). */
export function isOptionValueSelected(
  optionLabel: string,
  value: string | string[] | null | undefined,
): boolean {
  if (value == null || value === "") return false
  if (Array.isArray(value)) {
    return value.some((v) => typeof v === "string" && optionMatchesValue(optionLabel, v))
  }
  return typeof value === "string" && optionMatchesValue(optionLabel, value)
}

/**
 * Rename legacy unable-to-assess labels to {@link NOT_ABLE_TO_ASSESS_OPTION}
 * and inject the option when a question is missing one.
 */
export function ensureNotAbleToAssessOptions<
  T extends { questions: { questionId: string }[]; options: EsaQuestionOption[] },
>(rubric: T): T {
  const renamed = rubric.options.map((o) =>
    isNotAbleToAssessOption(o.option)
      ? {
          ...o,
          option: NOT_ABLE_TO_ASSESS_OPTION,
          normalizedScore: null,
          isExclusionOption: true,
        }
      : o,
  )

  // Drop duplicate Not Able to Assess rows per question (keep first by displayOrder).
  const seen = new Set<string>()
  const deduped: EsaQuestionOption[] = []
  for (const o of [...renamed].sort((a, b) => a.displayOrder - b.displayOrder)) {
    if (isNotAbleToAssessOption(o.option)) {
      const key = o.questionId
      if (seen.has(key)) continue
      seen.add(key)
    }
    deduped.push(o)
  }

  const additions: EsaQuestionOption[] = []
  for (const q of rubric.questions) {
    if (deduped.some((o) => o.questionId === q.questionId && isNotAbleToAssessOption(o.option))) {
      continue
    }

    const qOpts = deduped.filter((o) => o.questionId === q.questionId)
    const template = qOpts[0]
    const maxOrder = qOpts.reduce((max, o) => Math.max(max, o.displayOrder), 0)

    additions.push({
      questionId: q.questionId,
      option: NOT_ABLE_TO_ASSESS_OPTION,
      normalizedScore: null,
      displayOrder: maxOrder + 1,
      scoreId: template?.scoreId ?? `${q.questionId}a`,
      ...(template?.scoreGroupId ? { scoreGroupId: template.scoreGroupId } : {}),
      itemScoringMode: template?.itemScoringMode,
      isExclusionOption: true,
    })
  }

  if (!additions.length && deduped === rubric.options) return rubric
  // Always return a new options array when we renamed/deduped, even if lengths match.
  const optionsChanged =
    additions.length > 0 ||
    deduped.length !== rubric.options.length ||
    deduped.some((o, i) => o.option !== rubric.options[i]?.option)

  if (!optionsChanged) return rubric
  return { ...rubric, options: [...deduped, ...additions] }
}
