"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, ChevronUp, Crosshair, LocateFixed, MapPin, Trash2, X } from "lucide-react"
import type { Feature, FeatureCollection } from "geojson"
import type { AisdSchoolOption } from "@aisd/shared"
import {
  loadOutdoorAssetsGeoJSON,
  outdoorAssetLegendItems,
  outdoorAssetPopupHtml,
  outdoorAssetsForSchool,
  type OutdoorAssetLegendItem,
} from "@/lib/outdoor-assets"
import {
  OUTDOOR_ELEMENT_TYPE_OPTIONS,
  outdoorElementPinLabel,
  outdoorElementPinsToGeoJSON,
  outdoorElementTypeOption,
} from "@/lib/outdoor-element-types"
import OutdoorElementPinPanel from "@/components/outdoor-element-pin-panel"
import { useSurvey } from "@/lib/survey-store"
import { cn } from "@/lib/utils"
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

function OutdoorMapLegendContent({
  assetLegend,
  assetCount,
  assetsLoading,
  assetsError,
  geoStatus,
  compact = false,
}: {
  assetLegend: OutdoorAssetLegendItem[]
  assetCount: number
  assetsLoading: boolean
  assetsError: string | null
  geoStatus: "idle" | "active" | "denied" | "unavailable"
  compact?: boolean
}) {
  return (
    <>
      <ul className={cn("space-y-1", compact ? "text-[11px]" : "mt-1.5")}>
        <li className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-teal-600 ring-2 ring-white" />
          School location
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-white" />
          Your location
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-fuchsia-500 ring-2 ring-white" />
          Your placed pins
        </li>
      </ul>
      {assetLegend.length > 0 && (
        <div
          className={cn(
            "space-y-1 overflow-y-auto border-t pt-2",
            compact ? "mt-2 max-h-28 border-slate-100" : "mt-2 max-h-36 border-slate-700/80",
          )}
        >
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wide",
              compact ? "text-slate-400" : "text-slate-400",
            )}
          >
            Reference assets
          </p>
          {assetLegend.map((item) => (
            <div key={item.category} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate">{item.category}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-400">{item.count}</span>
            </div>
          ))}
        </div>
      )}
      <p className={cn("text-slate-400", compact ? "mt-2 text-[11px]" : "mt-2")}>
        {assetsLoading
          ? "Loading reference assets…"
          : assetsError
            ? assetsError
            : assetCount > 0
              ? `${assetCount} mapped asset${assetCount === 1 ? "" : "s"} for this campus`
              : "No mapped assets for this campus yet"}
      </p>
      {geoStatus === "denied" && (
        <p className={cn("text-amber-600", compact ? "mt-1 text-[11px]" : "mt-1 text-amber-300")}>
          Location access denied — enable it to see your position.
        </p>
      )}
      {geoStatus === "unavailable" && (
        <p className={cn("text-amber-600", compact ? "mt-1 text-[11px]" : "mt-1 text-amber-300")}>
          Geolocation is not available in this browser.
        </p>
      )}
    </>
  )
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
  const [assetLegend, setAssetLegend] = useState<OutdoorAssetLegendItem[]>([])
  const [geoStatus, setGeoStatus] = useState<"idle" | "active" | "denied" | "unavailable">("idle")
  const [userCoords, setUserCoords] = useState<{ lng: number; lat: number } | null>(null)
  const [markingMode, setMarkingMode] = useState(true)
  const [selectedElementType, setSelectedElementType] = useState<string | null>(null)
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)
  const [mobilePickerExpanded, setMobilePickerExpanded] = useState(false)

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
      setAssetLegend([])
      setMobilePickerExpanded(false)
    }
  }, [open])

  useEffect(() => {
    if (selectedElementType) setMobilePickerExpanded(false)
  }, [selectedElementType])

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
            "circle-radius": 9,
            "circle-color": ["coalesce", ["get", "color"], "#f59e0b"],
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
            .setHTML(outdoorAssetPopupHtml(feature))
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
        setAssetLegend(outdoorAssetLegendItems(schoolAssets))

        const source = mapRef.current?.getSource(OUTDOOR_SOURCE_ID) as import("mapbox-gl").GeoJSONSource | undefined
        source?.setData(schoolAssets)
        fitToAssetsAndSchool(schoolAssets)
      } catch (error) {
        if (!cancelled) {
          setAssetsError(error instanceof Error ? error.message : "Could not load outdoor assets")
          setAssetCount(0)
          setAssetLegend([])
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
  const selectedOption = selectedElementType
    ? outdoorElementTypeOption(selectedElementType)
    : undefined
  const selectedPin = selectedPinId
    ? outdoorElementPins.find((entry) => entry.id === selectedPinId)
    : undefined

  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col bg-slate-950">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-950/95 px-3 py-2 text-white backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 2xl:block">
            Outdoor elements map
          </p>
          <h2 id={titleId} className="truncate text-sm font-semibold">
            {school.displayName || school.name}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1 2xl:hidden">
          <button
            type="button"
            onClick={centerOnSchool}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
            aria-label="Center on school"
          >
            <MapPin className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={centerOnUser}
            disabled={!userCoords}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800 disabled:opacity-40"
            aria-label="Center on my location"
          >
            <LocateFixed className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white active:opacity-90"
          >
            Done
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-300 active:bg-slate-800 2xl:flex"
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
          <div className="absolute inset-0 pb-16 2xl:pb-0">
            <div
              ref={mapContainerCallbackRef}
              className="absolute inset-0 h-full w-full [&_.mapboxgl-ctrl-top-right]:hidden 2xl:[&_.mapboxgl-ctrl-top-right]:block [&_.mapboxgl-map]:h-full [&_.mapboxgl-map]:w-full"
              role="presentation"
              aria-hidden
            />
          </div>

          {mapError && (
            <div className="pointer-events-none absolute inset-x-3 top-3 rounded-xl border border-amber-500/40 bg-amber-950/90 px-3 py-2 text-xs text-amber-100 shadow-lg">
              {mapError}
            </div>
          )}

          {/* Desktop: floating panels */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden flex-col gap-2 p-3 2xl:flex 2xl:flex-row 2xl:items-end 2xl:justify-between">
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
                <OutdoorMapLegendContent
                  assetLegend={assetLegend}
                  assetCount={assetCount}
                  assetsLoading={assetsLoading}
                  assetsError={assetsError}
                  geoStatus={geoStatus}
                />
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

          {/* Mobile: bottom sheet — element type picker + legend */}
          {!selectedPinId && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 2xl:hidden">
              {mobilePickerExpanded && (
                <button
                  type="button"
                  className="pointer-events-auto fixed inset-0 bg-slate-900/40"
                  onClick={() => setMobilePickerExpanded(false)}
                  aria-label="Close element picker"
                />
              )}
              <div
                className={cn(
                  "pointer-events-auto relative flex flex-col overflow-hidden rounded-t-2xl border border-b-0 border-slate-200/80 bg-white shadow-2xl transition-[max-height] duration-200",
                  mobilePickerExpanded ? "max-h-[min(62vh,30rem)]" : "max-h-[3.75rem]",
                )}
              >
                <button
                  type="button"
                  onClick={() => setMobilePickerExpanded((expanded) => !expanded)}
                  className="flex shrink-0 items-center gap-2 px-3 py-3 text-left active:bg-slate-50"
                  aria-expanded={mobilePickerExpanded}
                >
                  {selectedOption ? (
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: selectedOption.color }}
                      aria-hidden
                    />
                  ) : (
                    <span className="inline-block h-3 w-3 shrink-0 rounded-sm bg-slate-200" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {selectedOption?.label ?? "Choose element to place"}
                    </span>
                    <span className="block truncate text-[10px] text-slate-500">
                      {outdoorElementPins.length} placed · {assetCount} reference asset
                      {assetCount === 1 ? "" : "s"}
                    </span>
                  </span>
                  {mobilePickerExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  ) : (
                    <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  )}
                </button>
                {mobilePickerExpanded && (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-slate-100">
                    <div className="shrink-0 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                        Outdoor elements
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                        Pick an element, then tap the map where it is located.
                      </p>
                      {selectedOption && (
                        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
                          Tap the map to place{" "}
                          <strong className="font-semibold">{selectedOption.label}</strong>
                          {!selectedOption.allowMultiple ? " (replaces any existing pin)" : ""}.
                        </p>
                      )}
                    </div>
                    <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-1">
                      {OUTDOOR_ELEMENT_TYPE_OPTIONS.map((option) => {
                        const placed = outdoorElementPins.filter(
                          (pin) => pin.elementType === option.id,
                        )
                        const active = selectedElementType === option.id
                        return (
                          <li key={option.id}>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedElementType(active ? null : option.id)
                              }
                              className={cn(
                                "mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                                active
                                  ? "bg-slate-900 text-white shadow-sm"
                                  : "text-slate-800 active:bg-slate-50",
                              )}
                            >
                              <span
                                className="inline-block h-3 w-3 shrink-0 rounded-sm"
                                style={{ backgroundColor: option.color }}
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1 truncate font-medium">
                                {option.label}
                              </span>
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                  active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600",
                                )}
                              >
                                {placed.length}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                    <div className="shrink-0 border-t border-slate-100 px-3 py-2 text-xs text-slate-600">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                        Legend
                      </p>
                      <OutdoorMapLegendContent
                        assetLegend={assetLegend}
                        assetCount={assetCount}
                        assetsLoading={assetsLoading}
                        assetsError={assetsError}
                        geoStatus={geoStatus}
                        compact
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mobile: bottom sheet — placed pin details */}
          {selectedPinId && selectedPin && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 2xl:hidden">
              <div className="pointer-events-auto flex max-h-[min(40vh,16rem)] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-slate-200/80 bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-100 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                      Placed element
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                      {outdoorElementPinLabel(selectedPin, outdoorElementPins)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPinId(null)}
                    className="rounded-lg p-1 text-slate-400 active:bg-slate-100"
                    aria-label="Deselect pin"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex gap-2 px-3 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      removeOutdoorElementPin(selectedPin.id)
                      setSelectedPinId(null)
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 active:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove pin
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>,
    document.body,
  )
}
