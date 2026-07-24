import type {
  CategoryScore,
  EsaCategory,
  EsaSubcategory,
  RoomScoreResult,
  SubcategoryScore,
} from "../types/survey"

/** Baseline classroom size for Traditional Studios scoring (sq ft). */
export const TRADITIONAL_STUDIO_SIZE_BASELINE_SQFT = 875

export const TRADITIONAL_STUDIO_SIZE_CATEGORY = "Size"
export const TRADITIONAL_STUDIO_SIZE_SUBCATEGORY = "Room Area"
export const TRADITIONAL_STUDIO_SIZE_QUESTION_ID = "ST-SIZE"

function weightedAverage(items: { score: number; weight: number }[]): number | null {
  if (!items.length) return null
  const totalWeight = items.reduce((s, i) => s + i.weight, 0)
  if (totalWeight <= 0) return null
  const sum = items.reduce((s, i) => s + i.score * i.weight, 0)
  return (sum / totalWeight) * 100
}

/** Normalized score (0–1) from room area vs the 875 sf baseline. */
export function traditionalStudioSizeNormalizedScore(
  areaSqft: number | null | undefined,
): number | null {
  if (areaSqft == null || !Number.isFinite(areaSqft) || areaSqft <= 0) return null
  const ratio = areaSqft / TRADITIONAL_STUDIO_SIZE_BASELINE_SQFT
  if (ratio >= 0.95) return 1
  if (ratio >= 0.85) return 0.75
  return 0.5
}

export function traditionalStudioSizeBandLabel(areaSqft: number | null | undefined): string | null {
  const normalized = traditionalStudioSizeNormalizedScore(areaSqft)
  if (normalized === null) return null
  if (normalized >= 1) return "≥95% of baseline (875 sf)"
  if (normalized >= 0.75) return "85–94.99% of baseline (875 sf)"
  return "<85% of baseline (875 sf)"
}

export function isTraditionalStudioRoomType(roomType: string | null | undefined): boolean {
  return roomType === "Traditional studio"
}

/** Inject Size category/subcategory scores and recalculate overall score. */
export function mergeTraditionalStudioSizeScore(
  result: RoomScoreResult,
  areaSqft: number | null | undefined,
  categories: EsaCategory[],
  subcategories: EsaSubcategory[],
): RoomScoreResult {
  const sizeCategory = categories.find((c) => c.category === TRADITIONAL_STUDIO_SIZE_CATEGORY)
  if (!sizeCategory) return result

  const categoryScores = result.categoryScores.filter(
    (c) => c.category !== TRADITIONAL_STUDIO_SIZE_CATEGORY,
  )
  const subcategoryScores = result.subcategoryScores.filter(
    (s) => s.category !== TRADITIONAL_STUDIO_SIZE_CATEGORY,
  )
  const questionScores = result.questionScores.filter(
    (q) => q.category !== TRADITIONAL_STUDIO_SIZE_CATEGORY,
  )

  const normalized = traditionalStudioSizeNormalizedScore(areaSqft)
  if (normalized === null) {
    return {
      ...result,
      categoryScores,
      subcategoryScores,
      questionScores,
      overallScore: weightedAverage(
        categoryScores.map((c) => ({ score: c.score / 100, weight: c.weight })),
      ),
    }
  }

  const categoryScorePercent = normalized * 100
  const sizeSubcategory = subcategories.find(
    (s) =>
      s.category === TRADITIONAL_STUDIO_SIZE_CATEGORY &&
      s.subcategory === TRADITIONAL_STUDIO_SIZE_SUBCATEGORY,
  )
  const subWeight = sizeSubcategory?.subcategoryWeight ?? 12

  const nextSubcategoryScores: SubcategoryScore[] = [
    ...subcategoryScores,
    {
      category: TRADITIONAL_STUDIO_SIZE_CATEGORY,
      subcategory: TRADITIONAL_STUDIO_SIZE_SUBCATEGORY,
      score: categoryScorePercent,
      weight: subWeight,
    },
  ]

  const nextCategoryScores: CategoryScore[] = [
    ...categoryScores,
    {
      category: TRADITIONAL_STUDIO_SIZE_CATEGORY,
      score: categoryScorePercent,
      weight: sizeCategory.categoryWeight,
    },
  ]

  const nextQuestionScores = [
    ...questionScores,
    {
      questionId: TRADITIONAL_STUDIO_SIZE_QUESTION_ID,
      category: TRADITIONAL_STUDIO_SIZE_CATEGORY,
      subcategory: TRADITIONAL_STUDIO_SIZE_SUBCATEGORY,
      score: normalized,
      weight: subWeight,
    },
  ]

  return {
    ...result,
    categoryScores: nextCategoryScores,
    subcategoryScores: nextSubcategoryScores,
    questionScores: nextQuestionScores,
    overallScore: weightedAverage(
      nextCategoryScores.map((c) => ({ score: c.score / 100, weight: c.weight })),
    ),
  }
}
