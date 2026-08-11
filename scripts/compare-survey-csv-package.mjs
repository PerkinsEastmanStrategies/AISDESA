import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { parseCsv, rowsToObjects } from "./lib/v4-rubric-generator.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

const newDir =
  process.argv[2] ||
  path.join(process.env.USERPROFILE ?? "", "Downloads", "AISD_ESA_8_10_26_CSV_Package")
const oldDir = path.join(root, "packages", "shared", "src", "data", "studios-outdoor")

function readObjects(dir, file) {
  const text = fs.readFileSync(path.join(dir, file), "utf8").replace(/^\uFEFF/, "")
  return rowsToObjects(parseCsv(text))
}

function countRows(dir, file) {
  if (!fs.existsSync(path.join(dir, file))) return 0
  return readObjects(dir, file).length
}

const generatorIds = {
  "Traditional Studio": "SPT-TRADITIONAL-STUDIO-78A63C",
  "Maker Space": "SPT-MAKER-SPACE-57653D",
  "Sensory Motor Lab": "SPT-SENSORY-MOTOR-LAB-3CE0F0",
  "Vocational Lab": "SPT-VOCATIONAL-LAB-534CA6",
  "Life Skills Studio": "SPT-LIFE-SKILLS-STUDIO-923127",
  "SPED Flex Studio": "SPT-SPED-FLEX-STUDIO-8EBAD0",
  "Outdoor Spaces": "SPT-OUTDOOR-SPACES-F4EC64",
  "Admin Offices": "SPT-ADMIN-OFFICES-C36ECE",
  "MW and Counseling Suite": "SPT-MW-AND-COUNSELING-SUITE-3ACB29",
  "Professional Learning Center": "SPT-PROFESSIONAL-LEARNING-CENTER-A2E7B5",
  "Main Entry/Reception": "SPT-MAIN-ENTRY-RECEPTION-CC5A87",
  "Main Admin Suite": "SPT-MAIN-ADMIN-SUITE-6009C0",
  "Community Partners Suite": "SPT-COMMUNITY-PARTNERS-SUITE-8EC0EC",
  Neighborhood: "SPT-NEIGHBORHOOD-D091AE",
  "Group Room": "SPT-GROUP-ROOM-4362E2",
  "Open Collaboration": "SPT-OPEN-COLLABORATION-0308C2",
}

console.log("=== CSV row counts (old studios-outdoor vs new package) ===")
for (const file of [
  "01_Surveys.csv",
  "02_SpaceTypes.csv",
  "03_Categories.csv",
  "04_Subcategories.csv",
  "05_Questions.csv",
  "06_QuestionOptions.csv",
]) {
  console.log(`${file}: old=${countRows(oldDir, file)} new=${countRows(newDir, file)}`)
}

const spaceTypes = readObjects(newDir, "02_SpaceTypes.csv")
const questions = readObjects(newDir, "05_Questions.csv")
const options = readObjects(newDir, "06_QuestionOptions.csv")

console.log("\n=== Generator space-type question counts (new package) ===")
for (const [label, id] of Object.entries(generatorIds)) {
  const q = questions.filter((row) => row.SpaceTypeID === id && String(row.IsActive).toLowerCase() === "true")
  const qIds = new Set(q.map((row) => row.QuestionID))
  const o = options.filter((row) => qIds.has(row.QuestionID) && String(row.IsActive).toLowerCase() === "true")
  console.log(`${label}: questions=${q.length} options=${o.length}${q.length === 0 ? " *** NO QUESTIONS ***" : ""}`)
}

const missingIds = Object.values(generatorIds).filter(
  (id) => !spaceTypes.some((row) => row.SpaceTypeID === id),
)
if (missingIds.length) {
  console.log("\n*** Missing SpaceTypeIDs in 02_SpaceTypes.csv:", missingIds.join(", "))
}

const validationPath = path.join(newDir, "08_ValidationNotes.csv")
if (fs.existsSync(validationPath)) {
  const notes = rowsToObjects(
    parseCsv(fs.readFileSync(validationPath, "utf8").replace(/^\uFEFF/, "")),
  )
  console.log(`\n=== Validation notes (${notes.length} rows in 08_ValidationNotes.csv) ===`)
  console.log("See source package for weight conflicts resolved during import.")
}
