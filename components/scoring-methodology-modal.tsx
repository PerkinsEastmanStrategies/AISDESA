"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { ArrowUp, Info, X } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import { cn } from "@/lib/utils"

const ROLLUP_LEVELS = [
  {
    id: "questions",
    label: "Questions",
    summary: "Each answer becomes a 0–100 score based on the scoring guide.",
    detail:
      "Yes / Fair / No (and similar options) map to point values defined for that question. “Not Able to Assess” is excluded from scoring and requires a note.",
    tone: "bg-slate-100 border-slate-200 text-slate-800",
    width: "w-[88%]",
  },
  {
    id: "subcategories",
    label: "Subcategories",
    summary: "Question scores combine using preset importance weights.",
    detail:
      "Related questions roll up into subcategories (for example, lighting or acoustics groupings). Questions that count more toward the score have a higher weight.",
    tone: "bg-blue-50 border-blue-200 text-blue-950",
    width: "w-[82%]",
  },
  {
    id: "categories",
    label: "Categories",
    summary: "Subcategories combine into the four ESA categories.",
    detail:
      "Function, Infrastructure, FF&E, and Environmental Quality each receive a weighted score from their subcategories.",
    tone: "bg-violet-50 border-violet-200 text-violet-950",
    width: "w-[76%]",
  },
  {
    id: "space-types",
    label: "Space types & rooms",
    summary: "Category scores form each room’s overall score.",
    detail:
      "Every assessed room (Traditional studio, Gym, Media Center, etc.) gets one overall %. Rooms are grouped by space type for reporting.",
    tone: "bg-amber-50 border-amber-200 text-amber-950",
    width: "w-[70%]",
  },
  {
    id: "focus-areas",
    label: "Focus areas (scoring)",
    summary: "Space types roll up into weighted focus areas.",
    detail:
      "Each space type maps to a Focus Area (Scoring) such as Studio, Special Education, Athletics and Wellness, or Shared Spaces. Within a focus area, space types combine using Space Type Weight from the Table of Surveys.",
    tone: "bg-emerald-50 border-emerald-200 text-emerald-950",
    width: "w-[64%]",
  },
  {
    id: "campus",
    label: "Campus score",
    summary: "Focus areas combine using Focus Area Weight.",
    detail:
      "The campus ESA score is a weighted average of focus-area scores. Focus Area Weight in the Table of Surveys sets how much each focus area counts relative to the others. Use the drill-down on this page to trace any score back to its questions.",
    tone: "bg-white border-slate-300 text-slate-900 shadow-sm",
    width: "w-[58%]",
  },
] as const

export default function ScoringMethodologyModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close scoring information"
        className="absolute inset-0 bg-slate-900/45"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scoring-methodology-title"
        className="relative flex max-h-[min(92dvh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[var(--color-primary)]">
            <Info className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="scoring-methodology-title" className="text-base font-semibold text-slate-900">
              How ESA scoring works
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Scores roll up from individual answers to the campus score you see at the top of
              Results. Survey modules, space types, and campus weights come from AISD’s Table of
              Surveys; question weights come from each survey’s scoring guide.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-3 text-xs leading-relaxed text-slate-700">
            <p className="font-semibold text-slate-900">What is the “scoring guide”?</p>
            <p className="mt-1">
              It’s the master list behind each survey: which questions to ask, what each answer is
              worth, and how much each question and category counts toward the room score. The Table
              of Surveys adds which space types belong to each survey, which Focus Area (Scoring)
              they map to, and the Space Type Weight and Focus Area Weight used at campus rollup.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white p-4">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Score rollup
            </p>
            <p className="mt-1 text-center text-xs text-slate-500">
              Bottom to top — each layer feeds the one above it
            </p>

            <div className="mt-5 flex flex-col items-center">
              {[...ROLLUP_LEVELS].reverse().map((level, index, reversed) => (
                <div key={level.id} className="flex w-full flex-col items-center">
                  <div
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-center transition-colors",
                      level.tone,
                      level.width,
                    )}
                  >
                    <p className="text-sm font-semibold">{level.label}</p>
                    <p className="mt-0.5 text-[11px] leading-snug opacity-90">{level.summary}</p>
                  </div>
                  {index < reversed.length - 1 ? (
                    <div className="flex flex-col items-center py-1 text-slate-400" aria-hidden>
                      <ArrowUp className="h-4 w-4" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {ROLLUP_LEVELS.map((level, index) => (
              <div key={level.id} className="flex gap-3 rounded-xl bg-slate-50/80 px-3 py-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{level.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{level.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs leading-relaxed text-slate-600">
            <p className="font-semibold text-slate-800">Score color bands</p>
            <p className="mt-1">
              <span className="font-medium text-emerald-800">70%+ Good</span>
              {" · "}
              <span className="font-medium text-amber-900">45–69% Fair</span>
              {" · "}
              <span className="font-medium text-rose-800">Below 45% Needs attention</span>
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full rounded-xl bg-[var(--color-primary)] text-sm font-semibold text-white hover:opacity-95"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
