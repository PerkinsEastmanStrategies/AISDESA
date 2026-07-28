import type { Feature, FeatureCollection } from "geojson"
import type { AisdSchoolOption } from "@aisd/shared"
import { schoolNamesMatch } from "@/lib/room-neighborhood-lookup"

export const OUTDOOR_ASSETS_GEOJSON_PATH =
  process.env.NEXT_PUBLIC_OUTDOOR_ASSETS_GEOJSON_URL ?? "/data/outdoor-assets.geojson"

let loadPromise: Promise<FeatureCollection> | null = null

export function resetOutdoorAssetsCache(): void {
  loadPromise = null
}

export async function loadOutdoorAssetsGeoJSON(): Promise<FeatureCollection> {
  if (!loadPromise) {
    loadPromise = (async () => {
      const response = await fetch(OUTDOOR_ASSETS_GEOJSON_PATH, { cache: "no-store" })
      if (!response.ok) {
        throw new Error(`Failed to load outdoor assets (${response.status})`)
      }
      const data = (await response.json()) as FeatureCollection
      if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
        throw new Error("Outdoor assets GeoJSON must be a FeatureCollection")
      }
      return data
    })()
  }
  return loadPromise
}

function propertyString(props: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!props) return ""
  for (const key of keys) {
    const val = props[key]
    if (val != null && String(val).trim()) return String(val).trim()
  }
  return ""
}

function normalizeCampusId(value: unknown): string {
  if (value == null) return ""
  return String(value).trim()
}

/** Strip numbered suffixes — "Bench 3" → "Bench", "Art-2" → "Art". */
export function outdoorAssetTypeCategory(rawType: string): string {
  const trimmed = rawType.trim()
  if (!trimmed) return "Other"
  const withoutSuffix = trimmed
    .replace(/\s+\d+[A-Za-z]?$/, "")
    .replace(/\s*-\s*\d+$/, "")
    .replace(/\d+$/, "")
    .trim()
  return withoutSuffix || trimmed
}

const OUTDOOR_ASSET_CATEGORY_COLORS: Record<string, string> = {
  Art: "#a855f7",
  Basketball: "#f97316",
  Bench: "#78716c",
  Benches: "#78716c",
  "Bike Rack": "#0ea5e9",
  "Berm/Swale": "#14b8a6",
  Cistern: "#0891b2",
  "Cistern/Rain Barrel": "#0891b2",
  Compost: "#65a30d",
  Field: "#16a34a",
  Fields: "#16a34a",
  "Fitness Station": "#fb7185",
  "Gaga Ball Pit": "#ec4899",
  "Garden/Planting Bed": "#84cc16",
  "Habitat Garden": "#84cc16",
  "Habitat garden": "#84cc16",
  Lawn: "#22c55e",
  "Mutt Mitt station": "#94a3b8",
  "Nature Trail": "#a3e635",
  "Nature Play": "#4ade80",
  Other: "#94a3b8",
  "Outdoor Classroom": "#c026d3",
  "Picnic table": "#d97706",
  "Picnic Table": "#d97706",
  "picnic table": "#d97706",
  Playground: "#e11d48",
  Pond: "#0284c7",
  "Produce Garden": "#4d7c0f",
  "Rain Garden": "#2dd4bf",
  "Rain Garden/Infiltration Garden": "#2dd4bf",
  Shed: "#92400e",
  "Shade Structure": "#6366f1",
  "Shade structure": "#6366f1",
  Signage: "#cbd5e1",
  Solar: "#eab308",
  Track: "#06b6d4",
  "Water fountain": "#38bdf8",
  "Waste receptacle": "#64748b",
  "Waste Receptacle": "#64748b",
  "Waste receptacles": "#64748b",
  "Wildlife Habitat": "#15803d",
  Pavilion: "#8b5cf6",
  Pavillion: "#8b5cf6",
  Greenhouse: "#059669",
  Amphitheater: "#7c3aed",
  "Tennis Court": "#2563eb",
}

