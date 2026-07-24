"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Map } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import PreWalkModal from "@/components/pre-walk-modal"
import {
  preWalkMappingList,
  schoolSupportsPreWalk,
  shouldOfferPreWalk,
} from "@/lib/prewalk"

function hasScoringStarted(
  rooms: Record<string, { responses: unknown[]; gradeType?: string }> | undefined,
): boolean {
  if (!rooms) return false
  return Object.values(rooms).some((r) => r.responses.length > 0 || !!r.gradeType)
}

export function PreWalkBanner() {
  const { state } = useSurvey()
  const [preWalkOpen, setPreWalkOpen] = useState(false)
  const [preWalkInitialFlow, setPreWalkInitialFlow] = useState(false)
  const preWalkAutoOpened = useRef(false)

  const scoringStarted = useMemo(
    () => hasScoringStarted(state.session?.rooms),
    [state.session?.rooms],
  )

  const offerPreWalk = useMemo(
    () => shouldOfferPreWalk(state.preWalk, scoringStarted, state.school?.schoolClass),
    [state.preWalk, scoringStarted, state.school?.schoolClass],
  )

  const supportsPreWalk = schoolSupportsPreWalk(state.school?.schoolClass)
  const mappedCount = preWalkMappingList(state.preWalk.mappings).length

  useEffect(() => {
    preWalkAutoOpened.current = false
  }, [state.school?.id])

  useEffect(() => {
    if (!state.preWalkRequested) return
    if (!state.school || state.floorPlanLoading || !offerPreWalk || preWalkAutoOpened.current) return
    preWalkAutoOpened.current = true
    setPreWalkInitialFlow(true)
    setPreWalkOpen(true)
  }, [state.preWalkRequested, state.school?.id, offerPreWalk, state.floorPlanLoading])

  if (!supportsPreWalk) return null

  return (
    <>
      {!preWalkOpen && (
        <div className="border-b border-slate-200/80 bg-blue-50/60 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-700">
              {mappedCount > 0
                ? `${mappedCount} room assignment${mappedCount === 1 ? "" : "s"} mapped in pre-walk`
                : "Walk the building to map rooms to space types across all surveys before scoring"}
            </p>
            <button
              type="button"
              onClick={() => {
                setPreWalkInitialFlow(false)
                setPreWalkOpen(true)
              }}
              className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] shadow-sm ring-1 ring-slate-200 active:bg-slate-50"
            >
              {state.preWalk.completedAt ? "Edit room map" : "Open pre-walk"}
            </button>
          </div>
        </div>
      )}

      <PreWalkModal
        open={preWalkOpen}
        initialFlow={preWalkInitialFlow}
        onClose={() => setPreWalkOpen(false)}
      />
    </>
  )
}

export function PreWalkHeaderButton() {
  const { state } = useSurvey()
  const [preWalkOpen, setPreWalkOpen] = useState(false)

  if (!schoolSupportsPreWalk(state.school?.schoolClass)) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setPreWalkOpen(true)}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 active:bg-slate-100"
        aria-label="Open building pre-walk"
      >
        <Map className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Pre-walk</span>
      </button>

      <PreWalkModal open={preWalkOpen} onClose={() => setPreWalkOpen(false)} />
    </>
  )
}
