import {
  parseAisdSchools,
  withTestCampusClones,
  type AisdSchoolOption,
  type AisdSchoolsGeoJSON,
} from "@aisd/shared"
import {
  loadFloorPlanManifest,
  schoolHasFloorPlan,
  schoolsWithManifestDisplayNames,
} from "@/lib/floor-plan-manifest"

const CACHE_KEY = "aisd-school-options-cache"

function readCachedSchoolOptions(): AisdSchoolOption[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AisdSchoolOption[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

function writeCachedSchoolOptions(options: AisdSchoolOption[]): void {
  if (typeof window === "undefined" || options.length === 0) return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(options))
  } catch {
    // Storage full or blocked. The list reloads from the network next time.
  }
}

/**
 * Load campus list from bundled geojson; floor-plan flags from manifest when available.
 *
 * Keeps a copy on the device because losing this list costs more than the list itself: the
 * campus falls back to one rebuilt from the draft, which has no school class, and school class
 * decides which questions apply and which space types a module needs. Without it a finished
 * module reads as not started, so a brief dropout looked like the day's work had vanished.
 */
export async function loadAisdSchoolOptions(): Promise<AisdSchoolOption[]> {
  try {
    const response = await fetch("/data/aisd-schools.geojson")
    if (!response.ok) {
      throw new Error(`School list request failed (${response.status})`)
    }

    const data = (await response.json()) as AisdSchoolsGeoJSON
    if (!Array.isArray(data.features)) {
      throw new Error("School list response was invalid")
    }

    let manifest: Awaited<ReturnType<typeof loadFloorPlanManifest>> = []
    try {
      manifest = await loadFloorPlanManifest()
    } catch {
      manifest = []
    }

    const parsed = withTestCampusClones(parseAisdSchools(data)).map((school) => ({
      ...school,
      hasFloorPlan: schoolHasFloorPlan(school, manifest),
    }))
    const options = schoolsWithManifestDisplayNames(parsed, manifest)
    writeCachedSchoolOptions(options)
    return options
  } catch (error) {
    const cached = readCachedSchoolOptions()
    if (cached) return cached
    throw error
  }
}
