"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Check, X } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import { countIncompleteItems } from "@/lib/closeout"
import type { SubmitValidationResult } from "@/lib/survey-validation"
import { cn } from "@/lib/utils"

export default function SurveyActionBar() {
  const {
    state,
    canSubmit,
    canDiscard,
    submitHint,
    saveAndCompleteAnotherSurvey,
    discardCurrentAssessment,
    peekSubmitValidation,
    selectRoom,
  } = useSurvey()

  const [incompleteConfirmOpen, setIncompleteConfirmOpen] = useState(false)
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const [pendingValidation, setPendingValidation] = useState<SubmitValidationResult | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!incompleteConfirmOpen && !discardConfirmOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIncompleteConfirmOpen(false)
        setDiscardConfirmOpen(false)
        setPendingValidation(null)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [incompleteConfirmOpen, discardConfirmOpen])

  const incompleteSummary = useMemo(() => {
    if (!pendingValidation) return null
    return countIncompleteItems(pendingValidation)
  }, [pendingValidation])

  if (!state.school || state.view === "results") return null

  const openIncompleteConfirm = (validation: SubmitValidationResult) => {
    setPendingValidation(validation)
    setIncompleteConfirmOpen(true)
  }

  const handleSaveClick = () => {
    if (!canSubmit) return
    const validation = peekSubmitValidation()
    if (!validation || validation.valid) {
      saveAndCompleteAnotherSurvey()
      return
    }
    openIncompleteConfirm(validation)
  }

  const handleAcceptDeferral = () => {
    setIncompleteConfirmOpen(false)
    setPendingValidation(null)
    saveAndCompleteAnotherSurvey({ deferIncomplete: true })
  }

  const handleGoBack = () => {
    setIncompleteConfirmOpen(false)
    if (pendingValidation?.firstIncompleteRoomId) {
      selectRoom(pendingValidation.firstIncompleteRoomId)
    }
    setPendingValidation(null)
  }

  const handleDiscardClick = () => {
    if (!canDiscard) return
    setDiscardConfirmOpen(true)
  }

  const incompleteDialog =
    mounted &&
    incompleteConfirmOpen &&
    pendingValidation &&
    createPortal(
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="Dismiss"
          className="absolute inset-0 bg-slate-900/45"
          onClick={handleGoBack}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="closeout-confirm-title"
          className="relative z-10 max-h-[min(80dvh,32rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-2xl"
        >
          <div className="mb-3 flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 id="closeout-confirm-title" className="text-base font-semibold">
                Unanswered questions
                {pendingValidation.rooms[0]?.roomName
                  ? ` · ${pendingValidation.rooms[0].roomName}`
                  : ""}
              </h2>
              <p className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">
                {state.surveyType === "closeout" ? (
                  <>
                    This room still has unanswered Close Out items. You can save now; remaining items
                    for this room stay in Close Out to finish later.
                  </>
                ) : (
                  <>
                    Unanswered questions for this room will be moved to a separate{" "}
                    <span className="font-medium text-slate-800">Close Out</span> survey so you can
                    finish them later.
                  </>
                )}
              </p>
              {incompleteSummary && (
                <p className="mt-2 text-xs text-slate-600">
                  {incompleteSummary.questions
                    ? `${incompleteSummary.questions} unanswered question${incompleteSummary.questions === 1 ? "" : "s"}`
                    : "Unanswered items"}
                  {incompleteSummary.grades ? " · grade not selected" : ""}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleGoBack}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-muted-foreground)] active:bg-slate-100"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <ul className="mb-4 max-h-40 space-y-1.5 overflow-y-auto rounded-xl bg-slate-50 px-3 py-2">
            {pendingValidation.rooms.flatMap((room) => [
              ...(room.missingGrade
                ? [
                    <li key={`${room.roomId}-grade`} className="text-xs text-slate-700">
                      Grade not selected
                    </li>,
                  ]
                : []),
              ...room.missingQuestions.map((q) => (
                <li key={`${room.roomId}-${q.questionId}`} className="text-xs text-slate-700">
                  <span className="font-medium">#{q.index}</span>
                  {q.label ? ` · ${q.label}` : ""}
                </li>
              )),
            ])}
          </ul>

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleAcceptDeferral}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white active:opacity-90"
            >
              Save and Complete Another Survey
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleGoBack}
              className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-medium active:bg-slate-50"
            >
              Go back
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )

  const discardDialog =
    mounted &&
    discardConfirmOpen &&
    createPortal(
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="Dismiss"
          className="absolute inset-0 bg-slate-900/45"
          onClick={() => setDiscardConfirmOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-confirm-title"
          className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-2xl"
        >
          <h2 id="discard-confirm-title" className="text-base font-semibold">
            Discard this survey?
          </h2>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Your current answers will be removed and will not appear on the Results tab. Previously
            saved surveys are not affected.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              onClick={() => {
                setDiscardConfirmOpen(false)
                discardCurrentAssessment()
              }}
              className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white active:opacity-90"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => setDiscardConfirmOpen(false)}
              className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-medium active:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )

  return (
    <>
      <div className="sticky bottom-0 z-40 border-t border-[var(--color-border)] bg-white/95 px-3 pt-3 backdrop-blur safe-bottom sm:pt-3">
        <p className="mb-2 text-center text-xs leading-snug text-[var(--color-muted-foreground)]">
          {submitHint}
        </p>
        <div className="mb-5 flex flex-row gap-2">
          <button
            type="button"
            disabled={!canDiscard}
            onClick={handleDiscardClick}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center rounded-xl border px-3 text-sm font-semibold sm:min-h-[48px] sm:px-4",
              canDiscard
                ? "border-red-200 bg-white text-red-600 active:bg-red-50"
                : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400",
            )}
          >
            Discard
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSaveClick}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 text-sm font-semibold text-white transition-opacity sm:min-h-[48px] sm:px-4",
              canSubmit ? "bg-[var(--color-primary)] active:opacity-90" : "cursor-not-allowed bg-slate-300",
            )}
          >
            Save and Complete Another Survey
          </button>
        </div>
      </div>
      {incompleteDialog}
      {discardDialog}
    </>
  )
}
