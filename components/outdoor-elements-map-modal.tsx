"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Crosshair, LocateFixed, MapPin, X } from "lucide-react"
import type { Feature, FeatureCollection } from "geojson"
import type { AisdSchoolOption } from "@aisd/shared"
import {
  loadOutdoorAssetsGeoJSON,
  outdoorAssetLabel,
  outdoorAssetsForSchool,
} from "@/lib/outdoor-assets"
import {
  outdoorElementPinsToGeoJSON,
} from "@/lib/outdoor-element-types"
import OutdoorElementPinPanel from "@/components/outdoor-element-pin-panel"
import { useSurvey } from "@/lib/survey-store"
import "mapbox-gl/dist/mapbox-gl.css"

type MapboxModule = typeof import("mapbox-gl")

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""
const SATELLITE_STYLE = "mapbox://styles/mapbox/satellite-streets-v12"

const OUTDOOR_SOURCE_ID = "outdoor-assets"
const OUTDOOR_FILL_LAYER = "outdoor-assets-fill"
const OUTDOOR_LINE_LAYER = "outdoor-assets-line"
const OUTDOOR_POINT_LAYER = "outdoor-assets-points"
const USER_SOURCE_ID = "user-location"
const USER_ACCURACY_LAYER = "user-location-accuracy"
const USER_DOT_LAYER = "user-location-dot"
const USER_PINS_SOURCE_ID = "user-outdoor-pins"
const USER_PINS_LAYER = "user-outdoor-pins-layer"

function emptyFeatureCollection(): FeatureCollection {
  return { type: "FeatureCollection", features: [] }
}

function userLocationCollection(
  lng: number,
  lat: number,
  accuracyMeters: number,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: { accuracy: accuracyMeters },
      },
    ],
  }
}

function setMapCursor(map: import("mapbox-gl").Map | null | undefined, cursor: string): void {
  try {
    const canvas = map?.getCanvas()
    if (canvas) canvas.style.cursor = cursor
  } catch {
    // Map was already removed during modal teardown.
  }
}

