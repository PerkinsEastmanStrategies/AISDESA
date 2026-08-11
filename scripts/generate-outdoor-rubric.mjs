import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function resolveWorkspaceRoot() {
  const fromEnv = process.env.AISD_WS
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv
  const marker = path.join(__dirname, "aisd-ws-path.txt")
  if (fs.existsSync(marker)) {
    const p = fs.readFileSync(marker, "utf8").trim()
    if (fs.existsSync(p)) return p
  }
  const candidate = path.resolve(__dirname, "..")
  if (fs.existsSync(path.join(candidate, "packages", "shared"))) return candidate
  throw new Error("Could not resolve workspace root")
}

const workspaceRoot = resolveWorkspaceRoot()
const csvDir = path.join(workspaceRoot, "packages", "shared", "src", "data", "studios-outdoor")
const outPath = path.join(workspaceRoot, "packages", "shared", "src", "data", "outdoor-rubric.ts")

const PACKAGE = {
  spaceTypeId: "SPT-OUTDOOR-SPACES-F4EC64",
  versionConst: "OUTDOOR_SPACES_RUBRIC_VERSION",
  version: 3,
  prefix: "OUTDOOR_SPACES",
  label: "Outdoor Spaces",
  assessmentArea: "Outdoor",
}

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

function rowsToObjects(rows) {
  const [header, ...body] = rows
  return body.map((r) => {
    const o = {}
    for (let i = 0; i < header.length; i++) o[header[i]] = r[i] ?? ""
    return o
  })
}

function readTable(name) {
  const text = fs.readFileSync(path.join(csvDir, name), "utf8").replace(/^\uFEFF/, "")
  return rowsToObjects(parseCsv(text))
}

function esc(s) {
  return JSON.stringify(s ?? "")
}

function normalizeQuestionType(raw) {
  if (raw === "YesNo") return "YesNoNA"
  if (raw === "MultiSelect") return "MultiSelect"
  if (raw === "SingleSelect") return "SingleSelect"
  if (String(raw).startsWith("MultiSelect")) return "MultiSelect"
  return raw
}

function isTrue(v) {
  return String(v).trim().toLowerCase() === "true"
}

