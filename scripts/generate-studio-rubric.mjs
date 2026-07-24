import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const surveyDir = path.join(__dirname, "..")
const publicDir = path.join(surveyDir, "public")
// Prefer local packages/shared (standalone checkout); fall back to monorepo sibling layout.
const localShared = path.join(surveyDir, "packages", "shared", "src", "data", "studio-rubric.ts")
const monorepoShared = path.join(surveyDir, "..", "packages", "shared", "src", "data", "studio-rubric.ts")
const outPath = fs.existsSync(path.dirname(localShared)) ? localShared : monorepoShared

const CSV_FILES = [
  "Categories.csv",
  "Subcategories.csv",
  "Questions.csv",
  "QuestionOptions.csv",
  "SurveyResponses.csv",
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

function esc(s) {
  return JSON.stringify(s)
}

function normalizeQuestionType(raw) {
  if (raw === "YesNo") return "YesNoNA"
  if (raw.startsWith("MultiSelect")) return "MultiSelect"
  return raw
}

for (const file of CSV_FILES) {
  const src = path.join(surveyDir, file)
  const dest = path.join(publicDir, file)
  fs.copyFileSync(src, dest)
  console.log(`Copied ${file} -> public/`)
}

const cats = parseCsv(fs.readFileSync(path.join(surveyDir, "Categories.csv"), "utf8"))
const subs = parseCsv(fs.readFileSync(path.join(surveyDir, "Subcategories.csv"), "utf8"))
const qs = parseCsv(fs.readFileSync(path.join(surveyDir, "Questions.csv"), "utf8"))
const opts = parseCsv(fs.readFileSync(path.join(surveyDir, "QuestionOptions.csv"), "utf8"))

const [, ...crows] = cats
const [, ...srows] = subs
const [, ...qrows] = qs
const [, ...orows] = opts

let out = `import type { EsaCategory, EsaQuestion, EsaQuestionOption, EsaSubcategory } from "../types/survey"

/** Studios rubric — sourced from AISD-Survey CSV templates (regenerate via scripts/generate-studio-rubric.mjs) */
export const STUDIO_CATEGORIES: EsaCategory[] = [
`

for (const r of crows) {
  out += `  { assessmentArea: ${esc(r[0])}, category: ${esc(r[1])}, categoryWeight: ${r[2]} },\n`
}

out += `]

export const STUDIO_SUBCATEGORIES: EsaSubcategory[] = [
`

for (const r of srows) {
  out += `  { category: ${esc(r[0])}, subcategory: ${esc(r[1])}, subcategoryWeight: ${r[2]} },\n`
}

out += `]

export const STUDIO_QUESTIONS: EsaQuestion[] = [
`

for (const r of qrows) {
  out += `  {
    questionId: ${esc(r[0])},
    assessmentArea: ${esc(r[1])},
    category: ${esc(r[2])},
    subcategory: ${esc(r[3])},
    question: ${esc(r[4])},
    questionType: ${esc(normalizeQuestionType(r[5]))},
    weight: ${Number(r[6])},
    required: ${r[7].toLowerCase() === "yes"},
  },
`
}

out += `]

export const STUDIO_QUESTION_OPTIONS: EsaQuestionOption[] = [
`

for (const r of orows) {
  const score = r[2] === "" || r[2] === undefined ? "null" : r[2]
  const scoreId = r[4] ?? r[0]
  out += `  { questionId: ${esc(r[0])}, option: ${esc(r[1])}, normalizedScore: ${score}, displayOrder: ${Number(r[3])}, scoreId: ${esc(scoreId)} },\n`
}

out += `]

export const GRADE_OPTIONS = ["PK", "K", "1", "2", "3", "4", "5", "MS", "HS"] as const
`

fs.writeFileSync(outPath, out)
console.log(`Wrote ${outPath}`)
console.log(`${qrows.length} questions, ${orows.length} options, ${crows.length} categories`)
