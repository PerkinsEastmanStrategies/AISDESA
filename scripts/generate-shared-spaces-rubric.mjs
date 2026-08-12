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
const outPath = path.join(workspaceRoot, "packages", "shared", "src", "data", "shared-spaces-rubric.ts")

const PACKAGES = [
  {
    spaceTypeId: "SPT-LIBRARY-MEDIA-CENTER-951EE9",
    assessmentArea: "Shared Spaces",
    versionConst: "LIBRARY_MEDIA_CENTER_RUBRIC_VERSION",
    version: 1,
    prefix: "LIBRARY_MEDIA_CENTER",
    label: "Library Media Center",
  },
  {
    spaceTypeId: "SPT-DINING-COMMONS-B2FE05",
    assessmentArea: "Shared Spaces",
    versionConst: "DINING_COMMONS_RUBRIC_VERSION",
    version: 1,
    prefix: "DINING_COMMONS",
    label: "Dining Commons",
  },
  {
    spaceTypeId: "SPT-KITCHEN-B9C465",
    assessmentArea: "Shared Spaces",
    versionConst: "KITCHEN_RUBRIC_VERSION",
    version: 1,
    prefix: "KITCHEN",
    label: "Kitchen",
  },
  {
    spaceTypeId: "SPT-EMPOWER-CENTER-B88577",
    assessmentArea: "Shared Spaces",
    versionConst: "EMPOWER_CENTER_RUBRIC_VERSION",
    version: 1,
    prefix: "EMPOWER_CENTER",
    label: "Empower Center",
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

/** Shared Spaces rubrics — regenerate via scripts/generate-shared-spaces-rubric.mjs
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
