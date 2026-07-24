"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { Map } from "lucide-react"
import {
  PREWALK_DESIGN_INTENT_NOTE,
  PREWALK_DESIGN_INTENT_TITLE,
} from "@/lib/prewalk"

interface PreWalkPromptModalProps {
  open: boolean
  schoolName: string
  hasFloorPlan: boolean
  onYes: () => void
  onNo: () => void
}

export default function PreWalkPromptModal({
  open,
  schoolName,
  hasFloorPlan,
  onYes,
  onNo,
}: PreWalkPromptModalProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onNo()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [open, onNo])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Skip pre-walk"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        onClick={onNo}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prewalk-prompt-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[var(--color-primary)]">
            <Map className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Building pre-walk · {schoolName}
            </p>
            <h2 id="prewalk-prompt-title" className="mt-1 text-xl font-semibold text-slate-900">
              Do a pre-walk before scoring?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {hasFloorPlan
                ? "Walk the campus and assign space types to rooms on the floor plan for each survey module before you start scoring."
                : "This campus has no floor plan on file, but you can still note room assignments before scoring."}
            </p>
            <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                {PREWALK_DESIGN_INTENT_TITLE}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-950">
                {PREWALK_DESIGN_INTENT_NOTE}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onYes}
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white active:opacity-90"
          >
            Yes, start pre-walk
          </button>
          <button
            type="button"
            onClick={onNo}
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 active:bg-slate-50"
          >
            No, go to surveys
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
