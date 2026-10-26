import {
  EMPTY_WEIGHT_OVERRIDES,
  getRoomSurveyRubric,
  isInventoryOption,
  isMultiSelectQuestionType,
  isNotAbleToAssessOption,
  responseRequiresUnableToAssessNote,
  schoolLevelFromSchoolClass,
  scoringFocusAreaForRoom,
  scoringFocusAreaLabel,
  type EsaQuestionOption,
  type RoomQuestionResponse,
  type RoomScoreResult,
  type RoomSurveySession,
  type SurveySession,
  type SurveyType,
} from "@aisd/shared"
import { aggregateCampusScores } from "@aisd/shared"
import type {
  AssessedRoomRecord,
  CampusScoringSnapshot,
  FocusAreaGroup,
  SpaceTypeGroup,
} from "@/lib/campus-scoring-tree"
import { scoreRoomSessionWithMetadata } from "@/lib/traditional-studio-room-score"
import { isNonViableSelectAllOption } from "@/lib/qa-revised/non-scoring"
import { scoreSchool } from "@/lib/qa-revised/scoring"
import {
  EMPTY_OVERRIDES,
  alignSnapshotToWeights,
  createWeightResolver,
  filterWeightsForLevel,
} from "@/lib/qa-revised/weights"
import type {
  SchoolLevel,
  SchoolSnapshot,
  ScoreNode,
  ScoredRoom,
  ScoredUnit,
  WeightFile,
} from "@/lib/qa-revised/types"
import revisedWeights from "@/lib/qa-revised/revised.json"

const WEIGHTS = revisedWeights as WeightFile

function answerLabel(value: string | string[] | null | undefined): string | null {
  if (value == null || value === "") return null
  if (Array.isArray(value)) {
    const joined = value.filter(Boolean).join(", ")
    return joined || null
  }
  return String(value)
}

function viableOptionGroups(questionId: string, options: EsaQuestionOption[]) {
  const groups = new Map<string, EsaQuestionOption[]>()
  for (const opt of options) {
    if (opt.questionId !== questionId) continue
    if (!opt.option?.trim()) continue
    if (isInventoryOption(opt)) continue
    if (isNonViableSelectAllOption(opt.option) || isNotAbleToAssessOption(opt.option)) continue
    const unitId = opt.scoreGroupId || opt.scoreId
    if (!unitId) continue
    const list = groups.get(unitId) ?? []
    list.push(opt)
    groups.set(unitId, list)
  }
  return groups
}

function unitsFromRoomSession(
  room: AssessedRoomRecord,
  roomSession: RoomSurveySession,
  schoolClass?: string | null,
): ScoredUnit[] {
  const rubric = getRoomSurveyRubric(
    room.surveyType,
    roomSession.roomType,
    roomSession.gradeType,
    schoolClass,
  )
  if (!rubric) return []

  const result = scoreRoomSessionWithMetadata(roomSession, rubric, EMPTY_WEIGHT_OVERRIDES)
  const questionById = new Map(rubric.questions.map((question) => [question.questionId, question]))
  const parentByUnit = new Map<string, string>()
  for (const opt of rubric.options) {
    const unitId = opt.scoreGroupId || opt.scoreId
    if (unitId && !parentByUnit.has(unitId)) parentByUnit.set(unitId, opt.questionId)
  }

  const scoredByUnitId = new Map(result.questionScores.map((unit) => [unit.questionId, unit]))
  const parentIds = new Set(
    result.questionScores.map((unit) => parentByUnit.get(unit.questionId) ?? unit.questionId),
  )
  for (const question of rubric.questions) {
    if (!isMultiSelectQuestionType(question.questionType)) continue
    const response = roomSession.responses.find((row: RoomQuestionResponse) => row.questionId === question.questionId)
    if (!response) continue
    if (responseRequiresUnableToAssessNote(response.value)) continue
    parentIds.add(question.questionId)
  }

  const units: ScoredUnit[] = []
  for (const parentId of parentIds) {
    const question = questionById.get(parentId)
    const groups = viableOptionGroups(parentId, rubric.options)
    if (!groups.size) continue
    const response = roomSession.responses.find((row) => row.questionId === parentId)
    const answer = answerLabel(response?.value)
    const isMulti = question ? isMultiSelectQuestionType(question.questionType) : false

    for (const [unitId, unitOptions] of groups) {
      const scored = scoredByUnitId.get(unitId)
      let score = scored?.score
      if (score == null) {
        if (!isMulti) continue
        score = 0
      }
      const texts = [...new Set(unitOptions.map((opt) => opt.option.trim()).filter(Boolean))]
      units.push({
        questionId: parentId,
        unitId,
        question: question?.question ?? parentId,
        category: scored?.category ?? question?.category ?? "",
        subcategory: scored?.subcategory ?? question?.subcategory ?? "",
        score,
        itemLabel: groups.size > 1 ? (texts.length === 1 ? texts[0] : unitId) : null,
        answer,
      })
    }
  }
  return units
}

