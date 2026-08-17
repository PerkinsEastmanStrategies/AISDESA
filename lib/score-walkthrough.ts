import type {
  CampusScoreSummary,
  EsaQuestion,
  EsaQuestionOption,
  ParsedPlanRoom,
  RoomQuestionResponse,
  RoomScoreResult,
  RoomSurveySession,
  ScoredRoomEntry,
  SurveySession,
  SurveyType,
} from "@aisd/shared"
import {
  EMPTY_WEIGHT_OVERRIDES,
  getRoomSurveyRubric,
  isNotAbleToAssessOption,
  responseRequiresUnableToAssessNote,
} from "@aisd/shared"
import { scoreRoomSessionWithMetadata } from "@/lib/traditional-studio-room-score"

export type WalkthroughFocus =
  | { level: "campus" }
  | { level: "category"; category: string }
  | { level: "subcategory"; category: string; subcategory: string }
  | { level: "question"; category: string; subcategory: string; unitId: string }

export interface WalkthroughRoomRow {
  roomId: string
  roomName: string
  neighborhood?: string
  gradeType?: string
  overallScore: number | null
  /** Category / subcategory / question score for the current drill level (0–100). */
  levelScore: number | null
  answerLabel?: string
  comment?: string
  excludedFromScore?: boolean
}

export interface WalkthroughCategoryRow {
  category: string
  score: number
  weight: number
}

export interface WalkthroughSubcategoryRow {
  category: string
  subcategory: string
  score: number
  weight: number
}

export interface WalkthroughQuestionRow {
  unitId: string
  questionId: string
  stem: string
  itemLabel: string | null
  category: string
  subcategory: string
  /** Average of room unit scores as 0–100. */
  averageScore: number | null
  roomCount: number
  weight: number
}

export interface QuestionLabel {
  questionId: string
  stem: string
  itemLabel: string | null
}

