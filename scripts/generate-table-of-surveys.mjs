import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const surveyDir = path.join(__dirname, "..")
const csvPath = path.join(surveyDir, "AISD_ESA_Categories.csv")
const publicPath = path.join(surveyDir, "public", "AISD_ESA_Categories.csv")
const localShared = path.join(surveyDir, "packages", "shared", "src", "data", "table-of-surveys.ts")
const monorepoShared = path.join(surveyDir, "..", "packages", "shared", "src", "data", "table-of-surveys.ts")
const outPath = fs.existsSync(path.dirname(localShared)) ? localShared : monorepoShared

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      field = ""
      if (row.length > 1 || row[0] !== "") rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function esc(s) {
  return JSON.stringify(s)
}

const ARRIVAL_ADMIN_ARRIVAL_RAW = new Set([
  "Main Entry/Reception",
  "Main Admin Suite",
  "Community Partners Suite",
  "Entry Experience",
  "Campus",
])

const ARRIVAL_ADMIN_ADMIN_RAW = new Set([
  "Admin Offices",
  "Professional Learning Center",
  "Mental Wellness and Counseling Suite",
])

function surveyModuleFromFocusArea(focusArea, spaceTypeRaw) {
  if (focusArea === "Arrival/Administration") {
    if (ARRIVAL_ADMIN_ARRIVAL_RAW.has(spaceTypeRaw)) return "arrival"
    if (ARRIVAL_ADMIN_ADMIN_RAW.has(spaceTypeRaw)) return "administration"
    throw new Error(`Unknown Arrival/Administration space type: ${spaceTypeRaw}`)
  }

  switch (focusArea) {
    case "Arrival Experience and Campus Organization":
      return "arrival"
    case "Administration":
      return "administration"
    case "Studios":
    case "Special Education":
    case "Visual Arts":
      return "studios"
    case "Neighborhoods":
      return "neighborhoods"
    case "Athletics and Wellness":
      return "athletics"
    case "Shared Spaces":
      return "shared_spaces"
    case "Outdoor Elements":
    case "Outdoor":
      return "outdoor"
    case "CTE":
      return "cte"
    case "Performing Arts":
      return "performing_arts"
    default:
      return null
  }
}

function scoringFocusAreaIdFromLabel(label) {
  const normalized = label.trim().toLowerCase()
  switch (normalized) {
    case "arrival/administration":
      return "arrival_administration"
    case "arrival experience and campus organization":
      return "arrival_experience"
    case "administration":
      return "administration"
    case "studios":
      return "studios"
    case "special education":
      return "special_education"
    case "visual arts":
      return "visual_arts"
    case "neighborhoods":
      return "neighborhoods"
    case "athletics and wellness":
      return "athletics_wellness"
    case "shared spaces":
      return "shared_spaces"
    case "outdoor elements":
    case "outdoor":
      return "outdoor_elements"
    case "cte":
      return "cte"
    case "performing arts":
      return "performing_arts"
    default:
      return normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
  }
}

