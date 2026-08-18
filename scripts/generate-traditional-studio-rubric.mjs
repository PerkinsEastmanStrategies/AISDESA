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
const v4CsvDir = path.join(workspaceRoot, "packages", "shared", "src", "data", "studios-outdoor")
const outPath = path.join(
  workspaceRoot,
  "packages",
  "shared",
  "src",
  "data",
  "traditional-studio-rubric.ts",
)

const PACKAGES = [
  {
    spaceTypeId: "SPT-TRADITIONAL-STUDIO-78A63C",
    versionConst: "TRADITIONAL_STUDIOS_RUBRIC_VERSION",
    version: 6,
    prefix: "TRADITIONAL_STUDIO",
    label: "Traditional Studio",
    assessmentArea: "Studios",
    csvDir: v4CsvDir,
    format: "v4",
  },
  {
    spaceTypeId: "SPT-MAKER-SPACE-57653D",
    versionConst: "MAKER_SPACE_RUBRIC_VERSION",
    version: 2,
    prefix: "MAKER_SPACE",
    label: "Maker Space",
    assessmentArea: "Studios",
    csvDir: v4CsvDir,
    format: "v4",
  },
  {
    spaceTypeId: "SPT-SENSORY-MOTOR-LAB-3CE0F0",
    versionConst: "SENSORY_LAB_RUBRIC_VERSION",
    version: 4,
    prefix: "SENSORY_LAB",
    label: "Sensory Motor Lab",
    assessmentArea: "Special Education",
    csvDir: v4CsvDir,
    format: "v4",
  },
  {
    spaceTypeId: "SPT-VOCATIONAL-LAB-534CA6",
    versionConst: "VOCATIONAL_LAB_RUBRIC_VERSION",
    version: 4,
    prefix: "VOCATIONAL_LAB",
    label: "Vocational Lab",
    assessmentArea: "Special Education",
    csvDir: v4CsvDir,
    format: "v4",
  },
  {
    spaceTypeId: "SPT-LIFE-SKILLS-STUDIO-923127",
    versionConst: "LIFE_SKILLS_RUBRIC_VERSION",
    version: 4,
    prefix: "LIFE_SKILLS",
    label: "Life Skills Studio",
    assessmentArea: "Special Education",
    csvDir: v4CsvDir,
    format: "v4",
  },
  {
    spaceTypeId: "SPT-SPED-FLEX-STUDIO-8EBAD0",
    versionConst: "SPED_FLEX_RUBRIC_VERSION",
    version: 4,
    prefix: "SPED_FLEX",
    label: "SPED Flex Studio",
    assessmentArea: "Special Education",
    csvDir: v4CsvDir,
    format: "v4",
  },
  {
    spaceTypeId: "SPT-SCIENCE-2593B2",
    extraSpaceTypeIds: ["SPT-SCIENCE-PREP-ROOM-C6879C"],
    extraSpaceTypeLabels: { "SPT-SCIENCE-PREP-ROOM-C6879C": "Science Prep Room" },
    versionConst: "SCIENCE_RUBRIC_VERSION",
    version: 1,
    prefix: "SCIENCE",
    label: "Science",
    assessmentArea: "Studios",
    csvDir: v4CsvDir,
    format: "v4",
  },
  {
    spaceTypeId: "SPT-ART-STUDIO-B083D5",
    versionConst: "ART_RUBRIC_VERSION",
    version: 1,
    prefix: "ART",
    label: "Art",
    assessmentArea: "Studios",
    csvDir: v4CsvDir,
    format: "v4",
  },
  {
    spaceTypeId: "SPT-MUSIC-STUDIO-7170B4",
    versionConst: "MUSIC_RUBRIC_VERSION",
    version: 1,
    prefix: "MUSIC",
    label: "Music",
    assessmentArea: "Studios",
    csvDir: v4CsvDir,
    format: "v4",
  },
  {
    spaceTypeId: "SPT-EARLY-CHILDHOOD-STUDIO-49159F",
    versionConst: "EARLY_CHILDHOOD_RUBRIC_VERSION",
    version: 1,
    prefix: "EARLY_CHILDHOOD",
    label: "Early Childhood Studio",
    assessmentArea: "Studios",
    csvDir: v4CsvDir,
    format: "v4",
  },
  {
    spaceTypeId: "SPT-EARLY-CHILDHOOD-SPECIAL-EDUCAT-0E3811",
    versionConst: "EARLY_CHILDHOOD_SPED_RUBRIC_VERSION",
    version: 1,
    prefix: "EARLY_CHILDHOOD_SPED",
    label: "Early Childhood Special Education Studio",
    assessmentArea: "Special Education",
    csvDir: v4CsvDir,
    format: "v4",
  },
]

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

