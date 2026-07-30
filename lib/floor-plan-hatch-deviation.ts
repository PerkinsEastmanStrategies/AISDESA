import type { RoomSizeDeviationMap, SizeDeviationBand } from "@/lib/room-neighborhood-lookup"
import { floorPlanRoomLookupIds } from "@/lib/room-neighborhood-lookup"
import { extractRoomsFromSvg } from "@/lib/spaces-data"

export type { RoomSizeDeviationMap }
export type RoomSizeDeviationColorMap = Map<string, string>

const HATCH_BAND_BY_LAYER: Record<string, SizeDeviationBand> = {
  DEF_HATCH_GREEN: "green",
  DEF_HATCH_RED: "red",
  DEF_HATCH_ORANGE: "orange",
}

/** Typical CAD hatch fills in LBJ exports (used for legend fallback). */
const HATCH_LAYER_FILL: Record<string, string> = {
  DEF_HATCH_GREEN: "#007f00",
  DEF_HATCH_RED: "#ff0000",
  DEF_HATCH_ORANGE: "#ff7f00",
}

export type LbjHatchDeviationData = {
  bands: RoomSizeDeviationMap
  colors: RoomSizeDeviationColorMap
  legend: { id: string; color: string }[]
}

function roomLookupKeys(rawId: string): string[] {
  const trimmed = rawId.trim()
  if (!trimmed) return []
  const upper = trimmed.toUpperCase()
  const keys = new Set<string>([trimmed, upper, trimmed.toLowerCase()])
  const normalized = upper.replace(/[^A-Z0-9]/g, "")
  if (normalized) keys.add(normalized)
  return [...keys]
}

function setRoomSizeDeviation(
  map: RoomSizeDeviationMap,
  rawId: string,
  band: SizeDeviationBand,
): void {
  for (const key of roomLookupKeys(rawId)) {
    map.set(key, band)
  }
}

function setRoomSizeDeviationColor(
  map: RoomSizeDeviationColorMap,
  rawId: string,
  color: string,
): void {
  for (const key of roomLookupKeys(rawId)) {
    map.set(key, color)
  }
}

function parseStyleColor(style: string | null, prop: "fill" | "stroke"): string | null {
  if (!style) return null
  const match = style.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`, "i"))
  return match?.[1]?.trim() ?? null
}

function normalizeCssColor(raw: string | null | undefined): string | null {
  if (!raw) return null
  const value = raw.trim()
  if (!value || value.toLowerCase() === "none" || value.toLowerCase() === "transparent") {
    return null
  }
  if (value.startsWith("#")) return value

  const rgbMatch = value.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i)
  if (rgbMatch) {
    const parts = rgbMatch.slice(1, 4).map((part) => Number.parseInt(part, 10))
    if (parts.every((n) => Number.isFinite(n))) {
      return `#${parts.map((n) => n.toString(16).padStart(2, "0")).join("")}`
    }
  }

  return value
}

function shapeFillColor(el: Element): string | null {
  return normalizeCssColor(
    el.getAttribute("fill") ?? parseStyleColor(el.getAttribute("style"), "fill"),
  )
}

function shapeHasFill(el: Element): boolean {
  return shapeFillColor(el) !== null
}

function bandFromHatchLayer(layerId: string): SizeDeviationBand | null {
  return HATCH_BAND_BY_LAYER[layerId] ?? null
}

function shapeCentroid(el: SVGGraphicsElement, svgRoot: SVGSVGElement): { x: number; y: number } | null {
  try {
    const bbox = el.getBBox()
    if (bbox.width <= 0 || bbox.height <= 0) return null
    const pt = svgRoot.createSVGPoint()
    pt.x = bbox.x + bbox.width / 2
    pt.y = bbox.y + bbox.height / 2
    const matrix = el.getCTM()
    if (!matrix) return { x: pt.x, y: pt.y }
    const mapped = pt.matrixTransform(matrix)
    return { x: mapped.x, y: mapped.y }
  } catch {
    return null
  }
}