function canonicalSpaceType(name) {
  const map = {
    "Tranditional Studio": "Traditional studio",
    "Main Entry/Reception": "Entry Experience",
    "Main Office": "Entry Experience",
    "Entry Experience": "Entry Experience",
    Campus: "Campus",
    "Main Admin Suite": "Main Admin Suite",
    "Community Partners Suite": "Community Partner Suite",
    "Admin Offices": "Admin Office",
    "Mental Wellness and Counseling Suite": "Counseling Suite",
    "Sped Flex Studio": "SPED Flex Studio",
    "SPED Flex Studio": "SPED Flex Studio",
    "Sensory Lab": "Sensory Motor Lab",
    "Sensory Motor Lab": "Sensory Motor Lab",
    "Life Skills Room": "Life Skills Studio",
    "Life Skills Studio": "Life Skills Studio",
    "Special Education Suite": "Special Education Suite",
    Music: "Music Studio",
    "Music Studio": "Music Studio",
    "Maker Space": "Maker space",
    "Open Collaboration": "Open Collaboration Space",
    "Small Group Room": "Group Room",
    "Group Room": "Group Room",
    "Large Group Room": "Large Group Room",
    "Early Childhood Neighborhood": "Early Childhood Neighborhood",
    "Science Prep Room": "Science Prep Room",
    "2D Art Studio": "2D Art Studio",
    "3D Art Studio": "3D Art Studio",
    "Digital Art Studio": "Digital Art Studio",
    "Digital Arts Studio": "Digital Art Studio",
    "Rehersal Hall": "Rehearsal Hall",
    "Theater Arts": "Theater Arts Studio",
    "Theater Arts Studio": "Theater Arts Studio",
    "Theater Arts Suite": "Theater Arts Suite",
    "Black Box": "Black Box",
    Auditorium: "Auditorium",
    Dance: "Dance",
    "Music Suite": "Music Suite",
    "Media Center": "Library Media Center",
    "Library Media Center": "Library Media Center",
    "Food Service": "Dining Commons",
    "Dining Commons": "Dining Commons",
    Kitchen: "Kitchen",
    "Outdoor Athletics": "Outdoor Athletics",
    Gym: "ES Gymnasium",
    "ES Gymnasium": "ES Gymnasium",
    "Multi-Purpose Gym": "Multi-Purpose Gym",
    "Multipurpose Gym": "Multi-Purpose Gym",
    "Practice Gym": "Practice Gym",
    "Competition Gym": "Competition Gym",
    "PE Fitness Room": "PE Fitness Room",
    "Locker Room": "Locker Room",
    "Locker rooms": "Locker Room",
    CTE: "CTE Studio",
    "CTE Studio": "CTE Studio",
    "Low Intensity Lab": "Low Intensity Lab",
    "Medium Intensity Lab": "Medium Intensity Lab",
    "High Intensity Lab": "High Intensity Lab",
  }
  return map[name] ?? name
}

function normalizeScoreCode(spaceTypeRaw, scoreCode) {
  const code = scoreCode.trim()
  if (spaceTypeRaw === "Neighborhood" && code === "MG") return "NE"
  if (spaceTypeRaw === "Music Suite" && code === "MU") return "MT"
  return code
}

if (!fs.existsSync(csvPath)) {
  console.error(`Missing ${csvPath}`)
  process.exit(1)
}

fs.copyFileSync(csvPath, publicPath)
console.log("Copied AISD_ESA_Categories.csv -> public/")

const rows = parseCsv(fs.readFileSync(csvPath, "utf8"))
const header = (rows[0] ?? []).map((cell) => cell.trim())
const col = (name, fallbackIndex) => {
  const index = header.findIndex((cell) => cell.toLowerCase() === name.toLowerCase())
  return index >= 0 ? index : fallbackIndex
}
const iFocus = col("Focus Area", 0)
const iSpace = col("Space Type", 1)
const iLevel = col("School Level", 2)
const iRequired = col("Required", 3)
const iMinSurveys = col("Minimum Surveys", -1)
const iScoringFocus = col("Focus Area (Scoring)", iMinSurveys >= 0 ? 5 : 4)
const iSpaceWeight = col("Space Type Weight", iMinSurveys >= 0 ? 6 : 5)
const iFocusWeight = col("Focus Area Weight", iMinSurveys >= 0 ? 7 : 6)
const iScoreCode = col("Score Code", iMinSurveys >= 0 ? 8 : 7)

const dataRows = rows.slice(1).filter((r) => {
  const level = r[iLevel]?.trim()
  return level === "ES" || level === "MS" || level === "HS"
})

