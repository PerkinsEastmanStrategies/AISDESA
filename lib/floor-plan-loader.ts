import type {
  AisdSchoolOption,
  ParsedPlanRoom,
  SchoolFloorPlanConfig,
} from "@aisd/shared"
import { parsePlanRoomsFromSvg } from "@/lib/room-parser"
import {
  getAvailableFloorsForSchool,
  loadFloorPlanManifest,
  PREFERRED_DEFAULT_FLOOR_LEVEL_ID,
  type FloorPlanLevelEntry,
} from "@/lib/floor-plan-manifest"
import {
  evictFloorPlanSvgFromMemoryCache,
  fetchFloorPlanSvgByFilename,
  needsInlineFloorPlanSvg,
  preferMobileFloorPlan,
  prefetchFloorPlanSvgs,
} from "@/lib/floor-plans"
import { prepareFloorPlanSvgForDisplay } from "@/lib/floor-plan-style"
import {
  applySvgViewBox,
  parseSvgViewBoxFromText,
  resolveSvgViewBox,
} from "@/lib/svg-utils"
import {
  loadRoomAreaMap,
  loadRoomNeighborhoodMap,
  loadRoomUseMap,
  neighborhoodForRoom,
  roomAreaForRoom,
  roomUseForRoom,
  resolveRoomDisplayName,
} from "@/lib/room-neighborhood-lookup"

const DEFAULT_BUILDING_SQFT = 150_000

/** Empty placeholder SVGs in Supabase (~150–400 bytes, no drawable content). */
const STUB_SVG_MAX_BYTES = 1000

const blobUrlsBySchool = new Map<string, string[]>()
const displaySvgTextByKey = new Map<string, string>()

/** Sentinel `src` when SVG text is cached for WebKit data-URL rendering. */
export const INLINE_FLOOR_PLAN_SRC = "aisd:inline-floor-plan"

export function isInlineFloorPlanSrc(src: string | undefined | null): boolean {
  return src === INLINE_FLOOR_PLAN_SRC
}

function displaySvgKey(schoolId: string, levelId: string): string {
  return `${schoolId}::${levelId}::plan-style-v2`
}

function cacheFloorPlanDisplaySvg(schoolId: string, levelId: string, svgText: string): void {
  displaySvgTextByKey.set(displaySvgKey(schoolId, levelId), svgText)
}

export function getFloorPlanDisplaySvg(schoolId: string, levelId: string): string | null {
  return displaySvgTextByKey.get(displaySvgKey(schoolId, levelId)) ?? null
}

export function hasFloorPlanDisplayCache(schoolId: string, levelId: string): boolean {
  return displaySvgTextByKey.has(displaySvgKey(schoolId, levelId))
}

