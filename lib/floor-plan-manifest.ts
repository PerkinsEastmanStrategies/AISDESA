import type { AisdSchoolOption } from "@aisd/shared"

/** Live Google Sheet (published CSV) — updated as floor plans are uploaded to Supabase. */
export const DEFAULT_FLOOR_PLAN_MANIFEST_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTGFUvsaGfYsp9TK7ZjHT8_ZHaUq4xqxiPSedQC9XeGpmY5QCS2rkcyGuZJm517sB4RWRsNqhmxFaW_/pub?output=csv"

/** Offline fallback when the live sheet cannot be fetched. */
export const FLOOR_PLAN_MANIFEST_PATH = "/aisd-floor-plan-manifest.csv"

export const FLOOR_LEVELS = [
  { id: "basement", column: "Basement", shortLabel: "B", fullLabel: "Basement" },
  { id: "floor-1", column: "Floor 1", shortLabel: "L1", fullLabel: "Floor 1" },
  { id: "floor-2", column: "Floor 2", shortLabel: "L2", fullLabel: "Floor 2" },
  { id: "floor-3", column: "Floor 3", shortLabel: "L3", fullLabel: "Floor 3" },
  { id: "floor-4", column: "Floor 4", shortLabel: "L4", fullLabel: "Floor 4" },
  { id: "floor-5", column: "Floor 5", shortLabel: "L5", fullLabel: "Floor 5" },
  { id: "floor-6", column: "Floor 6", shortLabel: "L6", fullLabel: "Floor 6" },
  { id: "floor-7", column: "Floor 7", shortLabel: "L7", fullLabel: "Floor 7" },
  { id: "floor-8", column: "Floor 8", shortLabel: "L8", fullLabel: "Floor 8" },
  { id: "floor-9", column: "Floor 9", shortLabel: "L9", fullLabel: "Floor 9" },
  {
    id: "athletics-building",
    column: "Athletics Building",
    shortLabel: "Ath",
    fullLabel: "Athletics Building",
  },
  { id: "mezzanine", column: "Mezzanine", shortLabel: "M", fullLabel: "Mezzanine" },
] as const

export type FloorLevelId = (typeof FLOOR_LEVELS)[number]["id"]

/** Default floor shown when a school’s plan opens (unless a room selects another level). */
export const PREFERRED_DEFAULT_FLOOR_LEVEL_ID: FloorLevelId = "floor-1"

export interface FloorPlanLevelEntry {
  id: FloorLevelId
  shortLabel: string
  fullLabel: string
  filename: string
}

export interface FloorPlanManifestRow {
  schoolName: string
  schoolLevel: string
  classCode: string
  campusId: string
  /** Assessor-facing label from the live Google Sheet `UpdatedName` column. */
  updatedName?: string
  floors: Partial<Record<FloorLevelId, string>>
}

let manifestCache: FloorPlanManifestRow[] | null = null
let manifestLoadPromise: Promise<FloorPlanManifestRow[]> | null = null
let manifestLoadedSuccessfully = false

function getManifestUrl(): string {
  return process.env.NEXT_PUBLIC_FLOOR_PLAN_MANIFEST_URL ?? DEFAULT_FLOOR_PLAN_MANIFEST_URL
}

/** Parse CSV into records, keeping newlines that appear inside quoted cells. */
function parseCsvRecords(csvText: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let current = ""
  let inQuotes = false
  const text = csvText.replace(/^\uFEFF/, "")

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === ",") {
      row.push(current)
      current = ""
      continue
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++
      row.push(current)
      current = ""
      if (row.some((cell) => cell.trim())) rows.push(row.map((cell) => cell.trim()))
      row = []
      continue
    }
    current += char
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current)
    if (row.some((cell) => cell.trim())) rows.push(row.map((cell) => cell.trim()))
  }

  return rows
}

function parseManifestCsv(csvText: string): FloorPlanManifestRow[] {
  const records = parseCsvRecords(csvText)
  if (records.length < 2) return []

  const headers = records[0].map((header) => header.trim())
  const schoolNameIndex = headers.indexOf("school_name")
  if (schoolNameIndex === -1) return []

  const schoolLevelIndex = headers.indexOf("school_level")
  const classCodeIndex = headers.indexOf("class_code")
  const campusIdIndex = headers.indexOf("campus_id")
  const updatedNameIndex = headers.indexOf("UpdatedName")
  const floorColumnIndexes = FLOOR_LEVELS.map((level) => ({
    id: level.id,
    index: headers.indexOf(level.column),
  }))

  const rows: FloorPlanManifestRow[] = []

  for (const cells of records.slice(1)) {
    const schoolName = cells[schoolNameIndex]?.trim()
    if (!schoolName) continue
    if (/^note:/i.test(schoolName)) continue

    const floors: Partial<Record<FloorLevelId, string>> = {}
    for (const { id, index } of floorColumnIndexes) {
      if (index === -1) continue
      const filename = cells[index]?.trim()
      if (filename) floors[id] = filename
    }

    const updatedName =
      updatedNameIndex === -1 ? undefined : cells[updatedNameIndex]?.trim() || undefined

    rows.push({
      schoolName,
      schoolLevel: schoolLevelIndex === -1 ? "" : cells[schoolLevelIndex]?.trim() ?? "",
      classCode: classCodeIndex === -1 ? "" : cells[classCodeIndex]?.trim() ?? "",
      campusId: campusIdIndex === -1 ? "" : cells[campusIdIndex]?.trim() ?? "",
      updatedName,
      floors,
    })
  }

  return rows
}

