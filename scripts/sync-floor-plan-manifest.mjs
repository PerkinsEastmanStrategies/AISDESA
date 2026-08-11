/**
 * Refresh public/aisd-floor-plan-manifest.csv from the live Google Sheet.
 * Preserves campus_id from the existing bundled file when school names match.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OUT_PATH = join(ROOT, "public", "aisd-floor-plan-manifest.csv")
const LOCAL_PATH = OUT_PATH

const MANIFEST_URL =
  process.env.NEXT_PUBLIC_FLOOR_PLAN_MANIFEST_URL ??
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTGFUvsaGfYsp9TK7ZjHT8_ZHaUq4xqxiPSedQC9XeGpmY5QCS2rkcyGuZJm517sB4RWRsNqhmxFaW_/pub?output=csv"

const FLOOR_COLUMNS = [
  "Basement",
  "Floor 1",
  "Floor 2",
  "Floor 3",
  "Floor 4",
  "Floor 5",
  "Floor 6",
  "Floor 7",
  "Floor 8",
  "Floor 9",
  "Athletics Building",
  "Mezzanine",
]

const OUTPUT_COLUMNS = [
  "school_name",
  "school_level",
  "class_code",
  "campus_id",
  ...FLOOR_COLUMNS,
  "UpdatedName",
]

function parseCsvLine(line) {
  const values = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === "," && !inQuotes) {
      values.push(current)
      current = ""
      continue
    }
    current += char
  }
  values.push(current)
  return values
}

function escapeCsvCell(value) {
  const text = value ?? ""
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim())
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const row = {}
    headers.forEach((header, index) => {
      row[header] = cells[index]?.trim() ?? ""
    })
    return row
  })
  return { headers, rows }
}

function loadCampusIdBySchoolName() {
  const map = new Map()
  try {
    const local = readFileSync(LOCAL_PATH, "utf8")
    const { rows } = parseCsv(local)
    for (const row of rows) {
      const name = row.school_name?.toUpperCase().replace(/\s+/g, " ").trim()
      const campusId = row.campus_id?.trim()
      if (name && campusId) map.set(name, campusId)
    }
  } catch {
    /* no existing file */
  }
  return map
}

const campusByName = loadCampusIdBySchoolName()

const response = await fetch(MANIFEST_URL, { cache: "no-store" })
if (!response.ok) {
  console.error(`Failed to fetch live manifest: ${response.status}`)
  process.exit(1)
}

const { rows: liveRows } = parseCsv(await response.text())
if (!liveRows.length) {
  console.error("Live manifest is empty")
  process.exit(1)
}

const outputLines = [OUTPUT_COLUMNS.join(",")]

for (const row of liveRows) {
  const schoolName = row.school_name?.trim()
  if (!schoolName) continue

  const normalized = schoolName.toUpperCase().replace(/\s+/g, " ").trim()
  const campusId = campusByName.get(normalized) ?? ""

  const outRow = {
    school_name: schoolName,
    school_level: row.school_level ?? "",
    class_code: row.class_code ?? "",
    campus_id: campusId,
    UpdatedName: row.UpdatedName ?? "",
  }
  for (const column of FLOOR_COLUMNS) {
    outRow[column] = row[column] ?? ""
  }

  outputLines.push(
    OUTPUT_COLUMNS.map((column) => escapeCsvCell(outRow[column])).join(","),
  )
}

writeFileSync(OUT_PATH, `${outputLines.join("\n")}\n`, "utf8")
console.log(`Wrote ${outputLines.length - 1} schools to ${OUT_PATH}`)
