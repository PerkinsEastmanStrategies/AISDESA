import type { Pt } from "./geometry"
import { polygonArea } from "./geometry"

export interface FloorPlanViewBox {
  x: number
  y: number
  w: number
  h: number
}

export interface FloorPlanLevel {
  id: string
  label: string
  src: string
  viewBox: FloorPlanViewBox
  buildings?: readonly string[]
}

export interface SchoolFloorPlanConfig {
  schoolId: string
  levels: FloorPlanLevel[]
  defaultLevelId: string
  buildingSqft: number
}

/** Lively Middle School — matches AISD/lib/floor-plan.ts */
export const LIVELY_FLOOR_PLAN: SchoolFloorPlanConfig = {
  schoolId: "lively",
  buildingSqft: 185_000,
  defaultLevelId: "l1",
  levels: [
    {
      id: "lb",
      label: "Basement",
      src: "/floor-plans/LivelyMS_LB_plan.svg",
      viewBox: { x: -13070.2, y: -18202.2, w: 27865.2, h: 5247.3 },
      buildings: ["A"],
    },
    {
      id: "l1",
      label: "Level 1",
      src: "/floor-plans/LivelyMS_L1_plan.svg",
      viewBox: { x: -2186.02, y: -18129.5, w: 6089.0, h: 4937.38 },
      buildings: ["A", "B", "C", "D"],
    },
    {
      id: "l2",
      label: "Level 2",
      src: "/floor-plans/LivelyMS_L2_plan.svg",
      viewBox: { x: -2186.0, y: -18047.9, w: 6089.0, h: 4613.8 },
      buildings: ["A", "B", "C", "D"],
    },
    {
      id: "l3",
      label: "Level 3",
      src: "/floor-plans/LivelyMS_L3_plan.svg",
      viewBox: { x: -2181.4, y: -18111.5, w: 6089.0, h: 4703.4 },
      buildings: ["A"],
    },
  ],
}

const FLOOR_PLANS: Record<string, SchoolFloorPlanConfig> = {
  lively: LIVELY_FLOOR_PLAN,
}

export function getFloorPlanForSchool(schoolId: string): SchoolFloorPlanConfig | null {
  return FLOOR_PLANS[schoolId] ?? null
}

export function schoolNameToId(name: string): string | null {
  const normalized = name.toUpperCase().replace(/\s+/g, " ").trim()
  if (normalized.includes("LIVELY")) return "lively"
  return null
}

export interface ParsedPlanRoom {
  id: string
  name: string
  x: number
  y: number
  area: number
  building?: string
  /** Learning neighborhood from the live room lookup sheet (e.g. A–N or 1–14). */
  neighborhood?: string
  /** Room area in square feet from the live room lookup sheet. */
  areaSqft?: number
  levelId: string
  points: Pt[]
}

function roomDisplayName(id: string): string {
  const upper = id.toUpperCase()
  if (upper === "GYM") return "Gymnasium"
  if (upper.startsWith("KIT")) return "Kitchen"
  if (upper.startsWith("CAFE")) return "Cafeteria"
  // Avoid treating CORE* (instructional) as corridors.
  if (/^COR(?!E)/.test(upper)) return `Corridor ${id}`
  if (/^[A-E]-\d/.test(upper)) return id
  // Building + digits (with optional sub-room): A100, B101A, A101.1
  if (/^[A-Z]\d{2,4}(\.\d+)?[A-Z]?$/.test(upper)) return id
  // Wing-style elementary IDs (Cowan ES: E1, N12, W8).
  if (/^[ENW]\d{1,2}$/.test(upper)) return id
  if (/^CORE\d*$/.test(upper)) return `Core ${id}`
  if (/^\d{2,4}(\.\d+)?[A-Z]?$/.test(upper)) return id
  if (/(RR|HRR|BRR|GRR|FRR)$/.test(upper) || upper.includes("RR")) return `Restroom ${id}`
  if (/(STO)$/.test(upper) || upper.includes("STO")) return `Storage ${id}`
  return id.replace(/_/g, " ")
}

/** Parse assessable rooms from polygon.proom shapes in a floor-plan SVG. */
export function parseRoomsFromSvg(svgText: string, levelId: string): ParsedPlanRoom[] {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml")
  const nodes = Array.from(doc.querySelectorAll("polygon.proom, #planRooms polygon.proom"))
  const parsed: ParsedPlanRoom[] = []

  nodes.forEach((node, i) => {
    const raw = node.getAttribute("points")
    if (!raw) return
    const nums = raw
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !Number.isNaN(n))
    const points: Pt[] = []
    for (let k = 0; k + 1 < nums.length; k += 2) points.push({ x: nums[k], y: nums[k + 1] })
    if (points.length < 3) return

    const area = polygonArea(points)
    if (area <= 0) return

    const cx = points.reduce((s, p) => s + p.x, 0) / points.length
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length
    const id = node.getAttribute("data-i") ?? String(i)

    parsed.push({
      id,
      name: roomDisplayName(id),
      x: cx,
      y: cy,
      area,
      building: node.getAttribute("data-building") ?? undefined,
      levelId,
      points,
    })
  })

  return parsed
}

/**
 * True for rooms that should appear in the Studios room dropdown.
 * Opt-out model: include every parsed space unless it is clearly
 * service / circulation / infrastructure. School-specific ID formats vary widely
 * (numeric, A-101, A100, A101.1, E1, S1-G1, SPEECH, etc.).
 */
export function isClassroomRoom(room: ParsedPlanRoom): boolean {
  const id = room.id.toUpperCase().replace(/\s+/g, "")
  if (!id) return false
  return !isExcludedFromClassroomPicker(id)
}

/** Non-instructional / support spaces excluded from the classroom dropdown. */
export function isExcludedFromClassroomPicker(idRaw: string): boolean {
  const id = idRaw.toUpperCase().replace(/\s+/g, "")
  if (!id) return true

  // Stairs: S1, S12, S1-1 — keep studio IDs like S1-G1
  if (/^S\d+[A-Z]?$/.test(id)) return true
  if (/^S\d+-\d/.test(id)) return true

  // Leading infrastructure / circulation / admin (COR but not CORE*)
  if (
    /^(COR(?!E)|CORR|RR|BRR|GRR|FRR|HRR|STO|ELEV|CELEV|AHU|MECH|KIT|KITCHEN|CAFE|GYM|CC|WF|MF|ADM|DN\.?|UP\.?|OPEN|OUTSIDE|GRPRM|BKRM|CHASE|CST|PTAOFC|AVRM|CLRM|DWRM|WKRM|LOUNGE|COUN|VAULT|MDF|IDF|FREEZER|CUST|TOILET|JANITOR|ELEC|VEST|LOBBY|HALL|STAIR|REST|COOLER|OSSTO|FCU|NURSE|NURM|NURW|TOIL|BHRR|GHRR|FHRR|MOP|MECHKIT)/.test(
      id,
    )
  ) {
    return true
  }

  // Office tags (keep computer labs that are not *OFC)
  if (/^(OFC|COMPOFC)/.test(id) || /OFC\d*$/.test(id)) return true

  // Trailing service adjuncts on room-like IDs (B111HRR, A109STO, A100GYM)
  if (/(HRR|BRR|GRR|FRR|RR|STO|ELEV|CHASE|CLO|MOPRM|DWRM|GYM|CAFE)$/.test(id)) return true

  // Numbered service zones: STO100, ELEC200
  if (/^(STO|ELEC|MECH|IDF|MDF|AHU|FCU)\d/.test(id)) return true

  return false
}

