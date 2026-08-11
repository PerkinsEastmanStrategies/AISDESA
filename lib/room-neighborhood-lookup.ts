/** Load school room→neighborhood assignments from the live Google Sheet CSV. */

import type { AisdSchoolOption } from "@aisd/shared"
import { NEIGHBORHOOD_OPTIONS } from "@aisd/shared"

export type RoomNeighborhoodMap = Map<string, string>

/** Room program / use from the live sheet, keyed by CAFM id. */
export interface RoomUseEntry {
  id: string
  useName: string
  /** Program Type column — drives Room use toggle fill colors. */
  programType?: string
}

export type RoomUseMap = Map<string, RoomUseEntry>

export type RoomAreaMap = Map<string, number>

export type SizeDeviationBand = "green" | "orange" | "red"

export type RoomSizeDeviationMap = Map<string, SizeDeviationBand>

/** Live Google Sheet (published CSV) — room neighborhoods by school + CAFM_ID. */
export const DEFAULT_ROOM_NEIGHBORHOOD_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQhjfsjsbDHT0eEKZifiNn67Wup9CfA4flEB3Mcx9tlNEO3-A8tTc7Vj50sI_SyE38nDjI3vUkqpUmd/pub?output=csv"

interface SchoolNeighborhoodData {
  byRoomKey: RoomNeighborhoodMap
  byRoomUse: RoomUseMap
  byRoomArea: RoomAreaMap
  byRoomSizeDeviation: RoomSizeDeviationMap
  neighborhoods: Set<string>
}

let csvLoadPromise: Promise<Map<string, SchoolNeighborhoodData>> | null = null
let campusIdIndex: Map<string, SchoolNeighborhoodData> = new Map()

export function resetRoomNeighborhoodCsvCache(): void {
  csvLoadPromise = null
  campusIdIndex = new Map()
}

function getCsvUrl(): string {
  return process.env.NEXT_PUBLIC_ROOM_NEIGHBORHOOD_CSV_URL ?? DEFAULT_ROOM_NEIGHBORHOOD_CSV_URL
}

export function normalizeSchoolLookupName(name: string): string {
  return name.toUpperCase().replace(/\s+/g, " ").trim()
}

