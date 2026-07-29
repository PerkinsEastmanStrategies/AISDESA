import type { RoomUseEntry } from "@/lib/room-neighborhood-lookup"

export type RoomUseLabelMode = "hidden" | "id" | "full"

/** Fixed on-screen typography — every visible tag uses the same base size. */
const ROOM_LABEL_FONT_PX = 13
const ROOM_LABEL_LINE_HEIGHT_PX = 14.5
const ROOM_LABEL_STROKE_PX = 1.5
const ROOM_LABEL_CHAR_WIDTH_EM = 0.56
const ROOM_LABEL_FIT_PADDING = 1.12

/** Zoom at/above which labels use full size; at MIN_ZOOM they are ~40% smaller. */
const ROOM_LABEL_ZOOM_FULL = 1.85
const ROOM_LABEL_ZOOM_MIN = 0.75
const ROOM_LABEL_SCALE_AT_MIN = 0.6

export const ROOM_LABEL_FILL = "#475569"
export const ROOM_LABEL_STROKE = "#ffffff"

function roomUseLabelZoomFontScale(zoom: number): number {
  const z = Math.max(zoom, ROOM_LABEL_ZOOM_MIN)
  if (z >= ROOM_LABEL_ZOOM_FULL) return 1
  const t = (z - ROOM_LABEL_ZOOM_MIN) / (ROOM_LABEL_ZOOM_FULL - ROOM_LABEL_ZOOM_MIN)
  return ROOM_LABEL_SCALE_AT_MIN + (1 - ROOM_LABEL_SCALE_AT_MIN) * t
}

function effectiveLabelFontPx(zoom: number): number {
  return ROOM_LABEL_FONT_PX * roomUseLabelZoomFontScale(zoom)
}

function effectiveLabelLineHeightPx(zoom: number): number {
  return ROOM_LABEL_LINE_HEIGHT_PX * roomUseLabelZoomFontScale(zoom)
}

export function roomLabelBounds(points: { x: number; y: number }[]): { width: number; height: number } {
  if (!points.length) return { width: 0, height: 0 }
  let minX = points[0].x
  let maxX = points[0].x
  let minY = points[0].y
  let maxY = points[0].y
  for (const p of points) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  return { width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) }
}

function normalizeRoomUseToken(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
}

/** Corridors are circulation — skip room-tag labels. */
export function isCorridorRoomUse(roomId: string, entry: RoomUseEntry): boolean {
  const program = normalizeRoomUseToken(entry.programType ?? "")
  if (program === "CORRIDOR" || program.startsWith("CORRIDOR")) return true

  const use = normalizeRoomUseToken(entry.useName)
  if (use === "CORRIDOR" || use.startsWith("CORRIDOR")) return true

  const id = normalizeRoomUseToken(entry.id || roomId)
  // Match COR* room ids but not CORE* instructional spaces.
  if (/^COR(?!E)/.test(id)) return true

  return false
}

function compactRoomLabel(roomId: string, entry: RoomUseEntry): string {
  const id = entry.id.trim() || roomId.trim()
  const name = entry.useName.trim()
  const roomNorm = roomId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  const nameNorm = name.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const idNorm = id.toUpperCase().replace(/[^A-Z0-9]/g, "")

  if (id && (nameNorm !== idNorm || !name)) return id
  if (roomId) return roomId
  if (name) return name
  return id || roomId || name
}

