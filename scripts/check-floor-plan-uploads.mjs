const MANIFEST_URL =
  process.env.NEXT_PUBLIC_FLOOR_PLAN_MANIFEST_URL ??
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTGFUvsaGfYsp9TK7ZjHT8_ZHaUq4xqxiPSedQC9XeGpmY5QCS2rkcyGuZJm517sB4RWRsNqhmxFaW_/pub?output=csv"

const SUPABASE_URL = "https://mgflyiwrzcmxxuxpfotk.supabase.co"
const BUCKET = "floor-plans"

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

function toMobile(filename) {
  if (/\.mobile\.svg$/i.test(filename)) return filename
  if (/\.svg$/i.test(filename)) return filename.replace(/\.svg$/i, ".mobile.svg")
  return `${filename}.mobile.svg`
}

function urlFor(filename) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(filename)}`
}

async function exists(filename) {
  try {
    const res = await fetch(urlFor(filename), { method: "HEAD" })
    if (res.ok) return true
    // Some hosts reject HEAD — try a ranged GET
    const get = await fetch(urlFor(filename), {
      headers: { Range: "bytes=0-0" },
    })
    return get.ok || get.status === 206
  } catch {
    return false
  }
}

const csv = await (await fetch(MANIFEST_URL, { cache: "no-store" })).text()
const lines = csv
  .replace(/^\uFEFF/, "")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean)

const headers = parseCsvLine(lines[0]).map((h) => h.trim())
const nameIdx = headers.indexOf("school_name")
const levelIdx = headers.indexOf("school_level")
const floorIdxs = FLOOR_COLUMNS.map((col) => ({
  col,
  index: headers.indexOf(col),
}))

const withFiles = []
const withoutFiles = []

for (const line of lines.slice(1)) {
  const cells = parseCsvLine(line)
  const schoolName = cells[nameIdx]?.trim()
  if (!schoolName) continue
  const schoolLevel = levelIdx === -1 ? "" : cells[levelIdx]?.trim() ?? ""

  const floors = []
  for (const { col, index } of floorIdxs) {
    if (index === -1) continue
    const filename = cells[index]?.trim()
    if (filename) floors.push({ col, filename })
  }

  if (floors.length === 0) {
    withoutFiles.push({ schoolName, schoolLevel })
  } else {
    withFiles.push({ schoolName, schoolLevel, floors })
  }
}

const failed = []
const ok = []
const missingMobileOnly = []

for (const school of withFiles) {
  const fileResults = []
  for (const floor of school.floors) {
    const desktopOk = await exists(floor.filename)
    const mobileName = toMobile(floor.filename)
    const mobileOk = await exists(mobileName)
    fileResults.push({
      ...floor,
      desktopOk,
      mobileOk,
      mobileName,
    })
  }

  const anyDesktopMissing = fileResults.some((f) => !f.desktopOk)
  const allDesktopOk = fileResults.every((f) => f.desktopOk)
  const anyMobileMissing = fileResults.some((f) => !f.mobileOk)

  if (anyDesktopMissing) {
    failed.push({
      schoolName: school.schoolName,
      schoolLevel: school.schoolLevel,
      files: fileResults.filter((f) => !f.desktopOk),
      allFiles: fileResults,
    })
  } else {
    ok.push(school.schoolName)
    if (anyMobileMissing) {
      missingMobileOnly.push({
        schoolName: school.schoolName,
        missing: fileResults.filter((f) => !f.mobileOk).map((f) => f.mobileName),
      })
    }
  }
}

console.log(
  JSON.stringify(
    {
      summary: {
        listedInCsvWithFilenames: withFiles.length,
        listedInCsvWithNoFilenames: withoutFiles.length,
        desktopUploadOk: ok.length,
        desktopUploadFailed: failed.length,
        mobileMissingButDesktopOk: missingMobileOnly.length,
      },
      desktopUploadFailed: failed.map((s) => ({
        school: s.schoolName,
        level: s.schoolLevel,
        missingDesktopFiles: s.files.map((f) => `${f.col}: ${f.filename}`),
      })),
      noFloorPlanFilenamesInCsv: withoutFiles.map(
        (s) => `${s.schoolName} (${s.schoolLevel || "unknown"})`,
      ),
      mobileMissingOnly: missingMobileOnly,
    },
    null,
    2,
  ),
)
