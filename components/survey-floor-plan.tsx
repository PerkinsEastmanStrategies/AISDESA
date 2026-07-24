"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import { useSelectRoomWithConfirm } from "@/components/use-select-room-with-confirm"
import { viewBoxString, type ParsedPlanRoom } from "@aisd/shared"
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
  roomUseLabelMode,
} from "@/lib/room-plan-labels"
import { programTypeFillColor, programTypeLegendColors } from "@/lib/program-type-colors"
import NeighborhoodLegend from "@/components/neighborhood-legend"
import { cn, scoreFillRgba, scoreStrokeRgba } from "@/lib/utils"
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

function clampZoom(value: number, min: number = MIN_ZOOM): number {
  return Math.min(MAX_ZOOM, Math.max(min, value))
}

function pointerDistance(pointers: Map<number, { x: number; y: number }>): number {
  const pts = [...pointers.values()]
  if (pts.length < 2) return 0
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
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
  resultsScoreMode,
  roomScoreById,
  neighborhoodScoreById,
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
  /** Results view: color rooms by assessment score instead of neighborhood identity. */
  resultsScoreMode?: "room" | "neighborhood"
  roomScoreById?: Record<string, number | null>
  neighborhoodScoreById?: Record<string, number | null>
}) {
  const { state, setLevel, levelRooms } = useSurvey()
  const { requestSelectRoom, completedRoomDialog } = useSelectRoomWithConfirm()
  const viewportRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(DEFAULT_ZOOM)
  const panRef = useRef({ x: 0, y: 0 })
  const [zoom, setZoomState] = useState(DEFAULT_ZOOM)
  const [pan, setPanState] = useState({ x: 0, y: 0 })
  const [rotation, setRotation] = useState(0)
  const [showNeighborhoods, setShowNeighborhoods] = useState(true)
  const [showSizeDeviation, setShowSizeDeviation] = useState(false)
  const [showRoomUse, setShowRoomUse] = useState(false)
  const [showRoomTags, setShowRoomTags] = useState(false)
  const [roomUseMap, setRoomUseMap] = useState<RoomUseMap>(new Map())
  const [neighborhoodMap, setNeighborhoodMap] = useState<RoomNeighborhoodMap>(new Map())
  const [sizeDeviationMap, setSizeDeviationMap] = useState<RoomSizeDeviationMap>(new Map())
  const [isPanning, setIsPanning] = useState(false)
  const [internalExpanded, setInternalExpanded] = useState(
    () => variant === "picker" && panelVisible !== false,
  )
  const expanded = expandedProp ?? internalExpanded
  const setExpanded = onExpandedChange ?? setInternalExpanded
  const canExpand = variant === "picker" || variant === "inline"
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const activePointerId = useRef<number | null>(null)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null)
  const didPanRef = useRef(false)

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

  const handleRoomSelect = useCallback(
    (roomId: string) => {
      if (readOnly) return
      if (onPreWalkRoomTap) {
        onPreWalkRoomTap(roomId)
        return
      }
      requestSelectRoom(roomId, { afterSelect: onRoomSelect })
    },
    [readOnly, onPreWalkRoomTap, requestSelectRoom, onRoomSelect],
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

  useEffect(() => {
    if (!state.school) {
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
  }, [state.school?.id, state.school?.name])

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
    didPanRef.current = false
  }, [variant, panelVisible, levelId, readOnly, setZoom, setPan])

  useEffect(() => {
    if (panelVisible !== false) return
    setExpanded(false)
  }, [panelVisible, setExpanded])

  useEffect(() => {
    if (variant === "picker" && panelVisible) {
      setExpanded(true)
    }
  }, [variant, panelVisible, setExpanded])

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

    el.addEventListener("wheel", onWheel, { passive: false, capture: true })

    return () => {
      el.removeEventListener("wheel", onWheel, { capture: true })
    }
  }, [setZoom, panelVisible])

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

  if (state.floorPlanLoading) {
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

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return

    // Do not capture yet — capture only after a real pan so room polygon
    // pointer/click events still reach RoomOverlay on a tap.
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    didPanRef.current = false

    if (pointersRef.current.size === 2) {
      pinchRef.current = { dist: pointerDistance(pointersRef.current), zoom: zoomRef.current }
      activePointerId.current = null
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

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size >= 2 && pinchRef.current && pinchRef.current.dist > 0) {
      e.preventDefault()
      didPanRef.current = true
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
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

    if (!isPanning) {
      if (Math.hypot(dx, dy) < PAN_THRESHOLD_PX) return
      setIsPanning(true)
      didPanRef.current = true
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }

    // Pan in screen pixels so drag tracks the pointer 1:1
    setPan({
      x: panStart.current.panX + dx,
      y: panStart.current.panY + dy,
    })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (activePointerId.current === e.pointerId) activePointerId.current = null
    setIsPanning(false)
    didPanRef.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.size === 0) return
    resetPointerState()
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

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
          "flex flex-wrap items-center gap-1 px-2 py-1.5",
          isPreWalk
            ? "pointer-events-auto absolute left-[min(18rem,calc(100vw-2rem))] right-2 top-2 z-20 rounded-xl border border-slate-200/80 bg-white/95 shadow-md backdrop-blur-sm sm:left-[min(19rem,calc(100vw-2rem))]"
            : "border-b border-[var(--color-border)] bg-white",
        )}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {!isPreWalk && (
          <div className="flex flex-1 gap-1 overflow-x-auto scrollbar-none">
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
        <div className={cn("flex shrink-0 flex-wrap items-center gap-0.5", isPreWalk && "ml-auto")}>
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

      {isPicker && !resultsScoreMode && showNeighborhoods && neighborhoodLegend.length > 0 && (
        <NeighborhoodLegend items={neighborhoodLegend} />
      )}

      {isPreWalk && !resultsScoreMode && showNeighborhoods && neighborhoodLegend.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-[min(18rem,calc(100vw-2rem))] right-3 z-20 sm:left-[min(19rem,calc(100vw-2rem))]">
          <NeighborhoodLegend
            items={neighborhoodLegend}
            className="pointer-events-auto rounded-xl border border-slate-200/80 bg-white/95 shadow-md backdrop-blur-sm"
          />
        </div>
      )}

      {isPreWalk && !resultsScoreMode && showSizeDeviation && hasSizeDeviationColors && (
        <div
          className={cn(
            "pointer-events-none absolute left-[min(18rem,calc(100vw-2rem))] right-3 z-20 sm:left-[min(19rem,calc(100vw-2rem))]",
            showNeighborhoods && neighborhoodLegend.length > 0 ? "bottom-14" : "bottom-3",
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <div
          className="absolute inset-0 origin-center will-change-transform"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
          }}
        >
          <svg
            viewBox={vbStr}
            preserveAspectRatio="xMidYMid meet"
            className={cn(
              "h-full w-full",
              isPanning ? "cursor-grabbing" : "cursor-grab",
            )}
          >
            <image
              href={level.src}
              x={vb.x}
              y={vb.y}
              width={vb.w}
              height={vb.h}
              // Fill the viewBox rect exactly so overlay polygons align with the image.
              preserveAspectRatio="none"
              pointerEvents="none"
            />
            {levelRooms
              .filter((room) => room.points.length >= 3)
              .map((room) => (
              <RoomOverlay
                key={room.id}
                room={room}
                neighborhood={resolveRoomNeighborhood(room)}
                assessmentScore={resultsScoreMode ? resolveAssessmentScore(room) : undefined}
                colorByAssessmentScore={!!resultsScoreMode}
                progress={getRoomSurveyProgress(state.session?.rooms[room.id], {
                  surveyType: state.surveyType,
                  schoolClass: state.school?.schoolClass,
                  scoreDetail: state.roomScoreDetails[room.id] ?? null,
                })}
                selected={
                  state.selectedRoomId === room.id || preWalkSelectedRoomId === room.id
                }
                showNeighborhood={showNeighborhoods}
                showSizeDeviation={showSizeDeviation}
                sizeDeviation={sizeDeviationForRoom(sizeDeviationMap, room.id, room.name)}
                showRoomUse={showRoomUse}
                showRoomTags={showRoomTags}
                roomUse={roomUseForRoom(roomUseMap, room.id, room.name)}
                zoom={zoom}
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
                interactive={Boolean(onPreWalkRoomTap) || !readOnly}
                onSelect={handleRoomSelect}
              />
            ))}
          </svg>
        </div>
      </div>

      {showRoomUse && programTypeLegend.length > 0 && (
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

      {resultsScoreMode && scoreLegend.length > 0 && (
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

      {!isPicker && !isPreWalk && !resultsScoreMode && showNeighborhoods && neighborhoodLegend.length > 0 && (
        <NeighborhoodLegend items={neighborhoodLegend} />
      )}

      {!isPreWalk && (
        <p className="px-3 py-1.5 text-center text-[10px] text-[var(--color-muted-foreground)]">
          {readOnly
            ? resultsScoreMode
              ? "Drag to pan · Pinch or scroll to zoom · Colors show assessment scores"
              : "Drag to pan · Pinch or scroll to zoom · Green = complete · Yellow = in progress"
            : "Drag to pan · Pinch or scroll to zoom · Tap a room · Green = complete · Yellow = in progress"}
          {canExpand && !expanded ? " · Expand for a larger view" : canExpand && expanded ? " · Minimize to compact view" : ""}
        </p>
      )}
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

function RoomOverlay({
  room,
  neighborhood,
  assessmentScore,
  colorByAssessmentScore = false,
  progress,
  selected,
  showNeighborhood,
  showSizeDeviation,
  sizeDeviation,
  showRoomUse,
  showRoomTags,
  roomUse,
  zoom,
  viewBoxWidth,
  viewBoxArea,
  preWalkSpaceType,
  preWalkColor,
  preWalkActiveSpaceType,
  readOnly,
  interactive = true,
  onSelect,
}: {
  room: ParsedPlanRoom
  neighborhood?: string
  assessmentScore?: number | null
  colorByAssessmentScore?: boolean
  progress: "idle" | "in_progress" | "complete"
  selected: boolean
  showNeighborhood: boolean
  showSizeDeviation: boolean
  sizeDeviation?: SizeDeviationBand
  showRoomUse: boolean
  showRoomTags: boolean
  roomUse?: RoomUseEntry
  zoom: number
  viewBoxWidth: number
  viewBoxArea: number
  preWalkSpaceType?: string
  preWalkColor?: string | null
  preWalkActiveSpaceType?: string | null
  readOnly: boolean
  interactive?: boolean
  onSelect: (roomId: string) => void
}) {
  const tapRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const shaded = progress === "in_progress" || progress === "complete"
  const progressFill = shaded ? ROOM_PROGRESS_FILL[progress] : undefined
  const neighborhoodColor = showNeighborhood ? neighborhoodFillColor(neighborhood) : null
  const sizeDeviationColor =
    showSizeDeviation && sizeDeviation ? sizeDeviationFillColor(sizeDeviation) : null
  const programTypeColor =
    showRoomUse && roomUse?.programType ? programTypeFillColor(roomUse.programType) : null

  let fill: string
  let fillOpacity = 1
  if (colorByAssessmentScore) {
    fill = scoreFillRgba(assessmentScore ?? null, selected ? 0.58 : 0.45)
    fillOpacity = 1
  } else if (sizeDeviationColor) {
    fill = colorWithAlpha(sizeDeviationColor, selected ? 0.62 : 0.45)
    if (shaded && progressFill) {
      fillOpacity = 0.72
    }
  } else if (preWalkColor && preWalkSpaceType) {
    fill = colorWithAlpha(preWalkColor, selected ? 0.62 : 0.42)
  } else if (preWalkActiveSpaceType && !preWalkSpaceType) {
    fill = selected ? "rgba(37, 99, 235, 0.2)" : "rgba(37, 99, 235, 0.06)"
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
    fill = "rgba(37, 99, 235, 0.15)"
  } else {
    // Slightly visible fill so SVG hit-testing stays reliable on all browsers.
    fill = interactive ? "rgba(37, 99, 235, 0.06)" : "rgba(37, 99, 235, 0.01)"
  }

  const programTypeStroke =
    programTypeColor && programTypeColor.toUpperCase() === "#FFFFFF" ? "#cbd5e1" : programTypeColor

  const sizeDeviationStroke = sizeDeviationColor

  const stroke = selected
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
            : "rgba(37, 99, 235, 0.2)"

  const trySelect = (pointerId: number, x: number, y: number) => {
    const start = tapRef.current
    tapRef.current = null
    if (!start || start.pointerId !== pointerId) return
    if (Math.hypot(x - start.x, y - start.y) > PAN_THRESHOLD_PX) return
    onSelect(room.id)
  }

  const { width: roomWidth, height: roomHeight } = roomLabelBounds(room.points)
  const labelMode =
    showRoomTags && roomUse
      ? roomUseLabelMode(zoom, room.area, viewBoxArea, roomWidth, viewBoxWidth, selected)
      : "hidden"
  const labelLayout =
    labelMode !== "hidden" && roomUse
      ? resolveRoomUseLabelLayout({
          roomId: room.id,
          entry: roomUse,
          mode: labelMode,
          viewBoxWidth,
          viewBoxArea,
          roomArea: room.area,
          roomWidth,
          roomHeight,
        })
      : null
  const labelLines = labelLayout?.lines ?? []
  const labelFontSize = labelLayout?.fontSize ?? 0
  const labelStroke = labelLayout?.strokeWidth ?? 0
  const lineHeight = labelLayout?.lineHeight ?? 0

  return (
    <g className="pointer-events-auto">
      <polygon
        points={room.points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeWidth={
          selected
            ? 14
            : colorByAssessmentScore ||
                preWalkColor ||
                shaded ||
                programTypeColor ||
                neighborhoodColor
              ? 8
              : 6
        }
        style={{ cursor: readOnly ? "default" : "pointer", pointerEvents: "all", touchAction: "manipulation" }}
        onPointerDown={(e) => {
          if (readOnly || !interactive) return
          if (e.pointerType === "mouse" && e.button !== 0) return
          e.stopPropagation()
          tapRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY }
        }}
        onPointerUp={(e) => {
          if (readOnly || !interactive) return
          if (e.pointerType === "mouse" && e.button !== 0) return
          e.stopPropagation()
          trySelect(e.pointerId, e.clientX, e.clientY)
        }}
        onPointerCancel={(e) => {
          e.stopPropagation()
          if (tapRef.current?.pointerId === e.pointerId) tapRef.current = null
        }}
      />
      {labelLines.length > 0 && (
        <text
          x={room.x}
          y={room.y - ((labelLines.length - 1) * lineHeight) / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#0f172a"
          stroke="#ffffff"
          strokeWidth={labelStroke}
          paintOrder="stroke"
          fontSize={labelFontSize}
          fontWeight={600}
          pointerEvents="none"
        >
          {labelLines.map((line, index) => (
            <tspan
              key={`${room.id}-${index}`}
              x={room.x}
              dy={index === 0 ? 0 : lineHeight}
              fontSize={index === 0 ? labelFontSize : labelFontSize * 0.82}
              fontWeight={index === 0 ? 700 : 500}
            >
              {line}
            </tspan>
          ))}
        </text>
      )}
    </g>
  )
}
