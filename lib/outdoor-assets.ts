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
  return {
    type: "FeatureCollection",
    features: collection.features.filter((feature) => outdoorAssetMatchesSchool(feature, school)),
  }
}

export function outdoorAssetLabel(feature: Feature): string {
  const props = (feature.properties ?? {}) as Record<string, unknown>
  const name = propertyString(props, ["name", "NAME", "asset_name", "assetName", "label", "title"])
  const type = propertyString(props, ["asset_type", "assetType", "type", "TYPE", "category"])
  if (name && type) return `${name} (${type})`
  return name || type || "Outdoor asset"
}
