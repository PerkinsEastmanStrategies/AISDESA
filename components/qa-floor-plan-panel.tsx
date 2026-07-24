"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react"
import type { AisdSchoolOption, ParsedPlanRoom } from "@aisd/shared"
import { viewBoxString } from "@aisd/shared"
import type { AssessedRoomRecord, CampusScoringSnapshot } from "@/lib/campus-scoring-tree"
import { loadFloorPlanForSchool } from "@/lib/floor-plan-loader"
import {
  neighborhoodFillColor,
  neighborhoodLegendColors,
} from "@/lib/room-neighborhood-lookup"
import { ScoreBadge } from "@/components/score-display"
import { cn, scoreBandLabel, scoreFillRgba, scoreStrokeRgba } from "@/lib/utils"

const PAN_THRESHOLD_PX = 6
const MIN_ZOOM = 0.75
const MAX_ZOOM = 10
const DEFAULT_ZOOM = 1
const ZOOM_BUTTON_STEP = 0.5

type QaFloorPlanView = "scores" | "neighborhoods"

function clampZoom(value: number, min: number = MIN_ZOOM): number {
  return Math.min(MAX_ZOOM, Math.max(min, value))
}

function pointerDistance(pointers: Map<number, { x: number; y: number }>): number {
  const pts = [...pointers.values()]
  if (pts.length < 2) return 0
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
}

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

function QaRoomOverlay({
  room,
  score,
  neighborhood,
  selected,
  showNeighborhoods,
  onSelect,
}: {
  room: ParsedPlanRoom
  score: number | null | undefined
  neighborhood?: string
  selected: boolean
  showNeighborhoods: boolean
  onSelect: (roomId: string) => void
}) {
  const tapRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const hasScore = score != null
  const neighborhoodColor = showNeighborhoods ? neighborhoodFillColor(neighborhood) : null

  let fill: string
  let fillOpacity = 1
  let stroke: string

  if (showNeighborhoods && neighborhoodColor) {
    fill = colorWithAlpha(neighborhoodColor, selected ? 0.55 : 0.38)
    stroke = selected ? "#2563eb" : neighborhoodColor
  } else if (hasScore) {
    fill = scoreFillRgba(score, selected ? 0.58 : 0.45)
    stroke = selected ? "#2563eb" : scoreStrokeRgba(score)
    fillOpacity = 0.45
  } else if (selected) {
    fill = "rgba(37, 99, 235, 0.15)"
    stroke = "#2563eb"
  } else {
    fill = "rgba(148, 163, 184, 0.08)"
    stroke = "rgba(148, 163, 184, 0.25)"
  }

  const trySelect = (pointerId: number, x: number, y: number) => {
    const start = tapRef.current
    tapRef.current = null
    if (!start || start.pointerId !== pointerId) return
    if (Math.hypot(x - start.x, y - start.y) > PAN_THRESHOLD_PX) return
    onSelect(room.id)
  }

  return (
    <g className="pointer-events-auto">
      <polygon
        points={room.points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeWidth={selected ? 14 : hasScore || neighborhoodColor ? 8 : 6}
        style={{ cursor: "pointer", pointerEvents: "all", touchAction: "manipulation" }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return
          e.stopPropagation()
          tapRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY }
        }}
        onPointerUp={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return
          e.stopPropagation()
          trySelect(e.pointerId, e.clientX, e.clientY)
        }}
        onPointerCancel={(e) => {
          e.stopPropagation()
          if (tapRef.current?.pointerId === e.pointerId) tapRef.current = null
        }}
      />
    </g>
  )
}

