"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Maximize2, Minimize2, Scan, ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import { useSelectRoomWithConfirm } from "@/components/use-select-room-with-confirm"
import { overlayPointsForRoom, viewBoxString, type ParsedPlanRoom } from "@aisd/shared"
import { getRoomSurveyProgress, ROOM_PROGRESS_FILL } from "@/lib/room-survey-progress"
import {
  loadRoomNeighborhoodMap,
  loadRoomSizeDeviationMap,
  loadRoomUseMap,
  neighborhoodFillColor,
  neighborhoodForRoom,
  neighborhoodLegendColors,
  roomUseForRoom,
  sizeDeviationFillColor,
  sizeDeviationForRoom,
  SIZE_DEVIATION_LEGEND,
  type RoomNeighborhoodMap,
  type RoomSizeDeviationMap,
  type RoomUseEntry,
  type RoomUseMap,
  type SizeDeviationBand,
} from "@/lib/room-neighborhood-lookup"
import {
  resolveRoomUseLabelLayout,
  roomLabelBounds,
  ROOM_LABEL_FILL,
  ROOM_LABEL_STROKE,
} from "@/lib/room-plan-labels"
import { programTypeFillColor, programTypeLegendColors } from "@/lib/program-type-colors"
import NeighborhoodLegend from "@/components/neighborhood-legend"
import { cn, scoreFillRgba, scoreStrokeRgba } from "@/lib/utils"
import type { CloseOutRoomFloorPlanEntry } from "@/lib/closeout-floor-plan"
import {
  floorPlanSvgDataUrl,
  floorPlanSvgInlineFragment,
  getFloorPlanDisplayFilename,
  getFloorPlanDisplaySvg,
  isInlineFloorPlanSrc,
} from "@/lib/floor-plan-loader"
import { preferMobileFloorPlan } from "@/lib/floor-plans"
import { neighborhoodGroupId, NEIGHBORHOOD_OPTIONS } from "@aisd/shared"

function colorWithAlpha(color: string, alpha: number): string {
  if (color.startsWith("#") && (color.length === 7 || color.length === 4)) {
    const hex =
      color.length === 4
        ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
        : color
    const r = Number.parseInt(hex.slice(1, 3), 16)
    const g = Number.parseInt(hex.slice(3, 5), 16)
    const b = Number.parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return color
}

const PAN_THRESHOLD_PX = 6
const MIN_ZOOM = 0.75
const MAX_ZOOM = 10
const DEFAULT_ZOOM = 1
const ZOOM_BUTTON_STEP = 0.5

function isFloorPlanRoomPointerTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest("[data-floor-plan-room]")
}

function clampZoom(value: number, min: number = MIN_ZOOM): number {
  return Math.min(MAX_ZOOM, Math.max(min, value))
}

/** Screen pixels → SVG units for a viewBox fitted with preserveAspectRatio meet. */
function svgMeetScale(
  viewBox: { w: number; h: number },
  viewport: { width: number; height: number },
): number {
  if (viewport.width <= 0 || viewport.height <= 0) return 1
  return Math.min(viewport.width / viewBox.w, viewport.height / viewBox.h)
}

function floorPlanSceneTransform(
  viewBox: { x: number; y: number; w: number; h: number },
  pan: { x: number; y: number },
  zoom: number,
  rotation: number,
  viewport: { width: number; height: number },
): string {
  const meet = svgMeetScale(viewBox, viewport)
  const panSvgX = pan.x / meet
  const panSvgY = pan.y / meet
  const cx = viewBox.x + viewBox.w / 2
  const cy = viewBox.y + viewBox.h / 2
  return `translate(${panSvgX} ${panSvgY}) translate(${cx} ${cy}) rotate(${rotation}) scale(${zoom}) translate(${-cx} ${-cy})`
}

function pointerDistance(pointers: Map<number, { x: number; y: number }>): number {
  const pts = [...pointers.values()]
  if (pts.length < 2) return 0
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
}

function touchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.hypot(dx, dy)
}

function photoRoomIdsHas(photoRoomIds: ReadonlySet<string> | undefined, roomId: string): boolean {
  if (!photoRoomIds?.size) return false
  if (photoRoomIds.has(roomId)) return true
  const upper = roomId.toUpperCase()
  for (const id of photoRoomIds) {
    if (id.toUpperCase() === upper) return true
  }
  return false
}

function roomHasPhotoMarker(
  room: { id: string; name?: string | null },
  photoRoomHasMarker?: (roomId: string, roomName?: string | null) => boolean,
  photoRoomIds?: ReadonlySet<string>,
): boolean {
  if (photoRoomHasMarker) return photoRoomHasMarker(room.id, room.name)
  return photoRoomIdsHas(photoRoomIds, room.id)
}

function photoRoomSelectionMatches(
  room: { id: string; name?: string | null },
  selectedPhotoRoomId: string | null | undefined,
  selectedPhotoRoomMatchesPlan?: (roomId: string, roomName?: string | null) => boolean,
): boolean {
  if (selectedPhotoRoomMatchesPlan) {
    return selectedPhotoRoomMatchesPlan(room.id, room.name)
  }
  return selectedPhotoRoomId?.toUpperCase() === room.id.toUpperCase()
}

function photoMarkerLayout(
  room: ParsedPlanRoom,
  viewBoxArea: number,
  viewBoxWidth: number,
  photoGalleryMode: boolean,
) {
  const areaRatio = Math.sqrt(Math.max(room.area, 1) / Math.max(viewBoxArea, 1))
  const photoMarkerScale = Math.max(
    0.75,
    Math.min(1.5, areaRatio * (photoGalleryMode ? 10 : 8)),
  )
  const sizeBoost = photoGalleryMode ? 1.2 : 1
  const baseR = 22 * photoMarkerScale * sizeBoost
  // Large CAFM plans (e.g. Casis ~10k viewBox) need a floor tied to plan width — otherwise
  // ~20 unit circles shrink to sub-pixel icons on screen.
  const minR = viewBoxWidth * (photoGalleryMode ? 0.022 : 0.014)
  const r = Math.max(baseR, minR)
  return {
    scale: photoMarkerScale,
    r,
    stroke: Math.max(5 * photoMarkerScale, r * 0.12),
    offset: r * 1.35,
  }
}

