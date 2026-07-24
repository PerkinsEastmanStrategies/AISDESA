import type {
  EsaCategory,
  EsaQuestion,
  EsaQuestionOption,
  EsaSubcategory,
  RoomQuestionResponse,
  RoomScoreResult,
  CategoryScore,
  SubcategoryScore,
} from "../types/survey"
import type { FloorPlanRoom, RoomEAMetric } from "../types/floor-plan-room"
import { conditionFromScore } from "../types/floor-plan-room"
import type { ParsedPlanRoom } from "../floor-plan/config"
import {
  scoreForScoreId,
  scorableScoreIdsForQuestion,
  totalScorableUnits,
} from "./score-units"

function weightedAverage(items: { score: number; weight: number }[]): number | null {
  if (!items.length) return null
  const totalWeight = items.reduce((s, i) => s + i.weight, 0)
  if (totalWeight <= 0) return null
  const sum = items.reduce((s, i) => s + i.score * i.weight, 0)
  return (sum / totalWeight) * 100
}

export function scoreRoom(
  responses: RoomQuestionResponse[],
  questions: EsaQuestion[],
  categories: EsaCategory[],
  subcategories: EsaSubcategory[],
  options: EsaQuestionOption[],
  assessmentArea: string,
  skipQuestionIds?: readonly string[],
): RoomScoreResult {
  const areaQuestions = questions.filter((q) => q.assessmentArea === assessmentArea)
  const responseMap = new Map(responses.map((r) => [r.questionId, r]))
  const skip = skipQuestionIds?.length ? new Set(skipQuestionIds) : null

  const questionScores: {
    questionId: string
    category: string
    subcategory: string
    score: number
    weight: number
  }[] = []

  for (const q of areaQuestions) {
    if (skip?.has(q.questionId)) continue
    const response = responseMap.get(q.questionId)
    const scoreIds = scorableScoreIdsForQuestion(q.questionId, options)
    if (!scoreIds.length) continue

    const itemWeights = scoreIds.map((scoreId) => {
      const sample = options.find(
        (o) =>
          o.questionId === q.questionId &&
          (o.scoreGroupId || o.scoreId) === scoreId &&
          o.itemWeight != null,
      )
      return sample?.itemWeight && sample.itemWeight > 0 ? sample.itemWeight : 1
    })
    const totalItemWeight = itemWeights.reduce((s, w) => s + w, 0) || scoreIds.length

    for (let i = 0; i < scoreIds.length; i++) {
      const scoreId = scoreIds[i]
      const normalized = scoreForScoreId(scoreId, q, response, options)
      if (normalized === null) continue
      questionScores.push({
        questionId: scoreId,
        category: q.category,
        subcategory: q.subcategory,
        score: normalized,
        weight: (q.weight * itemWeights[i]) / totalItemWeight,
      })
    }
  }

  const subcategoryScores: SubcategoryScore[] = subcategories
    .map((sub) => {
      const items = questionScores
        .filter((qs) => qs.subcategory === sub.subcategory && qs.category === sub.category)
        .map((qs) => ({ score: qs.score, weight: qs.weight * sub.subcategoryWeight }))
      const score = weightedAverage(items)
      return score === null
        ? null
        : { category: sub.category, subcategory: sub.subcategory, score, weight: sub.subcategoryWeight }
    })
    .filter((s): s is SubcategoryScore => s !== null)

  const categoryScores: CategoryScore[] = categories
    .filter((c) => c.assessmentArea === assessmentArea)
    .map((cat) => {
      const subs = subcategoryScores.filter((s) => s.category === cat.category)
      const items = subs.map((s) => ({ score: s.score / 100, weight: s.weight }))
      const score = weightedAverage(items)
      return score === null
        ? null
        : { category: cat.category, score, weight: cat.categoryWeight }
    })
    .filter((s): s is CategoryScore => s !== null)

  const overallItems = categoryScores.map((c) => ({ score: c.score / 100, weight: c.weight }))
  const overallScore = weightedAverage(overallItems)

  const totalCount = totalScorableUnits(areaQuestions, options, skip ?? undefined)
  const answeredCount = questionScores.length

  return {
    roomId: "",
    overallScore,
    categoryScores,
    subcategoryScores,
    questionScores,
    answeredCount,
    totalCount,
  }
}

/** Map survey scores to dashboard FloorPlanRoom shape */
export function toFloorPlanRoom(
  room: ParsedPlanRoom,
  scoreResult: RoomScoreResult,
  buildingSqft: number,
  totalArea: number,
): FloorPlanRoom {
  const eaScore = scoreResult.overallScore ?? 0
  const sqft = totalArea > 0 ? Math.max(80, Math.round((room.area / totalArea) * buildingSqft)) : 400
  const metrics: RoomEAMetric[] = scoreResult.categoryScores.map((c) => ({
    name: c.category,
    score: Math.round(c.score),
  }))

  return {
    id: room.id,
    name: room.name,
    x: room.x,
    y: room.y,
    building: room.building,
    condition: scoreResult.overallScore !== null ? conditionFromScore(eaScore) : "fair",
    eaScore: Math.round(eaScore),
    sqft,
    capacity: Math.max(1, Math.round(sqft / 45)),
    metrics,
    note: "",
    fci: 0,
    fcaCondition: "fair",
    systems: [],
    fcaNote: "",
    levelId: room.levelId,
  }
}
