import type { SurveyRubric } from "../data/survey-config"
import type { EsaCategory, EsaQuestion, EsaSubcategory } from "../types/survey"

export interface WeightOverrides {
  categories: Record<string, number>
  subcategories: Record<string, number>
  questions: Record<string, number>
}

export const EMPTY_WEIGHT_OVERRIDES: WeightOverrides = {
  categories: {},
  subcategories: {},
  questions: {},
}

export function subcategoryOverrideKey(category: string, subcategory: string): string {
  return `${category}::${subcategory}`
}

export function mergeRubricWeights(
  rubric: SurveyRubric,
  overrides: WeightOverrides | null | undefined,
): {
  categories: EsaCategory[]
  subcategories: EsaSubcategory[]
  questions: EsaQuestion[]
} {
  const o = overrides ?? EMPTY_WEIGHT_OVERRIDES

  return {
    categories: rubric.categories.map((c) => ({
      ...c,
      categoryWeight: o.categories[c.category] ?? c.categoryWeight,
    })),
    subcategories: rubric.subcategories.map((s) => ({
      ...s,
      subcategoryWeight:
        o.subcategories[subcategoryOverrideKey(s.category, s.subcategory)] ?? s.subcategoryWeight,
    })),
    questions: rubric.questions.map((q) => ({
      ...q,
      weight: o.questions[q.questionId] ?? q.weight,
    })),
  }
}

export function hasActiveWeightOverrides(overrides: WeightOverrides): boolean {
  return (
    Object.keys(overrides.categories).length > 0 ||
    Object.keys(overrides.subcategories).length > 0 ||
    Object.keys(overrides.questions).length > 0
  )
}