const entries = dataRows.map((r) => {
  const surveyFocus = r[iFocus].trim()
  const spaceTypeRaw = r[iSpace].trim()
  const schoolLevel = r[iLevel].trim()
  const required = r[iRequired].trim().toUpperCase() === "Y"
  const minimumSurveyCount = required
    ? Math.max(1, Number.parseInt(iMinSurveys >= 0 ? r[iMinSurveys] : "1", 10) || 1)
    : 0
  const scoringFocusLabel = r[iScoringFocus].trim()
  const spaceTypeWeight = Number.parseInt(r[iSpaceWeight], 10) || 0
  const focusAreaWeight = Number.parseInt(r[iFocusWeight], 10) || 0
  const scoreCode = normalizeScoreCode(spaceTypeRaw, r[iScoreCode]?.trim() ?? "")
  const surveyType = surveyModuleFromFocusArea(surveyFocus, spaceTypeRaw)
  const scoringFocusAreaId = scoringFocusAreaIdFromLabel(scoringFocusLabel)
  const spaceType = canonicalSpaceType(spaceTypeRaw)

  if (!surveyType) {
    throw new Error(`Unknown survey focus area: ${surveyFocus}`)
  }

  return {
    surveyFocus,
    surveyType,
    spaceType,
    spaceTypeRaw,
    schoolLevel,
    required,
    minimumSurveyCount,
    scoringFocusLabel,
    scoringFocusAreaId,
    spaceTypeWeight,
    focusAreaWeight,
    scoreCode,
  }
})

const scoringFocusDefs = new Map()
for (const entry of entries) {
  if (!scoringFocusDefs.has(entry.scoringFocusAreaId)) {
    scoringFocusDefs.set(entry.scoringFocusAreaId, {
      id: entry.scoringFocusAreaId,
      label: entry.scoringFocusLabel,
      focusAreaWeight: entry.focusAreaWeight,
    })
  }
}

const focusAreaOrder = [
  "arrival_experience",
  "administration",
  "studios",
  "special_education",
  "visual_arts",
  "neighborhoods",
  "athletics_wellness",
  "shared_spaces",
  "outdoor_elements",
  "cte",
  "performing_arts",
]

const scoringFocusAreas = [...scoringFocusDefs.values()].sort((a, b) => {
  const ai = focusAreaOrder.indexOf(a.id)
  const bi = focusAreaOrder.indexOf(b.id)
  if (ai >= 0 && bi >= 0) return ai - bi
  if (ai >= 0) return -1
  if (bi >= 0) return 1
  return a.label.localeCompare(b.label)
})

const surveyOrder = [
  "arrival",
  "administration",
  "studios",
  "neighborhoods",
  "shared_spaces",
  "athletics",
  "outdoor",
  "performing_arts",
  "cte",
  "closeout",
]

