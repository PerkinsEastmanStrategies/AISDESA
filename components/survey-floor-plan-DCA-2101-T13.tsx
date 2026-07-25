"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import { useSelectRoomWithConfirm } from "@/components/use-select-room-with-confirm"
import {
  ROOM_CONDITION_FILL,
  conditionFromScore,
  overlayPointsForRoom,
  viewBoxString,
  type ParsedPlanRoom,
} from "@aisd/shared"
import {
  neighborhoodFillColor,
  neighborhoodLegendColors,
} from "@/lib/room-neighborhood-lookup"
import { cn } from "@/lib/utils"

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
}: {
  readOnly?: boolean
  variant?: "inline" | "picker"
  panelVisible?: boolean
  onRoomSelect?: () => void
  onClose?: () => void
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
  const [isPanning, setIsPanning] = useState(false)
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
      if (readOnly || didPanRef.current) return
      requestSelectRoom(roomId, { afterSelect: onRoomSelect })
    },
    [readOnly, requestSelectRoom, onRoomSelect],
  )

  const rotateView = useCallback(() => {
    setRotation((prev) => (prev + 270) % 360)
  }, [])

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
  const neighborhoodLegend = neighborhoodLegendColors(
    levelRooms.map((room) => room.neighborhood).filter((n): n is string => Boolean(n)),
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
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  return (
    <div className="relative flex flex-col">
      {completedRoomDialog}
      <div className="flex items-center gap-1 border-b border-[var(--color-border)] bg-white px-2 py-1.5">
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
        <div className="flex shrink-0 items-center gap-0.5">
          {neighborhoodLegend.length > 0 && (
            <button
              type="button"
              onClick={() => setShowNeighborhoods((v) => !v)}
              aria-pressed={showNeighborhoods}
              className={cn(
                "mr-0.5 shrink-0 rounded-md px-2 py-1.5 text-[10px] font-medium",
                showNeighborhoods
                  ? "bg-slate-800 text-white"
                  : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
              )}
            >
              Neighborhoods
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

      <div
        ref={viewportRef}
        className={cn(
          "relative w-full overflow-hidden select-none bg-white",
          variant === "picker"
            ? "h-[220px] sm:h-[260px]"
            : "h-[min(42vh,360px)] md:h-[min(50vh,420px)]",
        )}
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
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
                score={state.roomScores[room.id] ?? null}
                selected={state.selectedRoomId === room.id}
                showNeighborhood={showNeighborhoods}
                readOnly={readOnly}
                onSelect={handleRoomSelect}
              />
            ))}
          </svg>
        </div>
      </div>

      {showNeighborhoods && neighborhoodLegend.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-[var(--color-border)] bg-white px-3 py-1.5">
          <span className="text-[10px] font-medium text-[var(--color-muted-foreground)]">
            Neighborhood
          </span>
          {neighborhoodLegend.map((item) => (
            <span key={item.id} className="inline-flex items-center gap-1 text-[10px] text-slate-700">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              {item.id}
            </span>
          ))}
        </div>
      )}

      <p className="px-3 py-1.5 text-center text-[10px] text-[var(--color-muted-foreground)]">
        {readOnly
          ? "Drag to pan · Pinch or scroll to zoom · Assessed rooms show scores"
          : "Drag to pan · Pinch or scroll to zoom · Tap a room to select"}
      </p>
    </div>
  )
}

function RoomOverlay({
  room,
  score,
  selected,
  showNeighborhood,
  readOnly,
  onSelect,
}: {
  room: ParsedPlanRoom
  score: number | null
  selected: boolean
  showNeighborhood: boolean
  readOnly: boolean
  onSelect: (roomId: string) => void
}) {
  const assessed = score !== null
  const scoreFill = assessed ? ROOM_CONDITION_FILL[conditionFromScore(score)] : undefined
  const neighborhoodColor = showNeighborhood
    ? neighborhoodFillColor(room.neighborhood)
    : null

  let fill: string
  let fillOpacity = 1
  if (assessed && scoreFill) {
    fill = scoreFill
    fillOpacity = 0.4
  } else if (neighborhoodColor) {
    fill = colorWithAlpha(neighborhoodColor, selected ? 0.55 : 0.38)
  } else if (selected) {
    fill = "rgba(37, 99, 235, 0.15)"
  } else {
    fill = "rgba(255, 255, 255, 0.01)"
  }

  const stroke = selected
    ? "#2563eb"
    : assessed && scoreFill
      ? scoreFill
      : neighborhoodColor
        ? neighborhoodColor
        : "transparent"

  return (
    <g className="pointer-events-auto">
      <polygon
        points={overlayPointsForRoom(room).map((p) => `${p.x},${p.y}`).join(" ")}
        fill={fill}
        fillRule="evenodd"
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeWidth={selected ? 14 : assessed || neighborhoodColor ? 8 : 0}
        style={{ cursor: readOnly ? "default" : "pointer", pointerEvents: "all" }}
        onPointerUp={(e) => {
          if (readOnly) return
          // Touch pointers report button 0; ignore non-primary mouse buttons only.
          if (e.pointerType === "mouse" && e.button !== 0) return
          e.stopPropagation()
          onSelect(room.id)
        }}
      />
    </g>
  )
}