function numOrNull(v) {
  const s = String(v ?? "").trim()
  if (s === "") return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function parseWeight(v) {
  const s = String(v ?? "").trim()
  if (s === "") return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function resolveScoreId(o) {
  const source = String(o.SourceScoreID ?? "").trim()
  if (source) return source
  const group = String(o.ScoreGroupID ?? "").trim()
  if (group) return group
  return String(o.OptionID ?? "").trim() || `${o.QuestionID}-opt`
}

function resolveOptionScore(o, isExclusion) {
  const explicit = numOrNull(o.OptionScore)
  if (isExclusion && explicit === null) return null
  if (explicit !== null) return explicit
  if (String(o.ItemScoringMode ?? "").trim() === "Inventory") return null
  const text = String(o.ResponseOption ?? o.OptionText ?? "").trim().toLowerCase()
  if (text === "yes") return 1
  if (text === "no") return 0
  return null
}

const allCategories = readTable("03_Categories.csv")
const allSubcategories = readTable("04_Subcategories.csv")
const allQuestions = readTable("05_Questions.csv")
const allOptions = readTable("06_QuestionOptions.csv")

const catById = new Map(allCategories.map((c) => [c.CategoryID, c]))
const subById = new Map(allSubcategories.map((s) => [s.SubcategoryID, s]))

const pkg = PACKAGE
const categories = allCategories
  .filter((c) => c.SpaceTypeID === pkg.spaceTypeId)
  .sort((a, b) => Number(a.DisplayOrder) - Number(b.DisplayOrder))

const catIds = new Set(categories.map((c) => c.CategoryID))
const subcategories = allSubcategories
  .filter((s) => catIds.has(s.CategoryID))
  .sort((a, b) => {
    const ca = catById.get(a.CategoryID)?.DisplayOrder ?? 0
    const cb = catById.get(b.CategoryID)?.DisplayOrder ?? 0
    if (Number(ca) !== Number(cb)) return Number(ca) - Number(cb)
    return Number(a.DisplayOrder) - Number(b.DisplayOrder)
  })

const questions = allQuestions
  .filter((q) => q.SpaceTypeID === pkg.spaceTypeId && isTrue(q.IsActive))
  .sort((a, b) => Number(a.DisplayOrder) - Number(b.DisplayOrder))

const questionIds = new Set(questions.map((q) => q.QuestionID))
const options = allOptions
  .filter((o) => questionIds.has(o.QuestionID) && isTrue(o.IsActive))
  .sort((a, b) => {
    if (a.QuestionID !== b.QuestionID) return a.QuestionID.localeCompare(b.QuestionID)
    return Number(a.DisplayOrder) - Number(b.DisplayOrder)
  })

let file = `import type { EsaCategory, EsaQuestion, EsaQuestionOption, EsaSubcategory } from "../types/survey"

/** Outdoor Spaces rubric — regenerate via scripts/generate-outdoor-rubric.mjs
 *  Source CSVs: packages/shared/src/data/studios-outdoor
 */

export const ${pkg.versionConst} = ${pkg.version} as const

export const ${pkg.prefix}_CATEGORIES: EsaCategory[] = [
`

for (const c of categories) {
  file += `  { assessmentArea: ${esc(pkg.assessmentArea)}, category: ${esc(c.CategoryName)}, categoryWeight: ${parseWeight(c.CategoryWeight)} },\n`
}

file += `]

export const ${pkg.prefix}_SUBCATEGORIES: EsaSubcategory[] = [
`

for (const s of subcategories) {
  const parent = catById.get(s.CategoryID)
  if (!parent) throw new Error(`Missing category for subcategory ${s.SubcategoryID}`)
  file += `  { category: ${esc(parent.CategoryName)}, subcategory: ${esc(s.SubcategoryName)}, subcategoryWeight: ${parseWeight(s.SubcategoryWeight)} },\n`
}

file += `]

export const ${pkg.prefix}_QUESTIONS: (EsaQuestion & {
  gradeApplicability?: string
  parentScoringPattern?: string
  context?: string
})[] = [
`

for (const q of questions) {
  const cat = catById.get(q.CategoryID)
  const sub = subById.get(q.SubcategoryID)
  if (!cat) throw new Error(`Missing category for question ${q.QuestionID}`)
  if (!sub) throw new Error(`Missing subcategory for question ${q.QuestionID}`)
  const schoolLevel = String(q.SchoolLevel ?? q.GradeApplicability ?? "ALL").trim()
  const scoringMode = String(q.ScoringMode ?? q.ParentScoringPattern ?? "SingleResponse").trim()
  const context = String(q.Context ?? "").trim()
  file += `  {
    questionId: ${esc(q.QuestionID)},
    assessmentArea: ${esc(pkg.assessmentArea)},
    category: ${esc(cat.CategoryName)},
    subcategory: ${esc(sub.SubcategoryName)},
    question: ${esc(q.QuestionText)},
    questionType: ${esc(normalizeQuestionType(q.QuestionType))},
    weight: ${parseWeight(q.QuestionWeight)},
    required: ${isTrue(q.IsRequired)},
    gradeApplicability: ${esc(schoolLevel)},
    parentScoringPattern: ${esc(scoringMode)},
    context: ${esc(context)},
  },
`
}

file += `]

export const ${pkg.prefix}_QUESTION_OPTIONS: (EsaQuestionOption & {
  itemScoringMode?: string
  scoreGroupId?: string
  optionScore?: number | null
  maxPoints?: number | null
  itemWeight?: number
  isExclusionOption?: boolean
})[] = [
`

let kept = 0
for (const o of options) {
  const optionText = String(o.ResponseOption ?? o.OptionText ?? "").trim()
  if (!optionText) continue

  const isExclusion = isTrue(o.IsExclusionOption)
  const optionScore = resolveOptionScore(o, isExclusion)
  const normalizedScore = isExclusion || optionScore === null ? null : optionScore
  const scoreId = resolveScoreId(o)

  kept += 1
  file += `  {
    questionId: ${esc(o.QuestionID)},
    option: ${esc(optionText)},
    normalizedScore: ${normalizedScore === null ? "null" : normalizedScore},
    displayOrder: ${Number(o.DisplayOrder)},
    scoreId: ${esc(scoreId)},
    itemScoringMode: ${esc(o.ItemScoringMode)} as any,
    scoreGroupId: ${esc(o.ScoreGroupID)},
    optionScore: ${optionScore === null ? "null" : optionScore},
    maxPoints: null,
    itemWeight: 1,
    isExclusionOption: ${isExclusion},
  } as EsaQuestionOption & Record<string, unknown>,
`
}

file += `]
`

fs.writeFileSync(outPath, file)
console.log(`Wrote ${outPath}`)
console.log(
  `${pkg.label}: questions=${questions.length} options=${kept} categories=${categories.length} subcategories=${subcategories.length}`,
)
