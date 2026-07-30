"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"

type SurveyLeavePromptModalProps = {
  open: boolean
  surveyLabel: string
  onKeepDraft: () => void
  onDiscard: () => void
  onCancel: () => void
}

export default function SurveyLeavePromptModal({
  open,
  surveyLabel,
  onKeepDraft,
  onDiscard,
  onCancel,
}: SurveyLeavePromptModalProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-slate-900/45"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="survey-leave-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-2xl"
      >
        <h2 id="survey-leave-title" className="text-base font-semibold">
          Leave this survey?
        </h2>
        <p className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">
          You have unsaved progress in{" "}
          <span className="font-medium text-slate-800">{surveyLabel}</span>. Keep your answers as a
          draft, or remove them from this device.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onKeepDraft}
            className="flex min-h-10 flex-1 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white active:opacity-90"
          >
            Keep draft
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="flex min-h-10 flex-1 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 active:bg-red-100"
          >
            Remove answers
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-medium active:bg-slate-50"
          >
            Stay here
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
