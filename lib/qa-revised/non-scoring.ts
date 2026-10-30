import { isObservational } from "@/lib/qa-revised/normalize"

export function isInventoryText(value: string | null | undefined): boolean {
  return /inventory/i.test(String(value ?? ""))
}

export function isNotAbleToAssessText(value: string | null | undefined): boolean {
  if (!value) return false
  const text = value.trim().toLowerCase()
  return (
    text === "not able to assess" ||
    text.startsWith("not able to assess ") ||
    text === "unable to assess" ||
    text.startsWith("unable to assess")
  )
}

/** Dummy select-all choices that must not sit in the score denominator. */
export function isNonViableSelectAllOption(value: string | null | undefined): boolean {
  if (!value) return false
  const text = value.trim().toLowerCase()
  return (
    text === "none of the above" ||
    text.startsWith("none of the above ") ||
    isNotAbleToAssessText(value)
  )
}

export function isInventoryUnitId(unitId: string | null | undefined): boolean {
  return String(unitId ?? "").trim().endsWith("i")
}

export function isDiningCommonsTackboardQuestion(questionId: string | null | undefined): boolean {
  return String(questionId ?? "").trim().toUpperCase() === "DC-015"
}

/** Safety select-all option that Version C (3) marks inventory (ScoreID `i`). */
export function isShelterInPlaceSafetyLabel(label: string | null | undefined): boolean {
  return /area large enough for a full class to easily get out of sight to shelter-in-place/i.test(
    String(label ?? ""),
  )
}

/**
 * Version C survey questions whose every option ScoreID ends in `i` (inventory /
 * recorded only) but walk snapshots still store scored unit IDs. Keep this list
 * aligned with the spreadsheet, not with weights.
 */
const SURVEY_INVENTORY_QUESTION_IDS = new Set([
  "AD-016",
  "AD-017",
  "AT-003",
  "AT-004",
  "AT-007",
  "DN-002",
  "DN-003",
  "DN-004",
  "EG-008",
  "EM-004",
  "LI-002",
  "LI-020",
  "MA-012",
  "MI-021",
  "MW-002",
  "MW-008",
  "MW-021",
  "MW-036",
  "OA-009",
  "OD-003",
  "OD-012",
  "OD-014",
  "OD-021",
  "OD-037",
  "OD-044",
  "OD-048",
  "OD-049",
  "OD-050",
  "OD-051",
  "OD-052",
  "OD-053",
  "OD-054",
  "OD-055",
  "OD-056",
  "OD-057",
  "OD-060",
  "PL-004",
  "WE-002",
])

export function isSurveyInventoryQuestion(questionId: string | null | undefined): boolean {
  return SURVEY_INVENTORY_QUESTION_IDS.has(String(questionId ?? "").trim().toUpperCase())
}

const SPECIAL_ED_ACOUSTIC_IDS = new Set(["SN-016", "LS-021", "VO-021", "SP-023"])

/** SPED acoustic-feature checklists are recorded only. */
export function isSpecialEducationAcousticQuestion(input: {
  questionId?: string | null
  question?: string | null
}): boolean {
  const id = String(input.questionId ?? "").trim().toUpperCase()
  if (SPECIAL_ED_ACOUSTIC_IDS.has(id)) return true
  return String(input.question ?? "").trim().toLowerCase() === "select all that apply (acoustic features)"
}

const ART_VARIED_SEATING_IDS = new Set(["EA-024", "TW-023", "TH-024", "DA-019"])
const ART_QUESTION_PREFIXES = new Set(["EA", "TW", "TH", "DA"])

/** Art (all levels): varied seating is recorded only. */
export function isArtVariedSeatingQuestion(input: {
  questionId?: string | null
  question?: string | null
}): boolean {
  const id = String(input.questionId ?? "").trim().toUpperCase()
  if (ART_VARIED_SEATING_IDS.has(id)) return true
  const prefix = id.split("-")[0] ?? ""
  if (!ART_QUESTION_PREFIXES.has(prefix)) return false
  return /how varied are the seating options/i.test(String(input.question ?? ""))
}

