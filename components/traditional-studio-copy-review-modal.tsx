"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { ClipboardCheck } from "lucide-react"
import {
  TRADITIONAL_STUDIO_COPY_DIFFERENCES,
  TRADITIONAL_STUDIO_COPY_REVIEW_INTRO,
  TRADITIONAL_STUDIO_COPY_REVIEW_TITLE,
} from "@/lib/traditional-studio-copy"

interface TraditionalStudioCopyReviewModalProps {
  open: boolean
  sourceRoomName: string
  targetRoomName: string
  neighborhood: string
  onStartReview: () => void
}

export default function TraditionalStudioCopyReviewModal({
  open,
  sourceRoomName,
  targetRoomName,
  neighborhood,
  onStartReview,
}: TraditionalStudioCopyReviewModalProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="traditional-copy-review-title"
        className="relative flex max-h-[min(88dvh,42rem)] w-full max-w-lg flex-col rounded-t-2xl border border-slate-200/90 bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-slate-200/80 px-4 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <ClipboardCheck className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Neighborhood {neighborhood} · Traditional studio
            </p>
            <h2
              id="traditional-copy-review-title"
              className="mt-1 text-base font-semibold leading-snug text-slate-900"
            >
              {TRADITIONAL_STUDIO_COPY_REVIEW_TITLE}
            </h2>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-4 py-4 text-sm leading-relaxed text-slate-700">
          <p>{TRADITIONAL_STUDIO_COPY_REVIEW_INTRO}</p>
          <p>
            Copied from{" "}
            <strong className="font-semibold text-slate-900">{sourceRoomName}</strong> into{" "}
            <strong className="font-semibold text-slate-900">{targetRoomName}</strong>.
          </p>
          <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-3">
            <p className="font-medium text-amber-950">Verify and edit answers that differ in:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-950">
              {TRADITIONAL_STUDIO_COPY_DIFFERENCES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-slate-500">
            Review each question below and update any responses that do not apply to this classroom.
            Confirm when you are done.
          </p>
        </div>

        <div className="shrink-0 border-t border-slate-200/80 px-4 py-3">
          <button
            type="button"
            onClick={onStartReview}
            className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[var(--color-primary)] text-sm font-semibold text-white active:opacity-90"
          >
            Start reviewing copied responses
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
