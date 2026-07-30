import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { emitV4Package, parseCsv, rowsToObjects } from "./lib/v4-rubric-generator.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(__dirname, "..")
const v4CsvDir = path.join(workspaceRoot, "packages", "shared", "src", "data", "studios-outdoor")
const outPath = path.join(workspaceRoot, "packages", "shared", "src", "data", "traditional-studio-rubric.ts")

const PACKAGES = [
  { spaceTypeId: "SPT-TRADITIONAL-STUDIO", versionConst: "TRADITIONAL_STUDIOS_RUBRIC_VERSION", version: 6, prefix: "TRADITIONAL_STUDIO", label: "Traditional Studio", assessmentArea: "Studios" },
  { spaceTypeId: "SPT-EARLY-CHILDHOOD-STUDIO", versionConst: "EARLY_CHILDHOOD_STUDIO_RUBRIC_VERSION", version: 1, prefix: "EARLY_CHILDHOOD_STUDIO", label: "Early childhood studio", assessmentArea: "Studios" },
  { spaceTypeId: "SPT-EARLY-CHILDHOOD-SPECIAL-EDUCATION-", versionConst: "EARLY_CHILDHOOD_SPED_STUDIO_RUBRIC_VERSION", version: 1, prefix: "EARLY_CHILDHOOD_SPED_STUDIO", label: "Early childhood special education studio", assessmentArea: "Studios" },
  { spaceTypeId: "SPT-MAKER-SPACE", versionConst: "MAKER_SPACE_RUBRIC_VERSION", version: 2, prefix: "MAKER_SPACE", label: "Maker Space", assessmentArea: "Studios" },
  { spaceTypeId: "SPT-SCIENCE", versionConst: "SCIENCE_RUBRIC_VERSION", version: 1, prefix: "SCIENCE", label: "Science", assessmentArea: "Studios" },
  { spaceTypeId: "SPT-SCIENCE-PREP-ROOM", versionConst: "SCIENCE_PREP_ROOM_RUBRIC_VERSION", version: 1, prefix: "SCIENCE_PREP_ROOM", label: "Science Prep Room", assessmentArea: "Studios" },
  { spaceTypeId: "SPT-ART-STUDIO", versionConst: "ART_STUDIO_RUBRIC_VERSION", version: 1, prefix: "ART_STUDIO", label: "Art Studio", assessmentArea: "Studios" },
  { spaceTypeId: "SPT-2D-ART-STUDIO", versionConst: "ART_2D_STUDIO_RUBRIC_VERSION", version: 1, prefix: "ART_2D_STUDIO", label: "2D Art Studio", assessmentArea: "Studios" },
  { spaceTypeId: "SPT-3D-ART-STUDIO", versionConst: "ART_3D_STUDIO_RUBRIC_VERSION", version: 1, prefix: "ART_3D_STUDIO", label: "3D Art Studio", assessmentArea: "Studios" },
  { spaceTypeId: "SPT-DIGITAL-ARTS-STUDIO", versionConst: "DIGITAL_ART_STUDIO_RUBRIC_VERSION", version: 1, prefix: "DIGITAL_ART_STUDIO", label: "Digital Art Studio", assessmentArea: "Studios" },
  { spaceTypeId: "SPT-SPED-FLEX-STUDIO", versionConst: "SPED_FLEX_RUBRIC_VERSION", version: 4, prefix: "SPED_FLEX", label: "SPED Flex Studio", assessmentArea: "Special Education" },
  { spaceTypeId: "SPT-SENSORY-MOTOR-LAB", versionConst: "SENSORY_LAB_RUBRIC_VERSION", version: 4, prefix: "SENSORY_LAB", label: "Sensory Motor Lab", assessmentArea: "Special Education" },
  { spaceTypeId: "SPT-LIFE-SKILLS-STUDIO", versionConst: "LIFE_SKILLS_RUBRIC_VERSION", version: 4, prefix: "LIFE_SKILLS", label: "Life Skills Studio", assessmentArea: "Special Education" },
  { spaceTypeId: "SPT-VOCATIONAL-LAB", versionConst: "VOCATIONAL_LAB_RUBRIC_VERSION", version: 4, prefix: "VOCATIONAL_LAB", label: "Vocational Lab", assessmentArea: "Special Education" },
  { spaceTypeId: "SPT-SPECIAL-EDUCATION-SUITE", versionConst: "SPECIAL_EDUCATION_SUITE_RUBRIC_VERSION", version: 1, prefix: "SPECIAL_EDUCATION_SUITE", label: "Special Education Suite", assessmentArea: "Special Education" },
]

function readTable(name) {
  const text = fs.readFileSync(path.join(v4CsvDir, name), "utf8").replace(/^\uFEFF/, "")
  return rowsToObjects(parseCsv(text))
}

const bundle = {
  categories: readTable("03_Categories.csv"),
  subcategories: readTable("04_Subcategories.csv"),
  questions: readTable("05_Questions.csv"),
  options: readTable("06_QuestionOptions.csv"),
}

let file = `import type { EsaCategory, EsaQuestion, EsaQuestionOption, EsaSubcategory } from "../types/survey"

/** Package studio + special education rubrics — regenerate via scripts/generate-traditional-studio-rubric.mjs
 *  Source CSVs: packages/shared/src/data/studios-outdoor (v4 CSV)
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
