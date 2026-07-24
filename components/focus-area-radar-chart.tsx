"use client"

import type { ScoringFocusAreaId } from "@aisd/shared"
import type { FocusAreaComparisonSeries } from "@/lib/walked-schools-comparison"

interface FocusAreaRadarChartProps {
  axes: { id: ScoringFocusAreaId; label: string }[]
  series: FocusAreaComparisonSeries[]
  size?: number
}

function polarPoint(
  center: number,
  radius: number,
  index: number,
  total: number,
  value: number,
): { x: number; y: number } {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2
  const distance = (Math.max(0, Math.min(100, value)) / 100) * radius
  return {
    x: center + distance * Math.cos(angle),
    y: center + distance * Math.sin(angle),
  }
}

function polygonPoints(
  center: number,
  radius: number,
  axes: { id: ScoringFocusAreaId }[],
  scores: Record<ScoringFocusAreaId, number | null>,
): string | null {
  const points = axes
    .map((axis, index) => {
      const score = scores[axis.id]
      if (score == null) return null
      const point = polarPoint(center, radius, index, axes.length, score)
      return `${point.x},${point.y}`
    })
    .filter((point): point is string => point !== null)

  return points.length >= 3 ? points.join(" ") : null
}

function truncateLabel(label: string, max = 18): string {
  if (label.length <= max) return label
  return `${label.slice(0, max - 1)}…`
}

export default function FocusAreaRadarChart({
  axes,
  series,
  size = 320,
}: FocusAreaRadarChartProps) {
  if (axes.length < 3) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
        Score at least three focus areas to show a comparison chart.
      </div>
    )
  }

  const padding = 72
  const viewSize = size + padding * 2
  const center = viewSize / 2
  const radius = size / 2
  const rings = [25, 50, 75, 100]

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${viewSize} ${viewSize}`}
        className="mx-auto h-auto w-full max-w-[28rem]"
        role="img"
        aria-label="Focus area comparison radar chart"
      >
        {rings.map((ring) => (
          <polygon
            key={ring}
            points={axes
              .map((_, index) => {
                const point = polarPoint(center, radius, index, axes.length, ring)
                return `${point.x},${point.y}`
              })
              .join(" ")}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={ring === 100 ? 1.5 : 1}
          />
        ))}

        {axes.map((axis, index) => {
          const outer = polarPoint(center, radius, index, axes.length, 100)
          const labelPoint = polarPoint(center, radius + 28, index, axes.length, 100)
          return (
            <g key={axis.id}>
              <line
                x1={center}
                y1={center}
                x2={outer.x}
                y2={outer.y}
                stroke="#cbd5e1"
                strokeWidth={1}
              />
              <text
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-slate-600 text-[10px] font-medium"
              >
                {truncateLabel(axis.label)}
              </text>
            </g>
          )
        })}

        {series.map((entry) => {
          const points = polygonPoints(center, radius, axes, entry.scores)
          if (!points) return null
          return (
            <polygon
              key={entry.id}
              points={points}
              fill={entry.dashed ? "none" : `${entry.color}22`}
              stroke={entry.color}
              strokeWidth={entry.dashed ? 2 : 2.5}
              strokeDasharray={entry.dashed ? "6 4" : undefined}
            />
          )
        })}

        {rings.map((ring) => (
          <text
            key={`label-${ring}`}
            x={center + 4}
            y={center - (ring / 100) * radius + 3}
            className="fill-slate-400 text-[9px]"
          >
            {ring}
          </text>
        ))}
      </svg>
    </div>
  )
}