const out = `/** Generated from AISD_ESA_Categories.csv — do not edit by hand. */
import type { SurveyType } from "../types/survey"

export type TableSchoolLevel = "ES" | "MS" | "HS"

export type ScoringFocusAreaId =
${scoringFocusAreas.map((a) => `  | ${esc(a.id)}`).join("\n")}

export interface TableOfSurveyEntry {
  surveyFocus: string
  surveyType: SurveyType
  spaceType: string
  spaceTypeRaw: string
  schoolLevel: TableSchoolLevel
  required: boolean
  /** Site-wide completed room surveys required by AISD_Matrix_RoomsRequired. 0 = not scored. */
  minimumSurveyCount: number
  scoringFocusLabel: string
  scoringFocusAreaId: ScoringFocusAreaId
  spaceTypeWeight: number
  focusAreaWeight: number
  scoreCode: string
}

export interface ScoringFocusAreaDef {
  id: ScoringFocusAreaId
  label: string
  focusAreaWeight: number
}

export const TABLE_OF_SURVEY_ENTRIES: TableOfSurveyEntry[] = [
${entries
  .map(
    (e) =>
      `  { surveyFocus: ${esc(e.surveyFocus)}, surveyType: ${esc(e.surveyType)}, spaceType: ${esc(e.spaceType)}, spaceTypeRaw: ${esc(e.spaceTypeRaw)}, schoolLevel: ${esc(e.schoolLevel)}, required: ${e.required}, minimumSurveyCount: ${e.minimumSurveyCount}, scoringFocusLabel: ${esc(e.scoringFocusLabel)}, scoringFocusAreaId: ${esc(e.scoringFocusAreaId)}, spaceTypeWeight: ${e.spaceTypeWeight}, focusAreaWeight: ${e.focusAreaWeight}, scoreCode: ${esc(e.scoreCode)} },`,
  )
  .join("\n")}
]

export const SCORING_FOCUS_AREAS_FROM_TABLE: ScoringFocusAreaDef[] = [
${scoringFocusAreas
  .map(
    (a) =>
      `  { id: ${esc(a.id)}, label: ${esc(a.label)}, focusAreaWeight: ${a.focusAreaWeight} },`,
  )
  .join("\n")}
]

export const SURVEY_MODULE_ORDER: SurveyType[] = [
${surveyOrder.map((s) => `  ${esc(s)},`).join("\n")}
]

export function schoolLevelFromSchoolClass(
  schoolClass: string | null | undefined,
): TableSchoolLevel | null {
  switch (schoolClass) {
    case "ELEM":
      return "ES"
    case "MID":
      return "MS"
    case "HIGH":
      return "HS"
    default:
      return null
  }
}

export function tableEntriesForSchool(
  schoolClass: string | null | undefined,
): TableOfSurveyEntry[] {
  const level = schoolLevelFromSchoolClass(schoolClass)
  if (!level) return TABLE_OF_SURVEY_ENTRIES
  return TABLE_OF_SURVEY_ENTRIES.filter((entry) => entry.schoolLevel === level)
}

export function surveyTypesForSchool(
  schoolClass: string | null | undefined,
): SurveyType[] {
  const level = schoolLevelFromSchoolClass(schoolClass)
  const seen = new Set<SurveyType>()
  const types: SurveyType[] = []
  for (const entry of TABLE_OF_SURVEY_ENTRIES) {
    if (level && entry.schoolLevel !== level) continue
    if (entry.surveyType === "closeout" || seen.has(entry.surveyType)) continue
    seen.add(entry.surveyType)
    types.push(entry.surveyType)
  }
  return types.sort(
    (a, b) => SURVEY_MODULE_ORDER.indexOf(a) - SURVEY_MODULE_ORDER.indexOf(b),
  )
}

export function surveyTypeAvailableForSchoolFromTable(
  type: SurveyType,
  schoolClass: string | null | undefined,
): boolean {
  if (type === "closeout") return true
  return surveyTypesForSchool(schoolClass).includes(type)
}

export function spaceTypesForSurveyModule(
  surveyType: SurveyType,
  schoolClass: string | null | undefined,
): TableOfSurveyEntry[] {
  const level = schoolLevelFromSchoolClass(schoolClass)
  const rows = TABLE_OF_SURVEY_ENTRIES.filter((entry) => {
    if (entry.surveyType !== surveyType) return false
    if (level && entry.schoolLevel !== level) return false
    return true
  })
  const seen = new Set<string>()
  return rows.filter((entry) => {
    if (seen.has(entry.spaceType)) return false
    seen.add(entry.spaceType)
    return true
  })
}

const SPACE_TYPE_ALIASES: Record<string, string> = {
  Gym: "ES Gymnasium",
  "Main Office": "Entry Experience",
  "Main Entry/Reception": "Entry Experience",
  "Sped flex studio": "SPED Flex Studio",
  "SPED Flex Room": "SPED Flex Studio",
  "Sped Flex Room": "SPED Flex Studio",
  "Sensory Lab": "Sensory Motor Lab",
  "Life Skills Room": "Life Skills Studio",
  Music: "Music Studio",
  "Small Group Room": "Group Room",
  "Digital Arts Studio": "Digital Art Studio",
  "Open Collaboration": "Open Collaboration Space",
  "Early Childhood Special Education studio": "Early childhood special education studio",
  "Early Childhood Special Education Studio": "Early childhood special education studio",
  "Early Childhood Sped Flex Room": "Early childhood special education studio",
  "Early Childhood SPED Flex Room": "Early childhood special education studio",
  "Early Childhood Sped Flex Studio": "Early childhood special education studio",
  "Early Childhood SPED Flex Studio": "Early childhood special education studio",
}

function spaceTypeLookupCandidates(spaceType: string): string[] {
  const trimmed = spaceType.trim()
  if (!trimmed) return []
  const candidates = [trimmed]
  const lower = trimmed.toLowerCase()
  const exactAlias = SPACE_TYPE_ALIASES[trimmed]
  if (exactAlias) candidates.push(exactAlias)
  for (const [from, to] of Object.entries(SPACE_TYPE_ALIASES)) {
    if (from.toLowerCase() === lower && !candidates.includes(to)) candidates.push(to)
  }
  const tableMatch = TABLE_OF_SURVEY_ENTRIES.find((entry) => entry.spaceType.toLowerCase() === lower)
  if (tableMatch && !candidates.includes(tableMatch.spaceType)) candidates.push(tableMatch.spaceType)
  if (
    lower.includes("early childhood") &&
    (lower.includes("sped") || lower.includes("special education"))
  ) {
    if (!candidates.includes("Early childhood special education studio")) {
      candidates.push("Early childhood special education studio")
    }
  }
  return candidates
}

export function lookupTableEntry(
  surveyType: SurveyType,
  spaceType: string | null | undefined,
  schoolClass: string | null | undefined,
): TableOfSurveyEntry | null {
  const level = schoolLevelFromSchoolClass(schoolClass)
  const normalized = spaceType?.trim()
  if (!normalized) return null

  const candidates = spaceTypeLookupCandidates(normalized)

  for (const candidate of candidates) {
    const match = TABLE_OF_SURVEY_ENTRIES.find(
      (entry) =>
        entry.surveyType === surveyType &&
        entry.spaceType === candidate &&
        (!level || entry.schoolLevel === level),
    )
    if (match) return match
  }

  return null
}

export function scoringFocusAreaForRoomFromTable(
  surveyType: SurveyType,
  spaceType: string | null | undefined,
  schoolClass: string | null | undefined,
): ScoringFocusAreaId | null {
  return lookupTableEntry(surveyType, spaceType, schoolClass)?.scoringFocusAreaId ?? null
}

export function scoringFocusAreaLabel(id: ScoringFocusAreaId): string {
  return SCORING_FOCUS_AREAS_FROM_TABLE.find((area) => area.id === id)?.label ?? id
}

export function focusAreaWeightForSchool(
  focusAreaId: ScoringFocusAreaId,
  schoolClass: string | null | undefined,
): number {
  const level = schoolLevelFromSchoolClass(schoolClass)
  const match = TABLE_OF_SURVEY_ENTRIES.find(
    (entry) =>
      entry.scoringFocusAreaId === focusAreaId && (!level || entry.schoolLevel === level),
  )
  return match?.focusAreaWeight ?? 0
}

export function requiredSurveyTypesForSchool(
  schoolClass: string | null | undefined,
): SurveyType[] {
  const level = schoolLevelFromSchoolClass(schoolClass)
  const required = new Set<SurveyType>()
  for (const entry of TABLE_OF_SURVEY_ENTRIES) {
    if (level && entry.schoolLevel !== level) continue
    if (entry.required) required.add(entry.surveyType)
  }
  return [...required].sort(
    (a, b) => SURVEY_MODULE_ORDER.indexOf(a) - SURVEY_MODULE_ORDER.indexOf(b),
  )
}

export function isSpaceTypeRequiredForSchool(
  surveyType: SurveyType,
  spaceType: string,
  schoolClass: string | null | undefined,
): boolean {
  return lookupTableEntry(surveyType, spaceType, schoolClass)?.required ?? false
}

/** Required completed room surveys for this space type at the school level. 0 = optional / not scored. */
export function minimumSurveyCountForSpaceType(
  surveyType: SurveyType,
  spaceType: string,
  schoolClass: string | null | undefined,
): number {
  const entry = lookupTableEntry(surveyType, spaceType, schoolClass)
  if (!entry) return 1
  if (!entry.required) return 0
  return Math.max(1, entry.minimumSurveyCount)
}

/** Optional (not-required) space types do not enter campus scoring. */
export function spaceTypeCountsTowardCampusScore(
  surveyType: SurveyType,
  spaceType: string,
  schoolClass: string | null | undefined,
): boolean {
  const entry = lookupTableEntry(surveyType, spaceType, schoolClass)
  if (!entry) return true
  return entry.required
}

export function scoreCodeForSpaceType(
  surveyType: SurveyType,
  spaceType: string,
  schoolClass: string | null | undefined,
): string | null {
  return lookupTableEntry(surveyType, spaceType, schoolClass)?.scoreCode ?? null
}

export function surveyFocusForSurveyType(
  surveyType: SurveyType,
  schoolClass: string | null | undefined,
): string | null {
  const level = schoolLevelFromSchoolClass(schoolClass)
  const entry = TABLE_OF_SURVEY_ENTRIES.find(
    (row) => row.surveyType === surveyType && (!level || row.schoolLevel === level),
  )
  return entry?.surveyFocus ?? null
}

/** Internal survey modules that share one sidebar entry (CSV survey focus area). */
export function surveyTypesInSameNavGroup(
  surveyType: SurveyType,
  schoolClass: string | null | undefined,
): SurveyType[] {
  const focus = surveyFocusForSurveyType(surveyType, schoolClass)?.trim()
  if (!focus) return [surveyType]
  const level = schoolLevelFromSchoolClass(schoolClass)
  const types = new Set<SurveyType>()
  for (const entry of TABLE_OF_SURVEY_ENTRIES) {
    if (entry.surveyFocus.trim() !== focus) continue
    if (level && entry.schoolLevel !== level) continue
    types.add(entry.surveyType)
  }
  const ordered = SURVEY_MODULE_ORDER.filter((type) => types.has(type))
  return ordered.length ? ordered : [surveyType]
}

/** One sidebar item per CSV survey focus area. */
export function surveyNavTypesForSchool(
  schoolClass: string | null | undefined,
): SurveyType[] {
  const level = schoolLevelFromSchoolClass(schoolClass)
  const primaryTypeByFocus = new Map<string, SurveyType>()

  for (const type of SURVEY_MODULE_ORDER) {
    const hasEntry = TABLE_OF_SURVEY_ENTRIES.some(
      (entry) => entry.surveyType === type && (!level || entry.schoolLevel === level),
    )
    if (!hasEntry) continue

    const focus = surveyFocusForSurveyType(type, schoolClass)?.trim()
    if (!focus) {
      primaryTypeByFocus.set(\`__\${type}\`, type)
      continue
    }

    if (!primaryTypeByFocus.has(focus)) {
      primaryTypeByFocus.set(focus, type)
    }
  }

  const navTypes: SurveyType[] = []
  for (const type of SURVEY_MODULE_ORDER) {
    const focus = surveyFocusForSurveyType(type, schoolClass)?.trim()
    if (!focus) {
      if (primaryTypeByFocus.get(\`__\${type}\`) === type) navTypes.push(type)
      continue
    }
    if (primaryTypeByFocus.get(focus) === type) navTypes.push(type)
  }

  if (!navTypes.includes("closeout")) {
    navTypes.push("closeout")
  }

  return navTypes
}

export function lookupTableEntryBySpaceType(
  spaceType: string | null | undefined,
  schoolClass: string | null | undefined,
): TableOfSurveyEntry | null {
  const level = schoolLevelFromSchoolClass(schoolClass)
  const normalized = spaceType?.trim()
  if (!normalized) return null

  const candidates = spaceTypeLookupCandidates(normalized)

  for (const candidate of candidates) {
    const match = TABLE_OF_SURVEY_ENTRIES.find(
      (entry) =>
        entry.spaceType === candidate && (!level || entry.schoolLevel === level),
    )
    if (match) return match
  }

  return null
}
`

fs.writeFileSync(outPath, out, "utf8")
console.log(`Wrote ${outPath}`)
console.log(`${entries.length} table rows, ${scoringFocusAreas.length} scoring focus areas`)
