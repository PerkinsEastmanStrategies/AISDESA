"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSurvey } from "@/lib/survey-store"
import RoomSelector from "@/components/room-selector"
import QuestionForm from "@/components/question-form"
import SurveyActionBar from "@/components/survey-action-bar"
import CloseOutPanel from "@/components/close-out-panel"
import { PreWalkBanner } from "@/components/pre-walk-launcher"
import TraditionalStudioCopyReviewModal from "@/components/traditional-studio-copy-review-modal"
import OutdoorElementsMapModal from "@/components/outdoor-elements-map-modal"
import { resolveRoomNeighborhoodForCopy } from "@/lib/traditional-studio-copy"
import { isNeighborhoodOnlySpaceType, isSpaceTypeMarkedAbsentAtSchool } from "@aisd/shared"
import { effectiveSpaceTypeForSelection } from "@/lib/prewalk"
import { Map } from "lucide-react"

function roomDisplayName(
  roomId: string,
  allRooms: { id: string; name: string }[],
  sessionRooms: Record<string, { roomNumber?: string }> | undefined,
): string {
  const parsed = allRooms.find((room) => room.id === roomId)
  const sessionRoom = sessionRooms?.[roomId]
  return parsed?.name ?? sessionRoom?.roomNumber ?? roomId
}

