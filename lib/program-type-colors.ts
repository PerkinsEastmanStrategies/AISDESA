/** Program Type fill colors from the AISD ESA space-type legend (Google Sheet Program Type column). */

const PROGRAM_TYPE_PALETTE: Record<string, string> = {
  "LEARNING NEIGHBORHOOD": "#C3DFF6",
  "LEARNING COLLABORATION": "#E2EFFA",
  "SMALL GROUP LEARNING": "#5D7482",
  PLC: "#F0F0A0",
  SPED: "#BFBFBF",
  "MAKER SPACE": "#BFB854",
  "LIBRARY MEDIA CENTER": "#D18D4A",
  "EMPOWERMENT CENTER": "#F6CC00",
  "VISUAL ARTS": "#FFCFFB",
  MUSIC: "#CB9DC6",
  WELLNESS: "#A39A91",
  "OUTDOOR LEARNING": "#829A39",
  "FOOD SERVICE": "#9D93B8",
  ADMINISTRATION: "#D04F4E",
  COMMUNITY: "#D8B886",
  "BUILDING SUPPORT": "#F7FBE1",
  CIRCULATION: "#FFFFFF",
}

/** Known CSV typos / abbreviations → canonical legend keys. */
const PROGRAM_TYPE_ALIASES: Record<string, string> = {
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
  "LEARNING COLLABORATION",
  "SMALL GROUP LEARNING",
  "PLC",
  "SPED",
  "MAKER SPACE",
  "LIBRARY MEDIA CENTER",
  "EMPOWERMENT CENTER",
  "VISUAL ARTS",
  "MUSIC",
  "WELLNESS",
  "OUTDOOR LEARNING",
  "FOOD SERVICE",
  "ADMINISTRATION",
  "COMMUNITY",
  "BUILDING SUPPORT",
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
