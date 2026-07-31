"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Map as MapIcon } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import SurveyFloorPlan from "@/components/survey-floor-plan"
import { buildCloseOutFloorPlanEntries } from "@/lib/closeout-floor-plan"
import { useFloorPlanDisplay } from "@/lib/use-floor-plan-display"

export default function CloseOutFloorPlan() {
  const { state, closeOutPending } = useSurvey()
  const [showFloorPlan, setShowFloorPlan] = useState(false)

  const closeOutProgressByRoomId = useMemo(
    () => buildCloseOutFloorPlanEntries(state.session, state.school?.schoolClass),
    [state.session, state.school?.schoolClass],
  )

  const hasCloseOutRooms = Object.keys(closeOutProgressByRoomId).length > 0
  const canShowFloorPlan =
    state.surveyType === "closeout" &&
    !!state.school?.hasFloorPlan &&
    hasCloseOutRooms

  const floorPlanOpen = canShowFloorPlan && showFloorPlan
  useFloorPlanDisplay(floorPlanOpen)

  const onOpenFloorPlan = useCallback(() => setShowFloorPlan(true), [])
  const onCloseFloorPlan = useCallback(() => setShowFloorPlan(false), [])

  // Hide the map once a room is selected (from the map or the room list).
  useEffect(() => {
    if (state.selectedRoomId) setShowFloorPlan(false)
  }, [state.selectedRoomId])

  useEffect(() => {
    setShowFloorPlan(false)
  }, [state.school?.id])

  if (!canShowFloorPlan) return null

  const pendingCount = closeOutPending.roomIds.length

  return (
    <div className="border-b border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
      <div className="px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          Close Out progress
        </p>
        <p className="mt-1 text-xs text-slate-600">
          {pendingCount > 0
            ? `${pendingCount} room${pendingCount === 1 ? "" : "s"} still have deferred questions`
            : "All deferred rooms are complete · tap a room to review"}
        </p>
        {!floorPlanOpen && (
          <button
            type="button"
            onClick={onOpenFloorPlan}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 shadow-[0_1px_0_rgba(15,23,42,0.03)] transition-colors active:bg-slate-50"
          >
            <MapIcon className="h-4 w-4 text-slate-400" />
            {state.selectedRoomId ? "Change room on floor plan" : "Select room on floor plan"}
          </button>
        )}
      </div>
      {floorPlanOpen && (
        <SurveyFloorPlan
          variant="picker"
          panelVisible={floorPlanOpen}
          startExpanded
          closeOutMode
          closeOutProgressByRoomId={closeOutProgressByRoomId}
          onRoomSelect={onCloseFloorPlan}
          onClose={onCloseFloorPlan}
        />
      )}
    </div>
  )
}
