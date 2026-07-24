import type { RoomUseEntry } from "@/lib/room-neighborhood-lookup"

export type RoomUseLabelMode = "hidden" | "id" | "full"

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

/** Decide how much room-use text to show based on zoom, room size, and footprint. */
export function roomUseLabelMode(
  zoom: number,
  roomArea: number,
  viewBoxArea: number,
  roomWidth: number,
  viewBoxWidth: number,
  selected: boolean,
): RoomUseLabelMode {
  const roomWidthRatio = roomWidth / Math.max(viewBoxWidth, 1)
  const roomAreaRatio = roomArea / Math.max(viewBoxArea, 1)
  const largeRoom = roomWidthRatio >= 0.05 || roomAreaRatio >= 0.00012
  const mediumRoom = roomWidthRatio >= 0.028 || roomAreaRatio >= 0.00005

  if (selected) {
    return largeRoom ? "full" : "id"
  }

  const screenWeight = roomArea * zoom * zoom
  const tinyRoom = viewBoxArea * 0.000045
  if (screenWeight < tinyRoom) return "hidden"

  if (zoom >= 1.15 && largeRoom) return "full"
  if (zoom >= 0.78 && mediumRoom) return "id"
  if (zoom >= 0.95 && roomWidthRatio >= 0.018) return "id"
  return "hidden"
}

function compactRoomLabel(roomId: string, entry: RoomUseEntry): string {
  const id = entry.id.trim() || roomId.trim()
  const name = entry.useName.trim()
  const roomNorm = roomId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  const nameNorm = name.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const idNorm = id.toUpperCase().replace(/[^A-Z0-9]/g, "")

  if (id && id.length <= 14 && (nameNorm !== idNorm || !name)) return id
  if (roomId && roomId.length <= 14) return roomId
  if (name && name.length <= 14) return name
  return truncateLabel(id || roomId || name, 10)
}

export function maxLabelCharsForRoom(roomWidth: number, fontSize: number, lineCount: number): number {
  const usableWidth = roomWidth * 0.82
  const perLine = usableWidth / Math.max(fontSize * 0.58, 1)
  if (lineCount > 1) return Math.max(4, Math.floor(perLine * 0.9))
  return Math.max(4, Math.floor(perLine))
}

export function roomUseLabelFontSize(
  viewBoxWidth: number,
  mode: RoomUseLabelMode,
  roomArea: number,
  viewBoxArea: number,
  roomWidth: number,
  roomHeight: number,
  lineCount: number,
  longestLineChars: number,
): number {
  const viewBase = Math.max(viewBoxWidth * 0.0078, 16)
  const areaRatio = Math.sqrt(Math.max(roomArea, 1) / Math.max(viewBoxArea, 1))
  const areaScaled = viewBase * Math.min(1.05, Math.max(0.38, areaRatio * 16))

  const minSide = Math.max(1, Math.min(roomWidth, roomHeight))
  const heightCap = (minSide * 0.84) / Math.max(1.08, lineCount * 1.1)
  const widthCap =
    longestLineChars > 0
      ? (roomWidth * 0.86) / Math.max(0.52 * longestLineChars, 1)
      : heightCap

  let size = Math.min(areaScaled, widthCap, heightCap)
  if (mode === "id") size *= 0.94
  return Math.max(12, Math.min(size, viewBase * 1.02))
}

export function roomUseLabelStroke(fontSize: number): number {
  return Math.max(2, fontSize * 0.14)
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
  return lines.slice(0, 2).map((line) => truncateLabel(line, maxLineLen))
}

export function buildRoomUseLabelLines(
  roomId: string,
  entry: RoomUseEntry,
  mode: RoomUseLabelMode,
  maxChars?: number,
): string[] {
  if (mode === "id") {
    return [truncateLabel(compactRoomLabel(roomId, entry), maxChars ?? 12)]
  }

  const name = entry.useName.trim()
  const id = entry.id.trim() || roomId.trim()
  const roomNorm = roomId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  const nameNorm = name.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const idNorm = id.toUpperCase().replace(/[^A-Z0-9]/g, "")

  const lineLimit = maxChars ?? 16

  if (name && (roomNorm === nameNorm || idNorm === nameNorm)) {
    return splitUseNameLines(name, lineLimit).slice(0, 2)
  }
  if (name && !/^\d+$/.test(id)) {
    return splitUseNameLines(name, lineLimit).slice(0, 2)
  }
  if (!name || name.toUpperCase() === id.toUpperCase()) {
    return [truncateLabel(id, lineLimit)]
  }

  const secondLineLimit = Math.max(8, lineLimit - 2)
  return [truncateLabel(id, lineLimit), ...splitUseNameLines(name, secondLineLimit)].slice(0, 2)
}

/** Resolve label lines + font size together so text fits inside the room footprint. */
export function resolveRoomUseLabelLayout(input: {
  roomId: string
  entry: RoomUseEntry
  mode: RoomUseLabelMode
  viewBoxWidth: number
  viewBoxArea: number
  roomArea: number
  roomWidth: number
  roomHeight: number
}): {
  lines: string[]
  fontSize: number
  strokeWidth: number
  lineHeight: number
} {
  const draftLines = buildRoomUseLabelLines(input.roomId, input.entry, input.mode)
  const draftLongest = Math.max(1, ...draftLines.map((line) => line.length))

  let fontSize = roomUseLabelFontSize(
    input.viewBoxWidth,
    input.mode,
    input.roomArea,
    input.viewBoxArea,
    input.roomWidth,
    input.roomHeight,
    draftLines.length,
    draftLongest,
  )

  let maxChars = maxLabelCharsForRoom(input.roomWidth, fontSize, draftLines.length)
  let lines = buildRoomUseLabelLines(input.roomId, input.entry, input.mode, maxChars)
  let longest = Math.max(1, ...lines.map((line) => line.length))

  fontSize = roomUseLabelFontSize(
    input.viewBoxWidth,
    input.mode,
    input.roomArea,
    input.viewBoxArea,
    input.roomWidth,
    input.roomHeight,
    lines.length,
    longest,
  )

  maxChars = maxLabelCharsForRoom(input.roomWidth, fontSize, lines.length)
  lines = buildRoomUseLabelLines(input.roomId, input.entry, input.mode, maxChars)

  if (lines.length > 1 && input.roomHeight < fontSize * 2.4) {
    lines = [truncateLabel(lines.join(" "), maxChars)]
  }

  fontSize = roomUseLabelFontSize(
    input.viewBoxWidth,
    input.mode,
    input.roomArea,
    input.viewBoxArea,
    input.roomWidth,
    input.roomHeight,
    lines.length,
    Math.max(1, ...lines.map((line) => line.length)),
  )

  return {
    lines,
    fontSize,
    strokeWidth: roomUseLabelStroke(fontSize),
    lineHeight: fontSize * 1.12,
  }
}