export function truncateLabel(text: string, maxLen: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, Math.max(1, maxLen - 1))}…`
}

export function splitUseNameLines(useName: string, maxLineLen: number): string[] {
  const words = useName.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  if (useName.length <= maxLineLen) return [useName.trim()]

  const lines: string[] = []
  let current = words[0]
  for (const word of words.slice(1)) {
    const next = `${current} ${word}`
    if (next.length <= maxLineLen) {
      current = next
    } else {
      lines.push(current)
      current = word
    }
  }
  lines.push(current)
  return lines.slice(0, 2)
}

export function buildRoomUseLabelLines(
  roomId: string,
  entry: RoomUseEntry,
  mode: Exclude<RoomUseLabelMode, "hidden">,
): string[] {
  if (mode === "id") {
    return [compactRoomLabel(roomId, entry)]
  }

  const name = entry.useName.trim()
  const id = entry.id.trim() || roomId.trim()
  const roomNorm = roomId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  const nameNorm = name.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const idNorm = id.toUpperCase().replace(/[^A-Z0-9]/g, "")

  if (name && (roomNorm === nameNorm || idNorm === nameNorm)) {
    return splitUseNameLines(name, 24)
  }
  if (name && !/^\d+$/.test(id)) {
    return splitUseNameLines(name, 24)
  }
  if (!name || name.toUpperCase() === id.toUpperCase()) {
    return [id]
  }

  return [id, ...splitUseNameLines(name, 20)].slice(0, 2)
}

function estimateLabelScreenSize(lines: string[], fontPx: number, lineHeightPx: number): { width: number; height: number } {
  const longest = Math.max(1, ...lines.map((line) => line.length))
  return {
    width: longest * ROOM_LABEL_CHAR_WIDTH_EM * fontPx,
    height: lines.length * lineHeightPx,
  }
}

/** True when the fixed-size label fits inside the room at the current zoom. */
export function roomLabelFitsAtZoom(
  roomWidth: number,
  roomHeight: number,
  zoom: number,
  meetScale: number,
  lines: string[],
): boolean {
  if (!lines.length || roomWidth <= 0 || roomHeight <= 0) return false
  const fontPx = effectiveLabelFontPx(zoom)
  const lineHeightPx = effectiveLabelLineHeightPx(zoom)
  const label = estimateLabelScreenSize(lines, fontPx, lineHeightPx)
  const roomScreenW = roomWidth * meetScale * zoom
  const roomScreenH = roomHeight * meetScale * zoom
  return (
    roomScreenW >= label.width * ROOM_LABEL_FIT_PADDING &&
    roomScreenH >= label.height * ROOM_LABEL_FIT_PADDING
  )
}

function roomUseLabelRenderMetrics(
  zoom: number,
  meetScale: number,
): Pick<ReturnType<typeof resolveRoomUseLabelLayout>, "fontSize" | "strokeWidth" | "lineHeight"> {
  const zoomScale = roomUseLabelZoomFontScale(zoom)
  const fontPx = ROOM_LABEL_FONT_PX * zoomScale
  const lineHeightPx = ROOM_LABEL_LINE_HEIGHT_PX * zoomScale
  const strokePx = ROOM_LABEL_STROKE_PX * zoomScale
  const scale = Math.max(meetScale * zoom, 0.05)
  return {
    fontSize: fontPx / scale,
    strokeWidth: strokePx / scale,
    lineHeight: lineHeightPx / scale,
  }
}

const EMPTY_LAYOUT = {
  lines: [] as string[],
  fontSize: 0,
  strokeWidth: 0,
  lineHeight: 0,
  mode: "hidden" as const,
}

/**
 * Pick label text + fixed render metrics. Labels stay hidden until zoomed in
 * enough that the same font size fits inside the room footprint.
 */
export function resolveRoomUseLabelLayout(input: {
  roomId: string
  entry: RoomUseEntry
  roomWidth: number
  roomHeight: number
  zoom: number
  meetScale: number
}): {
  lines: string[]
  fontSize: number
  strokeWidth: number
  lineHeight: number
  mode: RoomUseLabelMode
} {
  const { roomId, entry, roomWidth, roomHeight, zoom, meetScale } = input
  if (isCorridorRoomUse(roomId, entry)) return EMPTY_LAYOUT

  const metrics = roomUseLabelRenderMetrics(zoom, meetScale)

  const fullLines = buildRoomUseLabelLines(roomId, entry, "full")
  if (roomLabelFitsAtZoom(roomWidth, roomHeight, zoom, meetScale, fullLines)) {
    return { ...metrics, lines: fullLines, mode: "full" }
  }

  const idLines = buildRoomUseLabelLines(roomId, entry, "id")
  if (roomLabelFitsAtZoom(roomWidth, roomHeight, zoom, meetScale, idLines)) {
    return { ...metrics, lines: idLines, mode: "id" }
  }

  return EMPTY_LAYOUT
}