/** Match CSV `school_name` values to AISD school dropdown names (geojson NAME). */
export function schoolNamesMatch(csvSchoolName: string, appSchoolName: string): boolean {
  const csv = normalizeSchoolLookupName(csvSchoolName)
  const app = normalizeSchoolLookupName(appSchoolName)
  if (!csv || !app) return false
  if (csv === app) return true

  const csvNoTa = csv.replace(/^TA\s+/, "")
  const appNoTa = app.replace(/^TA\s+/, "")
  if (csvNoTa === app || csv === appNoTa || csvNoTa === appNoTa) return true

  // BARBARA JORDAN → JORDAN
  const csvLast = csv.split(/\s+/).pop() ?? ""
  if (csvLast.length >= 4 && csvLast === app) return true

  // BLAZIER → BLAZIER K-3 / GUERRERO → GUERRERO THOMPSON / SUMMIT → SUMMITT
  if (app.startsWith(`${csv} `) || app.startsWith(`${csv}-`)) return true
  if (csv.startsWith(`${app} `) || csv.startsWith(`${app}-`)) return true
  if (app.startsWith(csv) || csv.startsWith(app)) return true

  // SUMMIT ↔ SUMMITT
  if (csv.replace(/T+$/, "") === app.replace(/T+$/, "")) return true

  return false
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      field = ""
      if (row.length > 1 || row[0] !== "") rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function roomLookupKeys(rawId: string): string[] {
  const id = rawId.trim()
  if (!id) return []
  const upper = id.toUpperCase()
  const collapsed = upper.replace(/\s+/g, "")
  const alnum = upper.replace(/[^A-Z0-9]/g, "")
  const keys = new Set<string>([id, upper])
  if (collapsed) keys.add(collapsed)
  if (alnum) keys.add(alnum)
  if (/^\d+$/.test(id)) keys.add(String(Number.parseInt(id, 10)))
  return [...keys]
}

function setNeighborhood(map: RoomNeighborhoodMap, rawId: string, neighborhood: string) {
  for (const key of roomLookupKeys(rawId)) {
    map.set(key, neighborhood)
  }
}

function setRoomUse(map: RoomUseMap, rawId: string, entry: RoomUseEntry) {
  for (const key of roomLookupKeys(rawId)) {
    map.set(key, entry)
  }
}

function parseAreaSqft(raw: string | undefined): number | undefined {
  const cleaned = (raw ?? "").replace(/,/g, "").trim()
  if (!cleaned) return undefined
  const value = Number.parseFloat(cleaned)
  if (!Number.isFinite(value) || value <= 0) return undefined
  return value
}

function setRoomArea(map: RoomAreaMap, rawId: string, areaSqft: number) {
  for (const key of roomLookupKeys(rawId)) {
    map.set(key, areaSqft)
  }
}

function setRoomSizeDeviation(
  map: RoomSizeDeviationMap,
  rawId: string,
  band: SizeDeviationBand,
) {
  for (const key of roomLookupKeys(rawId)) {
    map.set(key, band)
  }
}

/** Parse SF Deviation column — sheet uses GREEN / ORANGE / RED or a numeric % of ed spec size. */
export function parseSizeDeviationBand(raw: string | undefined): SizeDeviationBand | undefined {
  const value = (raw ?? "").trim()
  if (!value) return undefined

  const upper = value.toUpperCase()
  if (upper === "GREEN" || upper.startsWith("GREEN")) return "green"
  if (upper === "ORANGE" || upper.startsWith("ORANGE")) return "orange"
  if (upper === "RED" || upper.startsWith("RED")) return "red"

  const pct = Number.parseFloat(value.replace(/%/g, "").replace(/,/g, ""))
  if (!Number.isFinite(pct)) return undefined
  if (pct >= 95) return "green"
  if (pct >= 85) return "orange"
  return "red"
}

function buildSchoolIndex(csvText: string): Map<string, SchoolNeighborhoodData> {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ""))
  if (rows.length < 2) return new Map()

  const header = rows[0].map((h) => h.trim())
  const schoolIdx = header.findIndex((h) => h.toLowerCase() === "school_name")
  const cafmIdx = header.findIndex((h) => h.toLowerCase() === "cafm_id")
  const nameIdx = header.findIndex((h) => h.toLowerCase() === "name")
  const nbhIdx = header.findIndex((h) => h.toLowerCase() === "neighborhood")
  const programTypeIdx = header.findIndex((h) => h.toLowerCase() === "program type")
  const areaIdx = header.findIndex((h) => h.toLowerCase() === "area")
  const sfDeviationIdx = header.findIndex((h) => h.toLowerCase() === "sf deviation")
  const campusIdx = header.findIndex((h) => h.toLowerCase() === "campus_id")
  if (schoolIdx < 0 || cafmIdx < 0) return new Map()

  const index = new Map<string, SchoolNeighborhoodData>()
  campusIdIndex = new Map()

  for (const row of rows.slice(1)) {
    const schoolName = (row[schoolIdx] ?? "").trim()
    const cafmId = (row[cafmIdx] ?? "").trim()
    const roomName = nameIdx >= 0 ? (row[nameIdx] ?? "").trim() : ""
    const neighborhood = nbhIdx >= 0 ? (row[nbhIdx] ?? "").trim().toUpperCase() : ""
    const programType =
      programTypeIdx >= 0 ? (row[programTypeIdx] ?? "").trim() : ""
    const areaSqft = areaIdx >= 0 ? parseAreaSqft(row[areaIdx]) : undefined
    const sizeDeviation =
      sfDeviationIdx >= 0 ? parseSizeDeviationBand(row[sfDeviationIdx]) : undefined
    const campusId = campusIdx >= 0 ? (row[campusIdx] ?? "").trim() : ""
    if (!schoolName) continue

    const schoolKey = normalizeSchoolLookupName(schoolName)
    let data = index.get(schoolKey)
    if (!data) {
      data = { byRoomKey: new Map(), byRoomUse: new Map(), byRoomArea: new Map(), byRoomSizeDeviation: new Map(), neighborhoods: new Set() }
      index.set(schoolKey, data)
    }

    if (campusId && !campusIdIndex.has(campusId)) {
      campusIdIndex.set(campusId, data)
    }

    if (neighborhood) {
      data.neighborhoods.add(neighborhood)
      if (cafmId) setNeighborhood(data.byRoomKey, cafmId, neighborhood)
    }

    const useName = roomName || cafmId
    if (useName || programType) {
      const entry: RoomUseEntry = {
        id: cafmId || roomName,
        useName: useName || cafmId,
        ...(programType ? { programType } : {}),
      }
      if (cafmId) setRoomUse(data.byRoomUse, cafmId, entry)
      if (roomName) setRoomUse(data.byRoomUse, roomName, entry)
    }

    if (areaSqft != null) {
      if (cafmId) setRoomArea(data.byRoomArea, cafmId, areaSqft)
      if (roomName) setRoomArea(data.byRoomArea, roomName, areaSqft)
    }

    if (sizeDeviation) {
      if (cafmId) setRoomSizeDeviation(data.byRoomSizeDeviation, cafmId, sizeDeviation)
      if (roomName) setRoomSizeDeviation(data.byRoomSizeDeviation, roomName, sizeDeviation)
    }
  }

  return index
}