function toQaRoom(
  room: AssessedRoomRecord,
  session: SurveySession | undefined,
  schoolClass?: string | null,
): ScoredRoom {
  const focusAreaId =
    scoringFocusAreaForRoom(room.surveyType, room.spaceType, schoolClass) ?? room.focusAreaId
  const roomSession = session?.rooms[room.roomId]
  return {
    roomId: room.roomId,
    roomName: room.roomName,
    surveyType: room.surveyType,
    spaceType: room.spaceType,
    focusAreaId,
    focusAreaLabel: scoringFocusAreaLabel(focusAreaId),
    neighborhood: room.neighborhood,
    gradeType: room.gradeType,
    markedAbsent: !!room.spaceTypeDoesNotExist,
    units:
      room.spaceTypeDoesNotExist || !roomSession
        ? []
        : unitsFromRoomSession(room, roomSession, schoolClass),
  }
}

function indexRoomNodes(focusAreas: ScoreNode[]): Map<string, ScoreNode> {
  const map = new Map<string, ScoreNode>()
  for (const focus of focusAreas) {
    for (const space of focus.children ?? []) {
      for (const room of space.children ?? []) {
        if (room.roomId) map.set(room.roomId, room)
      }
    }
  }
  return map
}

function detailsFromRoomNode(roomId: string, node: ScoreNode | undefined): RoomScoreResult | undefined {
  if (!node || node.score == null) {
    return node
      ? {
          roomId,
          overallScore: node.score,
          categoryScores: [],
          subcategoryScores: [],
          questionScores: [],
          answeredCount: 0,
          totalCount: 0,
        }
      : undefined
  }
  const categoryScores = []
  const subcategoryScores = []
  const questionScores = []
  for (const cat of node.children ?? []) {
    if (cat.score != null && cat.weight > 0) {
      categoryScores.push({ category: cat.label, score: cat.score, weight: cat.weight })
    }
    for (const sub of cat.children ?? []) {
      if (sub.score != null) {
        subcategoryScores.push({
          category: cat.label,
          subcategory: sub.label,
          score: sub.score,
          weight: sub.weight,
        })
      }
      for (const question of sub.children ?? []) {
        if (question.score == null) continue
        const unitId = question.id.split("::").pop() || question.questionId || question.id
        questionScores.push({
          questionId: unitId,
          category: cat.label,
          subcategory: sub.label,
          score: question.score / 100,
          weight: question.weight,
        })
      }
    }
  }
  return {
    roomId,
    overallScore: node.score,
    categoryScores,
    subcategoryScores,
    questionScores,
    answeredCount: questionScores.length,
    totalCount: questionScores.length,
  }
}

function spaceTypeFromNode(
  node: ScoreNode,
  roomsById: Map<string, AssessedRoomRecord>,
  detailsByRoom: Map<string, RoomScoreResult>,
  surveyType: SurveyType,
): SpaceTypeGroup {
  const roomNodes = (node.children ?? []).filter((child) => child.kind === "room" || child.roomId)
  const rooms: AssessedRoomRecord[] = []
  for (const roomNode of roomNodes) {
    const source = roomNode.roomId ? roomsById.get(roomNode.roomId) : undefined
    if (!source) continue
    const details = detailsByRoom.get(source.roomId)
    rooms.push({
      ...source,
      overallScore: roomNode.score,
      categoryScores: details?.categoryScores ?? source.categoryScores,
    })
  }
  const scored = rooms.filter((room) => room.overallScore != null)
  return {
    spaceType: node.label,
    surveyType: rooms[0]?.surveyType ?? surveyType,
    spaceTypeWeight: node.weight,
    roomCount: rooms.length,
    scoredRoomCount: scored.length,
    overallScore: node.score,
    categoryScores: scored[0]
      ? averageCategoryScores(scored)
      : [],
    rooms,
  }
}

