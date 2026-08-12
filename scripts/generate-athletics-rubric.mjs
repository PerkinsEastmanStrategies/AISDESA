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
const outPath = path.join(workspaceRoot, "packages", "shared", "src", "data", "athletics-rubric.ts")

const PACKAGES = [
  {
    spaceTypeId: "SPT-MULTIPURPOSE-GYM-99D091",
    assessmentArea: "Athletics and Wellness",
    versionConst: "MULTIPURPOSE_GYM_RUBRIC_VERSION",
    version: 1,
    prefix: "MULTIPURPOSE_GYM",
    label: "Multi-Purpose Gym",
  },
  {
    spaceTypeId: "SPT-COMPETITION-GYM-D05D49",
    assessmentArea: "Athletics and Wellness",
    versionConst: "COMPETITION_GYM_RUBRIC_VERSION",
    version: 1,
    prefix: "COMPETITION_GYM",
    label: "Competition Gym",
  },
  {
    spaceTypeId: "SPT-PRACTICE-GYM-8CB861",
    assessmentArea: "Athletics and Wellness",
    versionConst: "PRACTICE_GYM_RUBRIC_VERSION",
    version: 1,
    prefix: "PRACTICE_GYM",
    label: "Practice Gym",
  },
  {
    spaceTypeId: "SPT-ES-GYMNASIUM-4911CC",
    assessmentArea: "Athletics and Wellness",
    versionConst: "ES_GYMNASIUM_RUBRIC_VERSION",
    version: 1,
    prefix: "ES_GYMNASIUM",
    label: "ES Gymnasium",
  },
  {
    spaceTypeId: "SPT-WEIGHT-ROOM-9E9F80",
    assessmentArea: "Athletics and Wellness",
    versionConst: "WEIGHT_ROOM_RUBRIC_VERSION",
    version: 1,
    prefix: "WEIGHT_ROOM",
    label: "Weight Room",
  },
  {
    spaceTypeId: "SPT-WRESTLING-A78FB6",
    assessmentArea: "Athletics and Wellness",
    versionConst: "WRESTLING_RUBRIC_VERSION",
    version: 1,
    prefix: "WRESTLING",
    label: "Wrestling",
  },
  {
    spaceTypeId: "SPT-LOCKER-ROOMS-5ED7DB",
    assessmentArea: "Athletics and Wellness",
    versionConst: "LOCKER_ROOM_RUBRIC_VERSION",
    version: 1,
    prefix: "LOCKER_ROOM",
    label: "Locker Room",
  },
  {
    spaceTypeId: "SPT-PE-FITNESS-ROOM-F9EFD1",
    assessmentArea: "Athletics and Wellness",
    versionConst: "PE_FITNESS_ROOM_RUBRIC_VERSION",
    version: 1,
    prefix: "PE_FITNESS_ROOM",
    label: "PE Fitness Room",
  },
  {
    spaceTypeId: "SPT-ATHLETICS-WING-31743B",
    assessmentArea: "Athletics and Wellness",
    versionConst: "ATHLETICS_WING_RUBRIC_VERSION",
    version: 1,
    prefix: "ATHLETICS_WING",
    label: "Athletics Wing",
  },
  {
    spaceTypeId: "SPT-OUTDOOR-ATHLETICS-DEC8BC",
    assessmentArea: "Athletics and Wellness",
    versionConst: "OUTDOOR_ATHLETICS_RUBRIC_VERSION",
    version: 1,
    prefix: "OUTDOOR_ATHLETICS",
    label: "Outdoor Athletics",
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

/** Athletics and Wellness rubrics — regenerate via scripts/generate-athletics-rubric.mjs
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