function hashColor(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 62%, 50%)`
}

export function colorForOutdoorAssetCategory(category: string): string {
  const trimmed = category.trim()
  if (!trimmed) return OUTDOOR_ASSET_CATEGORY_COLORS.Other

  if (OUTDOOR_ASSET_CATEGORY_COLORS[trimmed]) {
    return OUTDOOR_ASSET_CATEGORY_COLORS[trimmed]
  }

  const lower = trimmed.toLowerCase()
  for (const [key, color] of Object.entries(OUTDOOR_ASSET_CATEGORY_COLORS)) {
    if (key.toLowerCase() === lower) return color
  }

  return hashColor(trimmed)
}

export function outdoorAssetRawType(feature: Feature): string {
  const props = (feature.properties ?? {}) as Record<string, unknown>
  return propertyString(props, [
    "Type",
    "type",
    "asset_type",
    "assetType",
    "TYPE",
    "category",
    "Category",
  ])
}

export function enrichOutdoorAssetsForMap(collection: FeatureCollection): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.map((feature) => {
      const props = (feature.properties ?? {}) as Record<string, unknown>
      const rawType = outdoorAssetRawType(feature)
      const assetCategory = outdoorAssetTypeCategory(rawType)
      const color = colorForOutdoorAssetCategory(assetCategory)
      return {
        ...feature,
        properties: {
          ...props,
          assetType: rawType,
          assetCategory,
          color,
        },
      }
    }),
  }
}

export interface OutdoorAssetLegendItem {
  category: string
  color: string
  count: number
}

export function outdoorAssetLegendItems(collection: FeatureCollection): OutdoorAssetLegendItem[] {
  const counts = new Map<string, number>()
  for (const feature of collection.features) {
    const props = (feature.properties ?? {}) as Record<string, unknown>
    const category =
      propertyString(props, ["assetCategory"]) ||
      outdoorAssetTypeCategory(outdoorAssetRawType(feature))
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([category, count]) => ({
      category,
      count,
      color: colorForOutdoorAssetCategory(category),
    }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
}

function outdoorAssetMatchesSchool(
  feature: Feature,
  school: Pick<AisdSchoolOption, "id" | "name" | "campusId" | "displayName">,
): boolean {
  const props = (feature.properties ?? {}) as Record<string, unknown>

  const campusId = propertyString(props, ["campus_id", "CAMPUS_ID", "campusId", "CampusId"])
  if (campusId && normalizeCampusId(campusId) === normalizeCampusId(school.campusId)) {
    return true
  }

  const schoolId = propertyString(props, ["school_id", "schoolId", "SCHOOL_ID", "id", "OBJECTID"])
  if (schoolId && (schoolId === school.id || schoolId === school.campusId)) {
    return true
  }

  const schoolName = propertyString(props, [
    "School ID",
    "school_name",
    "schoolName",
    "SCHOOL_NAME",
    "NAME",
    "name",
    "School",
  ])
  if (schoolName) {
    if (schoolNamesMatch(schoolName, school.name)) return true
    if (school.displayName && schoolNamesMatch(schoolName, school.displayName)) return true
  }

  return false
}

export function outdoorAssetsForSchool(
  collection: FeatureCollection,
  school: Pick<AisdSchoolOption, "id" | "name" | "campusId" | "displayName">,
): FeatureCollection {
  const filtered = collection.features.filter((feature) => outdoorAssetMatchesSchool(feature, school))
  return enrichOutdoorAssetsForMap({
    type: "FeatureCollection",
    features: filtered,
  })
}

export function outdoorAssetLabel(feature: Feature): string {
  const props = (feature.properties ?? {}) as Record<string, unknown>
  const rawType = propertyString(props, ["assetType", "Type", "type", "asset_type", "assetType"])
  const category = propertyString(props, ["assetCategory"]) || outdoorAssetTypeCategory(rawType)
  const notes = propertyString(props, ["Notes", "notes", "NOTE"])
  const featureId = propertyString(props, ["Feature ID", "feature_id", "featureId"])

  const title = rawType || category || "Outdoor asset"
  if (notes && featureId) return `${title} · ${notes} (#${featureId})`
  if (notes) return `${title} · ${notes}`
  if (category && category !== rawType) return `${title} (${category})`
  return title
}

export function outdoorAssetPopupHtml(feature: Feature): string {
  const props = (feature.properties ?? {}) as Record<string, unknown>
  const rawType = propertyString(props, ["assetType", "Type", "type"])
  const category = propertyString(props, ["assetCategory"]) || outdoorAssetTypeCategory(rawType)
  const notes = propertyString(props, ["Notes", "notes"])
  const quality = propertyString(props, ["Infrastructure Quality", "infrastructure_quality"])

  const lines = [`<strong>${rawType || category || "Outdoor asset"}</strong>`]
  if (category && category !== rawType) {
    lines.push(`<div class="text-slate-500">${category}</div>`)
  }
  if (notes) lines.push(`<div class="mt-1">${notes}</div>`)
  if (quality && quality !== "N/A") {
    lines.push(`<div class="mt-1 text-slate-500">Quality: ${quality}</div>`)
  }
  return lines.join("")
}