export default function SurveyFloorPlan({
  readOnly = false,
  variant = "inline",
  panelVisible = true,
  onRoomSelect,
  onClose,
  preWalkMappings,
  preWalkActiveSpaceType,
  preWalkSelectedRoomId,
  preWalkSpaceTypeColor,
  onPreWalkRoomTap,
  expanded: expandedProp,
  onExpandedChange,
  startExpanded = false,
  resultsScoreMode,
  roomScoreById,
  neighborhoodScoreById,
  photoRoomIds,
  photoRoomHasMarker,
  selectedPhotoRoomId,
  selectedPhotoRoomMatchesPlan,
  onPhotoRoomSelect,
  photoGalleryMode = false,
  closeOutMode = false,
  closeOutProgressByRoomId,
  onRequestSelectRoom,
}: {
  readOnly?: boolean
  variant?: "inline" | "picker" | "prewalk"
  panelVisible?: boolean
  onRoomSelect?: () => void
  onClose?: () => void
  preWalkMappings?: Record<string, { spaceType: string }>
  preWalkActiveSpaceType?: string | null
  preWalkSelectedRoomId?: string | null
  preWalkSpaceTypeColor?: (spaceType: string) => string
  onPreWalkRoomTap?: (roomId: string) => void
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  /** Picker only: open in the larger expanded view when first shown. */
  startExpanded?: boolean
  /** Results view: color rooms by assessment score instead of neighborhood identity. */
  resultsScoreMode?: "room" | "neighborhood"
  roomScoreById?: Record<string, number | null>
  neighborhoodScoreById?: Record<string, number | null>
  /** Results photos tab: rooms that have submitted photos (camera marker + tap to select). */
  photoRoomIds?: ReadonlySet<string>
  /** Preferred: resolve index/plan room id differences when marking photo rooms. */
  photoRoomHasMarker?: (roomId: string, roomName?: string | null) => boolean
  selectedPhotoRoomId?: string | null
  /** Whether the selected gallery room matches this plan room (index id vs plan id). */
  selectedPhotoRoomMatchesPlan?: (roomId: string, roomName?: string | null) => boolean
  onPhotoRoomSelect?: (roomId: string) => void
  /** Results photos tab: floor toggles only, clean plan, camera icons on photo rooms. */
  photoGalleryMode?: boolean
  /** Close Out: show % complete by room; uses lighter mobile SVG when available. */
  closeOutMode?: boolean
  closeOutProgressByRoomId?: Record<string, CloseOutRoomFloorPlanEntry>
  /** When set, room taps use this handler (dialog can live in a parent that outlives the map). */
  onRequestSelectRoom?: (roomId: string) => void
}) {
  const { state, setLevel, levelRooms, ensureFloorPlanLevel, floorPlanDisplayLoading } = useSurvey()
  const internalSelect = useSelectRoomWithConfirm()
  const requestSelectRoom = internalSelect.requestSelectRoom
  const completedRoomDialog = onRequestSelectRoom ? null : internalSelect.completedRoomDialog
  const viewportRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(DEFAULT_ZOOM)
  const panRef = useRef({ x: 0, y: 0 })
  const [zoom, setZoomState] = useState(DEFAULT_ZOOM)
  const [pan, setPanState] = useState({ x: 0, y: 0 })
  const [rotation, setRotation] = useState(0)
  const mobileTouchDevice = preferMobileFloorPlan()
  const [showNeighborhoods, setShowNeighborhoods] = useState(
    () => !closeOutMode && !(variant === "picker" && preferMobileFloorPlan()),
  )
  const [showSizeDeviation, setShowSizeDeviation] = useState(false)
  const [showRoomUse, setShowRoomUse] = useState(false)
  const [showRoomTags, setShowRoomTags] = useState(false)
  const [roomUseMap, setRoomUseMap] = useState<RoomUseMap>(new Map())
  const [neighborhoodMap, setNeighborhoodMap] = useState<RoomNeighborhoodMap>(new Map())
  const [sizeDeviationMap, setSizeDeviationMap] = useState<RoomSizeDeviationMap>(new Map())
  const [isPanning, setIsPanning] = useState(false)
  const [internalExpanded, setInternalExpanded] = useState(false)
  const expanded = expandedProp ?? internalExpanded
  const setExpanded = onExpandedChange ?? setInternalExpanded
  const canExpand = variant === "picker" || variant === "inline"
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const activePointerId = useRef<number | null>(null)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null)
  const didPanRef = useRef(false)
  const isPanningRef = useRef(false)
  const touchPinchActiveRef = useRef(false)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    isPanningRef.current = isPanning
  }, [isPanning])

  const setZoom = useCallback((value: number | ((prev: number) => number)) => {
    setZoomState((prev) => {
      const next = typeof value === "function" ? value(prev) : value
      const clamped = clampZoom(next)
      zoomRef.current = clamped
      return clamped
    })
  }, [])

  const setPan = useCallback((value: { x: number; y: number }) => {
    panRef.current = value
    setPanState(value)
  }, [])

  const plan = state.floorPlan
  const levelId = state.selectedLevelId ?? plan?.defaultLevelId ?? "floor-1"
  const level = plan?.levels.find((l) => l.id === levelId)

  // WebKit/iOS: render via data-URL <image> (blob: breaks; inline markup leaks CSS onto overlays).
  const webKitPlanImageUrl = useMemo(() => {
    if (!state.school || !levelId || !isInlineFloorPlanSrc(level?.src)) return null
    const svgText = getFloorPlanDisplaySvg(state.school.id, levelId)
    return svgText ? floorPlanSvgDataUrl(svgText) : null
  }, [state.school?.id, levelId, level?.src])

  const planImageHref = webKitPlanImageUrl ?? level?.src ?? ""

  const planInlineMarkup = useMemo(() => {
    if (!state.school || !levelId) return null
    const svgText = getFloorPlanDisplaySvg(state.school.id, levelId)
    if (!svgText) return null
    return floorPlanSvgInlineFragment(svgText)
  }, [state.school?.id, levelId, webKitPlanImageUrl])

  const planBackdropReady =
    Boolean(level?.src) &&
    (!isInlineFloorPlanSrc(level?.src) || Boolean(webKitPlanImageUrl))

  const displayFilename =
    state.school && levelId ? getFloorPlanDisplayFilename(state.school.id, levelId) : null

  useEffect(() => {
    if (!levelId || !plan || !state.school) return
    if (planBackdropReady) return
    void ensureFloorPlanLevel(levelId)
  }, [
    levelId,
    plan,
    state.school,
    planBackdropReady,
    ensureFloorPlanLevel,
  ])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const updateSize = () => {
      setViewportSize({ width: el.clientWidth, height: el.clientHeight })
    }
    updateSize()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize)
      return () => window.removeEventListener("resize", updateSize)
    }

    const observer = new ResizeObserver(updateSize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [levelId, expanded, panelVisible, variant])

  const handleRoomSelect = useCallback(
    (roomId: string) => {
      if (
        onPhotoRoomSelect &&
        roomHasPhotoMarker({ id: roomId }, photoRoomHasMarker, photoRoomIds)
      ) {
        onPhotoRoomSelect(roomId)
        return
      }
      if (readOnly) return
      if (onPreWalkRoomTap) {
        onPreWalkRoomTap(roomId)
        return
      }
      if (onRequestSelectRoom) {
        onRequestSelectRoom(roomId)
        return
      }
      requestSelectRoom(roomId, { afterSelect: onRoomSelect })
    },
    [
      readOnly,
      onPhotoRoomSelect,
      photoRoomHasMarker,
      photoRoomIds,
      onPreWalkRoomTap,
      onRequestSelectRoom,
      requestSelectRoom,
      onRoomSelect,
    ],
  )

  const rotateView = useCallback(() => {
    setRotation((prev) => (prev + 270) % 360)
  }, [])

  const resetPointerState = useCallback(() => {
    pointersRef.current.clear()
    pinchRef.current = null
    activePointerId.current = null
    didPanRef.current = false
    setIsPanning(false)
  }, [])

  const resetViewToExtent = useCallback(() => {
    setZoom(DEFAULT_ZOOM)
    setPan({ x: 0, y: 0 })
    setRotation(0)
    resetPointerState()
  }, [setZoom, setPan, resetPointerState])

  useEffect(() => {
    if (photoGalleryMode || !state.school) {
      if (!photoGalleryMode) {
        setRoomUseMap(new Map())
        setNeighborhoodMap(new Map())
        setSizeDeviationMap(new Map())
      }
      return
    }
    const needsSheetLookups =
      showNeighborhoods || showRoomUse || showSizeDeviation || variant === "prewalk" || resultsScoreMode
    if (mobileTouchDevice && variant === "picker" && !needsSheetLookups) {
      setRoomUseMap(new Map())
      setNeighborhoodMap(new Map())
      setSizeDeviationMap(new Map())
      return
    }
    let cancelled = false
    void (async () => {
      const [useMap, nbhMap, deviationMap] = await Promise.all([
        loadRoomUseMap(state.school),
        loadRoomNeighborhoodMap(state.school),
        loadRoomSizeDeviationMap(state.school),
      ])
      if (cancelled) return
      setRoomUseMap(useMap)
      setNeighborhoodMap(nbhMap)
      setSizeDeviationMap(deviationMap)
    })()
    return () => {
      cancelled = true
    }
  }, [
    photoGalleryMode,
    state.school?.id,
    state.school?.name,
    mobileTouchDevice,
    variant,
    showNeighborhoods,
    showRoomUse,
    showSizeDeviation,
    resultsScoreMode,
  ])

  useEffect(() => {
    if (photoGalleryMode) {
      setShowNeighborhoods(false)
      setShowRoomUse(false)
      setShowRoomTags(false)
      setShowSizeDeviation(false)
    }
  }, [photoGalleryMode])

  useEffect(() => {
    if (closeOutMode) setShowNeighborhoods(false)
  }, [closeOutMode])

  useEffect(() => {
    if (resultsScoreMode) setShowNeighborhoods(false)
  }, [resultsScoreMode])

  useEffect(() => {
    if (variant === "picker" && !panelVisible) return
    setZoom(DEFAULT_ZOOM)
    setPan({ x: 0, y: 0 })
    setRotation(0)
    pointersRef.current.clear()
    pinchRef.current = null
    touchPinchActiveRef.current = false
    didPanRef.current = false
  }, [variant, panelVisible, levelId, readOnly, setZoom, setPan])

  useEffect(() => {
    if (panelVisible === false) {
      setExpanded(false)
      return
    }
    if (variant === "picker" && startExpanded) {
      setExpanded(true)
    }
  }, [variant, panelVisible, startExpanded, setExpanded])

  useEffect(() => {
    if (!expanded) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [expanded, setExpanded])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const factor = Math.exp(-e.deltaY * 0.003)
      setZoom((z) => clampZoom(z * factor))
    }

    const onPointerDown = (e: PointerEvent) => {
      if (isFloorPlanRoomPointerTarget(e.target)) return
      if (e.pointerType === "mouse" && e.button !== 0) return

      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      didPanRef.current = false

      if (pointersRef.current.size === 2) {
        pinchRef.current = { dist: pointerDistance(pointersRef.current), zoom: zoomRef.current }
        activePointerId.current = null
        isPanningRef.current = false
        setIsPanning(false)
        return
      }

      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
      }
      activePointerId.current = e.pointerId
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!pointersRef.current.has(e.pointerId)) return

      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (
        !touchPinchActiveRef.current &&
        pointersRef.current.size >= 2 &&
        pinchRef.current &&
        pinchRef.current.dist > 0
      ) {
        e.preventDefault()
        didPanRef.current = true
        try {
          el.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        const dist = pointerDistance(pointersRef.current)
        setZoom(clampZoom(pinchRef.current.zoom * (dist / pinchRef.current.dist)))
        return
      }

      if (activePointerId.current !== e.pointerId) return

      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y

      if (!isPanningRef.current) {
        if (Math.hypot(dx, dy) < PAN_THRESHOLD_PX) return
        isPanningRef.current = true
        setIsPanning(true)
        didPanRef.current = true
        try {
          el.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }

      setPan({
        x: panStart.current.panX + dx,
        y: panStart.current.panY + dy,
      })
    }

    const onPointerUp = (e: PointerEvent) => {
      if (isFloorPlanRoomPointerTarget(e.target)) return
      pointersRef.current.delete(e.pointerId)
      if (pointersRef.current.size < 2) pinchRef.current = null
      if (activePointerId.current === e.pointerId) activePointerId.current = null
      isPanningRef.current = false
      setIsPanning(false)
      didPanRef.current = false
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    }

    let touchPinch: { dist: number; zoom: number } | null = null

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length < 2) return
      e.preventDefault()
      touchPinchActiveRef.current = true
      touchPinch = { dist: touchDistance(e.touches), zoom: zoomRef.current }
      pinchRef.current = touchPinch
      activePointerId.current = null
      isPanningRef.current = false
      setIsPanning(false)
      pointersRef.current.clear()
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length < 2 || !touchPinch || touchPinch.dist <= 0) return
      e.preventDefault()
      const dist = touchDistance(e.touches)
      setZoom(clampZoom(touchPinch.zoom * (dist / touchPinch.dist)))
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length >= 2) return
      touchPinch = null
      touchPinchActiveRef.current = false
      pinchRef.current = null
    }

    el.addEventListener("wheel", onWheel, { passive: false, capture: true })
    el.addEventListener("pointerdown", onPointerDown, { capture: true })
    el.addEventListener("pointermove", onPointerMove, { capture: true, passive: false })
    el.addEventListener("pointerup", onPointerUp, { capture: true })
    el.addEventListener("pointercancel", onPointerUp, { capture: true })
    el.addEventListener("touchstart", onTouchStart, { capture: true, passive: false })
    el.addEventListener("touchmove", onTouchMove, { capture: true, passive: false })
    el.addEventListener("touchend", onTouchEnd, { capture: true })
    el.addEventListener("touchcancel", onTouchEnd, { capture: true })

    return () => {
      el.removeEventListener("wheel", onWheel, { capture: true })
      el.removeEventListener("pointerdown", onPointerDown, { capture: true })
      el.removeEventListener("pointermove", onPointerMove, { capture: true })
      el.removeEventListener("pointerup", onPointerUp, { capture: true })
      el.removeEventListener("pointercancel", onPointerUp, { capture: true })
      el.removeEventListener("touchstart", onTouchStart, { capture: true })
      el.removeEventListener("touchmove", onTouchMove, { capture: true })
      el.removeEventListener("touchend", onTouchEnd, { capture: true })
      el.removeEventListener("touchcancel", onTouchEnd, { capture: true })
    }
  }, [setZoom, setPan, panelVisible, levelId, state.school?.id])

  const resolveRoomNeighborhood = useCallback(
    (room: ParsedPlanRoom): string | undefined =>
      room.neighborhood ??
      neighborhoodForRoom(neighborhoodMap, room.id, room.levelId, room.name),
    [neighborhoodMap],
  )

  const hasRoomUseColors = useMemo(
    () =>
      levelRooms.some((room) => {
        const entry = roomUseForRoom(roomUseMap, room.id, room.name)
        return Boolean(entry?.programType)
      }),
    [levelRooms, roomUseMap],
  )

  const hasRoomTags = useMemo(
    () =>
      roomUseMap.size > 0 ||
      levelRooms.some((room) => {
        const entry = roomUseForRoom(roomUseMap, room.id, room.name)
        return Boolean(entry?.useName || entry?.id)
      }),
    [levelRooms, roomUseMap],
  )

  const hasNeighborhoodLabels = useMemo(
    () =>
      neighborhoodMap.size > 0 ||
      levelRooms.some((room) => Boolean(resolveRoomNeighborhood(room))),
    [levelRooms, neighborhoodMap, resolveRoomNeighborhood],
  )

  const hasSizeDeviationColors = useMemo(
    () =>
      sizeDeviationMap.size > 0 ||
      levelRooms.some((room) =>
        Boolean(sizeDeviationForRoom(sizeDeviationMap, room.id, room.name)),
      ),
    [levelRooms, sizeDeviationMap],
  )

  const resolveAssessmentScore = useCallback(
    (room: ParsedPlanRoom): number | null => {
      if (!resultsScoreMode) return null
      if (resultsScoreMode === "room") {
        return roomScoreById?.[room.id] ?? null
      }
      const neighborhood = resolveRoomNeighborhood(room)
      return neighborhoodScoreById?.[neighborhoodGroupId(neighborhood, room.id)] ?? null
    },
    [resultsScoreMode, roomScoreById, neighborhoodScoreById, resolveRoomNeighborhood],
  )

  const scoreLegend = useMemo(
    () =>
      resultsScoreMode
        ? [
            { label: "Good (70%+)", color: scoreFillRgba(70, 1) },
            { label: "Fair (45–69%)", color: scoreFillRgba(45, 1) },
            { label: "Needs attention", color: scoreFillRgba(30, 1) },
            { label: "Not scored", color: scoreFillRgba(null, 1) },
          ]
        : [],
    [resultsScoreMode],
  )

  if (state.floorPlanLoading || floorPlanDisplayLoading || !planBackdropReady) {
    return (
      <div className="flex h-[min(42vh,360px)] items-center justify-center bg-white text-sm text-[var(--color-muted-foreground)] md:h-[min(50vh,420px)]">
        Loading floor plan…
      </div>
    )
  }

  if (!plan || !level) return null

  const vb = level.viewBox
  const vbStr = viewBoxString(vb)
  const viewBoxArea = vb.w * vb.h
  const meetScale = svgMeetScale(vb, viewportSize)
  const sceneTransform = floorPlanSceneTransform(vb, pan, zoom, rotation, viewportSize)
  const levelNeighborhoodLabels = levelRooms
    .map((room) => resolveRoomNeighborhood(room))
    .filter((n): n is string => Boolean(n))
  const neighborhoodLegend = neighborhoodLegendColors(
    levelNeighborhoodLabels.length > 0
      ? levelNeighborhoodLabels
      : neighborhoodMap.size > 0
        ? [...new Set(neighborhoodMap.values())]
        : variant === "picker" || variant === "prewalk"
          ? [...NEIGHBORHOOD_OPTIONS]
          : [],
  )
  const programTypeLegend = programTypeLegendColors(
    levelRooms
      .map((room) => roomUseForRoom(roomUseMap, room.id, room.name)?.programType)
      .filter((t): t is string => Boolean(t)),
  )

  const visibleLevelRooms = levelRooms.filter((room) => {
    if (room.points.length < 3) return false
    if (closeOutMode && closeOutProgressByRoomId) {
      return !!closeOutProgressByRoomId[room.id]
    }
    return true
  })

  const isPreWalk = variant === "prewalk"
  const isPicker = variant === "picker"
  const viewportHeightClass =
    isPicker || variant === "inline"
      ? expanded
        ? "min-h-0 flex-1"
        : isPicker
          ? "h-[220px] sm:h-[260px]"
          : "h-[min(42vh,360px)] md:h-[min(50vh,420px)]"
      : isPreWalk
        ? "absolute inset-0 h-full"
        : "h-[min(42vh,360px)] md:h-[min(50vh,420px)]"

  const planPanel = (
    <div
      className={cn(
        "relative flex flex-col bg-white",
        isPreWalk && "h-full min-h-0",
        canExpand && expanded && "h-full min-h-0",
        isPicker &&
          !expanded &&
          "mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(15,23,42,0.06)]",
      )}
    >
      {completedRoomDialog}
      <div
        className={cn(
          "flex gap-1 px-2 py-1.5",
          photoGalleryMode
            ? "flex-wrap items-center border-b border-[var(--color-border)] bg-white"
            : isPreWalk
            ? "pointer-events-auto absolute left-2 right-2 top-2 z-20 flex-col rounded-xl border border-slate-200/80 bg-white/95 shadow-md backdrop-blur-sm 2xl:flex-row 2xl:flex-wrap 2xl:items-center 2xl:left-[min(19rem,calc(100vw-2rem))] 2xl:right-2"
            : "flex-wrap items-center border-b border-[var(--color-border)] bg-white",
        )}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {!isPreWalk && (
          <div className={cn("flex gap-1 overflow-x-auto scrollbar-none", photoGalleryMode ? "w-full" : "flex-1")}>
            {plan.levels.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLevel(l.id)}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium",
                  l.id === levelId
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
        {!photoGalleryMode && !closeOutMode && (
        <div
          className={cn(
            "flex items-center gap-0.5",
            isPreWalk
              ? "w-full min-w-0 flex-col gap-1 2xl:ml-auto 2xl:w-auto 2xl:flex-row 2xl:flex-wrap"
              : "shrink-0 flex-wrap",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-0.5",
              isPreWalk ? "min-w-0 w-full overflow-x-auto scrollbar-none 2xl:w-auto 2xl:overflow-visible" : "contents",
            )}
          >
          <button
            type="button"
            onClick={() => setShowRoomUse((v) => !v)}
            aria-pressed={showRoomUse}
            disabled={!hasRoomUseColors}
            title={
              hasRoomUseColors
                ? showRoomUse
                  ? "Hide program type colors"
                  : "Show program type colors"
                : `${state.school?.name ?? "This school"} has no Program Type values in the live sheet`
            }
            className={cn(
              "mr-0.5 shrink-0 rounded-md px-2 py-1.5 text-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-40",
              showRoomUse
                ? "bg-slate-800 text-white"
                : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
            )}
          >
            Room use
          </button>
          <button
            type="button"
            onClick={() => setShowRoomTags((v) => !v)}
            aria-pressed={showRoomTags}
            disabled={!hasRoomTags}
            title={
              hasRoomTags
                ? showRoomTags
                  ? "Hide room tags"
                  : "Show room tags"
                : `${state.school?.name ?? "This school"} is not in the live room lookup sheet yet`
            }
            className={cn(
              "mr-0.5 shrink-0 rounded-md px-2 py-1.5 text-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-40",
              showRoomTags
                ? "bg-slate-800 text-white"
                : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
            )}
          >
            Room tags
          </button>
          <button
            type="button"
            onClick={() => setShowNeighborhoods((v) => !v)}
            aria-pressed={showNeighborhoods}
            disabled={!hasNeighborhoodLabels || !!resultsScoreMode}
            title={
              resultsScoreMode
                ? "Neighborhood identity colors are off while score colors are shown"
                : hasNeighborhoodLabels
                  ? showNeighborhoods
                    ? "Hide neighborhood colors"
                    : "Show neighborhood colors"
                  : `${state.school?.name ?? "This school"} has no neighborhood column values in the live sheet`
            }
            className={cn(
              "mr-0.5 shrink-0 rounded-md px-2 py-1.5 text-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-40",
              showNeighborhoods
                ? "bg-slate-800 text-white"
                : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
            )}
          >
            Neighborhoods
          </button>
          {isPreWalk && (
            <button
              type="button"
              onClick={() => setShowSizeDeviation((v) => !v)}
              aria-pressed={showSizeDeviation}
              disabled={!hasSizeDeviationColors}
              title={
                hasSizeDeviationColors
                  ? showSizeDeviation
                    ? "Hide size deviation colors"
                    : "Show size deviation colors from SF Deviation column"
                  : `${state.school?.name ?? "This school"} has no SF Deviation values in the live sheet`
              }
              className={cn(
                "mr-0.5 shrink-0 rounded-md px-2 py-1.5 text-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-40",
                showSizeDeviation
                  ? "bg-slate-800 text-white"
                  : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
              )}
            >
              Size deviation
            </button>
          )}
          </div>
          <div
            className={cn(
              "flex shrink-0 items-center justify-end gap-0.5",
              isPreWalk && "w-full 2xl:w-auto",
            )}
          >
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z + ZOOM_BUTTON_STEP))}
            className="flex h-9 w-8 items-center justify-center rounded-lg active:bg-slate-100"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z - ZOOM_BUTTON_STEP))}
            className="flex h-9 w-8 items-center justify-center rounded-lg active:bg-slate-100"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={resetViewToExtent}
            className="flex h-9 w-8 items-center justify-center rounded-lg active:bg-slate-100"
            aria-label="Show full floor plan"
            title="Show full floor plan"
          >
            <Scan className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={rotateView}
            className="flex h-9 w-8 items-center justify-center rounded-lg active:bg-slate-100"
            aria-label="Rotate floor plan 90 degrees"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          {canExpand && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex h-9 w-8 items-center justify-center rounded-lg active:bg-slate-100"
              aria-label={expanded ? "Minimize floor plan" : "Expand floor plan"}
              aria-pressed={expanded}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onClose()
              }}
              className="relative z-10 flex h-9 w-8 items-center justify-center rounded-lg active:bg-slate-100"
              aria-label="Close floor plan"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          </div>
        </div>
        )}
      </div>

      {!photoGalleryMode && isPicker && !resultsScoreMode && showNeighborhoods && neighborhoodLegend.length > 0 && (
        <NeighborhoodLegend items={neighborhoodLegend} />
      )}

      {!photoGalleryMode && isPreWalk && !resultsScoreMode && showNeighborhoods && neighborhoodLegend.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-20 hidden 2xl:absolute 2xl:left-[min(19rem,calc(100vw-2rem))] 2xl:right-3 2xl:block">
          <NeighborhoodLegend
            items={neighborhoodLegend}
            className="pointer-events-auto rounded-xl border border-slate-200/80 bg-white/95 shadow-md backdrop-blur-sm"
          />
        </div>
      )}

      {!photoGalleryMode && isPreWalk && !resultsScoreMode && showSizeDeviation && hasSizeDeviationColors && (
        <div
          className={cn(
            "pointer-events-none absolute left-3 right-3 z-20 hidden 2xl:absolute 2xl:left-[min(19rem,calc(100vw-2rem))] 2xl:right-3 2xl:block",
            showNeighborhoods && neighborhoodLegend.length > 0 ? "bottom-14 2xl:bottom-14" : "bottom-3",
          )}
        >
          <NeighborhoodLegend
            items={SIZE_DEVIATION_LEGEND}
            label="Size deviation"
            className="pointer-events-auto rounded-xl border border-slate-200/80 bg-white/95 shadow-md backdrop-blur-sm"
          />
        </div>
      )}

      <div
        ref={viewportRef}
        className={cn(
          "relative w-full overflow-hidden select-none bg-white",
          viewportHeightClass,
        )}
        style={{ touchAction: "none" }}
      >
        <svg
          viewBox={vbStr}
          preserveAspectRatio="xMidYMid meet"
          shapeRendering="geometricPrecision"
          textRendering="geometricPrecision"
          className={cn(
            "h-full w-full",
            isPanning ? "cursor-grabbing" : "cursor-grab",
          )}
        >
          <g transform={sceneTransform}>
            {planInlineMarkup ? (
              <g aria-hidden pointerEvents="none">
                {showRoomTags && !photoGalleryMode ? (
                  <style
                    dangerouslySetInnerHTML={{
                      __html:
                        "#CAFM_ID,#planLabels,#planBuildingLabels{display:none!important}",
                    }}
                  />
                ) : null}
                <g dangerouslySetInnerHTML={{ __html: planInlineMarkup }} />
              </g>
            ) : (
              <image
                href={planImageHref}
                x={vb.x}
                y={vb.y}
                width={vb.w}
                height={vb.h}
                preserveAspectRatio="none"
                pointerEvents="none"
              />
            )}
            {visibleLevelRooms.map((room) => {
              const photoSelected = photoRoomSelectionMatches(
                room,
                selectedPhotoRoomId,
                selectedPhotoRoomMatchesPlan,
              )
              const hasPhotoMarker = roomHasPhotoMarker(room, photoRoomHasMarker, photoRoomIds)
              return (
                <RoomOverlay
                  key={room.id}
                  room={room}
                  neighborhood={resolveRoomNeighborhood(room)}
                  assessmentScore={resultsScoreMode ? resolveAssessmentScore(room) : undefined}
                  colorByAssessmentScore={!!resultsScoreMode}
                  closeOutEntry={closeOutMode ? closeOutProgressByRoomId?.[room.id] : undefined}
                  progress={getRoomSurveyProgress(state.session?.rooms[room.id], {
                    surveyType: state.surveyType,
                    schoolClass: state.school?.schoolClass,
                    scoreDetail: state.roomScoreDetails[room.id] ?? null,
                  })}
                  selected={
                    photoGalleryMode
                      ? photoSelected
                      : state.selectedRoomId === room.id ||
                        preWalkSelectedRoomId === room.id ||
                        photoSelected
                  }
                  hasPhotoMarker={hasPhotoMarker}
                  photoMarkerActive={photoSelected}
                  photoGalleryMode={photoGalleryMode}
                  showInlinePhotoMarker={!photoGalleryMode}
                  showNeighborhood={showNeighborhoods && !photoGalleryMode}
                  showSizeDeviation={showSizeDeviation && !photoGalleryMode}
                  sizeDeviation={sizeDeviationForRoom(sizeDeviationMap, room.id, room.name)}
                  showRoomUse={showRoomUse && !photoGalleryMode}
                  showRoomTags={showRoomTags && !photoGalleryMode}
                  roomUse={roomUseForRoom(roomUseMap, room.id, room.name)}
                  zoom={zoom}
                  meetScale={meetScale}
                  viewBoxWidth={vb.w}
                  viewBoxArea={viewBoxArea}
                  preWalkSpaceType={preWalkMappings?.[room.id]?.spaceType}
                  preWalkColor={
                    preWalkMappings?.[room.id]?.spaceType && preWalkSpaceTypeColor
                      ? preWalkSpaceTypeColor(preWalkMappings[room.id].spaceType)
                      : null
                  }
                  preWalkActiveSpaceType={preWalkActiveSpaceType}
                  readOnly={readOnly}
                  interactive={
                    photoGalleryMode
                      ? false
                      : Boolean(onPreWalkRoomTap) ||
                        !readOnly ||
                        Boolean(onPhotoRoomSelect && hasPhotoMarker)
                  }
                  onSelect={handleRoomSelect}
                />
              )
            })}
            {photoGalleryMode && (
              <g aria-label="Photo room markers">
                {visibleLevelRooms.map((room) => {
                  if (!roomHasPhotoMarker(room, photoRoomHasMarker, photoRoomIds)) return null
                  return (
                    <PhotoRoomMarker
                      key={`photo-marker-${room.id}`}
                      room={room}
                      viewBoxArea={viewBoxArea}
                      viewBoxWidth={vb.w}
                      active={photoRoomSelectionMatches(
                        room,
                        selectedPhotoRoomId,
                        selectedPhotoRoomMatchesPlan,
                      )}
                      onSelect={handleRoomSelect}
                    />
                  )
                })}
              </g>
            )}
          </g>
        </svg>
      </div>

      {!photoGalleryMode && showRoomUse && programTypeLegend.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-[var(--color-border)] bg-white px-3 py-1.5">
          <span className="text-[10px] font-medium text-[var(--color-muted-foreground)]">
            Program type
          </span>
          {programTypeLegend.map((item) => (
            <span key={item.id} className="inline-flex items-center gap-1 text-[10px] text-slate-700">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm border border-slate-200"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              {item.id}
            </span>
          ))}
        </div>
      )}

      {!photoGalleryMode && resultsScoreMode && scoreLegend.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-[var(--color-border)] bg-white px-3 py-1.5">
          <span className="text-[10px] font-medium text-[var(--color-muted-foreground)]">
            {resultsScoreMode === "room" ? "Room score" : "Neighborhood score"}
          </span>
          {scoreLegend.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1 text-[10px] text-slate-700">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm border border-slate-200"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              {item.label}
            </span>
          ))}
        </div>
      )}

      {!photoGalleryMode && closeOutMode && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-[var(--color-border)] bg-white px-3 py-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-700">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm border border-emerald-300 bg-emerald-500/50"
              aria-hidden
            />
            Complete
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-700">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm border border-amber-300 bg-amber-400/45"
              aria-hidden
            />
            In progress
          </span>
          <span className="text-[10px] text-[var(--color-muted-foreground)]">
            Tap a highlighted room to finish deferred questions
          </span>
        </div>
      )}

      {!photoGalleryMode && !isPicker && !isPreWalk && !resultsScoreMode && !closeOutMode && showNeighborhoods && neighborhoodLegend.length > 0 && (
        <NeighborhoodLegend items={neighborhoodLegend} />
      )}

      {!isPreWalk && (
        <p className="px-3 py-1.5 text-center text-[10px] text-[var(--color-muted-foreground)]">
          {photoGalleryMode
            ? "Drag to pan · Pinch or scroll to zoom · Tap a camera icon to view room photos"
            : closeOutMode
              ? "Drag to pan · Pinch or scroll to zoom · Tap a room to answer deferred questions"
              : readOnly
            ? resultsScoreMode
              ? "Drag to pan · Pinch or scroll to zoom · Colors show assessment scores"
              : "Drag to pan · Pinch or scroll to zoom · Green = complete · Yellow = in progress"
            : "Drag to pan · Pinch or scroll to zoom · Tap a room · Green = complete · Yellow = in progress"}
          {!photoGalleryMode && canExpand && !expanded ? " · Expand for a larger view" : !photoGalleryMode && canExpand && expanded ? " · Minimize to compact view" : ""}
        </p>
      )}

      {displayFilename ? (
        <p
          className="border-t border-slate-100 px-3 py-1 text-center text-[9px] leading-tight text-slate-400 tabular-nums"
          title="Floor plan SVG source file"
        >
          {displayFilename}
        </p>
      ) : null}
    </div>
  )

  if (expanded && canExpand && typeof document !== "undefined") {
    return createPortal(
      <div
        className="fixed inset-0 z-[70] flex flex-col bg-white sm:bg-slate-900/50 sm:p-3 safe-bottom"
        role="dialog"
        aria-modal="true"
        aria-label="Expanded floor plan"
        onClick={() => setExpanded(false)}
      >
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white sm:mx-auto sm:my-auto sm:max-h-[min(920px,calc(100dvh-1.5rem))] sm:w-full sm:max-w-6xl sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          {planPanel}
        </div>
      </div>,
      document.body,
    )
  }

  return planPanel
}

