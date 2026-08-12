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
const outPath = path.join(workspaceRoot, "packages", "shared", "src", "data", "cte-rubric.ts")

const PACKAGES = [
  {
    spaceTypeId: "SPT-CTE-STUDIO-143933",
    assessmentArea: "CTE",
    versionConst: "CTE_STUDIO_RUBRIC_VERSION",
    version: 1,
    prefix: "CTE_STUDIO",
    label: "CTE Studio",
  },
  {
    spaceTypeId: "SPT-LOW-INTENSITY-LAB-05F8AF",
    assessmentArea: "CTE",
    versionConst: "CTE_LOW_INTENSITY_LAB_RUBRIC_VERSION",
    version: 1,
    prefix: "CTE_LOW_INTENSITY_LAB",
    label: "Low Intensity Lab",
  },
  {
    spaceTypeId: "SPT-MEDIUM-INTENSITY-LAB-C658FD",
    assessmentArea: "CTE",
    versionConst: "CTE_MEDIUM_INTENSITY_LAB_RUBRIC_VERSION",
    version: 1,
    prefix: "CTE_MEDIUM_INTENSITY_LAB",
    label: "Medium Intensity Lab",
  },
  {
    spaceTypeId: "SPT-HIGH-INTENSITY-LAB-BF5D1A",
    assessmentArea: "CTE",
    versionConst: "CTE_HIGH_INTENSITY_LAB_RUBRIC_VERSION",
    version: 1,
    prefix: "CTE_HIGH_INTENSITY_LAB",
    label: "High Intensity Lab",
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

/** CTE rubrics — regenerate via scripts/generate-cte-rubric.mjs
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