async function loadSchoolIndex(): Promise<Map<string, SchoolNeighborhoodData>> {
  if (csvLoadPromise) return csvLoadPromise

  csvLoadPromise = fetch(getCsvUrl(), { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) {
        csvLoadPromise = null
        return new Map<string, SchoolNeighborhoodData>()
      }
      return buildSchoolIndex(await res.text())
    })
    .catch(() => {
      csvLoadPromise = null
      return new Map<string, SchoolNeighborhoodData>()
    })

  return csvLoadPromise
}

type SchoolLookupInput =
  | string
  | {
      name: string
      displayName?: string | null
      campusId?: string | null
    }
  | null
  | undefined

function resolveSchoolName(school: SchoolLookupInput): string | null {
  if (!school) return null
  if (typeof school === "string") return school.trim() || null
  return school.name?.trim() || null
}

function findSchoolData(
  index: Map<string, SchoolNeighborhoodData>,
  school: SchoolLookupInput,
): SchoolNeighborhoodData | null {
  const schoolName = resolveSchoolName(school)
  if (!schoolName) return null

  const campusId =
    typeof school === "object" && school && "campusId" in school
      ? school.campusId?.trim()
      : ""
  if (campusId && campusIdIndex.has(campusId)) {
    return campusIdIndex.get(campusId) ?? null
  }

  const normalized = normalizeSchoolLookupName(schoolName)
  const direct = index.get(normalized)
  if (direct) return direct

  for (const [csvName, data] of index) {
    if (schoolNamesMatch(csvName, schoolName)) return data
  }

  const displayName =
    typeof school === "object" && school && "displayName" in school
      ? school.displayName?.trim()
      : ""
  if (displayName && displayName !== schoolName) {
    for (const [csvName, data] of index) {
      if (schoolNamesMatch(csvName, displayName)) return data
    }
  }

  return null
}

/** Room numbers embedded in sheet/display names (e.g. "KINDERGARTEN A107", "Room A112.1"). */
function embeddedRoomNumbersInName(name: string): string[] {
  const matches = name.match(/\b([A-Z]\d{2,4}(?:\.\d+)?[A-Z]?|\d{2,4}(?:\.\d+)?[A-Z]?)\b/gi)
  if (!matches) return []
  return [...new Set(matches.map((m) => m.trim().toUpperCase()).filter(Boolean))]
}

export function floorPlanRoomLookupIds(room: {
  id: string
  name?: string | null
}): string[] {
  const keys = new Set<string>()
  for (const key of roomLookupKeys(room.id)) keys.add(key)
  const name = room.name?.trim()
  if (name) {
    for (const key of roomLookupKeys(name)) keys.add(key)
    const tail = name.match(/\b([A-Z]?\d{2,4}(?:\.\d+)?[A-Z]?)\s*$/i)?.[1]
    if (tail) {
      for (const key of roomLookupKeys(tail)) keys.add(key)
    }
    for (const embedded of embeddedRoomNumbersInName(name)) {
      for (const key of roomLookupKeys(embedded)) keys.add(key)
    }
  }
  return [...keys]
}