/** Hairline selection/highlight weights in screen pixels (non-scaling-stroke). */
const ROOM_OVERLAY_STROKE_PX = {
  selected: 2,
  highlighted: 1.25,
} as const

function RoomOverlay({
  room,
  neighborhood,
  assessmentScore,
  colorByAssessmentScore = false,
  closeOutEntry,
  progress,
  selected,
  showNeighborhood,
  showSizeDeviation,
  sizeDeviation,
  showRoomUse,
  showRoomTags,
  roomUse,
  zoom,
  meetScale,
  viewBoxWidth,
  viewBoxArea,
  preWalkSpaceType,
  preWalkColor,
  preWalkActiveSpaceType,
  readOnly,
  interactive = true,
  hasPhotoMarker = false,
  photoMarkerActive = false,
  photoGalleryMode = false,
  showInlinePhotoMarker = true,
  onSelect,
}: {
  room: ParsedPlanRoom
  neighborhood?: string
  assessmentScore?: number | null
  colorByAssessmentScore?: boolean
  closeOutEntry?: CloseOutRoomFloorPlanEntry
  progress: "idle" | "in_progress" | "complete"
  selected: boolean
  showNeighborhood: boolean
  showSizeDeviation: boolean
  sizeDeviation?: SizeDeviationBand
  showRoomUse: boolean
  showRoomTags: boolean
  roomUse?: RoomUseEntry
  zoom: number
  meetScale: number
  viewBoxWidth: number
  viewBoxArea: number
  preWalkSpaceType?: string
  preWalkColor?: string | null
  preWalkActiveSpaceType?: string | null
  readOnly: boolean
  interactive?: boolean
  hasPhotoMarker?: boolean
  photoMarkerActive?: boolean
  photoGalleryMode?: boolean
  /** When false, marker is rendered in a top SVG layer (photo gallery mode). */
  showInlinePhotoMarker?: boolean
  onSelect: (roomId: string) => void
}) {
  const tapRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const closeOutComplete = closeOutEntry?.complete ?? false
  const closeOutPercent = closeOutEntry?.percent ?? 0
  const shaded = closeOutEntry
    ? closeOutComplete || closeOutPercent > 0
    : progress === "in_progress" || progress === "complete"
  const progressFill = shaded
    ? closeOutEntry
      ? closeOutComplete
        ? "#22c55e"
        : "#eab308"
      : ROOM_PROGRESS_FILL[progress === "complete" ? "complete" : "in_progress"]
    : undefined
  const neighborhoodColor = showNeighborhood ? neighborhoodFillColor(neighborhood) : null
  const sizeDeviationColor =
    showSizeDeviation && sizeDeviation ? sizeDeviationFillColor(sizeDeviation) : null
  const programTypeColor =
    showRoomUse && roomUse?.programType ? programTypeFillColor(roomUse.programType) : null

  let fill: string
  let fillOpacity = 1
  if (photoGalleryMode) {
    fill = selected ? "rgba(37, 99, 235, 0.14)" : "rgba(255, 255, 255, 0.01)"
    fillOpacity = 1
  } else if (closeOutEntry) {
    if (closeOutComplete) {
      fill = "#22c55e"
      fillOpacity = 0.48
    } else {
      fill = "#eab308"
      fillOpacity = 0.22 + (closeOutPercent / 100) * 0.38
    }
  } else if (colorByAssessmentScore) {
    fill = scoreFillRgba(assessmentScore ?? null, selected ? 0.58 : 0.45)
    fillOpacity = 1
  } else if (sizeDeviationColor) {
    fill = colorWithAlpha(sizeDeviationColor, selected ? 0.62 : 0.45)
    if (shaded && progressFill) {
      fillOpacity = 0.72
    }
  } else if (preWalkColor && preWalkSpaceType) {
    fill = colorWithAlpha(preWalkColor, selected ? 0.32 : 0.22)
  } else if (preWalkActiveSpaceType && !preWalkSpaceType) {
    fill = selected ? "rgba(37, 99, 235, 0.08)" : "rgba(255, 255, 255, 0.01)"
  } else if (programTypeColor) {
    fill = colorWithAlpha(programTypeColor, selected ? 0.62 : 0.45)
    if (shaded && progressFill) {
      fillOpacity = 0.72
    }
  } else if (neighborhoodColor) {
    fill = colorWithAlpha(neighborhoodColor, selected ? 0.55 : 0.38)
    if (shaded && progressFill) {
      fillOpacity = 0.72
    }
  } else if (shaded && progressFill) {
    fill = progressFill
    fillOpacity = 0.45
  } else if (selected) {
    fill = "rgba(37, 99, 235, 0.08)"
  } else {
    // Invisible hit target — plan reads as line art until a room is selected or an overlay is on.
    fill = "rgba(255, 255, 255, 0.01)"
  }

  const programTypeStroke =
    programTypeColor && programTypeColor.toUpperCase() === "#FFFFFF" ? "#cbd5e1" : programTypeColor

  const sizeDeviationStroke = sizeDeviationColor

  const showRoomHighlight =
    selected ||
    photoGalleryMode ||
    colorByAssessmentScore ||
    !!sizeDeviationColor ||
    !!(preWalkColor && preWalkSpaceType) ||
    !!programTypeColor ||
    !!neighborhoodColor ||
    shaded

  let stroke = photoGalleryMode
    ? selected
      ? "#2563eb"
      : "rgba(148, 163, 184, 0.45)"
    : selected
    ? "#2563eb"
    : colorByAssessmentScore
      ? scoreStrokeRgba(assessmentScore ?? null, selected ? 0.95 : 0.75)
      : sizeDeviationStroke
        ? sizeDeviationStroke
      : preWalkColor
      ? preWalkColor
      : programTypeStroke
        ? programTypeStroke
        : neighborhoodColor
          ? neighborhoodColor
          : shaded && progressFill
            ? progressFill
            : showRoomHighlight
              ? "rgba(37, 99, 235, 0.2)"
              : "transparent"

  const strokeWidth = selected
    ? ROOM_OVERLAY_STROKE_PX.selected
    : colorByAssessmentScore ||
        preWalkColor ||
        shaded ||
        programTypeColor ||
        neighborhoodColor ||
        sizeDeviationColor
      ? ROOM_OVERLAY_STROKE_PX.highlighted
      : showRoomHighlight
        ? ROOM_OVERLAY_STROKE_PX.highlighted
        : 0

  const trySelect = (pointerId: number, x: number, y: number) => {
    const start = tapRef.current
    tapRef.current = null
    if (!start || start.pointerId !== pointerId) return
    if (Math.hypot(x - start.x, y - start.y) > PAN_THRESHOLD_PX) return
    onSelect(room.id)
  }

  const { width: roomWidth, height: roomHeight } = roomLabelBounds(room.points)
  const labelLayout =
    showRoomTags && roomUse
      ? resolveRoomUseLabelLayout({
          roomId: room.id,
          entry: roomUse,
          roomWidth,
          roomHeight,
          zoom,
          meetScale,
        })
      : null
  const labelLines = labelLayout?.lines ?? []
  const labelFontSize = labelLayout?.fontSize ?? 0
  const labelStroke = labelLayout?.strokeWidth ?? 0
  const lineHeight = labelLayout?.lineHeight ?? 0

  const labelFontSizeForCloseOut = Math.max(
    viewBoxWidth * 0.018,
    Math.sqrt(Math.max(room.area, 1) / Math.max(viewBoxArea, 1)) * viewBoxWidth * 0.045,
  )

  return (
    <g className={photoGalleryMode && !hasPhotoMarker ? "pointer-events-none" : "pointer-events-auto"}>
      <polygon
        data-floor-plan-room={room.id}
        points={overlayPointsForRoom(room).map((p) => `${p.x},${p.y}`).join(" ")}
        fill={fill}
        fillRule="evenodd"
        fillOpacity={fillOpacity}
        stroke={stroke}
        pointerEvents={photoGalleryMode ? "none" : undefined}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
        style={{
          cursor: readOnly ? "default" : "pointer",
          pointerEvents: photoGalleryMode ? "none" : "all",
          touchAction: closeOutEntry ? "manipulation" : "none",
        }}
        onPointerDown={(e) => {
          if (readOnly || !interactive) return
          if (e.pointerType === "mouse" && e.button !== 0) return
          e.stopPropagation()
          tapRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY }
        }}
        onPointerUp={(e) => {
          if (readOnly || !interactive || closeOutEntry) return
          if (e.pointerType === "mouse" && e.button !== 0) return
          e.stopPropagation()
          trySelect(e.pointerId, e.clientX, e.clientY)
        }}
        onClick={(e) => {
          if (readOnly || !interactive || !closeOutEntry) return
          e.stopPropagation()
          onSelect(room.id)
        }}
        onPointerCancel={(e) => {
          e.stopPropagation()
          if (tapRef.current?.pointerId === e.pointerId) tapRef.current = null
        }}
      />
      {closeOutEntry && (
        <g pointerEvents="none">
          {closeOutEntry.complete ? (
            <>
              <circle
                cx={room.x}
                cy={room.y}
                r={labelFontSizeForCloseOut * 0.85}
                fill="rgba(255,255,255,0.92)"
                stroke="#16a34a"
                strokeWidth={Math.max(1, labelFontSizeForCloseOut * 0.08)}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={`M ${room.x - labelFontSizeForCloseOut * 0.32} ${room.y + labelFontSizeForCloseOut * 0.02} L ${room.x - labelFontSizeForCloseOut * 0.06} ${room.y + labelFontSizeForCloseOut * 0.28} L ${room.x + labelFontSizeForCloseOut * 0.34} ${room.y - labelFontSizeForCloseOut * 0.24}`}
                fill="none"
                stroke="#16a34a"
                strokeWidth={Math.max(1.5, labelFontSizeForCloseOut * 0.1)}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          ) : (
            <>
              <rect
                x={room.x - labelFontSizeForCloseOut * 0.75}
                y={room.y - labelFontSizeForCloseOut * 0.55}
                width={labelFontSizeForCloseOut * 1.5}
                height={labelFontSizeForCloseOut * 1.1}
                rx={labelFontSizeForCloseOut * 0.15}
                fill="rgba(255,255,255,0.92)"
                stroke="rgba(180, 83, 9, 0.55)"
                strokeWidth={Math.max(1, labelFontSizeForCloseOut * 0.06)}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={room.x}
                y={room.y + labelFontSizeForCloseOut * 0.08}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#92400e"
                fontSize={labelFontSizeForCloseOut * 0.72}
                fontWeight={700}
              >
                {closeOutEntry.percent}%
              </text>
            </>
          )}
        </g>
      )}
      {labelLines.length > 0 && (
        <text
          x={room.x}
          y={room.y - ((labelLines.length - 1) * lineHeight) / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={ROOM_LABEL_FILL}
          stroke={ROOM_LABEL_STROKE}
          strokeWidth={labelStroke}
          paintOrder="stroke"
          fontSize={labelFontSize}
          fontWeight={500}
          pointerEvents="none"
        >
          {labelLines.map((line, index) => (
            <tspan
              key={`${room.id}-${index}`}
              x={room.x}
              dy={index === 0 ? 0 : lineHeight}
              fontSize={index === 0 ? labelFontSize : labelFontSize * 0.82}
              fontWeight={500}
            >
              {line}
            </tspan>
          ))}
        </text>
      )}
      {showInlinePhotoMarker && hasPhotoMarker && (
        <PhotoRoomMarker
          room={room}
          viewBoxArea={viewBoxArea}
          viewBoxWidth={viewBoxWidth}
          active={photoMarkerActive}
          photoGalleryMode={photoGalleryMode}
          onSelect={onSelect}
        />
      )}
    </g>
  )
}

