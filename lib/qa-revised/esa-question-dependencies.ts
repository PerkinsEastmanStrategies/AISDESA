import type { EsaQuestion, RoomQuestionResponse } from "@aisd/shared"
import { isNotAbleToAssessText, isShelterInPlaceSafetyLabel } from "@/lib/qa-revised/non-scoring"

export { isShelterInPlaceSafetyLabel }

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
  const text = question.question.trim().toLowerCase()
  return (
    text === "are there exterior windows?" ||
    text.startsWith("are there exterior windows") ||
    text.startsWith("does the community room have exterior windows")
  )
}

/** Dependent questions skipped when the parent exterior-windows answer is "No". */
export function isExteriorWindowsSkipWhenNoDependent(
  question: Pick<EsaQuestion, "question">,
): boolean {
  const text = String(question.question ?? "").trim()
  return /^Select all that apply \(exterior windows/i.test(text)
}

export function isExteriorWindowsSelectAllQuestion(
  question: Pick<EsaQuestion, "question">,
): boolean {
  return isExteriorWindowsSkipWhenNoDependent(question)
}

/**
 * Views / clerestory / none-of-the-above are separate score units. Campus scoring
 * averages those units, so "Access to views" alone was 50%. Use the best unit
 * so views = 100% and clerestory-only stays 50%.
 */
export function collapseExteriorWindowsSelectAll<
  T extends { questionId: string; question: string; score: number },
>(units: T[]): T[] {
  const maxByQuestion = new Map<string, number>()
  for (const unit of units) {
    if (!isExteriorWindowsSelectAllQuestion({ question: unit.question })) continue
    if (!Number.isFinite(unit.score)) continue
    const current = maxByQuestion.get(unit.questionId)
    if (current == null || unit.score > current) maxByQuestion.set(unit.questionId, unit.score)
  }
  if (!maxByQuestion.size) return units
  return units.map((unit) => {
    const max = maxByQuestion.get(unit.questionId)
    if (max == null || !Number.isFinite(unit.score) || unit.score === max) return unit
    return { ...unit, score: max }
  })
}

/** Interior visibility select-all: windows vs door panel / sidelight. */
export function isInteriorVisibilitySelectAllQuestion(
  question: Pick<EsaQuestion, "question">,
): boolean {
  return /^What type of visibility is provided into the space from adjacent interior spaces/i.test(
    question.question.trim(),
  )
}

function optionLabelSelected(
  label: string,
  answer: string,
  score: number,
): boolean {
  const text = label.trim()
  if (!text) return false
  if (answer.includes(text)) return true
  if (!answer && Number.isFinite(score) && score > 0) return true
  return false
}

function isVisibilityWindowLabel(label: string): boolean {
  const text = label.trim()
  if (/full-height interior window/i.test(text) || /half-height interior window/i.test(text)) {
    return true
  }
  return /^interior window$/i.test(text)
}

function isVisibilitySidelightLabel(label: string): boolean {
  return /^sidelight$/i.test(label.trim())
}

function isVisibilityDoorPanelLabel(label: string): boolean {
  return /door panel/i.test(label)
}

/**
 * Full- or half-height window = 1.
 * Door panel or sidelight alone = 0.5.
 * Door panel and sidelight together = 1.
 */
export function interiorVisibilityScore(
  units: ReadonlyArray<{ itemLabel?: string | null; answer?: string | null; score: number }>,
): number {
  const answer = units.map((unit) => unit.answer?.trim()).find(Boolean) ?? ""
  let hasWindow = false
  let hasSidelight = false
  let hasDoorPanel = false
  for (const unit of units) {
    const label = unit.itemLabel ?? ""
    if (!optionLabelSelected(label, answer, unit.score)) continue
    if (isVisibilityWindowLabel(label)) hasWindow = true
    if (isVisibilitySidelightLabel(label)) hasSidelight = true
    if (isVisibilityDoorPanelLabel(label)) hasDoorPanel = true
  }
  if (hasWindow) return 1
  if (hasDoorPanel && hasSidelight) return 1
  if (hasDoorPanel || hasSidelight) return 0.5
  return 0
}

export function collapseInteriorVisibilitySelectAll<
  T extends {
    questionId: string
    question: string
    score: number
    itemLabel?: string | null
    answer?: string | null
  },
>(units: T[]): T[] {
  const groups = new Map<string, T[]>()
  for (const unit of units) {
    if (!isInteriorVisibilitySelectAllQuestion({ question: unit.question })) continue
    const list = groups.get(unit.questionId) ?? []
    list.push(unit)
    groups.set(unit.questionId, list)
  }
  if (!groups.size) return units
  const scoreByQuestion = new Map<string, number>()
  for (const [questionId, group] of groups) {
    scoreByQuestion.set(questionId, interiorVisibilityScore(group))
  }
  return units.map((unit) => {
    const next = scoreByQuestion.get(unit.questionId)
    if (next == null || !Number.isFinite(unit.score) || unit.score === next) return unit
    return { ...unit, score: next }
  })
}

/** Play field features: four groups, not six checkboxes. */
export function isPlayFieldFeaturesQuestion(question: Pick<EsaQuestion, "question">): boolean {
  return /^Select all that are present \(play field features\)/i.test(question.question.trim())
}

/**
 * 1) grass or turf  2) shade trees  3) exercise trail  4) seating or play structures.
 */
export function playFieldFeaturesScore(
  units: ReadonlyArray<{ itemLabel?: string | null; answer?: string | null; score: number }>,
): number {
  const answer = units.map((unit) => unit.answer?.trim()).find(Boolean) ?? ""
  let hasSurface = false
  let hasShade = false
  let hasTrail = false
  let hasAmenity = false
  for (const unit of units) {
    const label = unit.itemLabel ?? ""
    if (!optionLabelSelected(label, answer, unit.score)) continue
    const text = label.trim().toLowerCase()
    if (text.includes("natural grass") || text.includes("synthetic turf")) hasSurface = true
    if (text.includes("shade trees")) hasShade = true
    if (text.includes("exercise trail")) hasTrail = true
    if (text.includes("flexible seating") || text.includes("play structures")) hasAmenity = true
  }
  return ([hasSurface, hasShade, hasTrail, hasAmenity].filter(Boolean).length) / 4
}

export function collapsePlayFieldFeaturesSelectAll<
  T extends {
    questionId: string
    question: string
    score: number
    itemLabel?: string | null
    answer?: string | null
  },
>(units: T[]): T[] {
  const groups = new Map<string, T[]>()
  for (const unit of units) {
    if (!isPlayFieldFeaturesQuestion({ question: unit.question })) continue
    const list = groups.get(unit.questionId) ?? []
    list.push(unit)
    groups.set(unit.questionId, list)
  }
  if (!groups.size) return units
  const scoreByQuestion = new Map<string, number>()
  for (const [questionId, group] of groups) {
    scoreByQuestion.set(questionId, playFieldFeaturesScore(group))
  }
  return units.map((unit) => {
    const next = scoreByQuestion.get(unit.questionId)
    if (next == null || !Number.isFinite(unit.score) || unit.score === next) return unit
    return { ...unit, score: next }
  })
}

/** Adjacent-space visibility: either collaboration or small-group visibility is full credit. */
export function isAdjacentVisibilitySelectAllQuestion(
  question: Pick<EsaQuestion, "question"> & { questionId?: string },
): boolean {
  const id = String(question.questionId ?? "").trim().toUpperCase()
  if (id === "ST-030" || id === "PK-031" || id === "EC-030" || id === "SC-027") return true
  return /^Select all that are present \(visibility into adjacent spaces\)/i.test(
    String(question.question ?? "").trim(),
  )
}

export function collapseAdjacentVisibilitySelectAll<
  T extends { questionId: string; question: string; score: number },
>(units: T[]): T[] {
  const maxByQuestion = new Map<string, number>()
  for (const unit of units) {
    if (!isAdjacentVisibilitySelectAllQuestion(unit)) continue
    if (!Number.isFinite(unit.score)) continue
    const current = maxByQuestion.get(unit.questionId)
    if (current == null || unit.score > current) maxByQuestion.set(unit.questionId, unit.score)
  }
  if (!maxByQuestion.size) return units
  return units.map((unit) => {
    const max = maxByQuestion.get(unit.questionId)
    if (max == null || !Number.isFinite(unit.score) || unit.score === max) return unit
    return { ...unit, score: max }
  })
}

export function collapseSelectAllQuestionScores<
  T extends {
    questionId: string
    question: string
    score: number
    itemLabel?: string | null
    answer?: string | null
  },
>(units: T[]): T[] {
  return collapseDiningCommonsRestroomProximity(
    collapseSafetyExteriorCoveringFromWindowCoverings(
      omitSafetyExteriorCoveringWhenNoWindows(
        omitSafetyShelterInPlace(
          collapsePlayFieldFeaturesSelectAll(
            collapseAdjacentVisibilitySelectAll(
              collapseInteriorVisibilitySelectAll(collapseExteriorWindowsSelectAll(units)),
            ),
          ),
        ),
      ),
    ),
  )
}

const RESTROOM_PROXIMITY_CREDIT_IDS = new Set(["DC-027", "EM-035"])

/** Dining Commons / Empower Center restroom proximity: family or learner also credits generic restroom. */
export function isDiningCommonsRestroomProximityQuestion(
  question: Pick<EsaQuestion, "question"> & { questionId?: string },
): boolean {
  return RESTROOM_PROXIMITY_CREDIT_IDS.has(String(question.questionId ?? "").trim().toUpperCase())
}

function isFamilyOrLearnerRestroomLabel(label: string): boolean {
  const text = label.trim().toLowerCase()
  return text.includes("family restroom") || text.includes("learner restroom")
}

function isGenericRestroomAvailableLabel(label: string): boolean {
  const text = label.trim().toLowerCase()
  if (text.includes("family restroom") || text.includes("learner restroom")) return false
  return text.startsWith("a restroom is")
}

export function collapseDiningCommonsRestroomProximity<
  T extends {
    questionId: string
    question: string
    score: number
    itemLabel?: string | null
    answer?: string | null
  },
>(units: T[]): T[] {
  const groups = new Map<string, T[]>()
  for (const unit of units) {
    if (!isDiningCommonsRestroomProximityQuestion(unit)) continue
    const list = groups.get(unit.questionId) ?? []
    list.push(unit)
    groups.set(unit.questionId, list)
  }
  if (!groups.size) return units
  const creditGeneric = new Set<string>()
  for (const [questionId, group] of groups) {
    const answer = group.map((unit) => unit.answer?.trim()).find(Boolean) ?? ""
    const hasSpecific = group.some((unit) => {
      const label = unit.itemLabel ?? ""
      return isFamilyOrLearnerRestroomLabel(label) && optionLabelSelected(label, answer, unit.score)
    })
    if (hasSpecific) creditGeneric.add(questionId)
  }
  if (!creditGeneric.size) return units
  return units.map((unit) => {
    if (!creditGeneric.has(unit.questionId)) return unit
    if (!isGenericRestroomAvailableLabel(unit.itemLabel ?? "")) return unit
    if (unit.score === 1) return unit
    return { ...unit, score: 1 }
  })
}

export function isWindowCoveringsQuestion(
  question: Pick<EsaQuestion, "question">,
): boolean {
  return /^what window coverings are provided on exterior windows/i.test(question.question.trim())
}

export function isSafetySelectAllQuestion(
  question: Pick<EsaQuestion, "question">,
): boolean {
  return /^select all that apply \(safety\)/i.test(question.question.trim())
}

export function isExteriorGlassCoveringLabel(label: string | null | undefined): boolean {
  return /exterior windows and doors with glass can be covered/i.test(String(label ?? ""))
}

function isPresentWindowCoveringLabel(value: string | null | undefined): boolean {
  const text = String(value ?? "").trim().toLowerCase()
  if (!text) return false
  if (isNotAbleToAssessText(value)) return false
  if (text.includes("no window covering")) return false
  if (/mini[-\s]?blinds?/.test(text)) return true
  if (/roller shades?/.test(text)) return true
  return /\bother\b/.test(text)
}

/** Mini-blinds, roller shades, or other coverings were recorded on the earlier covering question. */
export function roomHasPresentWindowCoverings(
  units: ReadonlyArray<{ question: string; itemLabel?: string | null; answer?: string | null }>,
): boolean {
  return units.some((unit) => {
    if (!isWindowCoveringsQuestion({ question: unit.question })) return false
    return isPresentWindowCoveringLabel(unit.answer) || isPresentWindowCoveringLabel(unit.itemLabel)
  })
}

/**
 * If coverings are already present, treat "exterior windows and doors with glass
 * can be covered with a single movement" as met on the safety select-all.
 */
export function collapseSafetyExteriorCoveringFromWindowCoverings<
  T extends {
    question: string
    score: number
    itemLabel?: string | null
    answer?: string | null
  },
>(units: T[]): T[] {
  if (!roomHasPresentWindowCoverings(units)) return units
  return units.map((unit) => {
    if (!isSafetySelectAllQuestion({ question: unit.question })) return unit
    if (!isExteriorGlassCoveringLabel(unit.itemLabel)) return unit
    if (unit.score === 1) return unit
    return { ...unit, score: 1 }
  })
}

/** True when the room already answered No to having exterior windows. */
export function roomAnsweredNoExteriorWindows(
  units: ReadonlyArray<{ question: string; answer?: string | null }>,
): boolean {
  return units.some((unit) => {
    if (!isExteriorWindowsParentQuestion({ question: unit.question })) return false
    return isNoAnswer((unit.answer ?? "").trim() || undefined)
  })
}

/**
 * If the space has no exterior windows, drop the safety option about covering
 * exterior glass so it is neither credited nor penalized.
 */
export function omitSafetyExteriorCoveringWhenNoWindows<
  T extends {
    question: string
    itemLabel?: string | null
    answer?: string | null
  },
>(units: T[]): T[] {
  if (!roomAnsweredNoExteriorWindows(units)) return units
  return units.filter((unit) => {
    if (!isSafetySelectAllQuestion({ question: unit.question })) return true
    return !isExteriorGlassCoveringLabel(unit.itemLabel)
  })
}

/** Shelter-in-place is recorded only; do not include it in the safety average. */
export function omitSafetyShelterInPlace<
  T extends {
    question: string
    itemLabel?: string | null
  },
>(units: T[]): T[] {
  return units.filter((unit) => {
    if (!isSafetySelectAllQuestion({ question: unit.question })) return true
    return !isShelterInPlaceSafetyLabel(unit.itemLabel)
  })
}

/** Borrowed-daylight follow-up: only scores when the space does not have exterior windows. */
export function isBorrowedDaylightQuestion(
  question: Pick<EsaQuestion, "question">,
): boolean {
  return question.question
    .trim()
    .toLowerCase()
    .startsWith("is daylight accessible through another means")
}

/** True when a room already answered Yes to having exterior windows. */
export function roomHasExteriorWindows(
  units: ReadonlyArray<{ question: string; answer?: string | null; score?: number }>,
): boolean {
  return units.some((unit) => {
    if (!isExteriorWindowsParentQuestion({ question: unit.question })) return false
    if (isYesAnswer((unit.answer ?? "").trim() || undefined)) return true
    return !unit.answer && unit.score === 1
  })
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

function isYesAnswer(value: string | undefined): boolean {
  const text = String(value ?? "").trim().toLowerCase()
  return text === "yes" || text.startsWith("yes ") || text.startsWith("yes,")
}

function isNoAnswer(value: string | undefined): boolean {
  const text = String(value ?? "").trim().toLowerCase()
  return text === "no" || text.startsWith("no ") || text.startsWith("no,") || text.startsWith("no.")
}

function isParentAnsweredNo(parentId: string, responses: RoomQuestionResponse[]): boolean {
  const parent = responses.find((r) => r.questionId === parentId)
  return responseValue(parent) === "No"
}

function isParentAnsweredYes(parentId: string, responses: RoomQuestionResponse[]): boolean {
  const parent = responses.find((r) => r.questionId === parentId)
  return isYesAnswer(responseValue(parent))
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

function borrowedDaylightDependentIds(
  parentId: string,
  questions: readonly EsaQuestion[],
): readonly string[] {
  const parentIndex = questions.findIndex((q) => q.questionId === parentId)
  if (parentIndex < 0) return []

  const ids: string[] = []
  for (let i = parentIndex + 1; i < questions.length; i++) {
    const q = questions[i]
    if (isExteriorWindowsParentQuestion(q)) break
    if (isBorrowedDaylightQuestion(q)) ids.push(q.questionId)
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

function isSkippedByExteriorWindowsYes(
  questionId: string,
  responses: RoomQuestionResponse[],
  questions: readonly EsaQuestion[],
): boolean {
  for (const question of questions) {
    if (!isExteriorWindowsParentQuestion(question)) continue
    if (!isParentAnsweredYes(question.questionId, responses)) continue
    if (borrowedDaylightDependentIds(question.questionId, questions).includes(questionId)) {
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
  if (questions?.length && isSkippedByExteriorWindowsYes(questionId, responses, questions)) {
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
      return "Skipped — this dedicated space is not at the school."
    }
    return "Skipped — this space type is not at the school."
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

  if (
    questions?.length &&
    isSkippedByExteriorWindowsYes(questionId, responses, questions)
  ) {
    return "Skipped — this space already has exterior windows."
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