function average(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function formatAnswerValue(value: string | string[] | undefined): string {
  if (value == null || value === "") return "Not answered"
  if (Array.isArray(value)) {
    if (!value.length) return "Not answered"
    return value.join(", ")
  }
  return value
}

export function resolveParentQuestionId(
  unitId: string,
  options: EsaQuestionOption[],
): string | null {
  const opt = options.find((o) => (o.scoreGroupId || o.scoreId) === unitId)
  return opt?.questionId ?? null
}

export function resolveQuestionLabel(
  unitId: string,
  questions: EsaQuestion[],
  options: EsaQuestionOption[],
): QuestionLabel {
  const direct = questions.find((q) => q.questionId === unitId)
  if (direct) {
    return { questionId: direct.questionId, stem: direct.question, itemLabel: null }
  }

  const parentId = resolveParentQuestionId(unitId, options)
  const parent = parentId ? questions.find((q) => q.questionId === parentId) : undefined
  const unitOptions = options.filter((o) => (o.scoreGroupId || o.scoreId) === unitId)
  const siblingUnits = new Set(
    options
      .filter((o) => o.questionId === (parentId ?? ""))
      .map((o) => o.scoreGroupId || o.scoreId),
  )

  let itemLabel: string | null = null
  if (siblingUnits.size > 1 && unitOptions.length) {
    const texts = [...new Set(unitOptions.map((o) => o.option.trim()).filter(Boolean))]
    itemLabel = texts.length === 1 ? texts[0] : unitId
  }

  return {
    questionId: parent?.questionId ?? parentId ?? unitId,
    stem: parent?.question ?? unitId,
    itemLabel,
  }
}

function responseForUnit(
  roomSession: RoomSurveySession | undefined,
  unitId: string,
  options: EsaQuestionOption[],
): RoomQuestionResponse | undefined {
  if (!roomSession) return undefined
  const parentId = resolveParentQuestionId(unitId, options)
  const qid = parentId ?? unitId
  return roomSession.responses.find((r) => r.questionId === qid)
}

export function buildCampusCategoryRows(campus: CampusScoreSummary): WalkthroughCategoryRow[] {
  return [...campus.categoryScores]
    .map((c) => ({ category: c.category, score: c.score, weight: c.weight }))
    .sort((a, b) => a.category.localeCompare(b.category))
}

export function buildSubcategoryRows(
  roomScoreDetails: Record<string, RoomScoreResult>,
  scoredRoomIds: string[],
  category: string,
): WalkthroughSubcategoryRow[] {
  const bySub = new Map<string, { scores: number[]; weight: number }>()
  for (const roomId of scoredRoomIds) {
    const detail = roomScoreDetails[roomId]
    if (!detail) continue
    for (const sub of detail.subcategoryScores ?? []) {
      if (sub.category !== category) continue
      const entry = bySub.get(sub.subcategory) ?? { scores: [], weight: sub.weight }
      entry.scores.push(sub.score)
      entry.weight = sub.weight
      bySub.set(sub.subcategory, entry)
    }
  }
  return [...bySub.entries()]
    .map(([subcategory, { scores, weight }]) => ({
      category,
      subcategory,
      score: average(scores) ?? 0,
      weight,
    }))
    .sort((a, b) => a.subcategory.localeCompare(b.subcategory))
}

export function buildQuestionRows(
  roomScoreDetails: Record<string, RoomScoreResult>,
  scoredRoomIds: string[],
  category: string,
  subcategory: string,
  surveyType: SurveyType,
  session: SurveySession,
  schoolClass?: string | null,
): WalkthroughQuestionRow[] {
  const byUnit = new Map<
    string,
    { scores: number[]; weight: number; category: string; subcategory: string; sampleRoomId: string }
  >()

  for (const roomId of scoredRoomIds) {
    const detail = roomScoreDetails[roomId]
    if (!detail) continue
    for (const qs of detail.questionScores ?? []) {
      if (qs.category !== category || qs.subcategory !== subcategory) continue
      const entry = byUnit.get(qs.questionId) ?? {
        scores: [],
        weight: qs.weight,
        category: qs.category,
        subcategory: qs.subcategory,
        sampleRoomId: roomId,
      }
      entry.scores.push(qs.score * 100)
      entry.weight = qs.weight
      byUnit.set(qs.questionId, entry)
    }
  }

  return [...byUnit.entries()]
    .map(([unitId, data]) => {
      const roomSession = session.rooms[data.sampleRoomId]
      const rubric = getRoomSurveyRubric(
        surveyType === "closeout" ? roomSession?.sourceSurveyType ?? surveyType : surveyType,
        roomSession?.roomType,
        roomSession?.gradeType,
        schoolClass,
      )
      const label = rubric
        ? resolveQuestionLabel(unitId, rubric.questions, rubric.options)
        : { questionId: unitId, stem: unitId, itemLabel: null }
      return {
        unitId,
        questionId: label.questionId,
        stem: label.stem,
        itemLabel: label.itemLabel,
        category: data.category,
        subcategory: data.subcategory,
        averageScore: average(data.scores),
        roomCount: data.scores.length,
        weight: data.weight,
      }
    })
    .sort((a, b) => a.questionId.localeCompare(b.questionId) || a.unitId.localeCompare(b.unitId))
}

export function buildRoomRowsForFocus(
  focus: WalkthroughFocus,
  campus: CampusScoreSummary,
  roomScoreDetails: Record<string, RoomScoreResult>,
  session: SurveySession,
  surveyType: SurveyType,
  allRooms: ParsedPlanRoom[],
  focusRoomId?: string | null,
  schoolClass?: string | null,
): WalkthroughRoomRow[] {
  const scored = campus.rooms.filter((r) => r.overallScore !== null)
  const rows: WalkthroughRoomRow[] = []

  for (const entry of scored) {
    const detail = roomScoreDetails[entry.roomId]
    const roomSession = session.rooms[entry.roomId]
    const roomName =
      entry.roomName ||
      allRooms.find((r) => r.id === entry.roomId)?.name ||
      entry.roomId

    if (focus.level === "campus") {
      rows.push({
        roomId: entry.roomId,
        roomName,
        neighborhood: entry.neighborhood,
        gradeType: entry.gradeType,
        overallScore: entry.overallScore,
        levelScore: entry.overallScore,
      })
      continue
    }

    if (!detail) continue

    if (focus.level === "category") {
      const cat = detail.categoryScores.find((c) => c.category === focus.category)
      if (!cat) continue
      rows.push({
        roomId: entry.roomId,
        roomName,
        neighborhood: entry.neighborhood,
        gradeType: entry.gradeType,
        overallScore: entry.overallScore,
        levelScore: cat.score,
      })
      continue
    }

    if (focus.level === "subcategory") {
      const sub = detail.subcategoryScores.find(
        (s) => s.category === focus.category && s.subcategory === focus.subcategory,
      )
      if (!sub) continue
      rows.push({
        roomId: entry.roomId,
        roomName,
        neighborhood: entry.neighborhood,
        gradeType: entry.gradeType,
        overallScore: entry.overallScore,
        levelScore: sub.score,
      })
      continue
    }

    // question unit
    const qs = detail.questionScores.find((q) => q.questionId === focus.unitId)
    const rubric = getRoomSurveyRubric(
      surveyType === "closeout" ? roomSession?.sourceSurveyType ?? surveyType : surveyType,
      roomSession?.roomType,
      roomSession?.gradeType,
      schoolClass,
    )
    const response = rubric
      ? responseForUnit(roomSession, focus.unitId, rubric.options)
      : roomSession?.responses.find((r) => r.questionId === focus.unitId)

    const answerLabel = formatAnswerValue(response?.value)
    const excluded =
      responseRequiresUnableToAssessNote(response?.value) ||
      (typeof response?.value === "string" && isNotAbleToAssessOption(response.value)) ||
      (Array.isArray(response?.value) && response.value.some(isNotAbleToAssessOption))

    if (!qs && !excluded) continue

    rows.push({
      roomId: entry.roomId,
      roomName,
      neighborhood: entry.neighborhood,
      gradeType: entry.gradeType,
      overallScore: entry.overallScore,
      levelScore: qs ? qs.score * 100 : null,
      answerLabel,
      comment: response?.comment,
      excludedFromScore: excluded && !qs,
    })
  }

  rows.sort((a, b) => {
    if (focusRoomId) {
      if (a.roomId === focusRoomId) return -1
      if (b.roomId === focusRoomId) return 1
    }
    const as = a.levelScore
    const bs = b.levelScore
    if (as == null && bs == null) return a.roomName.localeCompare(b.roomName)
    if (as == null) return 1
    if (bs == null) return -1
    return as - bs
  })

  return rows
}

export function categoryWeightShare(categories: WalkthroughCategoryRow[], category: string): number {
  const total = categories.reduce((s, c) => s + c.weight, 0)
  if (total <= 0) return 0
  const cat = categories.find((c) => c.category === category)
  return cat ? cat.weight / total : 0
}

export function scoredRoomIds(campus: CampusScoreSummary): string[] {
  return campus.rooms.filter((r) => r.overallScore !== null).map((r) => r.roomId)
}

/**
 * Fill in missing roomScoreDetails by recomputing from session responses
 * (needed after restore when details are not persisted).
 */
export function ensureWalkthroughScoreDetails(
  session: SurveySession,
  roomScoreDetails: Record<string, RoomScoreResult>,
  surveyType: SurveyType,
  roomIds: string[],
  schoolClass?: string | null,
): Record<string, RoomScoreResult> {
  let changed = false
  const next: Record<string, RoomScoreResult> = { ...roomScoreDetails }

  for (const roomId of roomIds) {
    if (next[roomId]?.subcategoryScores?.length) continue
    const roomSession = session.rooms[roomId]
    if (!roomSession) continue

    const effectiveType =
      surveyType === "closeout" ? roomSession.sourceSurveyType ?? surveyType : surveyType
    const rubric = getRoomSurveyRubric(
      effectiveType,
      roomSession.roomType,
      roomSession.gradeType,
      schoolClass,
    )
    if (!rubric) continue

    const result = scoreRoomSessionWithMetadata(
      roomSession,
      rubric,
      EMPTY_WEIGHT_OVERRIDES,
      undefined,
    )
    next[roomId] = { ...result, roomId }
    changed = true
  }

  return changed ? next : roomScoreDetails
}

export function findRoomEntry(
  campus: CampusScoreSummary,
  roomId: string,
): ScoredRoomEntry | undefined {
  return campus.rooms.find((r) => r.roomId === roomId)
}