export async function loadRoomNeighborhoodMap(
  school: SchoolLookupInput,
): Promise<RoomNeighborhoodMap> {
  if (!resolveSchoolName(school)) return new Map()

  const index = await loadSchoolIndex()
  const data = findSchoolData(index, school)
  return data ? new Map(data.byRoomKey) : new Map()
}

export async function loadRoomUseMap(school: SchoolLookupInput): Promise<RoomUseMap> {
  if (!resolveSchoolName(school)) return new Map()

  const index = await loadSchoolIndex()
  const data = findSchoolData(index, school)
  return data ? new Map(data.byRoomUse) : new Map()
}

export async function loadRoomAreaMap(school: SchoolLookupInput): Promise<RoomAreaMap> {
  if (!resolveSchoolName(school)) return new Map()

  const index = await loadSchoolIndex()
  const data = findSchoolData(index, school)
  return data ? new Map(data.byRoomArea) : new Map()
}

export async function loadRoomSizeDeviationMap(
  school: SchoolLookupInput,
): Promise<RoomSizeDeviationMap> {
  if (!resolveSchoolName(school)) return new Map()

  const index = await loadSchoolIndex()
  const data = findSchoolData(index, school)
  return data ? new Map(data.byRoomSizeDeviation) : new Map()
}

export function roomAreaForRoom(
  map: RoomAreaMap,
  roomId: string,
  roomName?: string | null,
): number | undefined {
  for (const key of floorPlanRoomLookupIds({ id: roomId, name: roomName })) {
    const hit = map.get(key)
    if (hit != null && hit > 0) return hit
  }
  return undefined
}

export function sizeDeviationForRoom(
  map: RoomSizeDeviationMap,
  roomId: string,
  roomName?: string | null,
): SizeDeviationBand | undefined {
  for (const key of floorPlanRoomLookupIds({ id: roomId, name: roomName })) {
    const hit = map.get(key)
    if (hit) return hit
  }
  return undefined
}

const SIZE_DEVIATION_FILL: Record<SizeDeviationBand, string> = {
  green: "#069C56",
  orange: "#FF980E",
  red: "#D3212C",
}

export function sizeDeviationFillColor(band: SizeDeviationBand | null | undefined): string | null {
  if (!band) return null
  return SIZE_DEVIATION_FILL[band] ?? null
}

export const SIZE_DEVIATION_LEGEND: { id: string; color: string }[] = [
  { id: "Green · ≥95% of ed spec", color: SIZE_DEVIATION_FILL.green },
  { id: "Orange · 85–94.9%", color: SIZE_DEVIATION_FILL.orange },
  { id: "Red · <85%", color: SIZE_DEVIATION_FILL.red },
]

export async function schoolHasRoomLookupData(
  school: SchoolLookupInput,
): Promise<{ roomUse: boolean; neighborhood: boolean; sizeDeviation: boolean }> {
  if (!resolveSchoolName(school)) return { roomUse: false, neighborhood: false, sizeDeviation: false }
  const index = await loadSchoolIndex()
  const data = findSchoolData(index, school)
  if (!data) return { roomUse: false, neighborhood: false, sizeDeviation: false }
  return {
    roomUse: data.byRoomUse.size > 0,
    neighborhood: data.byRoomKey.size > 0 || data.neighborhoods.size > 0,
    sizeDeviation: data.byRoomSizeDeviation.size > 0,
  }
}

export function roomUseForRoom(
  map: RoomUseMap,
  roomId: string,
  roomName?: string | null,
): RoomUseEntry | undefined {
  for (const key of floorPlanRoomLookupIds({ id: roomId, name: roomName })) {
    const hit = map.get(key)
    if (hit) return hit
  }

  const target = roomId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (!target) return undefined
  for (const entry of map.values()) {
    const nameKey = entry.useName.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
    if (nameKey && nameKey === target) return entry
    const idKey = entry.id.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
    if (idKey && idKey === target) return entry
  }
  return undefined
}

