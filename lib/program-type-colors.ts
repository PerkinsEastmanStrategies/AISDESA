/** Program Type fill colors from the AISD ESA space-type legend (Google Sheet Program Type column). */

const PROGRAM_TYPE_PALETTE: Record<string, string> = {
  "LEARNING NEIGHBORHOOD": "#C3DFF6",
  "OPEN COLLABORATION": "#E2EFFA",
  "SMALL GROUP LEARNING": "#5D7482",
  "DEDICATED INSTRUCTIONAL": "#6D9EEB",
  "NEIGHBORHOOD MAKER SPACE": "#4285F4",
  PLC: "#65A4CF",
  SPED: "#BFBFBF",
  "MAKER SPACE": "#BFB854",
  CTE: "#BFB854",
  SCIENCE: "#9EB8CD",
  "LIBRARY MEDIA CENTER": "#D18D4A",
  "EMPOWER CENTER": "#F6CC00",
  "VISUAL ARTS": "#FFCFFB",
  "THEATER/AUDITORIUM": "#B352AB",
  DANCE: "#EA3AD8",
  "THEATER ARTS": "#D86DCD",
  MUSIC: "#CB9DC6",
  "ATHLETICS AND WELLNESS": "#A39A91",
  "OUTDOOR ATHLETICS AND WELLNESS": "#CDCDCD",
  WELLNESS: "#A39A91",
  "OUTDOOR LEARNING": "#829A39",
  "OUTDOOR PE": "#CDCDCD",
  "DINING COMMONS": "#9D93B8",
  "FOOD SERVICE": "#D4CCF3",
  ADMINISTRATION: "#D04F4E",
  "HEALTH SERVICES": "#EC8281",
  "STUDENT MENTAL WELLNESS AND COUNSELING": "#F6B1B0",
  COMMUNITY: "#D8B886",
  "PLC COMMUNITY": "#E7B76B",
  "BUILDING SUPPORT": "#F7FBE1",
  "PLC BUILDING SUPPORT": "#F0F0A0",
  CIRCULATION: "#FFFFFF",
}

/** Known CSV typos / abbreviations → canonical legend keys. */
const PROGRAM_TYPE_ALIASES: Record<string, string> = {
  "LEARNING COLLABORATION": "OPEN COLLABORATION",
  "EMPOWERMENT CENTER": "EMPOWER CENTER",
  "WELLN S": "WELLNESS",
  WELLNS: "WELLNESS",
  "SMALL GROUP L": "SMALL GROUP LEARNING",
}

export function normalizeProgramType(raw: string | null | undefined): string | null {
  if (!raw) return null
  let key = raw.trim().toUpperCase().replace(/_/g, " ").replace(/\s+/g, " ")
  if (!key) return null
  key = PROGRAM_TYPE_ALIASES[key] ?? key
  return key
}

export function programTypeFillColor(programType: string | null | undefined): string | null {
  const key = normalizeProgramType(programType)
  if (!key) return null
  if (PROGRAM_TYPE_PALETTE[key]) return PROGRAM_TYPE_PALETTE[key]
  const hue = [...key].reduce((acc, ch) => acc + ch.charCodeAt(0) * 13, 0) % 360
  return `hsl(${hue} 55% 62%)`
}

const LEGEND_ORDER = [
  "LEARNING NEIGHBORHOOD",
  "OPEN COLLABORATION",
  "SMALL GROUP LEARNING",
  "DEDICATED INSTRUCTIONAL",
  "NEIGHBORHOOD MAKER SPACE",
  "PLC",
  "SPED",
  "MAKER SPACE",
  "CTE",
  "SCIENCE",
  "LIBRARY MEDIA CENTER",
  "EMPOWER CENTER",
  "VISUAL ARTS",
  "THEATER/AUDITORIUM",
  "DANCE",
  "THEATER ARTS",
  "MUSIC",
  "ATHLETICS AND WELLNESS",
  "OUTDOOR ATHLETICS AND WELLNESS",
  "WELLNESS",
  "OUTDOOR LEARNING",
  "OUTDOOR PE",
  "DINING COMMONS",
  "FOOD SERVICE",
  "ADMINISTRATION",
  "HEALTH SERVICES",
  "STUDENT MENTAL WELLNESS AND COUNSELING",
  "COMMUNITY",
  "PLC COMMUNITY",
  "BUILDING SUPPORT",
  "PLC BUILDING SUPPORT",
  "CIRCULATION",
] as const

export function programTypeLegendColors(
  programTypes: Iterable<string>,
): { id: string; color: string }[] {
  const ids = [...new Set([...programTypes].map(normalizeProgramType).filter(Boolean))] as string[]
  const order = new Map<string, number>(LEGEND_ORDER.map((id, index) => [id, index]))
  ids.sort((a, b) => {
    const aOrder = order.get(a) ?? 999
    const bOrder = order.get(b) ?? 999
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.localeCompare(b)
  })
  return ids.map((id) => ({
    id,
    color: programTypeFillColor(id) ?? "#94a3b8",
  }))
}
