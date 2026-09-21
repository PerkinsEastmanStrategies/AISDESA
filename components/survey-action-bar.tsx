"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AlertTriangle, Check, CheckCircle2, Download, Loader2, X } from "lucide-react"
import { surveyTypeLabel } from "@aisd/shared"
import { useSurvey } from "@/lib/survey-store"
import { countIncompleteItems } from "@/lib/closeout"
import { downloadSurveySaveFailureCsv } from "@/lib/survey-save-csv"
import LocalCsvBackupButton from "@/components/local-csv-backup-button"
import type { SubmitValidationResult } from "@/lib/survey-validation"
import { cn } from "@/lib/utils"

type SaveAck = "saving" | "synced" | "error" | "offline"

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
    flushCloudSave,
    sameRoomCloudConflicts,
  } = useSurvey()

  const [incompleteConfirmOpen, setIncompleteConfirmOpen] = useState(false)
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const [pendingValidation, setPendingValidation] = useState<SubmitValidationResult | null>(null)
  const [saveAck, setSaveAck] = useState<SaveAck | null>(null)
  const [mounted, setMounted] = useState(false)
  const saveInFlightRef = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const dialogOpen = incompleteConfirmOpen || discardConfirmOpen || !!saveAck

  useEffect(() => {
    if (!dialogOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (saveAck === "saving") return
      setIncompleteConfirmOpen(false)
      setDiscardConfirmOpen(false)
      setPendingValidation(null)
      if (saveAck) setSaveAck(null)
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [dialogOpen, saveAck])

  const incompleteSummary = useMemo(() => {
    if (!pendingValidation) return null
    return countIncompleteItems(pendingValidation)
  }, [pendingValidation])

  if (!state.school || state.view === "results") return null

  const openIncompleteConfirm = (validation: SubmitValidationResult) => {
    setPendingValidation(validation)
    setIncompleteConfirmOpen(true)
  }

  const confirmDatabaseSave = async () => {
    if (saveInFlightRef.current) return
    saveInFlightRef.current = true
    setSaveAck("saving")
    try {
      const result = await flushCloudSave()
      setSaveAck(result)
    } catch {
      setSaveAck("error")
    } finally {
      saveInFlightRef.current = false
    }
  }

  const handleSaveClick = () => {
    if (!canSubmit || saveAck === "saving") return
    const validation = peekSubmitValidation()
    if (!validation || validation.valid) {
      saveAndCompleteAnotherSurvey()
      void confirmDatabaseSave()
      return
    }
    openIncompleteConfirm(validation)
  }

  const handleAcceptDeferral = () => {
    setIncompleteConfirmOpen(false)
    setPendingValidation(null)
    saveAndCompleteAnotherSurvey({ deferIncomplete: true })
    void confirmDatabaseSave()
  }

  const handleGoBack = () => {
    setIncompleteConfirmOpen(false)
    if (pendingValidation?.firstIncompleteRoomId) {
      selectRoom(pendingValidation.firstIncompleteRoomId)
    }
    setPendingValidation(null)
  }

  const handleDownloadSaveCsv = () => {
    if (!state.school || !state.session) return
    downloadSurveySaveFailureCsv({
      school: state.school,
      session: state.session,
      preWalk: state.preWalk,
      allRooms: state.allRooms,
      saveError: saveAck === "offline" ? "offline" : "error",
      lastSavedAt: state.lastSavedAt,
    })
  }

  const handleDiscardClick = () => {
    if (!canDiscard) return
    setDiscardConfirmOpen(true)
  }

  const moduleLabel = surveyTypeLabel(state.surveyType)

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

  const saveAckDialog =
    mounted &&
    saveAck &&
    createPortal(
      <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
        {saveAck !== "saving" && (
          <button
            type="button"
            aria-label="Dismiss"
            className="absolute inset-0 bg-slate-900/45"
            onClick={() => setSaveAck(null)}
          />
        )}
        {saveAck === "saving" && <div className="absolute inset-0 bg-slate-900/45" />}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-ack-title"
          aria-live="polite"
          className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-2xl"
        >
          {saveAck === "saving" && (
            <div className="flex items-start gap-3">
              <Loader2 className="mt-0.5 h-6 w-6 shrink-0 animate-spin text-[var(--color-primary)]" />
              <div>
                <h2 id="save-ack-title" className="text-base font-semibold">
                  Saving to the database…
                </h2>
                <p className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">
                  Keep this page open until save is confirmed. Answers are already stored on this
                  device.
                </p>
              </div>
            </div>
          )}
          {saveAck === "synced" && (
            <>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
                <div>
                  <h2 id="save-ack-title" className="text-base font-semibold">
                    Saved to the database
                  </h2>
                  <p className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">
                    {moduleLabel} answers are stored. You can reopen this survey and they will still
                    be there.
                  </p>
                  {sameRoomCloudConflicts.length > 0 && (
                    <p className="mt-2 text-sm text-amber-800">
                      Another iPad already had more answers in{" "}
                      {sameRoomCloudConflicts.join(", ")}. Those rooms were left unchanged in the
                      database.
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSaveAck(null)}
                className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white active:opacity-90"
              >
                Continue
              </button>
            </>
          )}
          {(saveAck === "error" || saveAck === "offline") && (
            <>
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
                <div>
                  <h2 id="save-ack-title" className="text-base font-semibold">
                    Could not confirm the database save
                  </h2>
                  <p className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">
                    {moduleLabel} answers are on this device only
                    {saveAck === "offline" ? " because this iPad is offline" : ""}. Stay here and tap
                    Retry. If Retry keeps failing, download a CSV backup of this survey.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void confirmDatabaseSave()}
                  className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white active:opacity-90"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSaveCsv}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold active:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Download CSV backup
                </button>
                <button
                  type="button"
                  onClick={() => setSaveAck(null)}
                  className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-medium active:bg-slate-50"
                >
                  Continue anyway
                </button>
              </div>
            </>
          )}
        </div>
      </div>,
      document.body,
    )

  return (
    <>
      <div className="shrink-0 border-t border-[var(--color-border)] bg-white px-3 pt-3 pb-3 safe-bottom">
        <p className="mb-2 text-center text-xs leading-snug text-[var(--color-muted-foreground)]">
          {submitHint}
        </p>
        <div className="flex flex-row gap-2">
          <button
            type="button"
            disabled={!canDiscard || saveAck === "saving"}
            onClick={handleDiscardClick}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center rounded-xl border px-3 text-sm font-semibold sm:min-h-[48px] sm:px-4",
              canDiscard && saveAck !== "saving"
                ? "border-red-200 bg-white text-red-600 active:bg-red-50"
                : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400",
            )}
          >
            Discard
          </button>
          <button
            type="button"
            disabled={!canSubmit || saveAck === "saving"}
            onClick={handleSaveClick}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 text-sm font-semibold text-white transition-opacity sm:min-h-[48px] sm:px-4",
              canSubmit && saveAck !== "saving"
                ? "bg-[var(--color-primary)] active:opacity-90"
                : "cursor-not-allowed bg-slate-300",
            )}
          >
            Save and Complete Another Survey
          </button>
          <LocalCsvBackupButton disabled={saveAck === "saving"} />
        </div>
      </div>
      {incompleteDialog}
      {discardDialog}
      {saveAckDialog}
    </>
  )
}
