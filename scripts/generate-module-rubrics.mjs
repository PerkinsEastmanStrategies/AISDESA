import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { emitV4Package, parseCsv, rowsToObjects } from "./lib/v4-rubric-generator.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(__dirname, "..")
const csvDir = path.join(workspaceRoot, "packages", "shared", "src", "data", "studios-outdoor")

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

const MODULES = [
  {
    outFile: "athletics-rubric.ts",
    header: `/** Athletics and Wellness rubrics — regenerate via scripts/generate-module-rubrics.mjs
 *  Source CSVs: packages/shared/src/data/studios-outdoor
 */`,
    packages: [
      { spaceTypeId: "SPT-MULTIPURPOSE-GYM", assessmentArea: "Athletics and Wellness", versionConst: "MULTIPURPOSE_GYM_RUBRIC_VERSION", version: 1, prefix: "MULTIPURPOSE_GYM", label: "Multipurpose Gym" },
      { spaceTypeId: "SPT-PRACTICE-GYM", assessmentArea: "Athletics and Wellness", versionConst: "PRACTICE_GYM_RUBRIC_VERSION", version: 1, prefix: "PRACTICE_GYM", label: "Practice Gym" },
      { spaceTypeId: "SPT-COMPETITION-GYM", assessmentArea: "Athletics and Wellness", versionConst: "COMPETITION_GYM_RUBRIC_VERSION", version: 1, prefix: "COMPETITION_GYM", label: "Competition Gym" },
      { spaceTypeId: "SPT-LOCKER-ROOMS", assessmentArea: "Athletics and Wellness", versionConst: "LOCKER_ROOM_RUBRIC_VERSION", version: 1, prefix: "LOCKER_ROOM", label: "Locker Room" },
      { spaceTypeId: "SPT-WEIGHT-ROOM", assessmentArea: "Athletics and Wellness", versionConst: "WEIGHT_ROOM_RUBRIC_VERSION", version: 1, prefix: "WEIGHT_ROOM", label: "Weight Room" },
      { spaceTypeId: "SPT-WRESTLING", assessmentArea: "Athletics and Wellness", versionConst: "WRESTLING_RUBRIC_VERSION", version: 1, prefix: "WRESTLING", label: "Wrestling" },
      { spaceTypeId: "SPT-PE-FITNESS-ROOM", assessmentArea: "Athletics and Wellness", versionConst: "PE_FITNESS_ROOM_RUBRIC_VERSION", version: 1, prefix: "PE_FITNESS_ROOM", label: "PE Fitness Room" },
      { spaceTypeId: "SPT-ATHLETICS-WING", assessmentArea: "Athletics and Wellness", versionConst: "ATHLETICS_WING_RUBRIC_VERSION", version: 1, prefix: "ATHLETICS_WING", label: "Athletics Wing" },
      { spaceTypeId: "SPT-OUTDOOR-ATHLETICS", assessmentArea: "Athletics and Wellness", versionConst: "OUTDOOR_ATHLETICS_RUBRIC_VERSION", version: 1, prefix: "OUTDOOR_ATHLETICS", label: "Outdoor Athletics" },
    ],
  },
  {
    outFile: "performing-arts-rubric.ts",
    header: `/** Performing Arts rubrics — regenerate via scripts/generate-module-rubrics.mjs
 *  Source CSVs: packages/shared/src/data/studios-outdoor
 */`,
    packages: [
      { spaceTypeId: "SPT-THEATER-ARTS-STUDIO", assessmentArea: "Performing Arts", versionConst: "THEATER_ARTS_RUBRIC_VERSION", version: 1, prefix: "THEATER_ARTS", label: "Theater Arts Studio" },
      { spaceTypeId: "SPT-THEATER-ARTS-SUITE", assessmentArea: "Performing Arts", versionConst: "THEATER_ARTS_SUITE_RUBRIC_VERSION", version: 1, prefix: "THEATER_ARTS_SUITE", label: "Theater Arts Suite" },
      { spaceTypeId: "SPT-BLACK-BOX", assessmentArea: "Performing Arts", versionConst: "BLACK_BOX_RUBRIC_VERSION", version: 1, prefix: "BLACK_BOX", label: "Black Box" },
      { spaceTypeId: "SPT-AUDITORIUM", assessmentArea: "Performing Arts", versionConst: "AUDITORIUM_RUBRIC_VERSION", version: 1, prefix: "AUDITORIUM", label: "Auditorium" },
      { spaceTypeId: "SPT-DANCE", assessmentArea: "Performing Arts", versionConst: "DANCE_RUBRIC_VERSION", version: 1, prefix: "DANCE", label: "Dance" },
    ],
  },
  {
    outFile: "shared-spaces-rubric.ts",
    header: `/** Shared Spaces rubrics — regenerate via scripts/generate-module-rubrics.mjs
 *  Source CSVs: packages/shared/src/data/studios-outdoor
 */`,
    packages: [
      { spaceTypeId: "SPT-LIBRARY-MEDIA-CENTER", assessmentArea: "Shared Spaces", versionConst: "MEDIA_CENTER_RUBRIC_VERSION", version: 1, prefix: "MEDIA_CENTER", label: "Library Media Center" },
    ],
  },
]

for (const mod of MODULES) {
  const outPath = path.join(workspaceRoot, "packages", "shared", "src", "data", mod.outFile)
  let file = `import type { EsaCategory, EsaQuestion, EsaQuestionOption, EsaSubcategory } from "../types/survey"\n\n${mod.header}\n`
  for (const pkg of mod.packages) {
    const { out, stats } = emitV4Package(pkg, bundle)
    file += `\n${out}`
    console.log(`${mod.outFile} — ${stats.label}: q=${stats.questions} opt=${stats.options}`)
  }
  fs.writeFileSync(outPath, file)
  console.log(`Wrote ${outPath}`)
}
