"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Info, Map as MapIcon, X } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import SurveyFloorPlan from "@/components/survey-floor-plan"
import { useFloorPlanDisplay } from "@/lib/use-floor-plan-display"
import {
  countMappingsBySpaceType,
  defaultPreWalkSurveyType,
  getPreWalkMapping,
  preWalkMappingList,
  preWalkMappingsByRoomForSurvey,
  preWalkSpaceTypeColor,
  preWalkSurveyTypesForSchool,
  PREWALK_DESIGN_INTENT_NOTE,
  PREWALK_DESIGN_INTENT_SHORT,
  PREWALK_DESIGN_INTENT_TITLE,
  spaceTypeOptionsForPreWalk,
} from "@/lib/prewalk"
import { loadRoomUseMap, roomUseForRoom, type RoomUseMap } from "@/lib/room-neighborhood-lookup"
import { cn } from "@/lib/utils"
import { surveyTypeLabel, type SurveyType } from "@aisd/shared"

interface PreWalkModalProps {
  open: boolean
  onClose: () => void
  /** First-time flow — marks pre-walk complete when starting survey */
  initialFlow?: boolean
}

export default function PreWalkModal({ open, onClose, initialFlow = false }: PreWalkModalProps) {
  const {
    state,
    setLevel,
    setPreWalkMapping,
    updatePreWalkNotes,
    removePreWalkMapping,
    clearPreWalkMappingsForSurvey,
    completePreWalk,
    savePreWalkToCloud,
    skipPreWalk,
  } = useSurvey()

  useFloorPlanDisplay(open)

  const [saving, setSaving] = useState(false)

  const surveyOptions = useMemo(
    () => preWalkSurveyTypesForSchool(state.school?.schoolClass),
    [state.school?.schoolClass],
  )

  const [selectedSurveyType, setSelectedSurveyType] = useState<SurveyType>("studios")
  const [activeSpaceType, setActiveSpaceType] = useState<string | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [note1, setNote1] = useState("")
  const [note2, setNote2] = useState("")
  const [typesPanelOpen, setTypesPanelOpen] = useState(true)
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(true)
  const [mobilePickerExpanded, setMobilePickerExpanded] = useState(false)
  const [showDesignIntentPopup, setShowDesignIntentPopup] = useState(false)
  const [roomUseMap, setRoomUseMap] = useState<RoomUseMap>(new Map())

  useEffect(() => {
    if (open) setShowDesignIntentPopup(true)
  }, [open])

  useEffect(() => {
    if (!open || !surveyOptions.length) return
    setSelectedSurveyType((current) =>
      surveyOptions.includes(current)
        ? current
        : defaultPreWalkSurveyType(state.surveyType, state.school?.schoolClass),
    )
  }, [open, surveyOptions, state.surveyType, state.school?.schoolClass])

  useEffect(() => {
    if (!open) return
    setActiveSpaceType(null)
    setSelectedRoomId(null)
    setMobilePickerExpanded(false)
  }, [open, selectedSurveyType])

  useEffect(() => {
    if (activeSpaceType) setMobilePickerExpanded(false)
  }, [activeSpaceType])

  const spaceTypeOptions = useMemo(
    () => spaceTypeOptionsForPreWalk(selectedSurveyType, state.school?.schoolClass),
    [selectedSurveyType, state.school?.schoolClass],
  )

  const surveyMappings = useMemo(
    () => preWalkMappingsByRoomForSurvey(state.preWalk.mappings, selectedSurveyType),
    [state.preWalk.mappings, selectedSurveyType],
  )

  const mappingCounts = useMemo(
    () => countMappingsBySpaceType(state.preWalk.mappings, selectedSurveyType),
    [state.preWalk.mappings, selectedSurveyType],
  )

  const mappedCountForSurvey = preWalkMappingList(state.preWalk.mappings, selectedSurveyType).length
  const totalMappedCount = preWalkMappingList(state.preWalk.mappings).length
  const levelId = state.selectedLevelId ?? state.floorPlan?.defaultLevelId ?? "floor-1"
  const displayLevel = state.floorPlan?.levels.find((level) => level.id === levelId)
  const mapDisplayReady = !!displayLevel?.src
  const selectedMapping = selectedRoomId
    ? getPreWalkMapping(state.preWalk.mappings, selectedSurveyType, selectedRoomId)
    : undefined
  const selectedRoom = selectedRoomId
    ? state.allRooms.find((r) => r.id === selectedRoomId)
    : undefined

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open || !state.school) {
      setRoomUseMap(new Map())
      return
    }
    let cancelled = false
    loadRoomUseMap(state.school).then((map) => {
      if (!cancelled) setRoomUseMap(map)
    })
    return () => {
      cancelled = true
    }
  }, [open, state.school?.id, state.school?.name])

  const selectedRoomUse = selectedRoomId
    ? roomUseForRoom(roomUseMap, selectedRoomId)
    : undefined

  useEffect(() => {
    if (!selectedRoomId) {
      setNote1("")
      setNote2("")
      return
    }
    const mapping = getPreWalkMapping(state.preWalk.mappings, selectedSurveyType, selectedRoomId)
    setNote1(mapping?.note1 ?? "")
    setNote2(mapping?.note2 ?? "")
    setDetailsPanelOpen(true)
  }, [selectedRoomId, selectedSurveyType, state.preWalk.mappings])

  const handleRoomTap = (roomId: string) => {
    setSelectedRoomId(roomId)
    setMobilePickerExpanded(false)
    if (activeSpaceType) {
      setPreWalkMapping(selectedSurveyType, roomId, activeSpaceType)
    }
  }

  const handleAssignActiveSpaceType = (dismissSheet = false) => {
    if (!selectedRoomId || !activeSpaceType) return
    setPreWalkMapping(selectedSurveyType, selectedRoomId, activeSpaceType)
    updatePreWalkNotes(selectedSurveyType, selectedRoomId, note1, note2)
    if (dismissSheet) setSelectedRoomId(null)
  }

  const handleSaveNotes = () => {
    if (!selectedRoomId || !selectedMapping) return
    updatePreWalkNotes(selectedSurveyType, selectedRoomId, note1, note2)
  }

  const handleRemoveMapping = () => {
    if (!selectedRoomId) return
    removePreWalkMapping(selectedSurveyType, selectedRoomId)
    setSelectedRoomId(null)
  }

  const handleClearAllMappings = () => {
    if (mappedCountForSurvey === 0) return
    const surveyLabel = surveyTypeLabel(selectedSurveyType)
    if (
      !window.confirm(
        `Remove all ${mappedCountForSurvey} room assignment${mappedCountForSurvey === 1 ? "" : "s"} for ${surveyLabel}?`,
      )
    ) {
      return
    }
    clearPreWalkMappingsForSurvey(selectedSurveyType)
    setSelectedRoomId(null)
  }

  const handleStartSurvey = () => {
    void (async () => {
      setSaving(true)
      try {
        if (initialFlow || totalMappedCount > 0) completePreWalk()
        await savePreWalkToCloud()
      } finally {
        setSaving(false)
        onClose()
      }
    })()
  }

  const handleSkip = () => {
    if (initialFlow) skipPreWalk()
    onClose()
  }

  const spaceTypeNoun =
    selectedSurveyType === "studios" ? "studio type" : "space type"

  const activeSpaceTypeColor = activeSpaceType
    ? preWalkSpaceTypeColor(activeSpaceType, spaceTypeOptions)
    : null

  if (!open || typeof document === "undefined" || !surveyOptions.length) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-slate-900">
      <header className="relative z-30 flex shrink-0 items-center gap-3 border-b border-slate-700/50 bg-slate-900/95 px-4 py-2.5 shadow-sm backdrop-blur-sm">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <MapIcon className="h-5 w-5 shrink-0 text-blue-400" aria-hidden />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-white">Building pre-walk</h2>
            <p className="truncate text-[11px] text-slate-400">
              {state.school?.displayName ?? "School"} · {totalMappedCount} assignment
              {totalMappedCount === 1 ? "" : "s"} mapped
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {initialFlow && (
            <button
              type="button"
              onClick={handleSkip}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 active:bg-slate-800"
            >
              Skip
            </button>
          )}
          {!initialFlow && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 active:bg-slate-800"
              aria-label="Close pre-walk"
            >
              <X className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleStartSurvey}
            disabled={saving}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white active:opacity-90 disabled:cursor-wait disabled:opacity-70"
          >
            {saving ? "Saving…" : initialFlow ? "Start survey" : "Done"}
          </button>
        </div>
      </header>

      {state.floorPlan && mapDisplayReady && !state.floorPlanLoading && (
        <div className="relative z-30 hidden shrink-0 border-b border-slate-700/40 bg-slate-900/95 px-3 py-2 backdrop-blur-sm 2xl:block">
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {state.floorPlan.levels.map((level) => (
              <button
                key={level.id}
                type="button"
                onClick={() => setLevel(level.id)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  level.id === levelId
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-slate-800 text-slate-300 active:bg-slate-700",
                )}
              >
                {level.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {showDesignIntentPopup && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[1px]">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="prewalk-design-intent-title"
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <Info className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3
                    id="prewalk-design-intent-title"
                    className="text-base font-semibold text-slate-900"
                  >
                    {PREWALK_DESIGN_INTENT_TITLE}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {PREWALK_DESIGN_INTENT_NOTE}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDesignIntentPopup(false)}
                className="mt-5 w-full rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white active:opacity-90"
              >
                Continue mapping
              </button>
            </div>
          </div>
        )}

        {state.floorPlanLoading || !state.floorPlan ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            {state.floorPlanLoading ? "Loading rooms…" : "No floor plan available for this school. You can still assign rooms from the survey room list."}
          </div>
        ) : !mapDisplayReady ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Loading floor plan…
          </div>
        ) : (
          <div className="absolute inset-0 pb-16 2xl:pb-0">
            <SurveyFloorPlan
              variant="prewalk"
              preWalkMappings={surveyMappings}
              preWalkActiveSpaceType={activeSpaceType}
              preWalkSelectedRoomId={selectedRoomId}
              preWalkSpaceTypeColor={(type) => preWalkSpaceTypeColor(type, spaceTypeOptions)}
              onPreWalkRoomTap={handleRoomTap}
            />
          </div>
        )}

        {/* Survey + space types — desktop left panel */}
        <div
          className={cn(
            "pointer-events-none absolute left-0 top-0 z-20 hidden max-h-full flex-col pt-2 transition-transform duration-200 2xl:flex",
            typesPanelOpen ? "translate-x-0" : "-translate-x-[calc(100%-2.5rem)]",
          )}
        >
          <aside className="pointer-events-auto flex max-h-[calc(100%-0.5rem)] w-[min(17rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-r-2xl border border-slate-200/80 bg-white/95 shadow-xl backdrop-blur-sm">
            <div className="shrink-0 border-b border-slate-100 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                Survey
              </p>
              <div className="relative mt-1.5">
                <select
                  value={selectedSurveyType}
                  onChange={(event) =>
                    setSelectedSurveyType(event.target.value as SurveyType)
                  }
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-slate-900 outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-100"
                  aria-label="Select survey to map"
                >
                  {surveyOptions.map((surveyType) => (
                    <option key={surveyType} value={surveyType}>
                      {surveyTypeLabel(surveyType)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
              </div>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                {spaceTypeNoun}s
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                Pick a type, then tap rooms on the map.
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                {mappedCountForSurvey} mapped in this survey
              </p>
              {mappedCountForSurvey > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllMappings}
                  className="mt-2 w-full rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] font-semibold text-red-700 active:bg-red-100"
                >
                  Clear all assignments
                </button>
              )}
              <div className="mt-2.5 rounded-xl border border-amber-200/80 bg-amber-50 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                  Assessor note
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-amber-950">
                  {PREWALK_DESIGN_INTENT_SHORT}
                </p>
              </div>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {spaceTypeOptions.map((type) => {
                const count = mappingCounts.get(type) ?? 0
                const active = activeSpaceType === type
                const color = preWalkSpaceTypeColor(type, spaceTypeOptions)
                return (
                  <li key={type}>
                    <button
                      type="button"
                      onClick={() => setActiveSpaceType(type)}
                      className={cn(
                        "mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                        active
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-800 active:bg-slate-50",
                      )}
                    >
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">{type}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>
          <button
            type="button"
            onClick={() => setTypesPanelOpen((v) => !v)}
            className="pointer-events-auto absolute -right-8 top-3 flex h-8 w-8 items-center justify-center rounded-r-lg border border-l-0 border-slate-200/80 bg-white/95 text-slate-600 shadow-md backdrop-blur-sm"
            aria-label={typesPanelOpen ? "Hide mapping panel" : "Show mapping panel"}
          >
            {typesPanelOpen ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Room details — desktop right panel */}
        {selectedRoomId && (
          <div
            className={cn(
              "pointer-events-none absolute right-0 top-0 z-20 hidden max-h-full flex-col pt-2 transition-transform duration-200 2xl:flex",
              detailsPanelOpen ? "translate-x-0" : "translate-x-[calc(100%-2.5rem)]",
            )}
          >
            <button
              type="button"
              onClick={() => setDetailsPanelOpen((v) => !v)}
              className="pointer-events-auto absolute -left-8 top-3 flex h-8 w-8 items-center justify-center rounded-l-lg border border-r-0 border-slate-200/80 bg-white/95 text-slate-600 shadow-md backdrop-blur-sm"
              aria-label={detailsPanelOpen ? "Hide room details" : "Show room details"}
            >
              {detailsPanelOpen ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
            <aside className="pointer-events-auto flex max-h-[calc(100%-0.5rem)] w-[min(18rem,calc(100vw-3rem))] flex-col overflow-y-auto rounded-l-2xl border border-slate-200/80 bg-white/95 shadow-xl backdrop-blur-sm">
              <div className="flex items-start justify-between border-b border-slate-100 px-3 py-2.5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Room details
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">
                    {selectedRoom?.name ?? `Room ${selectedRoomId}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRoomId(null)}
                  className="rounded-lg p-1 text-slate-400 active:bg-slate-100"
                  aria-label="Deselect room"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 px-3 py-3">
                <p className="text-[11px] text-slate-500">Floor plan id: {selectedRoomId}</p>
                {selectedRoomUse && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Room use
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-slate-900">
                      {selectedRoomUse.id}
                    </p>
                    {selectedRoomUse.useName &&
                      selectedRoomUse.useName.toUpperCase() !==
                        selectedRoomUse.id.toUpperCase() && (
                        <p className="mt-0.5 text-xs leading-snug text-slate-600">
                          {selectedRoomUse.useName}
                        </p>
                      )}
                  </div>
                )}

                {selectedMapping ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Assigned type
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-slate-900">
                      {selectedMapping.spaceType}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {surveyTypeLabel(selectedSurveyType)}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-amber-700">
                    {activeSpaceType
                      ? `Tap again to assign as “${activeSpaceType}”.`
                      : "Select a space type on the left, then tap this room."}
                  </p>
                )}

                {activeSpaceType && (
                  <button
                    type="button"
                    onClick={() =>
                      setPreWalkMapping(selectedSurveyType, selectedRoomId, activeSpaceType)
                    }
                    className="w-full rounded-xl border border-[var(--color-primary)] bg-blue-50 px-3 py-2 text-sm font-semibold text-[var(--color-primary)] active:bg-blue-100"
                  >
                    Assign as {activeSpaceType}
                  </button>
                )}

                <div>
                  <label
                    htmlFor="prewalk-note-1"
                    className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                  >
                    Note 1
                  </label>
                  <textarea
                    id="prewalk-note-1"
                    value={note1}
                    onChange={(e) => setNote1(e.target.value)}
                    onBlur={handleSaveNotes}
                    rows={2}
                    placeholder="Location, use, or condition notes…"
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="prewalk-note-2"
                    className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                  >
                    Note 2
                  </label>
                  <textarea
                    id="prewalk-note-2"
                    value={note2}
                    onChange={(e) => setNote2(e.target.value)}
                    onBlur={handleSaveNotes}
                    rows={2}
                    placeholder="Optional second note…"
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {selectedMapping && (
                  <button
                    type="button"
                    onClick={handleRemoveMapping}
                    className="w-full rounded-xl px-3 py-2 text-sm font-medium text-red-600 active:bg-red-50"
                  >
                    Remove assignment
                  </button>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* Phone / tablet: bottom sheet — pick survey + space type */}
        {!selectedRoomId && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 2xl:hidden">
            {mobilePickerExpanded && (
              <button
                type="button"
                className="pointer-events-auto fixed inset-0 bg-slate-900/40"
                onClick={() => setMobilePickerExpanded(false)}
                aria-label="Close type picker"
              />
            )}
            <div
              className={cn(
                "pointer-events-auto relative flex flex-col overflow-hidden rounded-t-2xl border border-b-0 border-slate-200/80 bg-white shadow-2xl transition-[max-height] duration-200",
                mobilePickerExpanded ? "max-h-[min(58vh,28rem)]" : "max-h-[3.75rem]",
              )}
            >
              <button
                type="button"
                onClick={() => setMobilePickerExpanded((expanded) => !expanded)}
                className="flex shrink-0 items-center gap-2 px-3 py-3 text-left active:bg-slate-50"
                aria-expanded={mobilePickerExpanded}
              >
                {activeSpaceTypeColor ? (
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: activeSpaceTypeColor }}
                    aria-hidden
                  />
                ) : (
                  <span className="inline-block h-3 w-3 shrink-0 rounded-sm bg-slate-200" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {activeSpaceType ?? `Choose ${spaceTypeNoun}`}
                  </span>
                  <span className="block truncate text-[10px] text-slate-500">
                    {surveyTypeLabel(selectedSurveyType)} · {displayLevel?.label ?? "Floor"} ·{" "}
                    {mappedCountForSurvey} mapped
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
                      Survey
                    </p>
                    <div className="relative mt-1">
                      <select
                        value={selectedSurveyType}
                        onChange={(event) =>
                          setSelectedSurveyType(event.target.value as SurveyType)
                        }
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-slate-900 outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-100"
                        aria-label="Select survey to map"
                      >
                        {surveyOptions.map((surveyType) => (
                          <option key={surveyType} value={surveyType}>
                            {surveyTypeLabel(surveyType)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden
                      />
                    </div>
                    {state.floorPlan && (
                      <div className="mt-2 flex gap-1 overflow-x-auto scrollbar-none">
                        {state.floorPlan.levels.map((level) => (
                          <button
                            key={level.id}
                            type="button"
                            onClick={() => setLevel(level.id)}
                            className={cn(
                              "shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                              level.id === levelId
                                ? "bg-[var(--color-primary)] text-white"
                                : "bg-slate-100 text-slate-600 active:bg-slate-200",
                            )}
                          >
                            {level.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                    {spaceTypeOptions.map((type) => {
                      const count = mappingCounts.get(type) ?? 0
                      const active = activeSpaceType === type
                      const color = preWalkSpaceTypeColor(type, spaceTypeOptions)
                      return (
                        <li key={type}>
                          <button
                            type="button"
                            onClick={() => setActiveSpaceType(type)}
                            className={cn(
                              "mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                              active
                                ? "bg-slate-900 text-white shadow-sm"
                                : "text-slate-800 active:bg-slate-50",
                            )}
                          >
                            <span
                              className="inline-block h-3 w-3 shrink-0 rounded-sm"
                              style={{ backgroundColor: color }}
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1 truncate font-medium">{type}</span>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600",
                              )}
                            >
                              {count}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Phone / tablet: bottom sheet — room details */}
        {selectedRoomId && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-40 2xl:hidden"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-auto flex max-h-[min(72vh,32rem)] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-slate-200/80 bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-100 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Room details
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                    {selectedRoom?.name ?? `Room ${selectedRoomId}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRoomId(null)}
                  className="rounded-lg p-1 text-slate-400 active:bg-slate-100"
                  aria-label="Deselect room"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-3 px-3 py-3">
                  <p className="text-[11px] text-slate-500">Floor plan id: {selectedRoomId}</p>
                  {selectedRoomUse && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Room use
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-slate-900">
                        {selectedRoomUse.id}
                      </p>
                      {selectedRoomUse.useName &&
                        selectedRoomUse.useName.toUpperCase() !==
                          selectedRoomUse.id.toUpperCase() && (
                          <p className="mt-0.5 text-xs leading-snug text-slate-600">
                            {selectedRoomUse.useName}
                          </p>
                        )}
                    </div>
                  )}

                  {selectedMapping ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Assigned type
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-slate-900">
                        {selectedMapping.spaceType}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {surveyTypeLabel(selectedSurveyType)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700">
                      {activeSpaceType
                        ? `Tap again to assign as “${activeSpaceType}”.`
                        : "Select a space type from the picker, then tap this room."}
                    </p>
                  )}

                  {activeSpaceType && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleAssignActiveSpaceType(true)
                      }}
                      className="w-full rounded-xl border border-[var(--color-primary)] bg-blue-50 px-3 py-2 text-sm font-semibold text-[var(--color-primary)] active:bg-blue-100"
                    >
                      {selectedMapping?.spaceType === activeSpaceType
                        ? "Done"
                        : `Assign as ${activeSpaceType}`}
                    </button>
                  )}

                  <div>
                    <label
                      htmlFor="prewalk-note-1-mobile"
                      className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                    >
                      Note 1
                    </label>
                    <textarea
                      id="prewalk-note-1-mobile"
                      value={note1}
                      onChange={(e) => setNote1(e.target.value)}
                      onBlur={handleSaveNotes}
                      rows={2}
                      placeholder="Location, use, or condition notes…"
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="prewalk-note-2-mobile"
                      className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                    >
                      Note 2
                    </label>
                    <textarea
                      id="prewalk-note-2-mobile"
                      value={note2}
                      onChange={(e) => setNote2(e.target.value)}
                      onBlur={handleSaveNotes}
                      rows={2}
                      placeholder="Optional second note…"
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {selectedMapping && (
                    <button
                      type="button"
                      onClick={handleRemoveMapping}
                      className="w-full rounded-xl px-3 py-2 text-sm font-medium text-red-600 active:bg-red-50"
                    >
                      Remove assignment
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active type hint — desktop only */}
        {activeSpaceType && !selectedRoomId && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden max-w-[90vw] -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-center text-xs font-medium text-white shadow-lg backdrop-blur-sm 2xl:block">
            Tap rooms on the map to assign as{" "}
            <span className="font-semibold">{activeSpaceType}</span>
            {" · "}
            {surveyTypeLabel(selectedSurveyType)}
          </div>
        )}

        {!activeSpaceType && !selectedRoomId && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden max-w-[90vw] -translate-x-1/2 rounded-full bg-slate-900/75 px-4 py-2 text-center text-xs text-white shadow-lg backdrop-blur-sm 2xl:block">
            Choose a survey and {spaceTypeNoun} on the left to begin mapping rooms
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
