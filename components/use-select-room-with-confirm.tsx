"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useSurvey } from "@/lib/survey-store"
import { canSelectRoomForSurvey } from "@/lib/prewalk"

type SelectOptions = {
  /** Called after the room is actually selected (including after Edit). */
  afterSelect?: () => void
  /** Called when the user declines and wants another room. */
  onChooseDifferent?: () => void
}

/**
 * Room selection that prompts when the target room was already submitted,
 * or when it is complete in the current module.
 */
export function useSelectRoomWithConfirm() {
  const {
    selectRoom,
    surveyedRooms,
    findSubmittedRoomAssessment,
    openResults,
    state,
  } = useSurvey()
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null)
  const [pendingRoomName, setPendingRoomName] = useState("")
  const [pendingSubmitted, setPendingSubmitted] = useState<ReturnType<
    typeof findSubmittedRoomAssessment
  > | null>(null)
  const [mounted, setMounted] = useState(false)
  const afterConfirmRef = useRef<(() => void) | null>(null)
  const onChooseDifferentRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const clearPending = useCallback(() => {
    setPendingRoomId(null)
    setPendingSubmitted(null)
    afterConfirmRef.current = null
    onChooseDifferentRef.current = null
  }, [])

  useEffect(() => {
    if (!pendingRoomId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const choose = onChooseDifferentRef.current
        clearPending()
        choose?.()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [pendingRoomId, clearPending])

  const isRoomCompleteById = useCallback(
    (roomId: string) => surveyedRooms.some((r) => r.roomId === roomId && r.complete),
    [surveyedRooms],
  )

  const requestSelectRoom = useCallback(
    (roomId: string | null, options?: SelectOptions) => {
      if (!roomId) {
        selectRoom(null)
        options?.afterSelect?.()
        return "selected" as const
      }
      if (
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
        return "blocked" as const
      }
      if (roomId === state.selectedRoomId) {
        selectRoom(roomId)
        options?.afterSelect?.()
        return "selected" as const
      }

      const submitted = findSubmittedRoomAssessment(roomId)
      if (submitted) {
        const parsed = state.allRooms.find((r) => r.id === roomId)
        setPendingRoomName(parsed?.name ?? roomId)
        setPendingSubmitted(submitted)
        setPendingRoomId(roomId)
        afterConfirmRef.current = options?.afterSelect ?? null
        onChooseDifferentRef.current = options?.onChooseDifferent ?? null
        return "confirm" as const
      }

      if (isRoomCompleteById(roomId)) {
        const entry = surveyedRooms.find((r) => r.roomId === roomId)
        const parsed = state.allRooms.find((r) => r.id === roomId)
        setPendingRoomName(entry?.roomName ?? parsed?.name ?? roomId)
        setPendingSubmitted(null)
        setPendingRoomId(roomId)
        afterConfirmRef.current = options?.afterSelect ?? null
        onChooseDifferentRef.current = options?.onChooseDifferent ?? null
        return "confirm" as const
      }
      selectRoom(roomId)
      options?.afterSelect?.()
      return "selected" as const
    },
    [
      selectRoom,
      state.surveyType,
      state.preWalk.mappings,
      state.pendingStudioType,
      state.selectedRoomId,
      state.session?.rooms,
      state.allRooms,
      state.school?.schoolClass,
      findSubmittedRoomAssessment,
      isRoomCompleteById,
      surveyedRooms,
    ],
  )

  const confirmEdit = useCallback(() => {
    if (!pendingRoomId) return
    selectRoom(pendingRoomId)
    const after = afterConfirmRef.current
    clearPending()
    after?.()
  }, [pendingRoomId, selectRoom, clearPending])

  const goToResults = useCallback(() => {
    clearPending()
    openResults("room")
  }, [clearPending, openResults])

  const chooseDifferent = useCallback(() => {
    const choose = onChooseDifferentRef.current
    clearPending()
    choose?.()
  }, [clearPending])

  const dialog =
    mounted &&
    pendingRoomId &&
    createPortal(
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="Dismiss"
          className="absolute inset-0 bg-slate-900/45"
          onClick={chooseDifferent}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="completed-room-title"
          className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-2xl"
        >
          {pendingSubmitted ? (
            <>
              <h2 id="completed-room-title" className="text-base font-semibold">
                Room already assessed
              </h2>
              <p className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">
                <span className="font-medium text-slate-800">{pendingRoomName}</span> was already
                assessed as{" "}
                <span className="font-medium text-slate-800">{pendingSubmitted.spaceType}</span> (
                {pendingSubmitted.surveyLabel}). To change responses, open{" "}
                <span className="font-medium text-slate-800">Results → Room</span> and select the
                room there.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={goToResults}
                  className="flex min-h-10 flex-1 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white active:opacity-90"
                >
                  Go to Results
                </button>
                <button
                  type="button"
                  onClick={chooseDifferent}
                  className="flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-medium active:bg-slate-50"
                >
                  Choose different room
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 id="completed-room-title" className="text-base font-semibold">
                Room already completed
              </h2>
              <p className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">
                <span className="font-medium text-slate-800">{pendingRoomName}</span> has already
                been completed. Would you like to edit this room, or choose a different one?
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={confirmEdit}
                  className="flex min-h-10 flex-1 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white active:opacity-90"
                >
                  Edit room
                </button>
                <button
                  type="button"
                  onClick={chooseDifferent}
                  className="flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-medium active:bg-slate-50"
                >
                  Choose different room
                </button>
              </div>
            </>
          )}
        </div>
      </div>,
      document.body,
    )

  return { requestSelectRoom, completedRoomDialog: dialog }
}
