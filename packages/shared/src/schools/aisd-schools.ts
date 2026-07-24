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

function schoolIdFromName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
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