function readTable(csvDir, name) {
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
  const optionId = String(o.OptionID ?? "").trim()
  if (optionId) return optionId
  return `${o.QuestionID}-opt`
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

function loadCsvBundle(csvDir) {
  return {
    categories: readTable(csvDir, "03_Categories.csv"),
    subcategories: readTable(csvDir, "04_Subcategories.csv"),
    questions: readTable(csvDir, "05_Questions.csv"),
    options: readTable(csvDir, "06_QuestionOptions.csv"),
  }
}

function emitPackage(pkg) {
  const bundle = loadCsvBundle(pkg.csvDir)
  const catById = new Map(bundle.categories.map((c) => [c.CategoryID, c]))
  const subById = new Map(bundle.subcategories.map((s) => [s.SubcategoryID, s]))
  const isV4 = pkg.format === "v4"
  const assessmentArea = pkg.assessmentArea ?? "Studios"
  const spaceTypeIds = new Set([pkg.spaceTypeId, ...(pkg.extraSpaceTypeIds ?? [])])
  const extraLabels = pkg.extraSpaceTypeLabels ?? {}

  const categoryLabel = (c) => {
    const prefix = extraLabels[c.SpaceTypeID]
    return prefix ? `${prefix} ${c.CategoryName}` : c.CategoryName
  }

  const categories = bundle.categories
    .filter((c) => spaceTypeIds.has(c.SpaceTypeID))
    .sort((a, b) => Number(a.DisplayOrder) - Number(b.DisplayOrder))

  const catIds = new Set(categories.map((c) => c.CategoryID))
  const subcategories = bundle.subcategories
    .filter((s) => catIds.has(s.CategoryID))
    .sort((a, b) => {
      const ca = catById.get(a.CategoryID)?.DisplayOrder ?? 0
      const cb = catById.get(b.CategoryID)?.DisplayOrder ?? 0
      if (Number(ca) !== Number(cb)) return Number(ca) - Number(cb)
      return Number(a.DisplayOrder) - Number(b.DisplayOrder)
    })

  const questions = bundle.questions
    .filter((q) => spaceTypeIds.has(q.SpaceTypeID) && (isV4 ? isTrue(q.IsActive) : true))
    .sort((a, b) => Number(a.DisplayOrder) - Number(b.DisplayOrder))

  const questionIds = new Set(questions.map((q) => q.QuestionID))
  const options = bundle.options
    .filter((o) => questionIds.has(o.QuestionID) && (isV4 ? isTrue(o.IsActive) : true))
    .sort((a, b) => {
      if (a.QuestionID !== b.QuestionID) return a.QuestionID.localeCompare(b.QuestionID)
      return Number(a.DisplayOrder) - Number(b.DisplayOrder)
    })

  let out = `export const ${pkg.versionConst} = ${pkg.version} as const

export const ${pkg.prefix}_CATEGORIES: EsaCategory[] = [
`

  for (const c of categories) {
    out += `  { assessmentArea: ${esc(assessmentArea)}, category: ${esc(categoryLabel(c))}, categoryWeight: ${parseWeight(c.CategoryWeight)} },\n`
  }

  out += `]

export const ${pkg.prefix}_SUBCATEGORIES: EsaSubcategory[] = [
`

  for (const s of subcategories) {
    const parent = catById.get(s.CategoryID)
    if (!parent) throw new Error(`Missing category for subcategory ${s.SubcategoryID}`)
    out += `  { category: ${esc(categoryLabel(parent))}, subcategory: ${esc(s.SubcategoryName)}, subcategoryWeight: ${parseWeight(s.SubcategoryWeight)} },\n`
  }

  out += `]

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
    if (!sub) throw new Error(`Missing subcategory for question ${q.SubcategoryID}`)
    const grade = isV4
      ? String(q.SchoolLevel ?? q.GradeApplicability ?? "ALL").trim()
      : String(q.GradeApplicability ?? "").trim()
    const pattern = isV4
      ? String(q.ScoringMode ?? q.ParentScoringPattern ?? "SingleResponse").trim()
      : String(q.ParentScoringPattern ?? "").trim()
    const context = isV4 ? String(q.Context ?? "").trim() : ""
    out += `  {
    questionId: ${esc(q.QuestionID)},
    assessmentArea: ${esc(assessmentArea)},
    category: ${esc(categoryLabel(cat))},
    subcategory: ${esc(sub.SubcategoryName)},
    question: ${esc(q.QuestionText)},
    questionType: ${esc(normalizeQuestionType(q.QuestionType))},
    weight: ${parseWeight(q.QuestionWeight)},
    required: ${isTrue(q.IsRequired)},
    gradeApplicability: ${esc(grade)},
    parentScoringPattern: ${esc(pattern)},${isV4 ? `\n    context: ${esc(context)},` : ""}
  },
`
  }

  out += `]

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
    const maxPoints = numOrNull(o.MaxPoints)
    let normalizedScore = null
    if (!isExclusion && optionScore !== null) {
      if (maxPoints !== null && maxPoints > 0) normalizedScore = optionScore / maxPoints
      else normalizedScore = optionScore
    }

    const itemWeightRaw = String(o.ItemWeight ?? "").trim()
    const itemWeight = itemWeightRaw === "" ? 1 : Number(itemWeightRaw)
    const scoreId = resolveScoreId(o)

    kept += 1
    out += `  {
    questionId: ${esc(o.QuestionID)},
    option: ${esc(optionText)},
    normalizedScore: ${normalizedScore === null ? "null" : normalizedScore},
    displayOrder: ${Number(o.DisplayOrder)},
    scoreId: ${esc(scoreId)},
    itemScoringMode: ${esc(o.ItemScoringMode)} as any,
    scoreGroupId: ${esc(o.ScoreGroupID)},
    optionScore: ${optionScore === null ? "null" : optionScore},
    maxPoints: ${maxPoints === null ? "null" : maxPoints},
    itemWeight: ${Number.isFinite(itemWeight) ? itemWeight : 1},
    isExclusionOption: ${isExclusion},
  } as EsaQuestionOption & Record<string, unknown>,
`
  }

  out += `]
`

  return {
    out,
    stats: {
      label: pkg.label,
      questions: questions.length,
      options: kept,
      categories: categories.length,
      subcategories: subcategories.length,
      questionIds: questions.map((q) => q.QuestionID),
    },
  }
}

let file = `import type { EsaCategory, EsaQuestion, EsaQuestionOption, EsaSubcategory } from "../types/survey"

/** Package studio rubrics — regenerate via scripts/generate-traditional-studio-rubric.mjs
 *  Source CSVs: packages/shared/src/data/studios-outdoor (v4 CSV package)
 */
`

const allStats = []
for (const pkg of PACKAGES) {
  const { out, stats } = emitPackage(pkg)
  file += `\n${out}`
  allStats.push(stats)
}

fs.writeFileSync(outPath, file)
console.log(`Wrote ${outPath}`)
for (const s of allStats) {
  console.log(
    `${s.label}: questions=${s.questions} options=${s.options} categories=${s.categories} subcategories=${s.subcategories}`,
  )
  console.log(`  questionIds=${s.questionIds.join(",")}`)
}
