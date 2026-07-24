"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { Camera, X } from "lucide-react"
import { PHOTO_PRIVACY_BODY, PHOTO_PRIVACY_TITLE } from "@/lib/photo-privacy"

interface PhotoPrivacyReminderModalProps {
  open: boolean
  onContinue: () => void
  onClose: () => void
  /** Optional context shown above the privacy reminder (e.g. pre-walk space photo). */
  contextNote?: string
}

export default function PhotoPrivacyReminderModal({
  open,
  onContinue,
  onClose,
  contextNote,
}: PhotoPrivacyReminderModalProps) {
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
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel photo"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-privacy-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <Camera className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Photo reminder
            </p>
            <h2 id="photo-privacy-title" className="mt-1 text-lg font-semibold text-slate-900">
              {PHOTO_PRIVACY_TITLE}
            </h2>
            {contextNote ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{contextNote}</p>
            ) : null}
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{PHOTO_PRIVACY_BODY}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onContinue}
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white active:opacity-90"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 active:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