function averageCategoryScores(rooms: AssessedRoomRecord[]) {
  const byCat = new Map<string, { scores: number[]; weight: number }>()
  for (const room of rooms) {
    if (room.overallScore == null) continue
    for (const cat of room.categoryScores) {
      if (cat.weight <= 0) continue
      const entry = byCat.get(cat.category) ?? { scores: [], weight: cat.weight }
      entry.scores.push(cat.score)
      byCat.set(cat.category, entry)
    }
  }
  return Array.from(byCat.entries()).map(([category, { scores, weight }]) => ({
    category,
    score: scores.reduce((sum, value) => sum + value, 0) / scores.length,
    weight,
  }))
}

/**
 * Re-roll Results using the QA portal Revised Categories weights and inventory rules.
 * Assessment (in-room) scoring is unchanged; this only overlays the Results tree.
 */
export function applyRevisedResultsScoring(
  snapshot: CampusScoringSnapshot,
  schoolClass?: string | null,
): CampusScoringSnapshot {
  const level = (schoolLevelFromSchoolClass(schoolClass) ?? "ES") as SchoolLevel
  const roomsById = new Map(snapshot.allRooms.map((room) => [room.roomId, room]))
  const qaRooms = snapshot.allRooms.map((room) =>
    toQaRoom(room, snapshot.sessionsBySurveyType[room.surveyType], schoolClass),
  )
  const rawSnapshot: SchoolSnapshot = {
    schoolId: snapshot.schoolId,
    schoolName: snapshot.schoolName,
    campusId: snapshot.campusId,
    schoolClass: schoolClass ?? "",
    schoolLevel: level,
    exportedAt: new Date().toISOString(),
    roomCount: qaRooms.length,
    scoredUnitCount: qaRooms.reduce((sum, room) => sum + room.units.length, 0),
    rooms: qaRooms,
  }
  const levelWeights = filterWeightsForLevel(WEIGHTS, level)
  const aligned = alignSnapshotToWeights(rawSnapshot, levelWeights)
  const resolver = createWeightResolver(levelWeights, EMPTY_OVERRIDES)
  const card = scoreSchool(aligned, resolver)
  const roomNodes = indexRoomNodes(card.focusAreas)
  const detailsByRoom = new Map<string, RoomScoreResult>()
  const detailsBySurvey: CampusScoringSnapshot["roomScoreDetailsBySurveyType"] = {}

  const allRooms = snapshot.allRooms.map((room) => {
    if (room.spaceTypeDoesNotExist) {
      return { ...room, overallScore: 0, categoryScores: [] }
    }
    const node = roomNodes.get(room.roomId)
    const details = detailsFromRoomNode(room.roomId, node)
    if (details) {
      detailsByRoom.set(room.roomId, details)
      const bySurvey = detailsBySurvey[room.surveyType] ?? {}
      bySurvey[room.roomId] = details
      detailsBySurvey[room.surveyType] = bySurvey
    }
    return {
      ...room,
      overallScore: node?.score ?? null,
      categoryScores: details?.categoryScores ?? [],
    }
  })

  const roomsForTree = new Map(allRooms.map((room) => [room.roomId, room]))
  const focusAreas: FocusAreaGroup[] = card.focusAreas.map((focus) => {
    const spaceTypes = (focus.children ?? [])
      .filter((child) => child.kind !== "room")
      .map((space) =>
        spaceTypeFromNode(
          space,
          roomsForTree,
          detailsByRoom,
          (space.children ?? []).find((child) => child.roomId)
            ? roomsForTree.get(space.children!.find((child) => child.roomId)!.roomId!)?.surveyType ??
              "studios"
            : "studios",
        ),
      )
      .filter((space) => space.roomCount > 0)
    const areaRooms = spaceTypes.flatMap((space) => space.rooms)
    const scored = areaRooms.filter((room) => room.overallScore != null)
    return {
      id: focus.id,
      label: focus.label,
      focusAreaWeight: focus.weight,
      roomCount: areaRooms.length,
      scoredRoomCount: scored.length,
      overallScore: focus.score,
      categoryScores: averageCategoryScores(scored),
      spaceTypes,
    }
  })

  const campusAgg = aggregateCampusScores(allRooms, {
    schoolId: snapshot.schoolId,
    schoolName: snapshot.schoolName,
    campusId: snapshot.campusId,
  })

  return {
    ...snapshot,
    focusAreas,
    allRooms,
    neighborhoods: campusAgg.neighborhoods,
    campusOverallScore: card.overall,
    campusOverallScoreExistingOnly: card.existingOnly,
    roomScoreDetailsBySurveyType: detailsBySurvey,
  }
}
