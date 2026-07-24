"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, CheckCircle2, ChevronDown, CircleHelp, Map, Search, X } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import SurveyFloorPlan from "@/components/survey-floor-plan"
import {
  ADMIN_SPACE_TYPE_OPTIONS,
  ARRIVAL_SPACE_TYPE_OPTIONS,
  GRADE_OPTIONS,
  NEIGHBORHOOD_OPTIONS,
  NEIGHBORHOOD_SPACE_TYPE_OPTIONS,
  STUDIO_TYPE_OPTIONS,
  getRoomSurveyRubric,
  isAdminSpaceType,
  isArrivalSpaceType,
  isClassroomRoom,
  isNeighborhoodSpaceType,
  isRoomComplete,
  isStudioType,
  type AdminSpaceType,
  type ArrivalSpaceType,
  type NeighborhoodSpaceType,
  type StudioType,
} from "@aisd/shared"
import { roomNeedsCloseOut } from "@/lib/closeout"
import { validateRoomSession } from "@/lib/survey-validation"
import { cn } from "@/lib/utils"
import { useSelectRoomWithConfirm } from "@/components/use-select-room-with-confirm"

interface RoomSelectorProps {
  showFloorPlan: boolean
  onOpenFloorPlan: () => void
  onCloseFloorPlan: () => void
}

