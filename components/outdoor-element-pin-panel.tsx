"use client"

import { Trash2 } from "lucide-react"
import type { OutdoorElementPin } from "@aisd/shared"
import {
  OUTDOOR_ELEMENT_TYPE_OPTIONS,
  outdoorElementPinLabel,
  outdoorElementTypeOption,
} from "@/lib/outdoor-element-types"

export default function OutdoorElementPinPanel({
  markingMode,
  selectedElementType,
  selectedPinId,
  pins,
  onToggleMarking,
  onSelectElementType,
  onSelectPin,
  onRemovePin,
}: {
  markingMode: boolean
  selectedElementType: string | null
  selectedPinId: string | null
  pins: OutdoorElementPin[]
  onToggleMarking: () => void
  onSelectElementType: (elementType: string | null) => void
  onRemovePin: (pinId: string) => void
  onSelectPin: (pinId: string | null) => void
}) {
  const selectedOption = selectedElementType
    ? outdoorElementTypeOption(selectedElementType)
    : undefined

  return (
    <div className="pointer-events-auto max-w-md rounded-xl border border-slate-700/80 bg-slate-950/92 px-3 py-2 text-xs text-slate-200 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-white">Mark outdoor elements</p>
        <button
          type="button"
          onClick={onToggleMarking}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
            markingMode
              ? "bg-[var(--color-primary)] text-white"
              : "border border-slate-600 text-slate-200"
          }`}
        >
          {markingMode ? "Placing pins" : "Place pins"}
        </button>
      </div>

      {markingMode && (
        <>
          <p className="mt-2 text-slate-400">
            Choose an element, then tap the map where it is located.
          </p>
          <div className="mt-2 max-h-32 space-y-1 overflow-y-auto overscroll-y-contain">
            {OUTDOOR_ELEMENT_TYPE_OPTIONS.map((option) => {
              const placed = pins.filter((pin) => pin.elementType === option.id)
              const active = selectedElementType === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onSelectElementType(active ? null : option.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${
                    active ? "bg-slate-800 ring-1 ring-slate-500" : "hover:bg-slate-900"
                  }`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: option.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {placed.length > 0 && (
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {placed.length} placed
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {selectedOption && (
            <p className="mt-2 rounded-lg bg-slate-900/80 px-2 py-1.5 text-amber-200">
              Tap the map to place{" "}
              <strong className="font-semibold text-white">{selectedOption.label}</strong>
              {!selectedOption.allowMultiple ? " (replaces any existing pin)" : ""}.
            </p>
          )}
        </>
      )}

      {pins.length > 0 && (
        <div className="mt-2 border-t border-slate-800 pt-2">
          <p className="font-medium text-white">Placed pins ({pins.length})</p>
          <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto overscroll-y-contain">
            {[...pins]
              .sort((a, b) => a.placedAt.localeCompare(b.placedAt))
              .map((pin) => {
                const option = outdoorElementTypeOption(pin.elementType)
                const active = selectedPinId === pin.id
                return (
                  <li
                    key={pin.id}
                    className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${
                      active ? "bg-slate-800" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectPin(active ? null : pin.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: option?.color ?? "#f59e0b" }}
                      />
                      <span className="truncate">{outdoorElementPinLabel(pin, pins)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemovePin(pin.id)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-red-300"
                      aria-label={`Remove ${outdoorElementPinLabel(pin, pins)}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                )
              })}
          </ul>
        </div>
      )}
    </div>
  )
}