/** Prefer the live sheet room name; otherwise show the floor plan id (not "Classroom …" labels). */
export function resolveRoomDisplayName(
  room: { id: string; name: string },
  useMap?: RoomUseMap,
): string {
  const sheetName = useMap ? roomUseForRoom(useMap, room.id, room.name)?.useName?.trim() : undefined
  const id = room.id.trim()
  if (sheetName) {
    if (sheetName.toUpperCase().includes(id.toUpperCase())) return sheetName
    return `${id} ${sheetName}`
  }
  if (/^(Classroom|Room)\s+/i.test(room.name.trim())) return id
  return room.name.trim() || id
}

export function formatRoomPickerLabel(room: { id: string; name: string }): string {
  const name = room.name.trim()
  const id = room.id.trim()
  if (!name || name.toUpperCase() === id.toUpperCase()) return id
  if (name.toUpperCase().includes(id.toUpperCase())) return name
  return `${name} (${id})`
}

export async function neighborhoodOptionsForSchool(
  school: Pick<AisdSchoolOption, "name" | "displayName" | "campusId"> | null | undefined,
): Promise<string[]> {
  if (!school?.name) return [...NEIGHBORHOOD_OPTIONS]

  const index = await loadSchoolIndex()
  const data = findSchoolData(index, school)
  if (!data || data.neighborhoods.size === 0) return [...NEIGHBORHOOD_OPTIONS]

  return [...data.neighborhoods].sort((a, b) => {
    const aNum = Number(a)
    const bNum = Number(b)
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum
    return a.localeCompare(b, undefined, { numeric: true })
  })
}

export function neighborhoodForRoom(
  map: RoomNeighborhoodMap,
  roomId: string,
  levelId?: string | null,
  roomName?: string | null,
): string | undefined {
  void levelId
  void roomName
  // Match only on CAFM / floor-plan room id — not the CSV Name column, which reuses
  // generic labels like "HALL" and "CLASSROOM" across many rooms.
  for (const key of roomLookupKeys(roomId)) {
    const hit = map.get(key)
    if (hit) return hit
  }
  return undefined
}

/** Distinct fills for neighborhood letters A–N and numeric labels from the live sheet. */
/** Neighborhood fill colors 1–20 from the AISD ESA neighborhood legend. */
const NEIGHBORHOOD_PALETTE: Record<string, string> = {
  "1": "#CCEDAF",
  "2": "#40AEAB",
  "3": "#5E8EDD",
  "4": "#7E48C6",
  "5": "#B397E2",
  "6": "#F6BDBB",
  "7": "#FDE156",
  "8": "#E0822D",
  "9": "#9D37E2",
  "10": "#B352AB",
  "11": "#4AF8BF",
  "12": "#8D29F7",
  "13": "#EA5913",
  "14": "#363475",
  "15": "#10A36C",
  "16": "#9C2776",
  "17": "#F1F400",
  "18": "#581793",
  "19": "#597F41",
  "20": "#AD0B32",
}

function neighborhoodPaletteKey(raw: string): string {
  const key = raw.trim().toUpperCase()
  if (/^\d+$/.test(key)) return key
  const letterIndex = key.charCodeAt(0) - "A".charCodeAt(0) + 1
  if (letterIndex >= 1 && letterIndex <= 20 && key.length === 1) return String(letterIndex)
  return key
}

export function neighborhoodFillColor(neighborhood: string | null | undefined): string | null {
  if (!neighborhood) return null
  const key = neighborhoodPaletteKey(neighborhood)
  if (!key) return null
  if (NEIGHBORHOOD_PALETTE[key]) return NEIGHBORHOOD_PALETTE[key]
  const hue = [...key].reduce((acc, ch) => acc + ch.charCodeAt(0) * 17, 0) % 360
  return `hsl(${hue} 65% 48%)`
}

export function neighborhoodLegendColors(
  neighborhoods: Iterable<string>,
): { id: string; color: string }[] {
  const ids = [...new Set([...neighborhoods].map((n) => n.trim().toUpperCase()).filter(Boolean))]
  ids.sort((a, b) => {
    const aNum = Number(a)
    const bNum = Number(b)
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum
    return a.localeCompare(b, undefined, { numeric: true })
  })
  return ids.map((id) => ({
    id,
    color: neighborhoodFillColor(id) ?? "#94a3b8",
  }))
}