export default function OutdoorElementsMapModal({
  open,
  school,
  onClose,
}: {
  open: boolean
  school: AisdSchoolOption
  onClose: () => void
}) {
  const { outdoorElementPins, placeOutdoorElementPin, removeOutdoorElementPin } = useSurvey()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import("mapbox-gl").Map | null>(null)
  const popupRef = useRef<import("mapbox-gl").Popup | null>(null)
  const mapboxRef = useRef<MapboxModule | null>(null)
  const schoolMarkerRef = useRef<import("mapbox-gl").Marker | null>(null)

  const [mounted, setMounted] = useState(false)
  const [containerReady, setContainerReady] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [assetsError, setAssetsError] = useState<string | null>(null)
  const [assetCount, setAssetCount] = useState(0)
  const [geoStatus, setGeoStatus] = useState<"idle" | "active" | "denied" | "unavailable">("idle")
  const [userCoords, setUserCoords] = useState<{ lng: number; lat: number } | null>(null)
  const [markingMode, setMarkingMode] = useState(true)
  const [selectedElementType, setSelectedElementType] = useState<string | null>(null)
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)

  const placePinRef = useRef(placeOutdoorElementPin)
  placePinRef.current = placeOutdoorElementPin

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setContainerReady(false)
      setMapError(null)
      setSelectedElementType(null)
      setSelectedPinId(null)
    }
  }, [open])

  const mapContainerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    mapContainerRef.current = node
    setContainerReady(!!node)
  }, [])

  const resizeMap = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    map.resize()
  }, [])

  const centerOnSchool = useCallback(() => {
    const map = mapRef.current
    const mapboxgl = mapboxRef.current
    if (!map || !mapboxgl) return
    map.flyTo({ center: [school.lng, school.lat], zoom: 17, essential: true })
  }, [school.lat, school.lng])

  const centerOnUser = useCallback(() => {
    const map = mapRef.current
    if (!map || !userCoords) return
    map.flyTo({ center: [userCoords.lng, userCoords.lat], zoom: 18, essential: true })
  }, [userCoords])

  const fitToAssetsAndSchool = useCallback(
    (assets: FeatureCollection) => {
      const map = mapRef.current
      const mapboxgl = mapboxRef.current
      if (!map || !mapboxgl) return

      const bounds = new mapboxgl.LngLatBounds([school.lng, school.lat], [school.lng, school.lat])
      for (const feature of assets.features) {
        if (!feature.geometry) continue
        try {
          const coords = feature.geometry
          if (coords.type === "Point") {
            bounds.extend(coords.coordinates as [number, number])
          } else if (coords.type === "MultiPoint") {
            for (const point of coords.coordinates) {
              bounds.extend(point as [number, number])
            }
          } else if (coords.type === "LineString") {
            for (const point of coords.coordinates) {
              bounds.extend(point as [number, number])
            }
          } else if (coords.type === "MultiLineString") {
            for (const line of coords.coordinates) {
              for (const point of line) {
                bounds.extend(point as [number, number])
              }
            }
          } else if (coords.type === "Polygon") {
            for (const ring of coords.coordinates) {
              for (const point of ring) {
                bounds.extend(point as [number, number])
              }
            }
          } else if (coords.type === "MultiPolygon") {
            for (const polygon of coords.coordinates) {
              for (const ring of polygon) {
                for (const point of ring) {
                  bounds.extend(point as [number, number])
                }
              }
            }
          }
        } catch {
          // Skip malformed geometries.
        }
      }

      if (assets.features.length > 0) {
        map.fitBounds(bounds, { padding: 48, maxZoom: 18, duration: 0 })
      } else {
        map.setCenter([school.lng, school.lat])
        map.setZoom(17)
      }
    },
    [school.lat, school.lng],
  )

  useEffect(() => {
    if (!open || !mounted || !containerReady || !mapContainerRef.current || !MAPBOX_TOKEN) return

    let cancelled = false
    let resizeObserver: ResizeObserver | null = null

    ;(async () => {
      try {
        const mapboxModule = await import("mapbox-gl")
        const mapboxgl = mapboxModule.default
        mapboxgl.workerUrl = "/mapbox-gl-csp-worker.js"

        if (cancelled || !mapContainerRef.current) return

        mapboxRef.current = mapboxgl as unknown as MapboxModule
        mapboxgl.accessToken = MAPBOX_TOKEN

        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: SATELLITE_STYLE,
          center: [school.lng, school.lat],
          zoom: 17,
          attributionControl: true,
          antialias: true,
        })

        mapRef.current = map
        popupRef.current = new mapboxgl.Popup({ closeButton: true, closeOnClick: true, offset: 12 })

        map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right")

        map.on("error", (event) => {
          const message = event.error?.message ?? "Map failed to load tiles."
          setMapError(message)
        })

        resizeObserver = new ResizeObserver(() => {
          resizeMap()
        })
        resizeObserver.observe(mapContainerRef.current)

        map.on("load", () => {
          if (cancelled) return

          requestAnimationFrame(() => {
            resizeMap()
          })

          map.addSource(USER_SOURCE_ID, {
          type: "geojson",
          data: emptyFeatureCollection(),
        })

        map.addLayer({
          id: USER_ACCURACY_LAYER,
          type: "circle",
          source: USER_SOURCE_ID,
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10,
              ["*", ["get", "accuracy"], 0.05],
              18,
              ["*", ["get", "accuracy"], 0.5],
            ],
            "circle-color": "#2563eb",
            "circle-opacity": 0.15,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#2563eb",
            "circle-stroke-opacity": 0.35,
          },
        })

        map.addLayer({
          id: USER_DOT_LAYER,
          type: "circle",
          source: USER_SOURCE_ID,
          paint: {
            "circle-radius": 7,
            "circle-color": "#2563eb",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        })

        map.addSource(OUTDOOR_SOURCE_ID, {
          type: "geojson",
          data: emptyFeatureCollection(),
        })

        map.addLayer({
          id: OUTDOOR_FILL_LAYER,
          type: "fill",
          source: OUTDOOR_SOURCE_ID,
          filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
          paint: {
            "fill-color": "#f59e0b",
            "fill-opacity": 0.45,
          },
        })

        map.addLayer({
          id: OUTDOOR_LINE_LAYER,
          type: "line",
          source: OUTDOOR_SOURCE_ID,
          filter: [
            "match",
            ["geometry-type"],
            ["Polygon", "MultiPolygon", "LineString", "MultiLineString"],
            true,
            false,
          ],
          paint: {
            "line-color": "#b45309",
            "line-width": 2,
          },
        })

        map.addLayer({
          id: OUTDOOR_POINT_LAYER,
          type: "circle",
          source: OUTDOOR_SOURCE_ID,
          filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
          paint: {
            "circle-radius": 8,
            "circle-color": "#f59e0b",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        })

        map.addSource(USER_PINS_SOURCE_ID, {
          type: "geojson",
          data: outdoorElementPinsToGeoJSON([]),
        })

        map.addLayer({
          id: USER_PINS_LAYER,
          type: "circle",
          source: USER_PINS_SOURCE_ID,
          paint: {
            "circle-radius": 10,
            "circle-color": ["get", "color"],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        })

        const showAssetPopup = (event: import("mapbox-gl").MapMouseEvent & { features?: Feature[] }) => {
          const feature = event.features?.[0]
          if (!feature) return
          popupRef.current
            ?.setLngLat(event.lngLat)
            .setHTML(`<strong>${outdoorAssetLabel(feature)}</strong>`)
            .addTo(map)
        }

        for (const layerId of [OUTDOOR_FILL_LAYER, OUTDOOR_LINE_LAYER, OUTDOOR_POINT_LAYER]) {
          map.on("click", layerId, showAssetPopup)
          map.on("mouseenter", layerId, () => {
            map.getCanvas().style.cursor = "pointer"
          })
          map.on("mouseleave", layerId, () => {
            map.getCanvas().style.cursor = ""
          })
        }

        map.on("click", USER_PINS_LAYER, (event) => {
          const pinId = event.features?.[0]?.properties?.id
          if (typeof pinId === "string") {
            setSelectedPinId(pinId)
            const label = event.features?.[0]?.properties?.label
            popupRef.current
              ?.setLngLat(event.lngLat)
              .setHTML(`<strong>${label ?? "Outdoor element"}</strong>`)
              .addTo(map)
          }
        })
        map.on("mouseenter", USER_PINS_LAYER, () => {
          map.getCanvas().style.cursor = "pointer"
        })
        map.on("mouseleave", USER_PINS_LAYER, () => {
          map.getCanvas().style.cursor = ""
        })

        schoolMarkerRef.current = new mapboxgl.Marker({ color: "#0f766e" })
          .setLngLat([school.lng, school.lat])
          .addTo(map)

        setMapReady(true)
      })
      } catch (error) {
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : "Could not initialize the map.")
        }
      }
    })()

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      setMapReady(false)
      setMapError(null)
      popupRef.current?.remove()
      popupRef.current = null
      schoolMarkerRef.current?.remove()
      schoolMarkerRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
      mapboxRef.current = null
    }
  }, [open, mounted, containerReady, school.lat, school.lng, resizeMap])

  useEffect(() => {
    if (!open || !mapReady) return

    let cancelled = false
    setAssetsLoading(true)
    setAssetsError(null)

    ;(async () => {
      try {
        const allAssets = await loadOutdoorAssetsGeoJSON()
        if (cancelled) return
        const schoolAssets = outdoorAssetsForSchool(allAssets, school)
        setAssetCount(schoolAssets.features.length)

        const source = mapRef.current?.getSource(OUTDOOR_SOURCE_ID) as import("mapbox-gl").GeoJSONSource | undefined
        source?.setData(schoolAssets)
        fitToAssetsAndSchool(schoolAssets)
      } catch (error) {
        if (!cancelled) {
          setAssetsError(error instanceof Error ? error.message : "Could not load outdoor assets")
          setAssetCount(0)
        }
      } finally {
        if (!cancelled) setAssetsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, mapReady, school, fitToAssetsAndSchool])

  useEffect(() => {
    if (!open || !mapReady) return
    const source = mapRef.current?.getSource(USER_PINS_SOURCE_ID) as import("mapbox-gl").GeoJSONSource | undefined
    source?.setData(outdoorElementPinsToGeoJSON(outdoorElementPins))
  }, [open, mapReady, outdoorElementPins])

  const markingModeRef = useRef(markingMode)
  const selectedElementTypeRef = useRef(selectedElementType)
  markingModeRef.current = markingMode
  selectedElementTypeRef.current = selectedElementType

  useEffect(() => {
    const map = mapRef.current
    if (!open || !mapReady || !map) return

    const onMapClick = (event: import("mapbox-gl").MapMouseEvent) => {
      if (!markingModeRef.current || !selectedElementTypeRef.current) return
      const hitPin = map.queryRenderedFeatures(event.point, { layers: [USER_PINS_LAYER] })
      if (hitPin.length > 0) return
      placePinRef.current(selectedElementTypeRef.current, event.lngLat.lng, event.lngLat.lat)
    }

    map.on("click", onMapClick)
    return () => {
      try {
        map.off("click", onMapClick)
      } catch {
        // Map was already removed during modal teardown.
      }
    }
  }, [open, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!open || !map || !mapReady) return
    if (markingMode && selectedElementType) {
      setMapCursor(map, "crosshair")
      return () => {
        setMapCursor(mapRef.current, "")
      }
    }
    setMapCursor(map, "")
  }, [open, mapReady, markingMode, selectedElementType])

  useEffect(() => {
    if (!open || !mapReady || !selectedPinId) return
    const pin = outdoorElementPins.find((entry) => entry.id === selectedPinId)
    if (!pin) return
    mapRef.current?.flyTo({ center: [pin.lng, pin.lat], zoom: 18, essential: true })
  }, [open, mapReady, selectedPinId, outdoorElementPins])

  useEffect(() => {
    if (!open || !mapReady || !navigator.geolocation) {
      if (open && !navigator.geolocation) setGeoStatus("unavailable")
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { longitude, latitude, accuracy } = position.coords
        setUserCoords({ lng: longitude, lat: latitude })
        setGeoStatus("active")

        const source = mapRef.current?.getSource(USER_SOURCE_ID) as import("mapbox-gl").GeoJSONSource | undefined
        source?.setData(userLocationCollection(longitude, latitude, accuracy))
      },
      () => {
        setGeoStatus("denied")
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
      setGeoStatus("idle")
      setUserCoords(null)
      const source = mapRef.current?.getSource(USER_SOURCE_ID) as import("mapbox-gl").GeoJSONSource | undefined
      source?.setData(emptyFeatureCollection())
    }
  }, [open, mapReady])

  if (!open || !mounted) return null

  const titleId = "outdoor-map-title"

  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col bg-slate-950">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-950/95 px-3 py-2 text-white backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Outdoor elements map
          </p>
          <h2 id={titleId} className="truncate text-sm font-semibold">
            {school.displayName || school.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
          aria-label="Close map"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {!MAPBOX_TOKEN ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-300">
          Add <code className="text-amber-300">NEXT_PUBLIC_MAPBOX_TOKEN</code> to{" "}
          <code className="text-amber-300">.env.local</code> to enable the outdoor map.
        </div>
      ) : (
        <div className="relative min-h-0 flex-1">
          <div
            ref={mapContainerCallbackRef}
            className="absolute inset-0 h-full w-full [&_.mapboxgl-map]:h-full [&_.mapboxgl-map]:w-full"
            role="presentation"
            aria-hidden
          />

          {mapError && (
            <div className="pointer-events-none absolute inset-x-3 top-3 rounded-xl border border-amber-500/40 bg-amber-950/90 px-3 py-2 text-xs text-amber-100 shadow-lg">
              {mapError}
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2 lg:max-w-[min(100%,28rem)]">
              <OutdoorElementPinPanel
                markingMode={markingMode}
                selectedElementType={selectedElementType}
                selectedPinId={selectedPinId}
                pins={outdoorElementPins}
                onToggleMarking={() => {
                  setMarkingMode((value) => !value)
                  if (markingMode) setSelectedElementType(null)
                }}
                onSelectElementType={setSelectedElementType}
                onSelectPin={setSelectedPinId}
                onRemovePin={(pinId) => {
                  removeOutdoorElementPin(pinId)
                  if (selectedPinId === pinId) setSelectedPinId(null)
                }}
              />

              <div className="pointer-events-auto max-w-sm rounded-xl border border-slate-700/80 bg-slate-950/90 px-3 py-2 text-xs text-slate-200 shadow-lg backdrop-blur">
                <p className="font-medium text-white">Legend</p>
                <ul className="mt-1.5 space-y-1">
                  <li className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-teal-600 ring-2 ring-white" />
                    School location
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-white" />
                    Your location
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
                    Reference assets
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-fuchsia-500 ring-2 ring-white" />
                    Your placed pins
                  </li>
                </ul>
                <p className="mt-2 text-slate-400">
                  {assetsLoading
                    ? "Loading reference assets…"
                    : assetsError
                      ? assetsError
                      : assetCount > 0
                        ? `${assetCount} reference asset${assetCount === 1 ? "" : "s"} for this campus`
                        : "No reference assets loaded yet for this campus"}
                </p>
                {geoStatus === "denied" && (
                  <p className="mt-1 text-amber-300">Location access denied — enable it to see your position.</p>
                )}
                {geoStatus === "unavailable" && (
                  <p className="mt-1 text-amber-300">Geolocation is not available in this browser.</p>
                )}
              </div>
            </div>

            <div className="pointer-events-auto flex gap-2 self-end">
              <button
                type="button"
                onClick={centerOnSchool}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/95 px-3 text-xs font-medium text-white shadow-lg backdrop-blur active:bg-slate-800"
              >
                <MapPin className="h-4 w-4" />
                School
              </button>
              <button
                type="button"
                onClick={centerOnUser}
                disabled={!userCoords}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/95 px-3 text-xs font-medium text-white shadow-lg backdrop-blur active:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LocateFixed className="h-4 w-4" />
                Me
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-3 text-xs font-semibold text-white shadow-lg active:opacity-90"
              >
                <Crosshair className="h-4 w-4" />
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
