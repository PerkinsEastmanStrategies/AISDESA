import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

const sourceDir =
  process.argv[2] ||
  path.join(process.env.USERPROFILE ?? "", "Downloads", "AISD_ESA_FinalDraft0729_CSV_Package")

const files = [
  "01_Surveys.csv",
  "02_SpaceTypes.csv",
  "03_Categories.csv",
  "04_Subcategories.csv",
  "05_Questions.csv",
  "06_QuestionOptions.csv",
]

const targets = [
  path.join(root, "packages", "shared", "src", "data", "studios-outdoor"),
  path.join(root, "packages", "shared", "src", "data", "outdoor-survey"),
  path.join(root, "packages", "shared", "src", "data", "admin-survey"),
  path.join(root, "packages", "shared", "src", "data", "arrival-admin-survey"),
]

if (!fs.existsSync(sourceDir)) {
  console.error(`Source directory not found: ${sourceDir}`)
  process.exit(1)
}

for (const file of files) {
  const src = path.join(sourceDir, file)
  if (!fs.existsSync(src)) {
    console.error(`Missing source file: ${src}`)
    process.exit(1)
  }
}

for (const dir of targets) {
  fs.mkdirSync(dir, { recursive: true })
  for (const file of files) {
    fs.copyFileSync(path.join(sourceDir, file), path.join(dir, file))
  }
  console.log(`Synced ${files.length} CSVs -> ${path.relative(root, dir)}`)
}

console.log("Done.")