export default function StudioSurvey() {
  const { state, currentRoomSession, closeOutPending } = useSurvey()
  const [showFloorPlan, setShowFloorPlan] = useState(false)
  const [outdoorMapOpen, setOutdoorMapOpen] = useState(false)
  const [copyReviewModalOpen, setCopyReviewModalOpen] = useState(false)
  const prevCopyPendingRef = useRef(false)

  const copyReviewPending = !!currentRoomSession?.traditionalStudioCopyReviewPending
  const copiedFromRoomId = currentRoomSession?.traditionalStudioCopiedFromRoomId

  useEffect(() => {
    if (copyReviewPending && !prevCopyPendingRef.current) {
      setCopyReviewModalOpen(true)
    }
    if (!copyReviewPending) {
      setCopyReviewModalOpen(false)
    }
    prevCopyPendingRef.current = copyReviewPending
  }, [copyReviewPending])

  const copyReviewLabels = useMemo(() => {
    if (!state.selectedRoomId || !copiedFromRoomId || !currentRoomSession) return null
    return {
      sourceRoomName: roomDisplayName(copiedFromRoomId, state.allRooms, state.session?.rooms),
      targetRoomName: roomDisplayName(state.selectedRoomId, state.allRooms, state.session?.rooms),
      neighborhood: resolveRoomNeighborhoodForCopy(
        state.allRooms,
        state.selectedRoomId,
        currentRoomSession,
      ),
    }
  }, [state.selectedRoomId, state.allRooms, state.session?.rooms, copiedFromRoomId, currentRoomSession])

  const onOpenFloorPlan = useCallback(() => setShowFloorPlan(true), [])
  const onCloseFloorPlan = useCallback(() => setShowFloorPlan(false), [])

  // Never carry an open floor plan picker across school, module, or space-type changes.
  useEffect(() => {
    setShowFloorPlan(false)
    setOutdoorMapOpen(false)
  }, [state.school?.id, state.surveyType, state.pendingStudioType])

  if (!state.school) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6 py-12 text-center">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Select a school on the landing page to begin the survey.
        </p>
      </div>
    )
  }

  const isCloseOut = state.surveyType === "closeout"
  const closeOutPendingCount = closeOutPending.roomIds.length
  const isOutdoor = state.surveyType === "outdoor"
  const needsSpaceType =
    state.surveyType === "administration" ||
    state.surveyType === "arrival" ||
    state.surveyType === "neighborhoods"
  const selectedSpaceType = effectiveSpaceTypeForSelection({
    surveyType: state.surveyType,
    pendingStudioType: state.pendingStudioType,
    selectedRoomId: state.selectedRoomId,
    sessionRooms: state.session?.rooms,
    preWalkMappings: state.preWalk.mappings,
    schoolClass: state.school?.schoolClass,
  })
  const neighborhoodOnlyMode = isNeighborhoodOnlySpaceType(
    state.surveyType,
    selectedSpaceType,
  )
  const isNeighborhoodsSurvey = state.surveyType === "neighborhoods"
  const pendingNeighborhood = state.pendingNeighborhood?.trim() ?? ""
  const spaceTypeAbsent =
    !!selectedSpaceType &&
    (isSpaceTypeMarkedAbsentAtSchool(
      state.session,
      selectedSpaceType,
      isNeighborhoodsSurvey ? pendingNeighborhood : null,
    ) ||
      Object.values(state.session?.rooms ?? {}).some(
        (room) =>
          room.spaceTypeMarkedAbsent &&
          room.roomType === selectedSpaceType &&
          (!isNeighborhoodsSurvey ||
            !pendingNeighborhood ||
            room.neighborhood?.trim() === pendingNeighborhood),
      ))
  const showQuestions = !!state.selectedRoomId && !spaceTypeAbsent

  return (
    <>
      <PreWalkBanner />

      {copyReviewLabels && (
        <TraditionalStudioCopyReviewModal
          open={copyReviewModalOpen}
          sourceRoomName={copyReviewLabels.sourceRoomName}
          targetRoomName={copyReviewLabels.targetRoomName}
          neighborhood={copyReviewLabels.neighborhood}
          onStartReview={() => setCopyReviewModalOpen(false)}
        />
      )}

      {!isOutdoor && (
        <RoomSelector
          showFloorPlan={showFloorPlan}
          onOpenFloorPlan={onOpenFloorPlan}
          onCloseFloorPlan={onCloseFloorPlan}
        />
      )}

      {isOutdoor && state.school && (
        <>
          <OutdoorElementsMapModal
            open={outdoorMapOpen}
            school={state.school}
            onClose={() => setOutdoorMapOpen(false)}
          />
          <div className="border-b border-slate-200/80 bg-white px-3 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Assessment scope
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">Campus outdoor elements</p>
            <p className="mt-1 text-xs text-slate-500">
              Score playground, outdoor studios, gardens, and other campus-wide outdoor features for this school.
            </p>
            <button
              type="button"
              onClick={() => setOutdoorMapOpen(true)}
              className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 active:bg-slate-100 sm:w-auto"
            >
              <Map className="h-4 w-4" />
              View outdoor map
            </button>
          </div>
        </>
      )}

      {showQuestions ? (
        <QuestionForm />
      ) : (
        <div className="flex min-h-[40vh] items-center justify-center px-6 py-8 text-center">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {spaceTypeAbsent
              ? `${selectedSpaceType} was marked as not present${isNeighborhoodsSurvey && pendingNeighborhood ? ` in Neighborhood ${pendingNeighborhood}` : ""}. Save and Complete Another Survey to record a score of 0.`
              : isCloseOut
              ? closeOutPendingCount > 0
                ? "Select a room below to answer deferred questions from other survey sections."
                : "Review your campus Close Out summary below, add final thoughts, and submit when ready."
              : needsSpaceType
                ? isNeighborhoodsSurvey
                  ? !selectedSpaceType
                    ? "Select a space type, then choose the neighborhood you are assessing."
                    : !pendingNeighborhood
                      ? "Select the neighborhood you are in, then confirm whether this space type exists in this neighborhood."
                      : neighborhoodOnlyMode
                        ? "Confirm whether this space type exists in this neighborhood to begin scoring."
                        : "Confirm whether this space type exists in this neighborhood, then select a room to begin scoring."
                  : neighborhoodOnlyMode
                    ? "Select the Neighborhood space type, then choose a neighborhood to begin scoring."
                    : "Select a space type, then choose a room from the dropdown or floor plan to begin scoring."
                : "Select a studio type, then choose a room from the dropdown or floor plan to begin scoring."}
          </p>
        </div>
      )}

      {isCloseOut && <CloseOutPanel />}
      {!isCloseOut && <SurveyActionBar />}
    </>
  )
}
