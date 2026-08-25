import { testCampusCloneForSchool, type AisdSchoolOption } from "@aisd/shared"

/** Live Google Sheet (published CSV) — fallback when `floor_plan_manifest` has no row for a campus. */
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

/** DXF converter `floor_plan_manifest` table (one row per campus + floor). */
type FloorPlanManifestDbRow = {
  campus_id: string
  school_name: string
  school_class: string | null
  floor_level_id: string
  floor_label: string
  filename: string
  mobile_filename: string | null
}

/** Converter floor ids that differ from ESA `FLOOR_LEVELS`. */
const FLOOR_LEVEL_ID_ALIASES: Record<string, FloorLevelId> = {
  athletics: "athletics-building",
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

function normalizeFloorLevelId(raw: string): FloorLevelId | null {
  const id = raw.trim()
  if (!id) return null
  const aliased = FLOOR_LEVEL_ID_ALIASES[id] ?? id
  return FLOOR_LEVELS.some((level) => level.id === aliased) ? (aliased as FloorLevelId) : null
}

function desktopFilenameFromDbRow(row: FloorPlanManifestDbRow): string {
  const filename = row.filename?.trim() || ""
  if (filename) return filename
  return row.mobile_filename?.trim() || ""
}

function supabaseRowsToManifest(rows: FloorPlanManifestDbRow[]): FloorPlanManifestRow[] {
  const byKey = new Map<string, FloorPlanManifestRow>()

  for (const row of rows) {
    const campusId = row.campus_id?.trim() ?? ""
    const schoolName = row.school_name?.trim() ?? ""
    if (!campusId && !schoolName) continue

    const levelId = normalizeFloorLevelId(row.floor_level_id ?? "")
    const filename = desktopFilenameFromDbRow(row)
    if (!levelId || !filename) continue

    const key = campusId || schoolName.toUpperCase().replace(/\s+/g, " ")
    let existing = byKey.get(key)
    if (!existing) {
      existing = {
        schoolName,
        schoolLevel: "",
        classCode: row.school_class?.trim() ?? "",
        campusId,
        floors: {},
      }
      byKey.set(key, existing)
    }
    existing.floors[levelId] = filename
  }

  return [...byKey.values()]
}

/**
 * Supabase (DXF converter) wins per campus. Schools with no table rows keep the Google Sheet.
 * When a campus has some converter floors, those filenames overlay the sheet; other sheet floors stay.
 */
function mergeSheetWithSupabase(
  sheetRows: FloorPlanManifestRow[],
  supabaseRows: FloorPlanManifestRow[],
): FloorPlanManifestRow[] {
  if (!supabaseRows.length) return sheetRows

  const merged = sheetRows.map((row) => ({
    ...row,
    floors: { ...row.floors },
  }))

  for (const supabaseRow of supabaseRows) {
    const match = matchManifestRow(
      merged,
      supabaseRow.schoolName,
      supabaseRow.schoolName,
      supabaseRow.campusId,
    )
    if (match) {
      match.floors = { ...match.floors, ...supabaseRow.floors }
      if (!match.campusId && supabaseRow.campusId) match.campusId = supabaseRow.campusId
      if (!match.classCode && supabaseRow.classCode) match.classCode = supabaseRow.classCode
    } else {
      merged.push(supabaseRow)
    }
  }

  return merged
}

async function loadSheetManifest(): Promise<FloorPlanManifestRow[]> {
  const liveCsv = await fetchManifestCsv(getManifestUrl())
  if (liveCsv) {
    const liveRows = parseManifestCsv(liveCsv)
    if (liveRows.length > 0) return liveRows
  }

  const localCsv = await fetchManifestCsv(FLOOR_PLAN_MANIFEST_PATH)
  if (localCsv) {
    const localRows = parseManifestCsv(localCsv)
    if (localRows.length > 0) return localRows
  }

  return []
}

async function loadSupabaseManifest(): Promise<FloorPlanManifestRow[]> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const response = await fetch("/api/floor-plan-manifest", {
      cache: "no-store",
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!response.ok) return []
    const payload = (await response.json()) as { rows?: FloorPlanManifestDbRow[] }
    if (!Array.isArray(payload.rows) || payload.rows.length === 0) return []
    return supabaseRowsToManifest(payload.rows)
  } catch {
    return []
  }
}

export async function loadFloorPlanManifest(forceReload = false): Promise<FloorPlanManifestRow[]> {
  if (manifestCache && !forceReload) return manifestCache
  if (manifestLoadPromise && !forceReload) return manifestLoadPromise

  manifestLoadPromise = (async () => {
    try {
      const [sheetRows, supabaseRows] = await Promise.all([
        loadSheetManifest(),
        loadSupabaseManifest(),
      ])
      const merged = mergeSheetWithSupabase(sheetRows, supabaseRows)
      manifestCache = merged
      manifestLoadedSuccessfully = merged.length > 0
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

function matchManifestRow(
  manifest: FloorPlanManifestRow[],
  schoolName: string,
  displayName: string,
  campusId: string,
): FloorPlanManifestRow | undefined {
  const normalizedName = schoolName.toUpperCase().replace(/\s+/g, " ").trim()
  const normalizedDisplay = displayName.toUpperCase().replace(/\s+/g, " ").trim()
  return manifest.find((row) => {
    const rowName = row.schoolName.toUpperCase().replace(/\s+/g, " ").trim()
    const updatedName = row.updatedName?.toUpperCase().replace(/\s+/g, " ").trim()
    return (
      rowName === normalizedName ||
      rowName === normalizedDisplay ||
      (!!updatedName && (updatedName === normalizedName || updatedName === normalizedDisplay)) ||
      (!!row.campusId && !!campusId && row.campusId === campusId)
    )
  })
}

export function getManifestRowForAisdSchool(
  manifest: FloorPlanManifestRow[],
  school: AisdSchoolOption,
): FloorPlanManifestRow | undefined {
  const clone = testCampusCloneForSchool(school)
  if (clone) {
    return matchManifestRow(manifest, clone.sourceName, clone.sourceName, clone.sourceCampusId)
  }
  return matchManifestRow(manifest, school.name, school.displayName, school.campusId)
}

/** Prefer live sheet `UpdatedName` for school picker labels; fall back to geojson name. */
export function displayNameForSchoolFromManifest(
  school: AisdSchoolOption,
  manifest: FloorPlanManifestRow[],
): string {
  const clone = testCampusCloneForSchool(school)
  if (clone) return clone.displayName
  const updatedName = matchManifestRow(
    manifest,
    school.name,
    school.displayName,
    school.campusId,
  )?.updatedName?.trim()
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
