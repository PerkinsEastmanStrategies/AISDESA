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
const outPath = path.join(workspaceRoot, "packages", "shared", "src", "data", "performing-arts-rubric.ts")

const PACKAGES = [
  {
    spaceTypeId: "SPT-THEATER-ARTS-STUDIO-66AF54",
    assessmentArea: "Performing Arts",
    versionConst: "THEATER_ARTS_STUDIO_RUBRIC_VERSION",
    version: 1,
    prefix: "THEATER_ARTS_STUDIO",
    label: "Theater Arts Studio",
  },
  {
    spaceTypeId: "SPT-THEATER-ARTS-SUITE-E7A662",
    assessmentArea: "Performing Arts",
    versionConst: "THEATER_ARTS_SUITE_RUBRIC_VERSION",
    version: 1,
    prefix: "THEATER_ARTS_SUITE",
    label: "Theater Arts Suite",
  },
  {
    spaceTypeId: "SPT-REHEARSAL-HALL-4608D6",
    assessmentArea: "Performing Arts",
    versionConst: "REHEARSAL_HALL_RUBRIC_VERSION",
    version: 1,
    prefix: "REHEARSAL_HALL",
    label: "Rehearsal Hall",
  },
  {
    spaceTypeId: "SPT-BLACK-BOX-AFA947",
    assessmentArea: "Performing Arts",
    versionConst: "BLACK_BOX_RUBRIC_VERSION",
    version: 1,
    prefix: "BLACK_BOX",
    label: "Black Box",
  },
  {
    spaceTypeId: "SPT-AUDITORIUM-A69CC4",
    assessmentArea: "Performing Arts",
    versionConst: "AUDITORIUM_RUBRIC_VERSION",
    version: 1,
    prefix: "AUDITORIUM",
    label: "Auditorium",
  },
  {
    spaceTypeId: "SPT-DANCE-9926FD",
    assessmentArea: "Performing Arts",
    versionConst: "DANCE_RUBRIC_VERSION",
    version: 1,
    prefix: "DANCE",
    label: "Dance",
  },
  {
    spaceTypeId: "SPT-MUSIC-SUITE-96730D",
    assessmentArea: "Performing Arts",
    versionConst: "MUSIC_SUITE_RUBRIC_VERSION",
    version: 1,
    prefix: "MUSIC_SUITE",
    label: "Music Suite",
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

/** Performing Arts rubrics — regenerate via scripts/generate-performing-arts-rubric.mjs
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
