"use client"

import { X } from "lucide-react"

export function spaceTypeGuidanceTitle(spaceType: string): string {
  if (spaceType === "Traditional studio") {
    return "Traditional Studios Classroom Assessment Selection Guidance"
  }
  return `${spaceType} Assessment Selection Guidance`
}

function TraditionalStudioGuidanceBody() {
  return (
    <>
      <p>
        For Traditional Studios classroom assessments, assess{" "}
        <strong className="font-semibold text-slate-900">
          two classrooms within each identified neighborhood
        </strong>
        . Selected classrooms should be representative of the classrooms in that wing or
        neighborhood.
      </p>
      <div>
        <p className="font-medium text-slate-900">When selecting classrooms, consider differences in:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Size and layout</li>
          <li>Windows and natural daylight</li>
          <li>Overall condition</li>
          <li>Furniture and built-in features</li>
          <li>Other distinguishing classroom characteristics</li>
        </ul>
      </div>
      <p>
        If classrooms within a neighborhood have noticeably different conditions or configurations
        (such as renovated versus original classrooms), assess{" "}
        <strong className="font-semibold text-slate-900">
          at least one classroom representing each condition type
        </strong>
        , even if this results in more than two assessments.
      </p>
      <p>
        When possible, select classrooms serving{" "}
        <strong className="font-semibold text-slate-900">different grade levels</strong> to capture a
        broader range of instructional environments.
      </p>
      <p>
        The goal is to accurately represent the variety of classroom conditions within each
        neighborhood while avoiding unnecessary duplication.
      </p>
    </>
  )
}

function PlaceholderGuidanceBody() {
  return <p>Instructions will be shown here</p>
}

export default function SpaceTypeAssessmentGuidanceModal({
  spaceType,
  open,
  onClose,
}: {
  spaceType: string
  open: boolean
  onClose: () => void
}) {
  if (!open) return null

  const title = spaceTypeGuidanceTitle(spaceType)
  const titleId = "space-type-guidance-title"

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close guidance"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(85dvh,40rem)] w-full max-w-lg flex-col rounded-t-2xl border border-slate-200/90 bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start gap-2 border-b border-slate-200/80 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold leading-snug text-slate-900">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100 active:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-4 py-4 text-sm leading-relaxed text-slate-700">
          {spaceType === "Traditional studio" ? (
            <TraditionalStudioGuidanceBody />
          ) : (
            <PlaceholderGuidanceBody />
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200/80 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[var(--color-primary)] text-sm font-semibold text-white active:opacity-90"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
