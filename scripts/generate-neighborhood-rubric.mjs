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
const csvDir = path.join(workspaceRoot, "packages", "shared", "src", "data", "neighborhood-survey")
const outPath = path.join(workspaceRoot, "packages", "shared", "src", "data", "neighborhood-rubric.ts")

const PACKAGES = [
  {
    spaceTypeId: "SPT-NEIGHBORHOOD-D091AE",
    assessmentArea: "Neighborhoods",
    versionConst: "NEIGHBORHOOD_SPACE_RUBRIC_VERSION",
    version: 2,
    prefix: "NEIGHBORHOOD_SPACE",
    label: "Neighborhood",
  },
  {
    spaceTypeId: "SPT-GROUP-ROOM-4362E2",
    assessmentArea: "Neighborhoods",
    versionConst: "GROUP_ROOM_RUBRIC_VERSION",
    version: 2,
    prefix: "GROUP_ROOM",
    label: "Group Room",
  },
  {
    spaceTypeId: "SPT-OPEN-COLLABORATION-0308C2",
    assessmentArea: "Neighborhoods",
    versionConst: "OPEN_COLLAB_RUBRIC_VERSION",
    version: 2,
    prefix: "OPEN_COLLAB",
    label: "Open Collaboration",
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

/** Neighborhoods survey rubrics — regenerate via scripts/generate-neighborhood-rubric.mjs
 *  Source CSVs: packages/shared/src/data/neighborhood-survey
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
  console.log(`  questionIds=${s.questionIds.join(",")}`)
}
