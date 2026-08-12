"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { ClipboardList, X } from "lucide-react"
import { PHOTO_PRIVACY_REMINDER_SHORT } from "@/lib/photo-privacy"

const REMINDERS = [
  "For the best experience, connect to the Wi‑Fi.",
  "Check in at the main office.",
  "Meet with the principal or designee to review their survey results.",
  "Complete a preliminary walk to identify representative spaces for the assessment. Select rooms that reflect the varying conditions on the campus.",
  "Use the pre-walk room identification tool to label rooms as you complete the preliminary walk.",
  PHOTO_PRIVACY_REMINDER_SHORT,
] as const

interface FieldSurveyRemindersModalProps {
  open: boolean
  onContinue: () => void
  onClose: () => void
}

export default function FieldSurveyRemindersModal({
  open,
  onContinue,
  onClose,
}: FieldSurveyRemindersModalProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close reminders"
        className="absolute inset-0 bg-slate-900/45"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="field-reminders-title"
        className="relative flex max-h-[min(88dvh,40rem)] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--color-border)] bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-[var(--color-border)] px-4 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[var(--color-primary)]">
            <ClipboardList className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Field visit
            </p>
            <h2 id="field-reminders-title" className="mt-0.5 text-lg font-semibold text-slate-900">
              Before you begin
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              A few reminders for your campus assessment.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-muted-foreground)] active:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ol className="min-h-0 flex-1 list-decimal space-y-3 overflow-y-auto overscroll-y-contain px-5 py-4 pl-8 text-sm leading-relaxed text-slate-700">
          {REMINDERS.map((reminder) => (
            <li key={reminder}>{reminder}</li>
          ))}
        </ol>

        <div className="shrink-0 border-t border-[var(--color-border)] bg-slate-50 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onContinue}
            className="flex w-full min-h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] text-sm font-semibold text-white active:opacity-90"
          >
            Start the assessment
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
