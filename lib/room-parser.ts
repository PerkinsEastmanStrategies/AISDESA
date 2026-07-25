import type { ParsedPlanRoom } from "@aisd/shared"
import { polygonArea } from "@aisd/shared"
import { extractRoomsFromSvg, type RoomInfo } from "@/lib/spaces-data"

function roomDisplayName(id: string, label?: string): string {
  if (label && label !== id) return label
  const upper = id.toUpperCase()
  if (upper === "GYM") return "Gymnasium"
  if (upper.startsWith("KIT")) return "Kitchen"
  if (upper.startsWith("CAFE")) return "Cafeteria"
  // Avoid treating CORE* (instructional) as corridors.
  if (/^COR(?!E)/.test(upper)) return `Corridor ${id}`
  if (/^[A-E]-\d/.test(upper)) return id
  // Building + digits / dotted sub-rooms (A100, B101A, A101.1)
  if (/^[A-Z]\d{2,4}(\.\d+)?[A-Z]?$/.test(upper)) return id
  // Studio-style IDs (Lively / Bryker: S1-G1) — not stair landings S1-1.
  if (/^S\d+-[A-Z]/.test(upper)) return id
  // Wing-style elementary IDs (Cowan ES: E1, N12, W8).
  if (/^[ENW]\d{1,2}$/.test(upper)) return id
  if (/^CORE\d*$/.test(upper)) return `Core ${id}`
  if (/^\d{2,4}(\.\d+)?[A-Z]?$/.test(upper)) return id
  if (upper === "ART") return "Art"
  if (upper === "MUSIC" || upper.startsWith("MUSIC")) return "Music"
  if (upper === "SPEECH") return "Speech"
  if (upper === "LIBRARY" || upper.startsWith("LIB")) return "Library"
  if (/(RR|HRR)$/.test(upper) || upper.includes("RR")) return `Restroom ${id}`
  if (/(STO)$/.test(upper) || upper.includes("STO")) return `Storage ${id}`
  return id.replace(/_/g, " ")
}

function buildingByRoomKey(svgText: string): Map<string, string | undefined> {
  const map = new Map<string, string | undefined>()
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml")
  for (const poly of doc.querySelectorAll("polygon.proom[data-i], polygon[data-k]")) {
    const key = poly.getAttribute("data-i")?.trim() ?? poly.getAttribute("data-k")?.trim()
    if (key) map.set(key, poly.getAttribute("data-building") ?? undefined)
  }
  return map
}

function roomInfoToParsedPlanRoom(
  room: RoomInfo,
  levelId: string,
  buildings: Map<string, string | undefined>,
): ParsedPlanRoom {
  return {
    id: room.key,
    name: roomDisplayName(room.key, room.label),
    x: room.x,
    y: room.y,
    area: room.points.length >= 3 ? polygonArea(room.points) : 0,
    building: buildings.get(room.key),
    levelId,
    points: room.points,
    overlayKind: room.overlayKind,
  }
}

/**
 * Parse selectable rooms from a floor plan SVG using the same detection order
 * as the Principal Survey: CAFM → generic labels → legacy data-k → proom.
 */
export function parsePlanRoomsFromSvg(svgText: string, levelId: string): ParsedPlanRoom[] {
  const rooms = extractRoomsFromSvg(svgText)
  if (!rooms.length) return []

  const buildings = buildingByRoomKey(svgText)
  return rooms
    .filter((room) => room.points.length >= 3)
    .map((room) => roomInfoToParsedPlanRoom(room, levelId, buildings))
    .filter((room) => room.area > 0)
}
