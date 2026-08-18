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

/** Load campus list from bundled geojson; floor-plan flags from manifest when available. */
export async function loadAisdSchoolOptions(): Promise<AisdSchoolOption[]> {
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
  return schoolsWithManifestDisplayNames(parsed, manifest)
}
