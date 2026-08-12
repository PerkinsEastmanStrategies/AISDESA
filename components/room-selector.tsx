"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, CheckCircle2, ChevronDown, CircleHelp, Map as MapIcon, Search, X } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import SurveyFloorPlan from "@/components/survey-floor-plan"
import {
  getRoomSurveyRubric,
  gradeOptionsForSchool,
  isClassroomRoom,
  isNeighborhoodOnlySpaceType,
  isNeighborhoodSurveyRoomId,
  isOutdoorSurveyRoomId,
  isRoomComplete,
  isSpaceTypeRequiredForSchool,
  isSpaceTypeRoomsComplete,
  isStudioType,
  NEIGHBORHOOD_OPTIONS,
  spaceTypeCompletionProgress,
  spaceTypeCompletionRule,
  spaceTypeOptionsForSurvey,
  readSpaceTypeExistsAtSchool,
  isSpaceTypeMarkedAbsentAtSchool,
  spaceTypeRequiresExistenceGate,
  neighborhoodFromSurveyRoomId,
  neighborhoodSurveyRoomDisplayName,
  neighborhoodSurveyRoomId,
  outdoorSurveyRoomDisplayName,
  studioTypeShowsGradePicker,
  surveyModuleUsesSpaceTypePicker,
  surveyTypeForSpaceType,
  tableEntryForSpaceType,
  type RoomSurveySession,
} from "@aisd/shared"
import { roomNeedsCloseOut } from "@/lib/closeout"
import {
  canSelectRoomForSurvey,
  effectiveSpaceTypeForSelection,
  hasPreWalkMappings,
  preWalkSpaceTypeForRoom,
} from "@/lib/prewalk"
import {
  formatRoomPickerLabel,
  neighborhoodFillColor,
  neighborhoodLegendColors,
  neighborhoodOptionsForSchool,
} from "@/lib/room-neighborhood-lookup"
import { validateRoomSession } from "@/lib/survey-validation"
import { cn } from "@/lib/utils"
import { useSelectRoomWithConfirm } from "@/components/use-select-room-with-confirm"
import { useFloorPlanDisplay } from "@/lib/use-floor-plan-display"
import SpaceTypeAssessmentGuidanceModal from "@/components/space-type-assessment-guidance-modal"
import SpaceTypeExistenceGate from "@/components/space-type-existence-gate"
import TraditionalStudioCopyOffer from "@/components/traditional-studio-copy-offer"
import NeighborhoodLegend from "@/components/neighborhood-legend"

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
    setSchoolRoomNumber,
    setPendingStudioType,
    setPendingNeighborhood,
    setSpaceTypeExists,
    setSurveyType,
    selectRoom,
    currentRoomSession,
    submitValidation,
    traditionalStudioCopyOffer,
    applyTraditionalStudioCopy,
  } = useSurvey()
  const { requestSelectRoom, completedRoomDialog } = useSelectRoomWithConfirm()
  const selectedId = state.selectedRoomId
  const plan = state.floorPlan
  const effectiveLevelId =
    state.selectedLevelId ?? plan?.defaultLevelId ?? state.allRooms[0]?.levelId ?? null
  const showStudioType = state.surveyType === "studios"
  const showSpaceType = surveyModuleUsesSpaceTypePicker(
    state.surveyType,
    state.school?.schoolClass,
  )
  const showNeighborhoodForRoom =
    state.surveyType === "studios" && !!selectedId
  const preWalkRoomSpaceType = preWalkSpaceTypeForRoom(
    state.preWalk.mappings,
    selectedId,
    state.surveyType,
    state.school?.schoolClass,
  )
  const selectedSpaceType =
    effectiveSpaceTypeForSelection({
      surveyType: state.surveyType,
      pendingStudioType: state.pendingStudioType,
      selectedRoomId: selectedId,
      sessionRooms: state.session?.rooms,
      preWalkMappings: state.preWalk.mappings,
      schoolClass: state.school?.schoolClass,
    }) ?? ""
  const neighborhoodOnlyMode = isNeighborhoodOnlySpaceType(
    state.surveyType,
    selectedSpaceType,
  )
  const isNeighborhoodsSurvey = state.surveyType === "neighborhoods"
  const showNeighborhoodsEarlyPicker = isNeighborhoodsSurvey && !!selectedSpaceType
  const showNeighborhoodPicker =
    showNeighborhoodForRoom || neighborhoodOnlyMode || showNeighborhoodsEarlyPicker
  const selectedStudioType =
    showStudioType && selectedSpaceType && isStudioType(selectedSpaceType)
      ? selectedSpaceType
      : ""
  const preWalkMapped = hasPreWalkMappings(
    state.preWalk.mappings,
    state.surveyType,
    state.school?.schoolClass,
  )
  const spaceTypeReady = !showSpaceType || !!selectedSpaceType || preWalkMapped
  const pendingNeighborhood = state.pendingNeighborhood ?? ""
  const selectedNeighborhood = neighborhoodOnlyMode
    ? neighborhoodFromSurveyRoomId(selectedId ?? "") ??
      currentRoomSession?.neighborhood ??
      pendingNeighborhood
    : isNeighborhoodsSurvey
      ? currentRoomSession?.neighborhood ?? pendingNeighborhood
      : (currentRoomSession?.neighborhood ?? "")
  const neighborhoodReady = !isNeighborhoodsSurvey || !!selectedNeighborhood.trim()
  const showExistenceGate =
    !!selectedSpaceType && spaceTypeRequiresExistenceGate(selectedSpaceType) && neighborhoodReady
  const spaceTypeExistsAnswer = showExistenceGate
    ? readSpaceTypeExistsAtSchool(
        state.session,
        selectedSpaceType,
        isNeighborhoodsSurvey ? selectedNeighborhood : null,
      )
    : null
  const spaceTypeAbsent = spaceTypeExistsAnswer === false
  const spaceTypeExistsConfirmed = spaceTypeExistsAnswer === true
  const roomSelectionReady =
    spaceTypeReady && neighborhoodReady && (!showExistenceGate || spaceTypeExistsConfirmed)
  const spaceTypeNoun = showStudioType ? "studio type" : "space type"
  const showGrade =
    studioTypeShowsGradePicker(selectedStudioType, state.school?.schoolClass) ||
    (state.surveyType === "closeout" &&
      !!currentRoomSession?.pendingGrade &&
      studioTypeShowsGradePicker(currentRoomSession.roomType, state.school?.schoolClass))
  const floorPlanOpen = roomSelectionReady && showFloorPlan
  useFloorPlanDisplay(floorPlanOpen)
  const [roomPickerOpen, setRoomPickerOpen] = useState(false)
  const [gradePickerOpen, setGradePickerOpen] = useState(false)
  const [neighborhoodPickerOpen, setNeighborhoodPickerOpen] = useState(false)
  const [studioTypePickerOpen, setStudioTypePickerOpen] = useState(false)
  const [spaceTypeGuidanceOpen, setSpaceTypeGuidanceOpen] = useState(false)
  const [roomQuery, setRoomQuery] = useState("")
  const [manualRoomNumber, setManualRoomNumber] = useState("")
  const [manualBuilding, setManualBuilding] = useState("")
  const [manualAddOpen, setManualAddOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const manualRoomRef = useRef<HTMLInputElement>(null)
  const selectedGrade = currentRoomSession?.gradeType ?? ""
  const [neighborhoodOptions, setNeighborhoodOptions] = useState<string[]>([...NEIGHBORHOOD_OPTIONS])
  const neighborhoodLoadRef = useRef(0)

  useEffect(() => {
    if (!state.school) return

    const loadId = ++neighborhoodLoadRef.current
    void (async () => {
      const options = await neighborhoodOptionsForSchool(state.school)
      if (neighborhoodLoadRef.current !== loadId) return
      setNeighborhoodOptions(options)
    })()
  }, [state.school?.id, state.school?.name])

  const gradeOptions = useMemo(
    () => gradeOptionsForSchool(state.school?.schoolClass),
    [state.school?.schoolClass],
  )
  const buildingOptions = useMemo(() => {
    const set = new Set<string>()
    const level = state.floorPlan?.levels.find((l) => l.id === state.selectedLevelId)
    for (const b of level?.buildings ?? []) {
      if (b.trim()) set.add(b.trim())
    }
    for (const room of state.allRooms) {
      if (room.building?.trim() && (!effectiveLevelId || room.levelId === effectiveLevelId)) {
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
  }, [state.allRooms, state.floorPlan, effectiveLevelId])

  const requiresManualBuilding = buildingOptions.length > 1
  const canAddManualRoom =
    !!manualRoomNumber.trim() && (!requiresManualBuilding || !!manualBuilding)

  const gradeMissing =
    !!selectedId &&
    showGrade &&
    (!!currentRoomSession?.pendingGrade ||
      !!submitValidation?.rooms.some((r) => r.roomId === selectedId && r.missingGrade))

  const sortRoomsByName = (rooms: typeof state.allRooms) =>
    [...rooms].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  const { pinnedRoomOptions, otherRoomOptions } = useMemo(() => {
    const schoolClass = state.school?.schoolClass
    const mappedTypeForRoom = (roomId: string) =>
      preWalkSpaceTypeForRoom(state.preWalk.mappings, roomId, state.surveyType, schoolClass)

    if (state.surveyType === "closeout" && state.session) {
      const seen = new Set<string>()
      const pending: typeof state.allRooms = []
      for (const roomSession of Object.values(state.session.rooms)) {
        if (!roomNeedsCloseOut(roomSession) || seen.has(roomSession.roomId)) continue
        seen.add(roomSession.roomId)
        const matched =
          state.allRooms.find((room) => room.id === roomSession.roomId) ??
          state.allRooms.find(
            (room) => room.id.toUpperCase() === roomSession.roomId.toUpperCase(),
          )
        if (matched) {
          pending.push(matched)
          continue
        }
        const neighborhoodLabel = neighborhoodFromSurveyRoomId(roomSession.roomId)
        pending.push({
          id: roomSession.roomId,
          name: isOutdoorSurveyRoomId(roomSession.roomId)
            ? outdoorSurveyRoomDisplayName()
            : neighborhoodLabel
              ? neighborhoodSurveyRoomDisplayName(neighborhoodLabel)
              : roomSession.schoolRoomNumber?.trim() ||
                roomSession.roomNumber?.trim() ||
                roomSession.roomId,
          x: 0,
          y: 0,
          area: 0,
          levelId: roomSession.levelId ?? effectiveLevelId ?? "",
          points: [],
        })
      }
      return { pinnedRoomOptions: [], otherRoomOptions: sortRoomsByName(pending) }
    }

    let onFloor = state.allRooms.filter((r) => {
      if (effectiveLevelId && r.levelId !== effectiveLevelId) return false
      return isClassroomRoom(r) || !!mappedTypeForRoom(r.id)
    })
    const eligibleForPreWalk = (r: (typeof state.allRooms)[number]) =>
      isClassroomRoom(r) || !!mappedTypeForRoom(r.id)
    const pinnedIds = new Set<string>()
    let pinned: typeof onFloor = []

    if (preWalkMapped) {
      const pinnedSource = state.allRooms.filter(eligibleForPreWalk)
      if (selectedSpaceType) {
        pinned = pinnedSource.filter((r) => mappedTypeForRoom(r.id) === selectedSpaceType)
      } else {
        pinned = pinnedSource.filter((r) => !!mappedTypeForRoom(r.id))
      }
      for (const room of pinned) pinnedIds.add(room.id)
      pinned = sortRoomsByName(pinned)
    }

    let other = onFloor.filter((r) => {
      if (pinnedIds.has(r.id)) return false
      const mappedType = mappedTypeForRoom(r.id)
      if (selectedSpaceType && mappedType && mappedType !== selectedSpaceType) return false
      return true
    })
    other = sortRoomsByName(other)

    if (selectedId) {
      const selected = state.allRooms.find((r) => r.id === selectedId)
      if (selected && !pinnedIds.has(selectedId) && !other.some((r) => r.id === selectedId)) {
        other = sortRoomsByName([selected, ...other])
      }
    }

    return { pinnedRoomOptions: pinned, otherRoomOptions: other }
  }, [
    state.allRooms,
    state.selectedLevelId,
    selectedId,
    effectiveLevelId,
    state.surveyType,
    state.session,
    state.preWalk.mappings,
    preWalkMapped,
    selectedSpaceType,
    effectiveLevelId,
    state.school?.schoolClass,
  ])

  const roomOptions = useMemo(
    () => [...pinnedRoomOptions, ...otherRoomOptions],
    [pinnedRoomOptions, otherRoomOptions],
  )

  const filterRoomsByQuery = (rooms: typeof state.allRooms) => {
    const q = roomQuery.trim().toLowerCase()
    if (!q) return rooms
    return rooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (r.building?.toLowerCase().includes(q) ?? false),
    )
  }

  const filteredPinnedRooms = useMemo(
    () => filterRoomsByQuery(pinnedRoomOptions),
    [pinnedRoomOptions, roomQuery],
  )

  const filteredOtherRooms = useMemo(
    () => filterRoomsByQuery(otherRoomOptions),
    [otherRoomOptions, roomQuery],
  )

  const filteredRooms = useMemo(
    () => [...filteredPinnedRooms, ...filteredOtherRooms],
    [filteredPinnedRooms, filteredOtherRooms],
  )

  const neighborhoodPickerLegend = useMemo(
    () => neighborhoodLegendColors(neighborhoodOptions),
    [neighborhoodOptions],
  )

  const spaceTypeOptions = useMemo(
    () => spaceTypeOptionsForSurvey(state.surveyType, state.school?.schoolClass),
    [state.surveyType, state.school?.schoolClass],
  )

  const spaceTypeProgress = useMemo(() => {
    const map = Object.fromEntries(
      spaceTypeOptions.map((type) => [type, { started: 0, complete: 0 }]),
    ) as Record<string, { started: number; complete: number }>

    if (!state.session || !showSpaceType) return map

    for (const room of Object.values(state.session.rooms)) {
      if (!spaceTypeOptions.includes(room.roomType)) continue
      const started =
        room.responses.length > 0 ||
        !!room.gradeType ||
        !!room.deferredToCloseOut
      if (!started) continue
      map[room.roomType].started += 1

      const detail = state.roomScoreDetails[room.roomId]
      const fullyScored = !!(
        detail &&
        isRoomComplete(detail, room.gradeType, room.roomType, state.school?.schoolClass)
      )
      const rubric = getRoomSurveyRubric(
        state.surveyType,
        room.roomType,
        room.gradeType,
        state.school?.schoolClass,
      )
      const submitReady =
        !!rubric &&
        validateRoomSession(room.roomId, room.roomId, room, rubric.questions, {
          forSubmit: true,
          schoolClass: state.school?.schoolClass,
        }).complete
      if (fullyScored || submitReady) {
        map[room.roomType].complete += 1
      }
    }
    for (const type of spaceTypeOptions) {
      const absentRooms = state.session
        ? Object.values(state.session.rooms).filter(
            (room) => room.spaceTypeMarkedAbsent && room.roomType === type,
          )
        : []
      if (absentRooms.length > 0 || isSpaceTypeMarkedAbsentAtSchool(state.session, type)) {
        map[type] = { started: Math.max(1, absentRooms.length), complete: 1 }
      }
    }
    return map
  }, [
    spaceTypeOptions,
    state.session,
    state.roomScoreDetails,
    showSpaceType,
    state.school?.schoolClass,
    state.surveyType,
  ])

  const roomSurveyComplete = useCallback(
    (room: RoomSurveySession) => {
      if (room.spaceTypeMarkedAbsent) return true
      const detail = state.roomScoreDetails[room.roomId]
      const fullyScored = !!(
        detail &&
        isRoomComplete(detail, room.gradeType, room.roomType, state.school?.schoolClass)
      )
      const rubric = getRoomSurveyRubric(
        state.surveyType,
        room.roomType,
        room.gradeType,
        state.school?.schoolClass,
      )
      const submitReady =
        !!rubric &&
        validateRoomSession(room.roomId, room.roomId, room, rubric.questions, {
          forSubmit: true,
          schoolClass: state.school?.schoolClass,
        }).complete
      return fullyScored || submitReady
    },
    [state.roomScoreDetails, state.school?.schoolClass, state.surveyType],
  )

  const selectedRoom = selectedId
    ? state.allRooms.find((r) => r.id === selectedId) ?? roomOptions.find((r) => r.id === selectedId)
    : null

  const handleSelectRoom = (roomId: string | null) => {
    if (
      roomId &&
      !canSelectRoomForSurvey({
        surveyType: state.surveyType,
        preWalkMappings: state.preWalk.mappings,
        pendingStudioType: state.pendingStudioType,
        selectedRoomId: state.selectedRoomId,
        sessionRooms: state.session?.rooms,
        roomId,
        schoolClass: state.school?.schoolClass,
      })
    ) {
      return
    }
    setRoomPickerOpen(false)
    setRoomQuery("")
    setManualRoomNumber("")
    setManualBuilding("")
    setManualAddOpen(false)
    requestSelectRoom(roomId, {
      afterSelect: roomId && !showFloorPlan ? onCloseFloorPlan : undefined,
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
    const targetSurveyType =
      surveyTypeForSpaceType(roomType, state.school?.schoolClass) ?? state.surveyType
    const enteringNeighborhoodOnly =
      isNeighborhoodOnlySpaceType(targetSurveyType, roomType)
    if (
      selectedId &&
      ((enteringNeighborhoodOnly && !isNeighborhoodSurveyRoomId(selectedId)) ||
        (!enteringNeighborhoodOnly && isNeighborhoodSurveyRoomId(selectedId)))
    ) {
      selectRoom(null)
    }
    if (targetSurveyType !== state.surveyType) {
      setSurveyType(targetSurveyType, { pendingStudioType: roomType || null })
    } else {
      setPendingStudioType(roomType || null)
    }
    setStudioTypePickerOpen(false)
    if (roomType) {
      setSpaceTypeGuidanceOpen(true)
    }
  }

  const handleSelectGrade = (grade: string) => {
    if (!selectedId) return
    setGrade(selectedId, grade)
    setGradePickerOpen(false)
  }

  const handleSelectNeighborhood = (neighborhood: string) => {
    setNeighborhoodPickerOpen(false)
    if (isNeighborhoodsSurvey) {
      const trimmed = neighborhood.trim()
      setPendingNeighborhood(trimmed || null)
      if (!trimmed) {
        if (neighborhoodOnlyMode) selectRoom(null)
        return
      }
      if (neighborhoodOnlyMode) {
        selectRoom(null)
        return
      }
      if (selectedId) {
        setNeighborhood(selectedId, trimmed)
      }
      return
    }
    if (!selectedId) return
    setNeighborhood(selectedId, neighborhood)
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
    if (
      state.surveyType === "outdoor" &&
      !selectedSpaceType &&
      !preWalkMapped &&
      spaceTypeOptions.length === 1 &&
      state.pendingStudioType !== spaceTypeOptions[0]
    ) {
      setPendingStudioType(spaceTypeOptions[0])
    }
  }, [
    state.surveyType,
    selectedSpaceType,
    preWalkMapped,
    state.pendingStudioType,
    spaceTypeOptions,
    setPendingStudioType,
  ])

  useEffect(() => {
    if (!showNeighborhoodPicker) setNeighborhoodPickerOpen(false)
  }, [showNeighborhoodPicker])

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
    if (!spaceTypeGuidanceOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSpaceTypeGuidanceOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [spaceTypeGuidanceOpen])

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
            {selectedSpaceType && (
              <button
                type="button"
                onClick={() => setSpaceTypeGuidanceOpen(true)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors active:bg-slate-100 active:text-slate-600"
                aria-label={`${selectedSpaceType} assessment guidance`}
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
              {preWalkMapped
                ? "Select a room — its space type will fill in from your pre-walk map"
                : isNeighborhoodsSurvey
                  ? "Choose a space type, then select the neighborhood you are assessing"
                  : neighborhoodOnlyMode
                    ? "Choose Neighborhood, then select which neighborhood to assess"
                    : `Choose a ${spaceTypeNoun} before selecting a room`}
            </p>
          )}
          {selectedSpaceType && isNeighborhoodsSurvey && !selectedNeighborhood.trim() && (
            <p className="mt-1.5 text-[11px] text-slate-500">
              Select the neighborhood you are in before confirming whether this space type exists there.
            </p>
          )}
          {selectedSpaceType && neighborhoodOnlyMode && selectedNeighborhood.trim() && !spaceTypeAbsent && (
            <p className="mt-1.5 text-[11px] text-slate-500">
              Confirm whether this space type exists in this neighborhood to begin scoring.
            </p>
          )}
        </div>
      )}

      {showNeighborhoodsEarlyPicker && (
        <div>
          <label
            htmlFor="neighborhood-early-select-trigger"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
          >
            Neighborhood
          </label>
          <button
            id="neighborhood-early-select-trigger"
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
                !selectedNeighborhood.trim() && "font-normal text-slate-400",
              )}
            >
              {selectedNeighborhood.trim()
                ? `Neighborhood ${selectedNeighborhood}`
                : "Select neighborhood"}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          </button>
        </div>
      )}

      {showExistenceGate && (
        <SpaceTypeExistenceGate
          spaceType={selectedSpaceType}
          value={spaceTypeExistsAnswer}
          onChange={(exists) => setSpaceTypeExists(selectedSpaceType, exists)}
          neighborhood={isNeighborhoodsSurvey ? selectedNeighborhood : null}
        />
      )}

      {!spaceTypeAbsent && (
      <>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        {!neighborhoodOnlyMode && (
          <>
            <div className={cn(!selectedId && "col-span-2")}>
              <label
                htmlFor="room-select-trigger"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
              >
                Room
              </label>
              <button
                id="room-select-trigger"
                type="button"
                disabled={!roomSelectionReady}
                onClick={() => {
                  if (!roomSelectionReady) return
                  setGradePickerOpen(false)
                  setNeighborhoodPickerOpen(false)
                  setStudioTypePickerOpen(false)
                  setRoomPickerOpen(true)
                }}
                className={cn(
                  "flex w-full min-h-[48px] items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-3 text-left text-sm font-medium text-slate-900 shadow-[0_1px_0_rgba(15,23,42,0.03)] outline-none transition-colors focus:border-[var(--color-primary)] focus:bg-white focus:ring-2 focus:ring-blue-100",
                  !roomSelectionReady && "cursor-not-allowed opacity-60",
                )}
              >
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    !selectedRoom && "font-normal text-slate-400",
                  )}
                >
                  {selectedRoom
                    ? formatRoomPickerLabel(selectedRoom)
                    : roomOptions.length
                      ? "Select a room"
                      : state.surveyType === "closeout"
                        ? "No unfinished Close Out rooms"
                        : "No rooms on this floor"}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              </button>
            </div>

            {selectedId && !isNeighborhoodSurveyRoomId(selectedId) && (
              <div>
                <label
                  htmlFor="school-room-number"
                  className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
                >
                  Room # in school
                </label>
                <input
                  id="school-room-number"
                  type="text"
                  value={currentRoomSession?.schoolRoomNumber ?? ""}
                  onChange={(e) => setSchoolRoomNumber(selectedId, e.target.value)}
                  placeholder={selectedRoom?.id ?? selectedId}
                  autoComplete="off"
                  className="flex w-full min-h-[48px] rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-3 text-sm font-medium text-slate-900 shadow-[0_1px_0_rgba(15,23,42,0.03)] outline-none transition-colors placeholder:font-normal placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
                <p className="mt-1 text-[10px] leading-snug text-slate-500">
                  Optional if different from floor plan ({selectedRoom?.id ?? selectedId}).
                </p>
              </div>
            )}
          </>
        )}

        {(state.school?.hasFloorPlan || plan) &&
          !floorPlanOpen &&
          roomSelectionReady &&
          !neighborhoodOnlyMode &&
          state.surveyType !== "closeout" && (
          <div className="col-span-2">
            <button
              type="button"
              onClick={onOpenFloorPlan}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 shadow-[0_1px_0_rgba(15,23,42,0.03)] transition-colors active:bg-slate-100"
            >
              <MapIcon className="h-4 w-4 text-slate-500" />
              {selectedId ? "Change room on floor plan" : "Select room on floor plan"}
            </button>
          </div>
        )}

        {showNeighborhoodForRoom && (
          <div className={cn(!showGrade && "col-span-2")}>
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

        {selectedId && showGrade && !isNeighborhoodSurveyRoomId(selectedId) && (
          <div className={cn(!showNeighborhoodForRoom && "col-span-2")}>
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
              <p className="mt-1 text-[10px] font-semibold leading-snug text-red-700">
                Select a grade before submitting
              </p>
            )}
          </div>
        )}
      </div>

      {selectedId &&
        (currentRoomSession?.preWalkNote1?.trim() || currentRoomSession?.preWalkNote2?.trim()) && (
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Pre-walk notes
            </p>
            {currentRoomSession?.preWalkNote1?.trim() && (
              <p className="mt-2 text-sm text-slate-700">{currentRoomSession.preWalkNote1}</p>
            )}
            {currentRoomSession?.preWalkNote2?.trim() && (
              <p className="mt-2 text-sm text-slate-700">{currentRoomSession.preWalkNote2}</p>
            )}
          </div>
        )}

      {(state.school?.hasFloorPlan || plan) &&
        floorPlanOpen &&
        state.surveyType !== "closeout" && (
        <SurveyFloorPlan
          variant="picker"
          panelVisible={floorPlanOpen}
          startExpanded
          onRoomSelect={onCloseFloorPlan}
          onClose={onCloseFloorPlan}
        />
      )}

      {traditionalStudioCopyOffer && selectedId && (
        <TraditionalStudioCopyOffer
          sourceRoomName={traditionalStudioCopyOffer.sourceRoomName}
          neighborhood={traditionalStudioCopyOffer.neighborhood}
          onCopy={() => applyTraditionalStudioCopy(selectedId)}
        />
      )}
      </>
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
                const progress = spaceTypeProgress[type] ?? { started: 0, complete: 0 }
                const tableEntry = tableEntryForSpaceType(
                  state.surveyType,
                  type,
                  state.school?.schoolClass,
                )
                const isRequired = tableEntry?.required ?? isSpaceTypeRequiredForSchool(
                  state.surveyType,
                  type,
                  state.school?.schoolClass,
                )
                const absent = isSpaceTypeMarkedAbsentAtSchool(state.session, type)
                const hasSaved = absent || progress.started > 0
                const roomsOfType = state.session
                  ? Object.values(state.session.rooms).filter((room) => room.roomType === type)
                  : []
                const completionProgress = spaceTypeCompletionProgress(
                  type,
                  roomsOfType,
                  state.school?.schoolClass,
                  (room) => roomSurveyComplete(room),
                )
                const typeComplete = isSpaceTypeRoomsComplete(
                  type,
                  roomsOfType,
                  state.school?.schoolClass,
                  (room) => roomSurveyComplete(room),
                )
                const inProgress = hasSaved && !typeComplete
                const isTraditional = spaceTypeCompletionRule(type, state.school?.schoolClass).kind === "perNeighborhood"
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
                        {!isRequired && (
                          <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                            Optional
                          </span>
                        )}
                        {isTraditional ? (
                          completionProgress.complete > 0 || progress.started > 0 ? (
                            <span className="mt-0.5 block text-xs font-normal text-[var(--color-muted-foreground)]">
                              {completionProgress.complete}
                              {completionProgress.required > 1 ? ` / ${completionProgress.required}` : ""}{" "}
                              complete
                              {inProgress
                                ? ` · ${Math.max(0, progress.started - progress.complete)} in progress`
                                : ""}
                            </span>
                          ) : null
                        ) : typeComplete ? (
                          <span className="mt-0.5 block text-xs font-semibold uppercase tracking-wide text-emerald-700">
                            {absent ? "Not at school" : "Complete"}
                          </span>
                        ) : hasSaved ? (
                          <span className="mt-0.5 block text-xs font-normal text-amber-800">
                            {completionProgress.complete > 0
                              ? `${completionProgress.complete} / ${completionProgress.required} complete`
                              : "In progress"}
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
                  {state.surveyType === "closeout"
                    ? `${roomOptions.length} with unfinished Close Out items`
                    : filteredPinnedRooms.length > 0
                      ? `${filteredPinnedRooms.length} pre-walk · ${filteredOtherRooms.length} other on this floor`
                      : `${roomOptions.length} on this floor`}
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

            {neighborhoodPickerLegend.length > 0 && (
              <NeighborhoodLegend
                items={neighborhoodPickerLegend}
                className="shrink-0 border-b border-[var(--color-border)]"
              />
            )}

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
                    : state.surveyType === "closeout"
                      ? "No unfinished Close Out rooms"
                      : "No rooms on this floor"}
                </li>
              ) : (
                <>
                  {filteredPinnedRooms.length > 0 && (
                    <>
                      <li className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {selectedSpaceType
                          ? `Pre-walk · ${selectedSpaceType}`
                          : "Pre-walk mapped"}
                      </li>
                      {filteredPinnedRooms.map((r) => {
                        const active = selectedId === r.id
                        const mappedType = preWalkSpaceTypeForRoom(
                          state.preWalk.mappings,
                          r.id,
                          state.surveyType,
                          state.school?.schoolClass,
                        )
                        return (
                          <li key={r.id}>
                            <button
                              type="button"
                              onClick={() => handleSelectRoom(r.id)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium active:bg-slate-50",
                                active && "bg-blue-50 text-[var(--color-primary)]",
                                !active && "bg-slate-50/80",
                              )}
                            >
                              <span className="min-w-0 flex-1 break-words leading-snug">
                                {r.name}
                                {mappedType && (
                                  <span
                                    className={cn(
                                      "mt-0.5 block text-[11px] font-normal",
                                      active ? "text-[var(--color-primary)]/80" : "text-slate-500",
                                    )}
                                  >
                                    Pre-walk · {mappedType}
                                  </span>
                                )}
                              </span>
                              {active && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                            </button>
                          </li>
                        )
                      })}
                    </>
                  )}
                  {filteredOtherRooms.length > 0 && (
                    <>
                      {filteredPinnedRooms.length > 0 && (
                        <li className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          All rooms on this floor
                        </li>
                      )}
                      {filteredOtherRooms.map((r) => {
                        const active = selectedId === r.id
                        const closeOutRoom =
                          state.surveyType === "closeout"
                            ? state.session?.rooms[r.id]
                            : undefined
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
                              <span className="min-w-0 flex-1 break-words leading-snug">
                                {formatRoomPickerLabel(r)}
                                {closeOutRoom?.roomType ? (
                                  <span
                                    className={cn(
                                      "mt-0.5 block text-[11px] font-normal",
                                      active ? "text-[var(--color-primary)]/80" : "text-slate-500",
                                    )}
                                  >
                                    {closeOutRoom.roomType}
                                  </span>
                                ) : null}
                              </span>
                              {active && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                            </button>
                          </li>
                        )
                      })}
                    </>
                  )}
                </>
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
              {gradeOptions.map((g) => {
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

      {neighborhoodPickerOpen && showNeighborhoodPicker && (
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

            {neighborhoodPickerLegend.length > 0 && (
              <NeighborhoodLegend
                items={neighborhoodPickerLegend}
                className="shrink-0 border-b border-[var(--color-border)]"
              />
            )}

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
              {neighborhoodOptions.map((n) => {
                const active = selectedNeighborhood === n
                const color = neighborhoodFillColor(n)
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
                      {color ? (
                        <span
                          className="inline-block h-3 w-3 shrink-0 rounded-sm border border-slate-200/80"
                          style={{ backgroundColor: color }}
                          aria-hidden
                        />
                      ) : null}
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

      {selectedSpaceType && (
        <SpaceTypeAssessmentGuidanceModal
          spaceType={selectedSpaceType}
          schoolClass={state.school?.schoolClass}
          open={spaceTypeGuidanceOpen}
          onClose={() => setSpaceTypeGuidanceOpen(false)}
        />
      )}
    </div>
  )
}
