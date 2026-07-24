import type {
  AisdSchoolOption,
  ParsedPlanRoom,
  SchoolFloorPlanConfig,
} from "@aisd/shared"
import {
  LIVELY_FLOOR_PLAN,
  parseRoomsFromSvg,
  schoolNameToId,
} from "@aisd/shared"
import { parsePlanRoomsFromSvg } from "@/lib/room-parser"
import {
  getAvailableFloorsForSchool,
  loadFloorPlanManifest,
  type FloorPlanLevelEntry,
} from "@/lib/floor-plan-manifest"
import {
  fetchFloorPlanSvgByFilename,
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

export function revokeFloorPlanBlobUrls(schoolId: string): void {
  const urls = blobUrlsBySchool.get(schoolId) ?? []
  for (const url of urls) URL.revokeObjectURL(url)
  blobUrlsBySchool.delete(schoolId)
}

export function isLivelySchool(school: AisdSchoolOption): boolean {
  return (
    school.id === "lively" ||
    schoolNameToId(school.name) === "lively" ||
    school.name.toUpperCase().includes("LIVELY")
  )
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
  const blobUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }))
  trackBlobUrl(schoolId, blobUrl)

  return {
    level: {
      id: floor.id,
      label: floor.fullLabel,
      src: blobUrl,
      viewBox,
    },
    rooms: parseRooms ? parsePlanRoomsFromSvg(svgText, floor.id) : [],
    svgText,
  }
}

async function loadLivelyFloorPlan(
  school: AisdSchoolOption,
  onFirstFloorReady?: (result: FloorPlanLoadResult) => void,
): Promise<FloorPlanLoadResult> {
  revokeFloorPlanBlobUrls(school.id)

  const styledLevels: SchoolFloorPlanConfig["levels"] = []
  const roomLists: ParsedPlanRoom[][] = []

  for (const level of LIVELY_FLOOR_PLAN.levels) {
    try {
      const response = await fetch(level.src)
      if (!response.ok) continue
      const raw = await response.text()
      if (isEmptyOrStubFloorPlanSvg(raw)) continue

      const prepared = prepareDistrictFloorPlanSvg(raw)
      if (!prepared) continue

      const blobUrl = URL.createObjectURL(
        new Blob([prepared.svgText], { type: "image/svg+xml" }),
      )
      trackBlobUrl(school.id, blobUrl)

      styledLevels.push({
        ...level,
        src: blobUrl,
        viewBox: prepared.viewBox,
      })
      roomLists.push(parseRoomsFromSvg(prepared.svgText, level.id))

      if (styledLevels.length === 1) {
        onFirstFloorReady?.({
          plan: {
            schoolId: school.id,
            defaultLevelId: styledLevels[0].id,
            buildingSqft: LIVELY_FLOOR_PLAN.buildingSqft,
            levels: [styledLevels[0]],
          },
          rooms: [],
        })
      }
    } catch {
      /* skip failed level */
    }
  }

  if (!styledLevels.length) {
    return { plan: null, rooms: [] }
  }

  return {
    plan: {
      schoolId: school.id,
      defaultLevelId: styledLevels[0].id,
      buildingSqft: LIVELY_FLOOR_PLAN.buildingSqft,
      levels: styledLevels,
    },
    rooms: roomLists.flat(),
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
 * Lively keeps its local multi-level plans; all other schools use the Sheet + Supabase files.
 */
export async function loadFloorPlanForSchool(
  school: AisdSchoolOption,
  onFirstFloorReady?: (result: FloorPlanLoadResult) => void,
): Promise<FloorPlanLoadResult> {
  revokeFloorPlanBlobUrls(school.id)

  if (isLivelySchool(school)) {
    const result = await loadLivelyFloorPlan(school, onFirstFloorReady)
    return {
      plan: result.plan,
      rooms: await withRoomSheetData(school, result.rooms),
    }
  }

  const manifest = await loadFloorPlanManifest()
  const floors = getAvailableFloorsForSchool(school, manifest)
  if (!floors.length) return { plan: null, rooms: [] }

  const preferMobile = preferMobileFloorPlan()

  // First FLOOR_LEVELS entry with a real file wins as default. Skip empty stubs /
  // failed fetches so a blank Floor 1 does not block Floor 2 (Bryker Woods).
  let defaultIndex = -1
  let defaultResult: LevelLoadResult | null = null
  for (let i = 0; i < floors.length; i++) {
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