function PhotoRoomMarker({
  room,
  viewBoxArea,
  viewBoxWidth,
  active,
  photoGalleryMode = true,
  onSelect,
}: {
  room: ParsedPlanRoom
  viewBoxArea: number
  viewBoxWidth: number
  active: boolean
  photoGalleryMode?: boolean
  onSelect: (roomId: string) => void
}) {
  const markerTapRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const { scale: photoMarkerScale, r: photoMarkerR, stroke: photoMarkerStroke, offset: photoMarkerOffset } =
    photoMarkerLayout(room, viewBoxArea, viewBoxWidth, photoGalleryMode)

  const tryMarkerSelect = (pointerId: number, x: number, y: number) => {
    const start = markerTapRef.current
    markerTapRef.current = null
    if (!start || start.pointerId !== pointerId) return
    if (Math.hypot(x - start.x, y - start.y) > PAN_THRESHOLD_PX) return
    onSelect(room.id)
  }

  return (
    <g
      transform={`translate(${room.x}, ${room.y - photoMarkerOffset})`}
      className={photoGalleryMode ? "cursor-pointer" : undefined}
      pointerEvents={photoGalleryMode ? "all" : "none"}
      {...(photoGalleryMode
        ? {
            role: "button" as const,
            "aria-label": `View photos for ${room.name || room.id}`,
            "aria-pressed": active,
            onPointerDown: (event: React.PointerEvent<SVGGElement>) => {
              event.stopPropagation()
              markerTapRef.current = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
              }
            },
            onPointerUp: (event: React.PointerEvent<SVGGElement>) => {
              event.stopPropagation()
              tryMarkerSelect(event.pointerId, event.clientX, event.clientY)
            },
            onPointerCancel: (event: React.PointerEvent<SVGGElement>) => {
              if (markerTapRef.current?.pointerId === event.pointerId) markerTapRef.current = null
            },
          }
        : { "aria-hidden": true })}
    >
      <circle
        r={photoMarkerR + (photoGalleryMode ? 6 : 0)}
        fill="transparent"
        pointerEvents="all"
      />
      <g pointerEvents="none" aria-hidden>
        <circle
          r={photoMarkerR + (photoGalleryMode ? 2 : 0)}
          fill="rgba(15, 23, 42, 0.22)"
          transform="translate(0, 2)"
        />
        <circle
          r={photoMarkerR}
          fill={active ? "#2563eb" : "#ea580c"}
          stroke="#ffffff"
          strokeWidth={photoMarkerStroke}
        />
        <g transform={`scale(${photoMarkerScale * 0.9})`}>
          <rect x="-10" y="-7" width="20" height="14" rx="2.5" fill="#ffffff" />
          <circle cx="0" cy="0" r="4" fill={active ? "#2563eb" : "#ea580c"} />
          <circle cx="7" cy="-4.5" r="1.6" fill="#ffffff" opacity={0.85} />
        </g>
      </g>
    </g>
  )
}
