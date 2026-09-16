export interface AisdSchoolProperties {
  OBJECTID: number
  CLASS: string
  NAME: string
  ISD: string
  ADDRESS: string | null
  CITY: string | null
  STATE: string | null
  ZIP: string | null
  CAMPUS_ID: string
}

export interface AisdSchoolFeature {
  type: "Feature"
  properties: AisdSchoolProperties
  geometry: { type: "Point"; coordinates: [number, number] }
}

export interface AisdSchoolsGeoJSON {
  type: "FeatureCollection"
  features: AisdSchoolFeature[]
}

export interface AisdSchoolOption {
  id: string
  campusId: string
  name: string
  displayName: string
  schoolClass: string
  address: string
  lat: number
  lng: number
  hasFloorPlan: boolean
}

function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(/[\s-/]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
}

function formatDisplayName(name: string, cls: string): string {
  const titled = titleCase(name.replace(/\//g, " / "))
  if (cls === "ELEM") {
    if (/elementary|k-\d|4-6/i.test(titled)) return titled
    return `${titled} Elementary`
  }
  if (cls === "MID") {
    if (/middle/i.test(titled)) return titled
    return `${titled} Middle School`
  }
  if (cls === "HIGH") {
    if (/high|echs|sywl|lasa/i.test(titled)) return titled
    return `${titled} High School`
  }
  return titled
}

export function schoolIdFromName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

/**
 * Sandbox campuses that reuse another school's floor plans, rooms, and
 * questions, but store survey results under a separate school/campus id.
 * Includes LBJ TEST and Pilot #2 copies of field campuses.
 */
export interface TestCampusClone {
  id: string
  name: string
  displayName: string
  sourceName: string
  sourceCampusId: string
  campusId: string
  /** When set, the school picker lists this clone after every live campus (1 = first of that group). */
  pickerEndOrder?: number
  /**
   * Copy rooms and answers from the source campus, keeping a response only when
   * the current question still exists and the stored value is still a valid option.
   */
  seedCompatibleAnswersFromSource?: boolean
  /** Used when seeding if the source esa_schools row is missing. */
  schoolClass?: string
}

export const TEST_CAMPUS_CLONES: readonly TestCampusClone[] = [
  {
    id: "lbj-test",
    name: "LBJ TEST",
    displayName: "LBJ TEST",
    sourceName: "LBJ",
    sourceCampusId: "014",
    campusId: "014-TEST",
  },
  {
    id: "lbj-pilot-test",
    name: "LBJ (PILOT Test)",
    displayName: "LBJ (PILOT Test)",
    sourceName: "LBJ",
    sourceCampusId: "014",
    campusId: "014-PILOT-TEST",
    seedCompatibleAnswersFromSource: true,
  },
  {
    id: "lbj-pilot-2",
    name: "LBJ (Pilot #2)",
    displayName: "LBJ ECHS (Pilot #2)",
    sourceName: "LBJ",
    sourceCampusId: "014",
    campusId: "014-PILOT-2",
  },
  {
    id: "eastside-echs-pilot-2",
    name: "EASTSIDE ECHS (Pilot #2)",
    displayName: "Eastside ECHS (Pilot #2)",
    sourceName: "EASTSIDE ECHS",
    sourceCampusId: "142",
    campusId: "142-PILOT-2",
  },
  {
    id: "casis-pilot-2",
    name: "CASIS (Pilot #2)",
    displayName: "Casis Elementary (Pilot #2)",
    sourceName: "CASIS",
    sourceCampusId: "112",
    campusId: "112-PILOT-2",
  },
  {
    id: "ortega-pilot-2",
    name: "ORTEGA (Pilot #2)",
    displayName: "Ortega Elementary (Pilot #2)",
    sourceName: "ORTEGA",
    sourceCampusId: "126",
    campusId: "126-PILOT-2",
  },
  {
    id: "lbj-pilot-2-merge",
    name: "LBJ (Pilot #2 Merge)",
    displayName: "LBJ (Pilot #2 Merge)",
    sourceName: "LBJ",
    sourceCampusId: "014",
    campusId: "014-PILOT-2-MERGE",
    seedCompatibleAnswersFromSource: true,
    schoolClass: "HIGH",
  },
  {
    id: "ortega-pilot-2-merge",
    name: "ORTEGA (Pilot #2 Merge)",
    displayName: "Ortega (Pilot #2 Merge)",
    sourceName: "ORTEGA",
    sourceCampusId: "126",
    campusId: "126-PILOT-2-MERGE",
    seedCompatibleAnswersFromSource: true,
    schoolClass: "ELEM",
  },
  {
    id: "casis-pilot-2-merge",
    name: "CASIS (Pilot #2 Merge)",
    displayName: "Casis (Pilot #2 Merge)",
    sourceName: "CASIS",
    sourceCampusId: "112",
    campusId: "112-PILOT-2-MERGE",
    seedCompatibleAnswersFromSource: true,
    schoolClass: "ELEM",
  },
  {
    id: "eastside-echs-pilot-2-merge",
    name: "EASTSIDE ECHS (Pilot #2 Merge)",
    displayName: "Eastside (Pilot #2 Merge)",
    sourceName: "EASTSIDE ECHS",
    sourceCampusId: "142",
    campusId: "142-PILOT-2-MERGE",
    seedCompatibleAnswersFromSource: true,
    schoolClass: "HIGH",
  },
  {
    id: "test-es",
    name: "TEST ES",
    displayName: "Test ES",
    sourceName: "CASIS",
    sourceCampusId: "112",
    campusId: "112-TEST-ES",
    pickerEndOrder: 1,
  },
  {
    id: "test-ms",
    name: "TEST MS",
    displayName: "Test MS",
    sourceName: "KEALING",
    sourceCampusId: "044",
    campusId: "044-TEST-MS",
    pickerEndOrder: 2,
  },
  {
    id: "test-hs",
    name: "TEST HS",
    displayName: "Test HS",
    sourceName: "LBJ",
    sourceCampusId: "014",
    campusId: "014-TEST-HS",
    pickerEndOrder: 3,
  },
]

export function sourceSchoolIdForTestClone(clone: TestCampusClone): string {
  return schoolIdFromName(clone.sourceName)
}

export function campusUsesSeededWalkedRooms(
  school: Pick<AisdSchoolOption, "id" | "name" | "campusId"> | { name?: string | null; campusId?: string | null; id?: string | null } | null | undefined,
): boolean {
  if (!school) return false
  return !!testCampusCloneForSchool(school)?.seedCompatibleAnswersFromSource
}

export function testCampusCloneForSchool(
  school: Pick<AisdSchoolOption, "id" | "name" | "campusId"> | { name?: string | null; campusId?: string | null; id?: string | null },
): TestCampusClone | undefined {
  const id = school.id?.trim() ?? ""
  const name = school.name?.trim().toUpperCase() ?? ""
  const campusId = school.campusId?.trim() ?? ""
  return TEST_CAMPUS_CLONES.find(
    (clone) =>
      clone.id === id ||
      clone.name.toUpperCase() === name ||
      clone.campusId === campusId,
  )
}

/** Live campuses first (A–Z), then pinned sandbox campuses in Test ES / MS / HS order. */
export function compareSchoolsForPicker(a: AisdSchoolOption, b: AisdSchoolOption): number {
  const aOrder = testCampusCloneForSchool(a)?.pickerEndOrder ?? 0
  const bOrder = testCampusCloneForSchool(b)?.pickerEndOrder ?? 0
  if (aOrder !== bOrder) return aOrder - bOrder
  return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" })
}

/** Attach sandbox campuses after the live AISD list is parsed. */
export function withTestCampusClones(schools: AisdSchoolOption[]): AisdSchoolOption[] {
  const next = [...schools]
  for (const clone of TEST_CAMPUS_CLONES) {
    if (next.some((school) => school.id === clone.id)) continue
    const source = next.find(
      (school) =>
        school.id === schoolIdFromName(clone.sourceName) ||
        school.name.toUpperCase() === clone.sourceName.toUpperCase() ||
        school.campusId === clone.sourceCampusId,
    )
    if (!source) continue
    next.push({
      ...source,
      id: clone.id,
      name: clone.name,
      displayName: clone.displayName,
      campusId: clone.campusId,
    })
  }
  return next
}

const FLOOR_PLAN_SCHOOLS = new Set<string>()

export function parseAisdSchools(geojson: AisdSchoolsGeoJSON): AisdSchoolOption[] {
  return geojson.features
    .filter((f) => f.properties.CLASS !== "DISTRICT")
    .map((f) => {
      const id = schoolIdFromName(f.properties.NAME)
      const displayName = formatDisplayName(f.properties.NAME, f.properties.CLASS)
      const address = [f.properties.ADDRESS, f.properties.CITY, f.properties.STATE, f.properties.ZIP]
        .filter(Boolean)
        .join(", ")
      return {
        id,
        campusId: f.properties.CAMPUS_ID,
        name: f.properties.NAME,
        displayName,
        schoolClass: f.properties.CLASS,
        address,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        hasFloorPlan: FLOOR_PLAN_SCHOOLS.has(id),
      }
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}