export default function QaFloorPlanPanel({
  school,
  snapshot,
}: {
  school: AisdSchoolOption
  snapshot: CampusScoringSnapshot
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(DEFAULT_ZOOM)
  const panRef = useRef({ x: 0, y: 0 })
  const [planState, setPlanState] = useState<{
    plan: Awaited<ReturnType<typeof loadFloorPlanForSchool>>["plan"]
    rooms: ParsedPlanRoom[]
  }>({ plan: null, rooms: [] })
  const [loading, setLoading] = useState(true)
  const [levelId, setLevelId] = useState<string | null>(null)
  const [view, setView] = useState<QaFloorPlanView>("scores")
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [zoom, setZoomState] = useState(DEFAULT_ZOOM)
  const [pan, setPanState] = useState({ x: 0, y: 0 })
  const [rotation, setRotation] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const activePointerId = useRef<number | null>(null)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null)

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

  const scoreByRoomId = useMemo(() => {
    const map = new Map<string, number | null>()
    for (const room of snapshot.allRooms) {
      map.set(room.roomId, room.overallScore)
    }
    return map
  }, [snapshot.allRooms])

  const assessedByRoomId = useMemo(() => {
    const map = new Map<string, AssessedRoomRecord>()
    for (const room of snapshot.allRooms) {
      map.set(room.roomId, room)
    }
    return map
  }, [snapshot.allRooms])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setPlanState({ plan: null, rooms: [] })
    setLevelId(null)
    setSelectedRoomId(null)
    setZoom(DEFAULT_ZOOM)
    setPan({ x: 0, y: 0 })
    setRotation(0)

    loadFloorPlanForSchool(school, (partial) => {
      if (cancelled) return
      setPlanState({ plan: partial.plan, rooms: partial.rooms })
      if (partial.plan?.defaultLevelId) {
        setLevelId(partial.plan.defaultLevelId)
      }
      setLoading(false)
    })
      .then((result) => {
        if (cancelled) return
        setPlanState({ plan: result.plan, rooms: result.rooms })
        setLevelId(result.plan?.defaultLevelId ?? result.plan?.levels[0]?.id ?? null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [school, setPan, setZoom])

  const plan = planState.plan
  const activeLevelId = levelId ?? plan?.defaultLevelId ?? plan?.levels[0]?.id ?? null
  const level = plan?.levels.find((l) => l.id === activeLevelId)
  const levelRooms = useMemo(
    () => planState.rooms.filter((room) => room.levelId === activeLevelId),
    [planState.rooms, activeLevelId],
  )

  const matchedScoreCount = useMemo(
    () => levelRooms.filter((room) => scoreByRoomId.has(room.id)).length,
    [levelRooms, scoreByRoomId],
  )

  const neighborhoodLegend = useMemo(
    () =>
      neighborhoodLegendColors(
        levelRooms
          .map((room) => assessedByRoomId.get(room.id)?.neighborhood ?? room.neighborhood)
          .filter((n): n is string => Boolean(n)),
      ),
    [assessedByRoomId, levelRooms],
  )

  const selectedRoom = selectedRoomId ? assessedByRoomId.get(selectedRoomId) : null

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
  }, [setZoom])

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
  }, [expanded])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

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
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }

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

  if (loading && !plan) {
    return (
      <div className="flex h-[min(48vh,440px)] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
        Loading floor plan…
      </div>
    )
  }

  if (!plan || !level) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-500">
        No floor plan is available for this school yet.
      </div>
    )
  }

  const vb = level.viewBox
  const vbStr = viewBoxString(vb)

  const planPanel = (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]",
        expanded && "flex h-full min-h-0 flex-col",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
        <div className="flex flex-1 gap-1 overflow-x-auto scrollbar-none">
          {plan.levels.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => {
                setLevelId(l.id)
                setSelectedRoomId(null)
                setZoom(DEFAULT_ZOOM)
                setPan({ x: 0, y: 0 })
              }}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium",
                l.id === activeLevelId
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setView("scores")}
            aria-pressed={view === "scores"}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-[10px] font-medium",
              view === "scores"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:text-slate-900",
            )}
          >
            Scores
          </button>
          <button
            type="button"
            onClick={() => setView("neighborhoods")}
            aria-pressed={view === "neighborhoods"}
            disabled={neighborhoodLegend.length === 0}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-40",
              view === "neighborhoods"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:text-slate-900",
            )}
          >
            Neighborhoods
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z + ZOOM_BUTTON_STEP))}
            className="flex h-9 w-8 items-center justify-center rounded-lg hover:bg-slate-100"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z - ZOOM_BUTTON_STEP))}
            className="flex h-9 w-8 items-center justify-center rounded-lg hover:bg-slate-100"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setRotation((prev) => (prev + 270) % 360)}
            className="flex h-9 w-8 items-center justify-center rounded-lg hover:bg-slate-100"
            aria-label="Rotate floor plan"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex h-9 w-8 items-center justify-center rounded-lg hover:bg-slate-100"
            aria-label={expanded ? "Minimize floor plan" : "Expand floor plan"}
            aria-pressed={expanded}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={cn(
          "relative w-full overflow-hidden select-none bg-white",
          expanded ? "min-h-0 flex-1" : "h-[min(48vh,440px)]",
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
            className={cn("h-full w-full", isPanning ? "cursor-grabbing" : "cursor-grab")}
          >
            <image
              href={level.src}
              x={vb.x}
              y={vb.y}
              width={vb.w}
              height={vb.h}
              preserveAspectRatio="none"
              pointerEvents="none"
            />
            {levelRooms
              .filter((room) => room.points.length >= 3)
              .map((room) => (
                <QaRoomOverlay
                  key={room.id}
                  room={room}
                  score={scoreByRoomId.get(room.id)}
                  neighborhood={assessedByRoomId.get(room.id)?.neighborhood ?? room.neighborhood}
                  selected={selectedRoomId === room.id}
                  showNeighborhoods={view === "neighborhoods"}
                  onSelect={setSelectedRoomId}
                />
              ))}
          </svg>
        </div>
      </div>

      {view === "scores" ? (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-600">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600/70" aria-hidden />
            Good (70%+)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500/70" aria-hidden />
            Fair (45–69%)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-600/70" aria-hidden />
            Needs attention (&lt;45%)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-300/50" aria-hidden />
            No score
          </span>
        </div>
      ) : neighborhoodLegend.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-slate-200 bg-white px-3 py-2">
          <span className="text-[10px] font-medium text-slate-500">Neighborhood</span>
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
      ) : null}

      <div className="border-t border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-500">
        {matchedScoreCount} of {levelRooms.length} rooms on this level match assessed spaces.
        Tap a room for details · Drag to pan · Scroll to zoom
        {!expanded ? " · Expand for a larger view" : ""}
      </div>

      {selectedRoom ? (
        <div className="border-t border-slate-200 bg-white px-3 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{selectedRoom.roomName}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {selectedRoom.spaceType}
                {selectedRoom.neighborhood ? ` · Neighborhood ${selectedRoom.neighborhood}` : ""}
              </p>
              {scoreBandLabel(selectedRoom.overallScore) ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  {scoreBandLabel(selectedRoom.overallScore)}
                </p>
              ) : null}
            </div>
            <ScoreBadge score={selectedRoom.overallScore} size="lg" />
          </div>
        </div>
      ) : null}
    </div>
  )

  if (expanded && typeof document !== "undefined") {
    return createPortal(
      <div
        className="fixed inset-0 z-[90] flex flex-col bg-white sm:bg-slate-900/50 sm:p-3 safe-bottom"
        role="dialog"
        aria-modal="true"
        aria-label="Expanded floor plan"
        onClick={() => setExpanded(false)}
      >
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden sm:mx-auto sm:my-auto sm:max-h-[min(920px,calc(100dvh-1.5rem))] sm:w-full sm:max-w-6xl"
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
