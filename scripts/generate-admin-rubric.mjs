import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { emitV4Package, parseCsv, rowsToObjects } from "./lib/v4-rubric-generator.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function resolveWorkspaceRoot() {
  const candidate = path.resolve(__dirname, "..")
  if (fs.existsSync(path.join(candidate, "packages", "shared"))) return candidate
  throw new Error("Could not resolve workspace root")
}

const workspaceRoot = resolveWorkspaceRoot()
const csvDir = path.join(workspaceRoot, "packages", "shared", "src", "data", "studios-outdoor")
const outPath = path.join(workspaceRoot, "packages", "shared", "src", "data", "admin-rubric.ts")

const PACKAGES = [
  {
    spaceTypeId: "SPT-ADMIN-OFFICES-C36ECE",
    assessmentArea: "Administration",
    versionConst: "ADMIN_OFFICE_RUBRIC_VERSION",
    version: 3,
    prefix: "ADMIN_OFFICE",
    label: "Admin Offices",
  },
  {
    spaceTypeId: "SPT-MW-AND-COUNSELING-SUITE-3ACB29",
    assessmentArea: "Administration",
    versionConst: "COUNSELING_SUITE_RUBRIC_VERSION",
    version: 3,
    prefix: "COUNSELING_SUITE",
    label: "MW and Counseling Suite",
  },
  {
    spaceTypeId: "SPT-PROFESSIONAL-LEARNING-CENTER-A2E7B5",
    assessmentArea: "Administration",
    versionConst: "PLC_RUBRIC_VERSION",
    version: 3,
    prefix: "PLC",
    label: "Professional Learning Center",
  },
]

function readTable(name) {
  const text = fs.readFileSync(path.join(csvDir, name), "utf8").replace(/^\uFEFF/, "")
  return rowsToObjects(parseCsv(text))
}

const bundle = {
  categories: readTable("03_Categories.csv"),
  subcategories: readTable("04_Subcategories.csv"),
  questions: readTable("05_Questions.csv"),
  options: readTable("06_QuestionOptions.csv"),
}

let file = `import type { EsaCategory, EsaQuestion, EsaQuestionOption, EsaSubcategory } from "../types/survey"

/** Administration rubrics — regenerate via scripts/generate-admin-rubric.mjs
 *  Source CSVs: packages/shared/src/data/studios-outdoor
 */
`

const allStats = []
for (const pkg of PACKAGES) {
  const { out, stats } = emitV4Package(pkg, bundle)
  file += `\n${out}`
  allStats.push(stats)
}

fs.writeFileSync(outPath, file)
console.log(`Wrote ${outPath}`)
for (const s of allStats) {
  console.log(
    `${s.label}: questions=${s.questions} options=${s.options} categories=${s.categories} subcategories=${s.subcategories}`,
  )
}
