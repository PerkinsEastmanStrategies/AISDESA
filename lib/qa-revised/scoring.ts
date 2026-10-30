import { canonicalName } from "@/lib/qa-revised/normalize"
import { isNotAbleToAssessText, unitsForScoring } from "@/lib/qa-revised/non-scoring"
import {
  collapseSelectAllQuestionScores,
  isBorrowedDaylightQuestion,
  isExteriorGlassCoveringLabel,
  isSafetySelectAllQuestion,
  isShelterInPlaceSafetyLabel,
  roomAnsweredNoExteriorWindows,
  roomHasExteriorWindows,
} from "@/lib/qa-revised/esa-question-dependencies"
import type { WeightResolver } from "@/lib/qa-revised/weights"
import type { SchoolScorecard, SchoolSnapshot, ScoreNode, ScoredRoom, ScoredUnit } from "@/lib/qa-revised/types"

function weightedAverage(items: { score: number; weight: number }[]): number | null {
  const valid = items.filter((item) => item.weight > 0 && Number.isFinite(item.score))
  if (!valid.length) return null
  const total = valid.reduce((sum, item) => sum + item.weight, 0)
  if (total <= 0) return null
  return valid.reduce((sum, item) => sum + item.score * item.weight, 0) / total
}

function average(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

interface RoomResult {
  room: ScoredRoom
  overall: number | null
  categories: Map<string, number>
  subcategories: Map<string, { category: string; subcategory: string; score: number }>
  questions: Map<string, { questionId: string; question: string; category: string; subcategory: string; score: number }>
}

function isNotPresentRoom(room: ScoredRoom): boolean {
  if (room.markedAbsent) return true
  return /(?:—|-|–)?\s*not (?:at school|present)\b/i.test(room.roomName)
}

function scoredUnitsForRoom(
  room: ScoredRoom,
  weights: WeightResolver,
  schoolLevel?: string,
): Array<ScoredUnit & { weight: number }> {
  const omitBorrowedDaylight = roomHasExteriorWindows(room.units)
  const omitExteriorCovering = roomAnsweredNoExteriorWindows(room.units)
  const applicable = collapseSelectAllQuestionScores(room.units).filter((unit) => {
    if (!Number.isFinite(unit.score)) return false
    if (isNotAbleToAssessText(unit.answer)) return false
    if (omitBorrowedDaylight && isBorrowedDaylightQuestion({ question: unit.question })) return false
    if (
      omitExteriorCovering &&
      isSafetySelectAllQuestion({ question: unit.question }) &&
      isExteriorGlassCoveringLabel(unit.itemLabel)
    ) {
      return false
    }
    if (
      isSafetySelectAllQuestion({ question: unit.question }) &&
      isShelterInPlaceSafetyLabel(unit.itemLabel)
    ) {
      return false
    }
    return true
  })
  return unitsForScoring(
    applicable.map((unit) => ({
      ...unit,
      schoolLevel,
      weight: weights.question(unit.questionId, unit.category, unit.question),
    })),
  )
}

function scoreRoom(room: ScoredRoom, weights: WeightResolver, schoolLevel?: string): RoomResult {
  if (isNotPresentRoom(room)) {
    return {
      room,
      overall: 0,
      categories: new Map(),
      subcategories: new Map(),
      questions: new Map(),
    }
  }

  const units = scoredUnitsForRoom(room, weights, schoolLevel)
  const unitCounts = new Map<string, number>()
  for (const unit of units) {
    unitCounts.set(unit.questionId, (unitCounts.get(unit.questionId) ?? 0) + 1)
  }

  const subMap = new Map<string, { category: string; subcategory: string; items: ScoredUnit[]; weight: number }>()
  for (const unit of units) {
    const key = `${canonicalName(unit.category)}::${canonicalName(unit.subcategory)}`
    const existing = subMap.get(key)
    if (existing) {
      existing.items.push(unit)
    } else {
      subMap.set(key, {
        category: unit.category,
        subcategory: unit.subcategory,
        items: [unit],
        weight: weights.subcategory(
          unit.category,
          unit.subcategory,
          room.focusAreaLabel,
          room.spaceType,
        ),
      })
    }
  }

  const subcategoryScores = new Map<string, { category: string; subcategory: string; score: number }>()
  for (const [key, group] of subMap) {
    const score = weightedAverage(
      group.items.map((item) => ({
        score: item.score,
        weight:
          weights.question(item.questionId, item.category) /
          (unitCounts.get(item.questionId) ?? 1),
      })),
    )
    if (score == null) continue
    subcategoryScores.set(key, {
      category: group.category,
      subcategory: group.subcategory,
      score: score * 100,
    })
  }

  const catMap = new Map<string, { category: string; items: { score: number; weight: number }[] }>()
  for (const [key, sub] of subcategoryScores) {
    const group = subMap.get(key)
    if (!group || group.weight <= 0) continue
    const catKey = canonicalName(sub.category)
    const existing = catMap.get(catKey)
    const item = { score: sub.score / 100, weight: group.weight }
    if (existing) existing.items.push(item)
    else catMap.set(catKey, { category: sub.category, items: [item] })
  }

  const categories = new Map<string, number>()
  const categoryItems: { score: number; weight: number }[] = []
  for (const [, group] of catMap) {
    const score = weightedAverage(group.items)
    const weight = weights.category(group.category, room.focusAreaLabel, room.spaceType)
    if (score == null || weight <= 0) continue
    const percent = score * 100
    categories.set(group.category, percent)
    categoryItems.push({ score: percent / 100, weight })
  }

  const overall = weightedAverage(categoryItems)

  return {
    room,
    overall: overall == null ? null : overall * 100,
    categories,
    subcategories: subcategoryScores,
    questions: new Map(),
  }
}

/** Drop not-present placeholders when that space type was actually surveyed. */
function omitAbsentPlaceholders(rooms: ScoredRoom[]): ScoredRoom[] {
  const assessedTypes = new Set(
    rooms
      .filter((room) => !isNotPresentRoom(room))
      .map((room) => `${room.surveyType}::${room.spaceType}`),
  )
  return rooms.filter((room) => {
    if (!isNotPresentRoom(room)) return true
    return !assessedTypes.has(`${room.surveyType}::${room.spaceType}`)
  })
}

function withDelta(node: ScoreNode, baselineNodes?: ScoreNode[]): ScoreNode {
  const baseline = baselineNodes?.find((item) => item.id === node.id)
  return {
    ...node,
    baseline: baseline?.score ?? null,
    children: node.children?.map((child) => withDelta(child, baseline?.children)),
  }
}

function groupByFocus(rooms: RoomResult[]): Map<string, RoomResult[]> {
  const byFocus = new Map<string, RoomResult[]>()
  for (const room of rooms) {
    const list = byFocus.get(room.room.focusAreaLabel) ?? []
    list.push(room)
    byFocus.set(room.room.focusAreaLabel, list)
  }
  return byFocus
}

function spaceTypeAverage(rooms: RoomResult[]): number | null {
  return average(rooms.filter((room) => room.overall != null).map((room) => room.overall as number))
}

function summarizeFocusAreas(
  rooms: RoomResult[],
  weights: WeightResolver,
  buildNodes: boolean,
  schoolLevel?: string,
): { scores: { score: number; weight: number }[]; nodes: ScoreNode[] } {
  const scores: { score: number; weight: number }[] = []
  const nodes: ScoreNode[] = []
  const byFocus = groupByFocus(rooms)

  for (const focusArea of [...byFocus.keys()].sort((a, b) => a.localeCompare(b))) {
    const focusRooms = byFocus.get(focusArea) ?? []
    const bySpace = new Map<string, RoomResult[]>()
    for (const room of focusRooms) {
      const list = bySpace.get(room.room.spaceType) ?? []
      list.push(room)
      bySpace.set(room.room.spaceType, list)
    }

    const spaceNodes: ScoreNode[] = []
    const spaceScores: { score: number; weight: number }[] = []

    for (const spaceType of [...bySpace.keys()].sort((a, b) => a.localeCompare(b))) {
      const spaceRooms = bySpace.get(spaceType) ?? []
      const spaceAvg = spaceTypeAverage(spaceRooms)
      const spaceWeight = weights.space(focusArea, spaceType)
      if (spaceAvg != null && spaceWeight > 0) spaceScores.push({ score: spaceAvg, weight: spaceWeight })
      if (!buildNodes) continue

      const roomNodes: ScoreNode[] = spaceRooms
        .slice()
        .sort((a, b) => a.room.roomName.localeCompare(b.room.roomName, undefined, { numeric: true }))
        .map((room) => {
          const bits = [
            room.room.neighborhood?.trim() || null,
            room.room.gradeType || null,
            room.overall != null ? "complete" : null,
            spaceRooms.length > 0 ? `${Math.round(100 / spaceRooms.length)}% each` : null,
          ].filter(Boolean)
          return {
            id: `${focusArea}::${spaceType}::${room.room.roomId}`,
            kind: "room" as const,
            label: room.room.roomName,
            score: room.overall,
            baseline: null,
            weight: 1,
            roomId: room.room.roomId,
            countLabel: bits.join(" · ") || undefined,
            children: categoryNodesForRooms([room], weights, schoolLevel),
          }
        })

      spaceNodes.push({
        id: `${focusArea}::${spaceType}`,
        kind: "group",
        label: spaceType,
        score: spaceAvg,
        baseline: null,
        weight: spaceWeight,
        scoredCount: spaceRooms.filter((room) => room.overall != null).length,
        totalCount: spaceRooms.length,
        countLabel: `${spaceRooms.filter((room) => room.overall != null).length} of ${spaceRooms.length} room${spaceRooms.length === 1 ? "" : "s"}`,
        children: roomNodes,
      })
    }

    const focusScore = weightedAverage(spaceScores)
    const focusWeight = weights.focus(focusArea)
    if (focusScore != null && focusWeight > 0) scores.push({ score: focusScore, weight: focusWeight })
    if (!buildNodes || !spaceNodes.length || focusScore == null) continue

    nodes.push({
      id: focusArea,
      kind: "group",
      label: focusArea,
      score: focusScore,
      baseline: null,
      weight: focusWeight,
      scoredCount: focusRooms.filter((room) => room.overall != null).length,
      totalCount: focusRooms.length,
      countLabel: `${focusRooms.filter((room) => room.overall != null).length} of ${focusRooms.length} space${focusRooms.length === 1 ? "" : "s"} scored`,
      children: spaceNodes,
    })
  }

  return { scores, nodes }
}

function buildTree(
  rooms: RoomResult[],
  weights: WeightResolver,
  schoolLevel?: string,
): { overall: number | null; existingOnly: number | null; categories: ScoreNode[]; focusAreas: ScoreNode[] } {
  const assessed = rooms.filter((room) => !isNotPresentRoom(room.room) && room.overall != null)
  const includingMissing = rooms.filter((room) => room.overall != null)
  const existing = summarizeFocusAreas(assessed, weights, true, schoolLevel)
  const missing = summarizeFocusAreas(includingMissing, weights, false, schoolLevel)

  return {
    overall: weightedAverage(missing.scores),
    existingOnly: weightedAverage(existing.scores) ?? average(assessed.map((room) => room.overall as number)),
    categories: categoryNodesForRooms(assessed, weights, schoolLevel),
    focusAreas: existing.nodes,
  }
}

function categoryNodesForRooms(rooms: RoomResult[], weights: WeightResolver, schoolLevel?: string): ScoreNode[] {
  const context = rooms.length === 1 ? rooms[0]?.room : null
  const catScores = new Map<string, number[]>()
  const catLabels = new Map<string, string>()
  const subScores = new Map<string, { category: string; subcategory: string; scores: number[] }>()
  const questionScores = new Map<
    string,
    {
      questionId: string
      unitId: string
      question: string
      itemLabel?: string | null
      answer?: string | null
      category: string
      subcategory: string
      scores: number[]
      weight: number
    }
  >()

  for (const room of rooms) {
    for (const [category, score] of room.categories) {
      const key = canonicalName(category)
      catLabels.set(key, category)
      const list = catScores.get(key) ?? []
      list.push(score)
      catScores.set(key, list)
    }
    for (const sub of room.subcategories.values()) {
      const key = `${canonicalName(sub.category)}::${canonicalName(sub.subcategory)}`
      const existing = subScores.get(key)
      if (existing) existing.scores.push(sub.score)
      else subScores.set(key, { category: sub.category, subcategory: sub.subcategory, scores: [sub.score] })
    }
    for (const unit of scoredUnitsForRoom(room.room, weights, schoolLevel)) {
      const weight = unit.weight ?? weights.question(unit.questionId, unit.category, unit.question)
      if (weight <= 0) continue
      const key = unit.unitId || unit.questionId
      const bucket = questionScores.get(key)
      if (bucket) {
        bucket.scores.push(unit.score * 100)
        if (rooms.length > 1) bucket.answer = null
      } else {
        questionScores.set(key, {
          questionId: unit.questionId,
          unitId: unit.unitId,
          question: unit.question,
          itemLabel: unit.itemLabel,
          answer: rooms.length === 1 ? unit.answer : null,
          category: unit.category,
          subcategory: unit.subcategory,
          scores: [unit.score * 100],
          weight,
        })
      }
    }
  }

  return [...catScores.entries()]
    .map(([catKey, scores]) => {
      const category = catLabels.get(catKey) ?? catKey
      const children = [...subScores.values()]
        .filter((sub) => canonicalName(sub.category) === catKey)
        .map((sub) => {
          const questionRows = [...questionScores.values()]
            .filter(
              (q) =>
                canonicalName(q.category) === catKey &&
                canonicalName(q.subcategory) === canonicalName(sub.subcategory),
            )
          const unitsPerQuestion = new Map<string, number>()
          for (const q of questionRows) {
            unitsPerQuestion.set(q.questionId, (unitsPerQuestion.get(q.questionId) ?? 0) + 1)
          }
          const questions = questionRows
            .map((q) => ({
              id: `${category}::${sub.subcategory}::${q.unitId}`,
              kind: "question" as const,
              label: q.question,
              score: average(q.scores),
              baseline: null,
              weight: q.weight / Math.max(1, unitsPerQuestion.get(q.questionId) ?? 1),
              questionId: q.questionId,
              itemLabel: q.itemLabel,
              answer: q.answer,
            }))
            .filter((q) => q.weight > 0)
            .sort(
              (a, b) =>
                (a.questionId ?? "").localeCompare(b.questionId ?? "") ||
                (a.itemLabel ?? "").localeCompare(b.itemLabel ?? ""),
            )

          return {
            id: `${category}::${sub.subcategory}`,
            kind: "group" as const,
            label: sub.subcategory,
            score: average(sub.scores),
            baseline: null,
            weight: weights.subcategory(
              sub.category,
              sub.subcategory,
              context?.focusAreaLabel,
              context?.spaceType,
            ),
            children: questions,
          }
        })
        .sort((a, b) => a.label.localeCompare(b.label))

      return {
        id: category,
        kind: "group" as const,
        label: category,
        score: average(scores),
        baseline: null,
        weight: weights.category(category, context?.focusAreaLabel, context?.spaceType),
        children,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function scoreSchool(
  snapshot: SchoolSnapshot,
  weights: WeightResolver,
  baseline?: WeightResolver,
): SchoolScorecard {
  const snapshotRooms = omitAbsentPlaceholders(snapshot.rooms)
  const rooms = snapshotRooms.map((room) => scoreRoom(room, weights, snapshot.schoolLevel))
  const tree = buildTree(rooms, weights, snapshot.schoolLevel)
  const baselineTree = baseline
    ? buildTree(
        snapshotRooms.map((room) => scoreRoom(room, baseline, snapshot.schoolLevel)),
        baseline,
        snapshot.schoolLevel,
      )
    : null

  return {
    schoolId: snapshot.schoolId,
    schoolName: snapshot.schoolName,
    campusId: snapshot.campusId,
    overall: tree.overall,
    overallBaseline: baselineTree?.overall ?? null,
    existingOnly: tree.existingOnly,
    existingOnlyBaseline: baselineTree?.existingOnly ?? null,
    scoredRoomCount: snapshotRooms.filter((room) => room.units.length > 0).length,
    absentCount: snapshotRooms.filter((room) => isNotPresentRoom(room)).length,
    categories: tree.categories.map((node) => withDelta(node, baselineTree?.categories)),
    focusAreas: tree.focusAreas.map((node) => withDelta(node, baselineTree?.focusAreas)),
    rooms: rooms
      .filter((room) => !isNotPresentRoom(room.room))
      .map((room) => ({
        roomId: room.room.roomId,
        roomName: room.room.roomName,
        spaceType: room.room.spaceType,
        focusAreaLabel: room.room.focusAreaLabel,
        neighborhood: room.room.neighborhood,
        score: room.overall,
      })),
  }
}