export default function RoomSelector({
  showFloorPlan,
  onOpenFloorPlan,
  onCloseFloorPlan,
}: RoomSelectorProps) {
  const {
    state,
    addManualRoom,
    setGrade,
    setNeighborhood,
    setPendingStudioType,
    currentRoomSession,
    submitValidation,
  } = useSurvey()
  const { requestSelectRoom, completedRoomDialog } = useSelectRoomWithConfirm()
  const selectedId = state.selectedRoomId
  const plan = state.floorPlan
  const showStudioType = state.surveyType === "studios"
  const showAdminSpaceType = state.surveyType === "administration"
  const showArrivalSpaceType = state.surveyType === "arrival"
  const showNeighborhoodSpaceType = state.surveyType === "neighborhoods"
  const showSpaceType =
    showStudioType || showAdminSpaceType || showArrivalSpaceType || showNeighborhoodSpaceType
  const showNeighborhood =
    (state.surveyType === "studios" || state.surveyType === "neighborhoods") && !!selectedId
  const selectedStudioType =
    (currentRoomSession && isStudioType(currentRoomSession.roomType)
      ? currentRoomSession.roomType
      : null) ??
    (state.pendingStudioType && isStudioType(state.pendingStudioType) ? state.pendingStudioType : "")
  const selectedAdminSpaceType =
    (currentRoomSession && isAdminSpaceType(currentRoomSession.roomType)
      ? currentRoomSession.roomType
      : null) ??
    (state.pendingStudioType && isAdminSpaceType(state.pendingStudioType)
      ? state.pendingStudioType
      : "")
  const selectedArrivalSpaceType =
    (currentRoomSession && isArrivalSpaceType(currentRoomSession.roomType)
      ? currentRoomSession.roomType
      : null) ??
    (state.pendingStudioType && isArrivalSpaceType(state.pendingStudioType)
      ? state.pendingStudioType
      : "")
  const selectedNeighborhoodSpaceType =
    (currentRoomSession && isNeighborhoodSpaceType(currentRoomSession.roomType)
      ? currentRoomSession.roomType
      : null) ??
    (state.pendingStudioType && isNeighborhoodSpaceType(state.pendingStudioType)
      ? state.pendingStudioType
      : "")
  const selectedSpaceType = showAdminSpaceType
    ? selectedAdminSpaceType
    : showArrivalSpaceType
      ? selectedArrivalSpaceType
      : showNeighborhoodSpaceType
        ? selectedNeighborhoodSpaceType
        : selectedStudioType
  const spaceTypeReady = !showSpaceType || !!selectedSpaceType
  const spaceTypeNoun = showStudioType ? "studio type" : "space type"
  const showGrade = false
  const floorPlanOpen = spaceTypeReady && showFloorPlan
  const [roomPickerOpen, setRoomPickerOpen] = useState(false)
  const [gradePickerOpen, setGradePickerOpen] = useState(false)
  const [neighborhoodPickerOpen, setNeighborhoodPickerOpen] = useState(false)
  const [studioTypePickerOpen, setStudioTypePickerOpen] = useState(false)
  const [traditionalGuidanceOpen, setTraditionalGuidanceOpen] = useState(false)
  const [roomQuery, setRoomQuery] = useState("")
  const [manualRoomNumber, setManualRoomNumber] = useState("")
  const [manualBuilding, setManualBuilding] = useState("")
  const [manualAddOpen, setManualAddOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const manualRoomRef = useRef<HTMLInputElement>(null)
  const selectedGrade = currentRoomSession?.gradeType ?? ""
  const selectedNeighborhood = currentRoomSession?.neighborhood ?? ""

  const buildingOptions = useMemo(() => {
    const set = new Set<string>()
    const level = state.floorPlan?.levels.find((l) => l.id === state.selectedLevelId)
    for (const b of level?.buildings ?? []) {
      if (b.trim()) set.add(b.trim())
    }
    for (const room of state.allRooms) {
      if (room.building?.trim() && (!state.selectedLevelId || room.levelId === state.selectedLevelId)) {
        set.add(room.building.trim())
      }
    }
    // Fall back to all levels if current floor has no building tags yet.
    if (set.size === 0) {
      for (const lvl of state.floorPlan?.levels ?? []) {
        for (const b of lvl.buildings ?? []) {
          if (b.trim()) set.add(b.trim())
        }
      }
      for (const room of state.allRooms) {
        if (room.building?.trim()) set.add(room.building.trim())
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [state.allRooms, state.floorPlan, state.selectedLevelId])

  const requiresManualBuilding = buildingOptions.length > 1
  const canAddManualRoom =
    !!manualRoomNumber.trim() && (!requiresManualBuilding || !!manualBuilding)

  const gradeMissing =
    !!selectedId &&
    showGrade &&
    (!!currentRoomSession?.pendingGrade ||
      !!submitValidation?.rooms.some((r) => r.roomId === selectedId && r.missingGrade))

  const roomOptions = useMemo(() => {
    let byLevel = state.allRooms.filter(
      (r) => r.levelId === state.selectedLevelId && isClassroomRoom(r),
    )
    if (state.surveyType === "closeout" && state.session) {
      byLevel = byLevel.filter((r) => {
        const rs = state.session!.rooms[r.id]
        return !!rs && roomNeedsCloseOut(rs)
      })
    }
    if (selectedId && !byLevel.some((r) => r.id === selectedId)) {
      const selected = state.allRooms.find((r) => r.id === selectedId)
      if (selected) return [selected, ...byLevel]
    }
    return byLevel.sort((a, b) => a.name.localeCompare(b.name))
  }, [state.allRooms, state.selectedLevelId, selectedId, state.surveyType, state.session])

  const filteredRooms = useMemo(() => {
    const q = roomQuery.trim().toLowerCase()
    if (!q) return roomOptions
    return roomOptions.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (r.building?.toLowerCase().includes(q) ?? false),
    )
  }, [roomOptions, roomQuery])

  const studioTypeProgress = useMemo(() => {
    const map = Object.fromEntries(
      STUDIO_TYPE_OPTIONS.map((type) => [type, { started: 0, complete: 0 }]),
    ) as Record<StudioType, { started: number; complete: number }>

    if (!state.session || state.surveyType !== "studios") return map

    for (const room of Object.values(state.session.rooms)) {
      if (!isStudioType(room.roomType)) continue
      const started = room.responses.length > 0 || !!room.gradeType || !!room.deferredToCloseOut
      if (!started) continue
      map[room.roomType].started += 1

      const detail = state.roomScoreDetails[room.roomId]
      const fullyScored = !!(detail && isRoomComplete(detail, room.gradeType, room.roomType))
      const rubric = getRoomSurveyRubric("studios", room.roomType, room.gradeType)
      const submitReady =
        !!rubric &&
        validateRoomSession(room.roomId, room.roomId, room, rubric.questions, { forSubmit: true })
          .complete
      if (fullyScored || submitReady) {
        map[room.roomType].complete += 1
      }
    }
    return map
  }, [state.session, state.roomScoreDetails, state.surveyType])

  const adminSpaceTypeProgress = useMemo(() => {
    const map = Object.fromEntries(
      ADMIN_SPACE_TYPE_OPTIONS.map((type) => [type, { started: 0, complete: 0 }]),
    ) as Record<AdminSpaceType, { started: number; complete: number }>

    if (!state.session || state.surveyType !== "administration") return map

    for (const room of Object.values(state.session.rooms)) {
      if (!isAdminSpaceType(room.roomType)) continue
      const started = room.responses.length > 0 || !!room.deferredToCloseOut
      if (!started) continue
      map[room.roomType].started += 1

      const detail = state.roomScoreDetails[room.roomId]
      const fullyScored = !!(detail && isRoomComplete(detail, room.gradeType, room.roomType))
      const rubric = getRoomSurveyRubric("administration", room.roomType, room.gradeType)
      const submitReady =
        !!rubric &&
        validateRoomSession(room.roomId, room.roomId, room, rubric.questions, { forSubmit: true })
          .complete
      if (fullyScored || submitReady) {
        map[room.roomType].complete += 1
      }
    }
    return map
  }, [state.session, state.roomScoreDetails, state.surveyType])

  const arrivalSpaceTypeProgress = useMemo(() => {
    const map = Object.fromEntries(
      ARRIVAL_SPACE_TYPE_OPTIONS.map((type) => [type, { started: 0, complete: 0 }]),
    ) as Record<ArrivalSpaceType, { started: number; complete: number }>

    if (!state.session || state.surveyType !== "arrival") return map

    for (const room of Object.values(state.session.rooms)) {
      if (!isArrivalSpaceType(room.roomType)) continue
      const started = room.responses.length > 0 || !!room.deferredToCloseOut
      if (!started) continue
      map[room.roomType].started += 1

      const detail = state.roomScoreDetails[room.roomId]
      const fullyScored = !!(detail && isRoomComplete(detail, room.gradeType, room.roomType))
      const rubric = getRoomSurveyRubric("arrival", room.roomType, room.gradeType)
      const submitReady =
        !!rubric &&
        validateRoomSession(room.roomId, room.roomId, room, rubric.questions, { forSubmit: true })
          .complete
      if (fullyScored || submitReady) {
        map[room.roomType].complete += 1
      }
    }
    return map
  }, [state.session, state.roomScoreDetails, state.surveyType])

  const neighborhoodSpaceTypeProgress = useMemo(() => {
    const map = Object.fromEntries(
      NEIGHBORHOOD_SPACE_TYPE_OPTIONS.map((type) => [type, { started: 0, complete: 0 }]),
    ) as Record<NeighborhoodSpaceType, { started: number; complete: number }>

    if (!state.session || state.surveyType !== "neighborhoods") return map

    for (const room of Object.values(state.session.rooms)) {
      if (!isNeighborhoodSpaceType(room.roomType)) continue
      const started = room.responses.length > 0 || !!room.deferredToCloseOut
      if (!started) continue
      map[room.roomType].started += 1

      const detail = state.roomScoreDetails[room.roomId]
      const fullyScored = !!(detail && isRoomComplete(detail, room.gradeType, room.roomType))
      const rubric = getRoomSurveyRubric("neighborhoods", room.roomType, room.gradeType)
      const submitReady =
        !!rubric &&
        validateRoomSession(room.roomId, room.roomId, room, rubric.questions, { forSubmit: true })
          .complete
      if (fullyScored || submitReady) {
        map[room.roomType].complete += 1
      }
    }
    return map
  }, [state.session, state.roomScoreDetails, state.surveyType])

  const spaceTypeOptions = showAdminSpaceType
    ? ADMIN_SPACE_TYPE_OPTIONS
    : showArrivalSpaceType
      ? ARRIVAL_SPACE_TYPE_OPTIONS
      : showNeighborhoodSpaceType
        ? NEIGHBORHOOD_SPACE_TYPE_OPTIONS
        : STUDIO_TYPE_OPTIONS

  const selectedRoom = selectedId
    ? state.allRooms.find((r) => r.id === selectedId) ?? roomOptions.find((r) => r.id === selectedId)
    : null

  const handleSelectRoom = (roomId: string | null) => {
    if (roomId && showSpaceType && !selectedSpaceType) return
    setRoomPickerOpen(false)
    setRoomQuery("")
    setManualRoomNumber("")
    setManualBuilding("")
    setManualAddOpen(false)
    requestSelectRoom(roomId, {
      afterSelect: roomId ? onCloseFloorPlan : undefined,
      onChooseDifferent: () => setRoomPickerOpen(true),
    })
  }

  const handleAddManualRoom = () => {
    if (state.surveyType === "closeout") return
    const value = manualRoomNumber.trim()
    if (!value) return
    if (requiresManualBuilding && !manualBuilding) return
    if (showSpaceType && !selectedSpaceType) return
    addManualRoom(value, requiresManualBuilding ? manualBuilding : undefined)
    setRoomPickerOpen(false)
    setRoomQuery("")
    setManualRoomNumber("")
    setManualBuilding("")
    setManualAddOpen(false)
    onCloseFloorPlan()
  }

  const handleSelectStudioType = (roomType: string) => {
    setPendingStudioType(roomType || null)
    setStudioTypePickerOpen(false)
    if (roomType === "Traditional studio") {
      setTraditionalGuidanceOpen(true)
    }
  }

  const handleSelectGrade = (grade: string) => {
    if (!selectedId) return
    setGrade(selectedId, grade)
    setGradePickerOpen(false)
  }

  const handleSelectNeighborhood = (neighborhood: string) => {
    if (!selectedId) return
    setNeighborhood(selectedId, neighborhood)
    setNeighborhoodPickerOpen(false)
  }

  const pickerOpen =
    roomPickerOpen ||
    (showGrade && gradePickerOpen) ||
    neighborhoodPickerOpen ||
    studioTypePickerOpen

  useEffect(() => {
    if (!showGrade) setGradePickerOpen(false)
  }, [showGrade])

  useEffect(() => {
    if (!showNeighborhood) setNeighborhoodPickerOpen(false)
  }, [showNeighborhood])

  useEffect(() => {
    if (!pickerOpen) return
    if (roomPickerOpen) {
      setRoomQuery("")
      setManualBuilding("")
      setManualAddOpen(false)
      requestAnimationFrame(() => searchRef.current?.focus())
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRoomPickerOpen(false)
        setGradePickerOpen(false)
        setNeighborhoodPickerOpen(false)
        setStudioTypePickerOpen(false)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [pickerOpen, roomPickerOpen])

  useEffect(() => {
    if (!traditionalGuidanceOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTraditionalGuidanceOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [traditionalGuidanceOpen])

  return (
    <div className="space-y-3 border-b border-slate-200/80 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
      {completedRoomDialog}
      {showSpaceType && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5">
            <label
              htmlFor="studio-type-select-trigger"
              className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
            >
              {showStudioType ? "Studio type" : "Space type"}
            </label>
            {selectedStudioType === "Traditional studio" && (
              <button
                type="button"
                onClick={() => setTraditionalGuidanceOpen(true)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors active:bg-slate-100 active:text-slate-600"
                aria-label="Traditional studios assessment guidance"
                title="Assessment selection guidance"
              >
                <CircleHelp className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            id="studio-type-select-trigger"
            type="button"
            onClick={() => {
              setRoomPickerOpen(false)
              setGradePickerOpen(false)
              setNeighborhoodPickerOpen(false)
              setStudioTypePickerOpen(true)
            }}
            className="flex w-full min-h-[48px] items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-3 text-left text-sm font-medium text-slate-900 shadow-[0_1px_0_rgba(15,23,42,0.03)] outline-none transition-colors focus:border-[var(--color-primary)] focus:bg-white focus:ring-2 focus:ring-blue-100"
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                !selectedSpaceType && "font-normal text-slate-400",
              )}
            >
              {selectedSpaceType || `Select ${spaceTypeNoun}`}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          </button>
          {!selectedSpaceType && (
            <p className="mt-1.5 text-[11px] text-slate-500">
              {`Choose a ${spaceTypeNoun} before selecting a room`}
            </p>
          )}
        </div>
      )}

      <div>
        <label
          htmlFor="room-select-trigger"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
        >
          Room
        </label>
        <button
          id="room-select-trigger"
          type="button"
          disabled={!spaceTypeReady}
          onClick={() => {
            if (!spaceTypeReady) return
            setGradePickerOpen(false)
            setNeighborhoodPickerOpen(false)
            setStudioTypePickerOpen(false)
            setRoomPickerOpen(true)
          }}
          className={cn(
            "flex w-full min-h-[48px] items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-3 text-left text-sm font-medium text-slate-900 shadow-[0_1px_0_rgba(15,23,42,0.03)] outline-none transition-colors focus:border-[var(--color-primary)] focus:bg-white focus:ring-2 focus:ring-blue-100",
            !spaceTypeReady && "cursor-not-allowed opacity-60",
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              !selectedRoom && "font-normal text-slate-400",
            )}
          >
            {selectedRoom
              ? `${selectedRoom.name} (${selectedRoom.id})`
              : roomOptions.length
                ? "Select a room"
                : "No rooms on this floor"}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        </button>
        {plan && !floorPlanOpen && spaceTypeReady && (
          <button
            type="button"
            onClick={onOpenFloorPlan}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 shadow-[0_1px_0_rgba(15,23,42,0.03)] transition-colors active:bg-slate-50"
          >
            <Map className="h-4 w-4 text-slate-400" />
            {selectedId ? "Change room on floor plan" : "Select room on floor plan"}
          </button>
        )}
      </div>

      {plan && floorPlanOpen && (
        <div className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
          <SurveyFloorPlan
            key={`picker-${state.selectedLevelId}`}
            variant="picker"
            panelVisible={floorPlanOpen}
            startExpanded
            onRoomSelect={onCloseFloorPlan}
            onClose={onCloseFloorPlan}
          />
        </div>
      )}

      {showNeighborhood && (
        <div>
          <label
            htmlFor="neighborhood-select-trigger"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
          >
            Neighborhood
          </label>
          <button
            id="neighborhood-select-trigger"
            type="button"
            onClick={() => {
              setRoomPickerOpen(false)
              setGradePickerOpen(false)
              setStudioTypePickerOpen(false)
              setNeighborhoodPickerOpen(true)
            }}
            className="flex w-full min-h-[48px] items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-3 text-left text-sm font-medium text-slate-900 shadow-[0_1px_0_rgba(15,23,42,0.03)] outline-none transition-colors focus:border-[var(--color-primary)] focus:bg-white focus:ring-2 focus:ring-blue-100"
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                !selectedNeighborhood && "font-normal text-slate-400",
              )}
            >
              {selectedNeighborhood
                ? `Neighborhood ${selectedNeighborhood}`
                : "Select neighborhood"}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          </button>
        </div>
      )}

      {selectedId && showGrade && (
        <div>
          <label
            htmlFor="grade-select-trigger"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
          >
            Grade served in room
          </label>
          <button
            id="grade-select-trigger"
            type="button"
            onClick={() => {
              setRoomPickerOpen(false)
              setStudioTypePickerOpen(false)
              setNeighborhoodPickerOpen(false)
              setGradePickerOpen(true)
            }}
            className={cn(
              "flex w-full min-h-[48px] items-center gap-2 rounded-xl border bg-slate-50/80 px-3 py-3 text-left text-sm font-medium text-slate-900 shadow-[0_1px_0_rgba(15,23,42,0.03)] outline-none transition-colors focus:border-[var(--color-primary)] focus:bg-white focus:ring-2 focus:ring-blue-100",
              gradeMissing
                ? "border-red-400 ring-2 ring-red-200"
                : "border-slate-200/90",
            )}
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                !selectedGrade && "font-normal text-slate-400",
              )}
            >
              {selectedGrade || "Select grade"}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          </button>
          {gradeMissing && (
            <p className="mt-1.5 text-xs font-semibold text-red-700">Select a grade before submitting</p>
          )}
        </div>
      )}

      {studioTypePickerOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            aria-label={`Close ${spaceTypeNoun} list`}
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setStudioTypePickerOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-type-picker-title"
            className="relative flex max-h-[min(85dvh,36rem)] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--color-border)] bg-white shadow-xl sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 id="studio-type-picker-title" className="text-base font-semibold">
                  {`Select ${spaceTypeNoun}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setStudioTypePickerOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-muted-foreground)] active:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-y-contain px-2 py-2">
              {spaceTypeOptions.map((type) => {
                const active = selectedSpaceType === type
                const progress = showAdminSpaceType
                  ? adminSpaceTypeProgress[type as AdminSpaceType]
                  : showArrivalSpaceType
                    ? arrivalSpaceTypeProgress[type as ArrivalSpaceType]
                    : showNeighborhoodSpaceType
                      ? neighborhoodSpaceTypeProgress[type as NeighborhoodSpaceType]
                      : studioTypeProgress[type as StudioType]
                const hasSaved = progress.started > 0
                const inProgress = progress.started > progress.complete
                const isTraditional = type === "Traditional studio"
                // Non-traditional / package types: once any room of that type is done, treat as complete.
                const typeComplete = !isTraditional && progress.complete > 0
                const itemClass = active
                  ? "bg-blue-50 text-[var(--color-primary)]"
                  : typeComplete
                    ? "bg-emerald-50 text-emerald-900"
                    : inProgress
                      ? "bg-amber-50 text-amber-950"
                      : "active:bg-slate-50"
                return (
                  <li key={type}>
                    <button
                      type="button"
                      onClick={() => handleSelectStudioType(type)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium",
                        itemClass,
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block leading-snug">{type}</span>
                        {isTraditional ? (
                          progress.complete > 0 || progress.started > 0 ? (
                            <span className="mt-0.5 block text-xs font-normal text-[var(--color-muted-foreground)]">
                              {progress.complete} complete
                              {inProgress
                                ? ` · ${progress.started - progress.complete} in progress`
                                : ""}
                            </span>
                          ) : null
                        ) : typeComplete ? (
                          <span className="mt-0.5 block text-xs font-semibold uppercase tracking-wide text-emerald-700">
                            Complete
                          </span>
                        ) : hasSaved ? (
                          <span className="mt-0.5 block text-xs font-normal text-amber-800">
                            In progress
                          </span>
                        ) : null}
                      </span>
                      {typeComplete ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      ) : active ? (
                        <Check className="h-4 w-4 shrink-0" aria-hidden />
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {roomPickerOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close room list"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setRoomPickerOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="room-picker-title"
            className="relative flex max-h-[min(85dvh,36rem)] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--color-border)] bg-white shadow-xl sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 id="room-picker-title" className="text-base font-semibold">
                  Select a room
                </h2>
                <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                  {roomOptions.length} on this floor
                  {roomQuery.trim() ? ` · ${filteredRooms.length} match` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoomPickerOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-muted-foreground)] active:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-2.5">
              <label htmlFor="room-picker-search" className="sr-only">
                Search rooms
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]"
                  aria-hidden
                />
                <input
                  ref={searchRef}
                  id="room-picker-search"
                  type="search"
                  value={roomQuery}
                  onChange={(e) => setRoomQuery(e.target.value)}
                  placeholder="Search by name or ID…"
                  autoComplete="off"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-slate-50 py-2.5 pl-10 pr-3 text-base outline-none focus:border-[var(--color-primary)] focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2">
              <li>
                <button
                  type="button"
                  onClick={() => handleSelectRoom(null)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm",
                    !selectedId
                      ? "bg-blue-50 text-[var(--color-primary)]"
                      : "text-[var(--color-muted-foreground)] active:bg-slate-50",
                  )}
                >
                  <span className="min-w-0 flex-1">Clear selection</span>
                  {!selectedId && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                </button>
              </li>
              {filteredRooms.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                  {roomQuery.trim()
                    ? `No rooms match “${roomQuery.trim()}”`
                    : "No rooms on this floor"}
                </li>
              ) : (
                filteredRooms.map((r) => {
                  const active = selectedId === r.id
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectRoom(r.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium active:bg-slate-50",
                          active && "bg-blue-50 text-[var(--color-primary)]",
                        )}
                      >
                        <span className="min-w-0 flex-1 break-words leading-snug">{r.name}</span>
                        {active && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>

            {state.surveyType !== "closeout" && (
              <div className="shrink-0 border-t border-[var(--color-border)] bg-slate-50 px-3 py-2">
                {!manualAddOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      setManualAddOpen(true)
                      requestAnimationFrame(() => manualRoomRef.current?.focus())
                    }}
                    className="w-full rounded-lg py-1.5 text-center text-sm font-medium text-[var(--color-primary)] active:bg-blue-50"
                  >
                    Room not listed? Add it
                  </button>
                ) : (
                  <form
                    className="space-y-1.5"
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleAddManualRoom()
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium text-[var(--color-muted-foreground)]">
                        Add unlisted room
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setManualAddOpen(false)
                          setManualRoomNumber("")
                          setManualBuilding("")
                        }}
                        className="text-[11px] font-medium text-[var(--color-muted-foreground)] active:text-slate-800"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      <label htmlFor="manual-room-number" className="sr-only">
                        Room number
                      </label>
                      <input
                        ref={manualRoomRef}
                        id="manual-room-number"
                        type="text"
                        value={manualRoomNumber}
                        onChange={(e) => setManualRoomNumber(e.target.value)}
                        placeholder="Room #"
                        autoComplete="off"
                        className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-2 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-100"
                      />
                      {requiresManualBuilding && (
                        <>
                          <label htmlFor="manual-room-building" className="sr-only">
                            Building
                          </label>
                          <select
                            id="manual-room-building"
                            value={manualBuilding}
                            onChange={(e) => setManualBuilding(e.target.value)}
                            className="w-[5.5rem] shrink-0 rounded-lg border border-[var(--color-border)] bg-white px-1.5 py-2 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-100"
                          >
                            <option value="">Bldg</option>
                            {buildingOptions.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                      <button
                        type="submit"
                        disabled={!canAddManualRoom}
                        className={cn(
                          "shrink-0 rounded-lg px-3 py-2 text-sm font-semibold",
                          canAddManualRoom
                            ? "bg-[var(--color-primary)] text-white active:opacity-90"
                            : "cursor-not-allowed bg-slate-200 text-slate-400",
                        )}
                      >
                        Add
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {gradePickerOpen && showGrade && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close grade list"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setGradePickerOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="grade-picker-title"
            className="relative flex max-h-[min(85dvh,36rem)] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--color-border)] bg-white shadow-xl sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 id="grade-picker-title" className="text-base font-semibold">
                  Select grade
                </h2>
                <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                  Grade served in this room
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGradePickerOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-muted-foreground)] active:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2">
              <li>
                <button
                  type="button"
                  onClick={() => handleSelectGrade("")}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm",
                    !selectedGrade
                      ? "bg-blue-50 text-[var(--color-primary)]"
                      : "text-[var(--color-muted-foreground)] active:bg-slate-50",
                  )}
                >
                  <span className="min-w-0 flex-1">Clear selection</span>
                  {!selectedGrade && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                </button>
              </li>
              {GRADE_OPTIONS.map((g) => {
                const active = selectedGrade === g
                return (
                  <li key={g}>
                    <button
                      type="button"
                      onClick={() => handleSelectGrade(g)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium active:bg-slate-50",
                        active && "bg-blue-50 text-[var(--color-primary)]",
                      )}
                    >
                      <span className="min-w-0 flex-1">{g}</span>
                      {active && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {neighborhoodPickerOpen && showNeighborhood && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close neighborhood list"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setNeighborhoodPickerOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="neighborhood-picker-title"
            className="relative flex max-h-[min(85dvh,36rem)] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--color-border)] bg-white shadow-xl sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 id="neighborhood-picker-title" className="text-base font-semibold">
                  Select neighborhood
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setNeighborhoodPickerOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-muted-foreground)] active:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2">
              <li>
                <button
                  type="button"
                  onClick={() => handleSelectNeighborhood("")}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm",
                    !selectedNeighborhood
                      ? "bg-blue-50 text-[var(--color-primary)]"
                      : "text-[var(--color-muted-foreground)] active:bg-slate-50",
                  )}
                >
                  <span className="min-w-0 flex-1">Clear selection</span>
                  {!selectedNeighborhood && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                </button>
              </li>
              {NEIGHBORHOOD_OPTIONS.map((n) => {
                const active = selectedNeighborhood === n
                return (
                  <li key={n}>
                    <button
                      type="button"
                      onClick={() => handleSelectNeighborhood(n)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium active:bg-slate-50",
                        active && "bg-blue-50 text-[var(--color-primary)]",
                      )}
                    >
                      <span className="min-w-0 flex-1">Neighborhood {n}</span>
                      {active && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {traditionalGuidanceOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close guidance"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setTraditionalGuidanceOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="traditional-guidance-title"
            className="relative flex max-h-[min(85dvh,40rem)] w-full max-w-lg flex-col rounded-t-2xl border border-slate-200/90 bg-white shadow-xl sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-start gap-2 border-b border-slate-200/80 px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2
                  id="traditional-guidance-title"
                  className="text-base font-semibold leading-snug text-slate-900"
                >
                  Traditional Studios Classroom Assessment Selection Guidance
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setTraditionalGuidanceOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100 active:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-4 py-4 text-sm leading-relaxed text-slate-700">
              <p>
                For Traditional Studios classroom assessments, assess{" "}
                <strong className="font-semibold text-slate-900">
                  two classrooms within each identified neighborhood
                </strong>
                . Selected classrooms should be representative of the classrooms in that wing or
                neighborhood.
              </p>
              <div>
                <p className="font-medium text-slate-900">When selecting classrooms, consider differences in:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Size and layout</li>
                  <li>Windows and natural daylight</li>
                  <li>Overall condition</li>
                  <li>Furniture and built-in features</li>
                  <li>Other distinguishing classroom characteristics</li>
                </ul>
              </div>
              <p>
                If classrooms within a neighborhood have noticeably different conditions or
                configurations (such as renovated versus original classrooms), assess{" "}
                <strong className="font-semibold text-slate-900">
                  at least one classroom representing each condition type
                </strong>
                , even if this results in more than two assessments.
              </p>
              <p>
                When possible, select classrooms serving{" "}
                <strong className="font-semibold text-slate-900">different grade levels</strong> to
                capture a broader range of instructional environments.
              </p>
              <p>
                The goal is to accurately represent the variety of classroom conditions within each
                neighborhood while avoiding unnecessary duplication.
              </p>
            </div>

            <div className="shrink-0 border-t border-slate-200/80 px-4 py-3">
              <button
                type="button"
                onClick={() => setTraditionalGuidanceOpen(false)}
                className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[var(--color-primary)] text-sm font-semibold text-white active:opacity-90"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