async function fetchManifestCsv(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(url, { cache: "no-store", signal: controller.signal })
    clearTimeout(timer)
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  }
}

export async function loadFloorPlanManifest(forceReload = false): Promise<FloorPlanManifestRow[]> {
  if (manifestCache && !forceReload) return manifestCache
  if (manifestLoadPromise && !forceReload) return manifestLoadPromise

  manifestLoadPromise = (async () => {
    try {
      const liveCsv = await fetchManifestCsv(getManifestUrl())
      if (liveCsv) {
        const liveRows = parseManifestCsv(liveCsv)
        if (liveRows.length > 0) {
          manifestCache = liveRows
          manifestLoadedSuccessfully = true
          return manifestCache
        }
      }

      const localCsv = await fetchManifestCsv(FLOOR_PLAN_MANIFEST_PATH)
      if (localCsv) {
        const localRows = parseManifestCsv(localCsv)
        if (localRows.length > 0) {
          manifestCache = localRows
          manifestLoadedSuccessfully = true
          return manifestCache
        }
      }

      manifestCache = []
      manifestLoadedSuccessfully = false
      return manifestCache
    } catch {
      manifestCache = []
      manifestLoadedSuccessfully = false
      return manifestCache
    } finally {
      manifestLoadPromise = null
    }
  })()

  return manifestLoadPromise
}

export function getManifestRowForAisdSchool(
  manifest: FloorPlanManifestRow[],
  school: AisdSchoolOption,
): FloorPlanManifestRow | undefined {
  const normalizedName = school.name.toUpperCase().replace(/\s+/g, " ").trim()
  const normalizedDisplay = school.displayName.toUpperCase().replace(/\s+/g, " ").trim()
  return manifest.find((row) => {
    const rowName = row.schoolName.toUpperCase().replace(/\s+/g, " ").trim()
    const updatedName = row.updatedName?.toUpperCase().replace(/\s+/g, " ").trim()
    return (
      rowName === normalizedName ||
      rowName === normalizedDisplay ||
      (!!updatedName && (updatedName === normalizedName || updatedName === normalizedDisplay)) ||
      (!!row.campusId && row.campusId === school.campusId)
    )
  })
}

/** Prefer live sheet `UpdatedName` for school picker labels; fall back to geojson name. */
export function displayNameForSchoolFromManifest(
  school: AisdSchoolOption,
  manifest: FloorPlanManifestRow[],
): string {
  const updatedName = getManifestRowForAisdSchool(manifest, school)?.updatedName?.trim()
  return updatedName || school.displayName
}

export function schoolsWithManifestDisplayNames(
  schools: AisdSchoolOption[],
  manifest: FloorPlanManifestRow[],
): AisdSchoolOption[] {
  return schools
    .map((school) => ({
      ...school,
      displayName: displayNameForSchoolFromManifest(school, manifest),
    }))
    .sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
    )
}

export function rowHasFloorPlans(row: FloorPlanManifestRow): boolean {
  return FLOOR_LEVELS.some((level) => Boolean(row.floors[level.id]?.trim()))
}

export function schoolHasFloorPlan(
  school: AisdSchoolOption,
  manifest: FloorPlanManifestRow[],
): boolean {
  // Lively uses local multi-level plans regardless of the live Sheet row.
  if (
    school.id === "lively" ||
    school.name.toUpperCase().replace(/\s+/g, " ").trim().includes("LIVELY")
  ) {
    return true
  }
  const row = getManifestRowForAisdSchool(manifest, school)
  return row ? rowHasFloorPlans(row) : false
}

export function getAvailableFloorsForSchool(
  school: AisdSchoolOption,
  manifest: FloorPlanManifestRow[],
): FloorPlanLevelEntry[] {
  const row = getManifestRowForAisdSchool(manifest, school)
  if (!row) return []

  const floors: FloorPlanLevelEntry[] = []
  for (const level of FLOOR_LEVELS) {
    const filename = row.floors[level.id]?.trim()
    if (filename) {
      floors.push({
        id: level.id,
        shortLabel: level.shortLabel,
        fullLabel: level.fullLabel,
        filename,
      })
    }
  }
  return floors
}

export async function getAvailableFloors(school: AisdSchoolOption): Promise<FloorPlanLevelEntry[]> {
  const manifest = await loadFloorPlanManifest()
  return getAvailableFloorsForSchool(school, manifest)
}

export function isManifestLoaded(): boolean {
  return manifestLoadedSuccessfully
}