/** Collaboration-space / small-group-room access (ST-028 / ST-029 and the same prompt on other space types). */
export function isSharedLearningAccessQuestion(input: {
  questionId?: string | null
  question?: string | null
}): boolean {
  const text = String(input.question ?? "").trim().toLowerCase()
  if (text.includes("access does the space have to a collaboration space")) return true
  if (text.includes("access does the space have to a small group room")) return true
  const id = String(input.questionId ?? "").trim().toUpperCase()
  return (
    id === "ST-028" ||
    id === "ST-029" ||
    id === "SC-025" ||
    id === "SC-026" ||
    id === "PK-029" ||
    id === "PK-030" ||
    id === "EC-028" ||
    id === "EC-029" ||
    id === "MS-028" ||
    id === "MU-002"
  )
}

/** Direct outdoor / exterior-door access — Traditional Studio, Maker Space, and the same prompt elsewhere. */
export function isExteriorAccessQuestion(input: {
  questionId?: string | null
  question?: string | null
}): boolean {
  const text = String(input.question ?? "").trim().toLowerCase()
  if (text.includes("access does the space have to the exterior")) return true
  if (text.includes("direct access to outdoor")) return true
  if (text.includes("access to an art patio or outdoor work")) return true
  const id = String(input.questionId ?? "").trim().toUpperCase()
  return (
    id === "ST-031" ||
    id === "MS-029" ||
    id === "MS-030" ||
    id === "MS-032" ||
    id === "EA-028" ||
    id === "SC-028" ||
    id === "TW-027" ||
    id === "TH-028" ||
    id === "DA-023" ||
    id === "MI-026" ||
    id === "EM-029" ||
    id === "HI-009" ||
    id === "EA-029" ||
    id === "TW-028" ||
    id === "TH-029" ||
    id === "DA-024" ||
    id === "HI-010"
  )
}

/** MS science utilities (SC-032): only floor drain and eyewash are scored. */
export function isMsScienceUtilitiesScoredOption(label: string | null | undefined): boolean {
  const text = String(label ?? "").trim().toLowerCase()
  if (!text) return false
  if (text.includes("floor drain")) return true
  return text.includes("eye wash") || text.includes("eyewash")
}

export function isMsScienceUtilitiesInventoryOption(input: {
  questionId?: string | null
  itemLabel?: string | null
  schoolLevel?: string | null
}): boolean {
  if (String(input.questionId ?? "").trim().toUpperCase() !== "SC-032") return false
  if (String(input.schoolLevel ?? "").trim().toUpperCase() !== "MS") return false
  if (isNonViableSelectAllOption(input.itemLabel)) return false
  return !isMsScienceUtilitiesScoredOption(input.itemLabel)
}

export function isNonScoringQuestion(input: {
  category?: string | null
  subcategory?: string | null
  question?: string | null
  questionId?: string | null
  unitId?: string | null
  itemLabel?: string | null
  schoolLevel?: string | null
  weight?: number | null
}): boolean {
  if (isDiningCommonsTackboardQuestion(input.questionId)) return true
  if (isShelterInPlaceSafetyLabel(input.itemLabel)) return true
  if (isSurveyInventoryQuestion(input.questionId)) return true
  if (isSpecialEducationAcousticQuestion(input)) return true
  if (isArtVariedSeatingQuestion(input)) return true
  if (isSharedLearningAccessQuestion(input)) return true
  if (isExteriorAccessQuestion(input)) return true
  if (isMsScienceUtilitiesInventoryOption(input)) return true
  if (isObservational(input.category) || isObservational(input.subcategory)) return true
  if (isInventoryText(input.question) || isInventoryText(input.subcategory) || isInventoryText(input.category)) {
    return true
  }
  if (isInventoryUnitId(input.unitId)) return true
  if (input.weight != null && input.weight <= 0) return true
  return false
}

/** Drop none-of-the-above / not-able-to-assess rows from select-all questions. */
export function unitsForScoring<
  T extends {
    questionId: string
    itemLabel?: string | null
    unitId?: string | null
    category?: string | null
    subcategory?: string | null
    question?: string | null
    schoolLevel?: string | null
    weight?: number | null
  },
>(units: T[]): T[] {
  const scored = units.filter((unit) => !isNonScoringQuestion(unit))
  const siblingCount = new Map<string, number>()
  for (const unit of scored) {
    siblingCount.set(unit.questionId, (siblingCount.get(unit.questionId) ?? 0) + 1)
  }
  return scored.filter((unit) => {
    if ((siblingCount.get(unit.questionId) ?? 1) < 2) return true
    return !isNonViableSelectAllOption(unit.itemLabel)
  })
}