function pointInPolygon(x: number, y: number, points: { x: number; y: number }[]): boolean {
  if (points.length < 3) return false
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x
    const yi = points[i].y
    const xj = points[j].x
    const yj = points[j].y
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function findRoomAtPoint(
  rooms: ReturnType<typeof extractRoomsFromSvg>,
  x: number,
  y: number,
): (typeof rooms)[number] | null {
  const hits = rooms
    .filter((room) => room.points.length >= 3 && pointInPolygon(x, y, room.points))
    .sort((a, b) => {
      const areaA = polygonAreaAbs(a.points)
      const areaB = polygonAreaAbs(b.points)
      return areaA - areaB
    })
  return hits[0] ?? null
}

function polygonAreaAbs(points: { x: number; y: number }[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    sum += points[i].x * points[j].y - points[j].x * points[i].y
  }
  return Math.abs(sum / 2)
}

function buildLegend(layerColors: Map<string, string>): { id: string; color: string }[] {
  const legend: { id: string; color: string }[] = []
  const labels: Record<SizeDeviationBand, string> = {
    green: "Green · ≥95% of ed spec",
    red: "Red · <85%",
    orange: "Orange · 85–94.9%",
  }

  for (const [layerId, band] of Object.entries(HATCH_BAND_BY_LAYER)) {
    legend.push({
      id: labels[band],
      color: layerColors.get(layerId) ?? HATCH_LAYER_FILL[layerId] ?? "#888888",
    })
  }

  return legend
}

/**
 * Map DEF_HATCH_* room fills to size-deviation bands and exact hatch colors
 * by matching each hatch polygon centroid to a CAFM room boundary.
 */
export function parseLbjHatchDeviationFromSvg(svgText: string): LbjHatchDeviationData {
  const empty: LbjHatchDeviationData = {
    bands: new Map(),
    colors: new Map(),
    legend: buildLegend(new Map()),
  }

  if (typeof DOMParser === "undefined") return empty

  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml")
  const svgRoot = doc.documentElement as unknown as SVGSVGElement
  if (!svgRoot || svgRoot.tagName.toLowerCase() !== "svg") return empty
  if (doc.querySelector("parsererror")) return empty

  const rooms = extractRoomsFromSvg(svgText)
  if (!rooms.length) return empty

  const bands: RoomSizeDeviationMap = new Map()
  const colors: RoomSizeDeviationColorMap = new Map()
  const layerColors = new Map<string, string>()

  for (const layer of Array.from(svgRoot.querySelectorAll("g[id^='DEF_HATCH_']"))) {
    const layerId = layer.id
    const band = bandFromHatchLayer(layerId)
    if (!band) continue

    const shapes = Array.from(
      layer.querySelectorAll("path, polygon, polyline, rect, circle"),
    ) as SVGGraphicsElement[]

    for (const shape of shapes) {
      const fillColor = shapeFillColor(shape)
      if (!fillColor) continue
      if (!layerColors.has(layerId)) layerColors.set(layerId, fillColor)

      const centroid = shapeCentroid(shape, svgRoot)
      if (!centroid) continue
      const room = findRoomAtPoint(rooms, centroid.x, centroid.y)
      if (!room) continue
      setRoomSizeDeviation(bands, room.key, band)
      setRoomSizeDeviationColor(colors, room.key, fillColor)
    }
  }

  return {
    bands,
    colors,
    legend: buildLegend(layerColors),
  }
}

/** @deprecated Use parseLbjHatchDeviationFromSvg — bands only. */
export function parseSizeDeviationFromSvgHatch(svgText: string): RoomSizeDeviationMap {
  return parseLbjHatchDeviationFromSvg(svgText).bands
}

export function sizeDeviationHatchColorForRoom(
  map: RoomSizeDeviationColorMap,
  roomId: string,
  roomName?: string | null,
): string | undefined {
  for (const key of floorPlanRoomLookupIds({ id: roomId, name: roomName })) {
    const hit = map.get(key)
    if (hit) return hit
  }
  return undefined
}

export function mergeLbjHatchDeviationData(
  target: LbjHatchDeviationData,
  level: LbjHatchDeviationData,
): LbjHatchDeviationData {
  for (const [key, band] of level.bands) target.bands.set(key, band)
  for (const [key, color] of level.colors) target.colors.set(key, color)

  const layerColors = new Map<string, string>()
  for (const item of level.legend) {
    if (item.id.startsWith("Green")) layerColors.set("DEF_HATCH_GREEN", item.color)
    if (item.id.startsWith("Red")) layerColors.set("DEF_HATCH_RED", item.color)
    if (item.id.startsWith("Orange")) layerColors.set("DEF_HATCH_ORANGE", item.color)
  }
  for (const item of target.legend) {
    if (item.id.startsWith("Green") && !layerColors.has("DEF_HATCH_GREEN")) {
      layerColors.set("DEF_HATCH_GREEN", item.color)
    }
    if (item.id.startsWith("Red") && !layerColors.has("DEF_HATCH_RED")) {
      layerColors.set("DEF_HATCH_RED", item.color)
    }
    if (item.id.startsWith("Orange") && !layerColors.has("DEF_HATCH_ORANGE")) {
      layerColors.set("DEF_HATCH_ORANGE", item.color)
    }
  }

  return {
    bands: target.bands,
    colors: target.colors,
    legend: buildLegend(layerColors),
  }
}