/** Data URL for SVG text — works in WebKit <image> where blob: URLs fail. */
export function floorPlanSvgDataUrl(svgText: string): string {
  try {
    const bytes = new TextEncoder().encode(svgText)
    let binary = ""
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
    return `data:image/svg+xml;base64,${btoa(binary)}`
  } catch {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`
  }
}

/**
 * Inner SVG markup for inline rendering (vector-sharp at any zoom).
 * Strips <style> blocks so plan CSS cannot override room overlay labels.
 */
export function floorPlanSvgInlineFragment(svgText: string): string | null {
  if (typeof DOMParser === "undefined") return null
  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml")
    if (doc.querySelector("parsererror")) return null
    const svg = doc.documentElement
    if (!svg || svg.tagName.toLowerCase() !== "svg") return null
    for (const styleEl of Array.from(svg.querySelectorAll("style"))) {
      styleEl.remove()
    }
    return svg.innerHTML.trim() || null
  } catch {
    return null
  }
}

function clearFloorPlanDisplaySvgCache(schoolId: string): void {
  const prefix = `${schoolId}::`
  for (const key of displaySvgTextByKey.keys()) {
    if (key.startsWith(prefix)) displaySvgTextByKey.delete(key)
  }
}

function createFloorPlanLevelSrc(
  schoolId: string,
  levelId: string,
  svgText: string,
): string {
  cacheFloorPlanDisplaySvg(schoolId, levelId, svgText)
  if (needsInlineFloorPlanSvg()) {
    return INLINE_FLOOR_PLAN_SRC
  }
  const blobUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }))
  trackBlobUrl(schoolId, blobUrl)
  return blobUrl
}

/** True for empty upload stubs (e.g. Bryker/Baldwin L1) that still fetch as HTTP 200. */
export function isEmptyOrStubFloorPlanSvg(svgText: string): boolean {
  const trimmed = svgText.trim()
  if (!trimmed) return true
  if (trimmed.length >= STUB_SVG_MAX_BYTES) return false
  return !/<(?:path|polygon|polyline|rect|circle|ellipse|image|text|use)\b/i.test(trimmed)
}

function trackBlobUrl(schoolId: string, url: string): void {
  const list = blobUrlsBySchool.get(schoolId) ?? []
  list.push(url)
  blobUrlsBySchool.set(schoolId, list)
}

/** Revoke blob: URLs only. Keeps inline SVG text cache for fast floor-plan reopen. */
export function revokeFloorPlanBlobUrls(schoolId: string): void {
  const urls = blobUrlsBySchool.get(schoolId) ?? []
  for (const url of urls) URL.revokeObjectURL(url)
  blobUrlsBySchool.delete(schoolId)
}

/** Drop all cached display SVG for a school (e.g. when switching schools). */
export function clearFloorPlanDisplayCache(schoolId: string): void {
  revokeFloorPlanBlobUrls(schoolId)
  clearFloorPlanDisplaySvgCache(schoolId)
}

/** Reattach a display src from an already-cached SVG (after STRIP cleared level.src). */
export function restoreFloorPlanLevelFromCache(
  schoolId: string,
  level: SchoolFloorPlanConfig["levels"][number],
): SchoolFloorPlanConfig["levels"][number] | null {
  const svgText = getFloorPlanDisplaySvg(schoolId, level.id)
  if (!svgText) return null
  return {
    ...level,
    src: createFloorPlanLevelSrc(schoolId, level.id, svgText),
  }
}

interface LevelLoadResult {
  level: SchoolFloorPlanConfig["levels"][number]
  rooms: ParsedPlanRoom[]
  svgText: string
}

/** Restyle SVG, crop viewBox to content so the plan fills the panel, return text + viewBox. */
function prepareDistrictFloorPlanSvg(rawSvg: string): {
  svgText: string
  viewBox: { x: number; y: number; w: number; h: number }
} | null {
  // Crop first so line weights are scaled to the visible plan, not a padded CAD sheet.
  if (typeof DOMParser === "undefined") {
    const styled = prepareFloorPlanSvgForDisplay(rawSvg)
    const vb = parseSvgViewBoxFromText(styled)
    if (!vb) return null
    return {
      svgText: styled,
      viewBox: { x: vb.x, y: vb.y, w: vb.width, h: vb.height },
    }
  }

  const doc = new DOMParser().parseFromString(rawSvg, "image/svg+xml")
  const svg = doc.documentElement as unknown as SVGSVGElement
  if (!svg || svg.tagName.toLowerCase() !== "svg") return null
  if (doc.querySelector("parsererror")) return null

  const resolved = resolveSvgViewBox(svg, rawSvg.length)
  if (!resolved) return null
  applySvgViewBox(svg, resolved)

  const cropped =
    typeof XMLSerializer !== "undefined"
      ? new XMLSerializer().serializeToString(doc)
      : rawSvg

  const styled = prepareFloorPlanSvgForDisplay(cropped)
  const styledDoc = new DOMParser().parseFromString(styled, "image/svg+xml")
  const styledSvg = styledDoc.documentElement as unknown as SVGSVGElement
  if (styledSvg?.tagName?.toLowerCase() === "svg") {
    applySvgViewBox(styledSvg, resolved)
  }

  const svgText =
    typeof XMLSerializer !== "undefined"
      ? new XMLSerializer().serializeToString(styledDoc)
      : styled

  return {
    svgText,
    viewBox: { x: resolved.x, y: resolved.y, w: resolved.width, h: resolved.height },
  }
}

/** Plan levels without blob URLs — SVG display is loaded on demand. */
const EMPTY_FLOOR_PLAN_SRC = ""

async function loadLevelRoomsOnly(
  schoolId: string,
  floor: FloorPlanLevelEntry,
  preferMobile: boolean,
): Promise<LevelLoadResult | null> {
  const rawSvg = await fetchFloorPlanSvgByFilename(floor.filename, { preferMobile })
  if (!rawSvg || isEmptyOrStubFloorPlanSvg(rawSvg)) return null

  const prepared = prepareDistrictFloorPlanSvg(rawSvg)
  if (!prepared) return null

  const { svgText, viewBox } = prepared
  const rooms = parsePlanRoomsFromSvg(svgText, floor.id)
  evictFloorPlanSvgFromMemoryCache(floor.filename)

  return {
    level: {
      id: floor.id,
      label: floor.fullLabel,
      src: EMPTY_FLOOR_PLAN_SRC,
      viewBox,
    },
    rooms,
    svgText: "",
  }
}

async function loadLevel(
  schoolId: string,
  floor: FloorPlanLevelEntry,
  parseRooms: boolean,
  preferMobile: boolean,
): Promise<LevelLoadResult | null> {
  const rawSvg = await fetchFloorPlanSvgByFilename(floor.filename, { preferMobile })
  if (!rawSvg || isEmptyOrStubFloorPlanSvg(rawSvg)) return null

  const prepared = prepareDistrictFloorPlanSvg(rawSvg)
  if (!prepared) return null

  const { svgText, viewBox } = prepared
  const src = createFloorPlanLevelSrc(schoolId, floor.id, svgText)

  return {
    level: {
      id: floor.id,
      label: floor.fullLabel,
      src,
      viewBox,
    },
    rooms: parseRooms ? parsePlanRoomsFromSvg(svgText, floor.id) : [],
    svgText,
  }
}

export interface FloorPlanLoadResult {
  plan: SchoolFloorPlanConfig | null
  rooms: ParsedPlanRoom[]
}

async function withRoomSheetData(
  school: AisdSchoolOption,
  rooms: ParsedPlanRoom[],
): Promise<ParsedPlanRoom[]> {
  if (!rooms.length) return rooms
  const [neighborhoodMap, areaMap, useMap] = await Promise.all([
    loadRoomNeighborhoodMap(school),
    loadRoomAreaMap(school),
    loadRoomUseMap(school),
  ])
  if (neighborhoodMap.size === 0 && areaMap.size === 0 && useMap.size === 0) return rooms
  return rooms.map((room) => {
    const neighborhood = neighborhoodForRoom(neighborhoodMap, room.id, room.levelId, room.name)
    const areaSqft = roomAreaForRoom(areaMap, room.id, room.name)
    const name = resolveRoomDisplayName(room, useMap)
    if (
      name === room.name &&
      !neighborhood &&
      areaSqft == null
    ) {
      return room
    }
    return {
      ...room,
      name,
      ...(neighborhood ? { neighborhood } : {}),
      ...(areaSqft != null ? { areaSqft } : {}),
    }
  })
}

/**
 * Load floor plans for a school. Calls `onFirstFloorReady` as soon as the default
 * floor SVG is fetched so the map can render before room parsing and other floors finish.
 * All schools use the manifest + Supabase SVG files.
 */
export async function loadFloorPlanForSchool(
  school: AisdSchoolOption,
  onFirstFloorReady?: (result: FloorPlanLoadResult) => void,
): Promise<FloorPlanLoadResult> {
  revokeFloorPlanBlobUrls(school.id)

  const manifest = await loadFloorPlanManifest()
  const floors = getAvailableFloorsForSchool(school, manifest)
  if (!floors.length) return { plan: null, rooms: [] }

  const preferMobile = preferMobileFloorPlan()

  // Prefer Floor 1 when available; skip empty stubs so a blank L1 does not block L2 (Bryker Woods).
  const preferredIndex = floors.findIndex((floor) => floor.id === PREFERRED_DEFAULT_FLOOR_LEVEL_ID)
  const defaultCandidateIndexes =
    preferredIndex >= 0
      ? [preferredIndex, ...floors.map((_, i) => i).filter((i) => i !== preferredIndex)]
      : floors.map((_, i) => i)

  let defaultIndex = -1
  let defaultResult: LevelLoadResult | null = null
  for (const i of defaultCandidateIndexes) {
    const result = await loadLevel(school.id, floors[i], false, preferMobile)
    if (result) {
      defaultIndex = i
      defaultResult = result
      break
    }
  }
  if (!defaultResult || defaultIndex < 0) return { plan: null, rooms: [] }

  const defaultFloor = floors[defaultIndex]
  const remainingFloors = floors.filter((_, i) => i !== defaultIndex)

  prefetchFloorPlanSvgs(
    remainingFloors.map((f) => f.filename),
    { preferMobile },
  )

  onFirstFloorReady?.({
    plan: {
      schoolId: school.id,
      defaultLevelId: defaultFloor.id,
      buildingSqft: DEFAULT_BUILDING_SQFT,
      levels: [defaultResult.level],
    },
    rooms: [],
  })

  const [defaultRooms, ...otherResults] = await Promise.all([
    Promise.resolve().then(() =>
      parsePlanRoomsFromSvg(defaultResult.svgText, defaultFloor.id),
    ),
    ...remainingFloors.map((floor) => loadLevel(school.id, floor, true, preferMobile)),
  ])

  const loadedById = new Map<string, LevelLoadResult>()
  loadedById.set(defaultFloor.id, {
    ...defaultResult,
    rooms: defaultRooms,
  })
  remainingFloors.forEach((floor, i) => {
    const result = otherResults[i]
    if (result) loadedById.set(floor.id, result)
  })

  // Keep manifest / FLOOR_LEVELS order for level chips.
  const ordered = floors
    .map((floor) => loadedById.get(floor.id))
    .filter((result): result is LevelLoadResult => Boolean(result))

  const rooms = await withRoomSheetData(
    school,
    ordered.flatMap((r) => r.rooms),
  )

  return {
    plan: {
      schoolId: school.id,
      defaultLevelId: defaultFloor.id,
      buildingSqft: DEFAULT_BUILDING_SQFT,
      levels: ordered.map((r) => r.level),
    },
    rooms,
  }
}

/**
 * Parse room metadata for every floor without keeping SVG blobs in memory.
 * Used during survey scoring so the room dropdown works without loading the map.
 */
export async function loadSchoolRoomsForSchool(
  school: AisdSchoolOption,
): Promise<FloorPlanLoadResult> {
  revokeFloorPlanBlobUrls(school.id)

  const manifest = await loadFloorPlanManifest()
  const floors = getAvailableFloorsForSchool(school, manifest)
  if (!floors.length) return { plan: null, rooms: [] }

  const preferMobile = preferMobileFloorPlan()
  const results: (LevelLoadResult | null)[] = []

  // On iPad/iPhone load one floor at a time to avoid Safari memory spikes.
  if (preferMobile) {
    for (const floor of floors) {
      results.push(await loadLevelRoomsOnly(school.id, floor, preferMobile))
    }
  } else {
    results.push(
      ...(await Promise.all(
        floors.map((floor) => loadLevelRoomsOnly(school.id, floor, preferMobile)),
      )),
    )
  }

  const loadedById = new Map<string, LevelLoadResult>()
  floors.forEach((floor, i) => {
    const result = results[i]
    if (result) loadedById.set(floor.id, result)
  })

  const ordered = floors
    .map((floor) => loadedById.get(floor.id))
    .filter((result): result is LevelLoadResult => Boolean(result))

  if (!ordered.length) return { plan: null, rooms: [] }

  const preferredDefaultId = PREFERRED_DEFAULT_FLOOR_LEVEL_ID
  const defaultLevelId = ordered.some((entry) => entry.level.id === preferredDefaultId)
    ? preferredDefaultId
    : ordered[0].level.id

  const rooms = await withRoomSheetData(
    school,
    ordered.flatMap((entry) => entry.rooms),
  )

  return {
    plan: {
      schoolId: school.id,
      defaultLevelId,
      buildingSqft: DEFAULT_BUILDING_SQFT,
      levels: ordered.map((entry) => entry.level),
    },
    rooms,
  }
}

/** Load one floor's SVG for display (pre-walk, room picker, results map). */
export async function loadFloorPlanLevelDisplay(
  school: AisdSchoolOption,
  levelId: string,
): Promise<SchoolFloorPlanConfig["levels"][number] | null> {
  const manifest = await loadFloorPlanManifest()
  const floors = getAvailableFloorsForSchool(school, manifest)
  const floor = floors.find((entry) => entry.id === levelId)
  if (!floor) return null

  const result = await loadLevel(school.id, floor, false, preferMobileFloorPlan())
  return result?.level ?? null
}

/** Revoke blob URLs and drop level src so SVG memory can be reclaimed. */
export function stripFloorPlanDisplay(
  schoolId: string,
  plan: SchoolFloorPlanConfig | null,
): SchoolFloorPlanConfig | null {
  revokeFloorPlanBlobUrls(schoolId) // keep inline SVG text cache
  if (!plan) return null
  return {
    ...plan,
    levels: plan.levels.map((level) =>
      level.src ? { ...level, src: EMPTY_FLOOR_PLAN_SRC } : level,
    ),
  }
}
