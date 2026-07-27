import type { FeatureCollection } from "geojson"
import type { OutdoorElementPin } from "@aisd/shared"

export interface OutdoorElementTypeOption {
  id: string
  label: string
  /** When false, placing a new pin replaces any existing pin of this type. */
  allowMultiple: boolean
  color: string
}

export const OUTDOOR_ELEMENT_TYPE_OPTIONS: OutdoorElementTypeOption[] = [
  {
    id: "early_childhood_playground",
    label: "Early Childhood Playground",
    allowMultiple: false,
    color: "#e11d48",
  },
  {
    id: "elementary_playground",
    label: "Elementary Playground",
    allowMultiple: false,
    color: "#f97316",
  },
  { id: "habitat_garden", label: "Habitat Garden", allowMultiple: false, color: "#84cc16" },
  { id: "pollinator_garden", label: "Pollinator Garden", allowMultiple: false, color: "#22c55e" },
  { id: "trail", label: "Trail", allowMultiple: false, color: "#a855f7" },
  { id: "field", label: "Field", allowMultiple: false, color: "#14b8a6" },
  { id: "track", label: "Track", allowMultiple: false, color: "#06b6d4" },
  {
    id: "competition_field",
    label: "Competition Field",
    allowMultiple: false,
    color: "#0ea5e9",
  },
  { id: "baseball_field", label: "Baseball Field", allowMultiple: false, color: "#3b82f6" },
  { id: "outdoor_studio", label: "Outdoor Studio", allowMultiple: true, color: "#d946ef" },
]

export function outdoorElementTypeOption(
  elementType: string,
): OutdoorElementTypeOption | undefined {
  return OUTDOOR_ELEMENT_TYPE_OPTIONS.find((option) => option.id === elementType)
}

export function outdoorElementTypeLabel(elementType: string): string {
  return outdoorElementTypeOption(elementType)?.label ?? elementType
}

export function outdoorElementPinLabel(
  pin: OutdoorElementPin,
  allPins: OutdoorElementPin[],
): string {
  const base = outdoorElementTypeLabel(pin.elementType)
  const option = outdoorElementTypeOption(pin.elementType)
  if (!option?.allowMultiple) return base

  const sameType = allPins
    .filter((entry) => entry.elementType === pin.elementType)
    .sort((a, b) => a.placedAt.localeCompare(b.placedAt))
  const index = sameType.findIndex((entry) => entry.id === pin.id)
  if (index <= 0 && sameType.length <= 1) return base
  return `${base} ${index + 1}`
}

export function createOutdoorElementPin(
  elementType: string,
  lng: number,
  lat: number,
): OutdoorElementPin {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `pin-${elementType}-${Date.now()}`
  return {
    id,
    elementType,
    lng,
    lat,
    placedAt: new Date().toISOString(),
  }
}

export function placeOutdoorElementPin(
  pins: OutdoorElementPin[],
  elementType: string,
  lng: number,
  lat: number,
): OutdoorElementPin[] {
  const option = outdoorElementTypeOption(elementType)
  const pin = createOutdoorElementPin(elementType, lng, lat)
  if (option?.allowMultiple) return [...pins, pin]
  return [...pins.filter((entry) => entry.elementType !== elementType), pin]
}

export function removeOutdoorElementPin(
  pins: OutdoorElementPin[],
  pinId: string,
): OutdoorElementPin[] {
  return pins.filter((entry) => entry.id !== pinId)
}

export function outdoorElementPinsToGeoJSON(
  pins: OutdoorElementPin[],
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: pins.map((pin) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [pin.lng, pin.lat] },
      properties: {
        id: pin.id,
        elementType: pin.elementType,
        label: outdoorElementPinLabel(pin, pins),
        color: outdoorElementTypeOption(pin.elementType)?.color ?? "#f59e0b",
      },
    })),
  }
}
