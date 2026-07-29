"use client"

import { X } from "lucide-react"
import { lookupSpaceTypeAssessmentGuidance } from "@aisd/shared"

function GuidanceNoteBody({ body }: { body: string }) {
  const blocks = body.split(/\n\n+/).filter((block) => block.trim())

  return (
    <>
      {blocks.map((block, index) => {
        const lines = block
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
        const heading = lines[0] ?? ""
        const listIntro = /:\s*$/.test(heading)

        if (listIntro && lines.length > 1) {
          return (
            <div key={index}>
              <p>{heading}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {lines.slice(1).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )
        }

        if (/^More about this space:/i.test(heading) && lines.length === 1) {
          return (
            <p key={index}>
              <span className="font-medium text-slate-900">More about this space: </span>
              {heading.replace(/^More about this space:\s*/i, "")}
            </p>
          )
        }

        if (/^More about this space:/i.test(heading) && lines.length > 1) {
          return (
            <div key={index}>
              <p className="font-medium text-slate-900">{heading.split(":")[0]}:</p>
              <p className="mt-1">{lines.slice(1).join(" ")}</p>
            </div>
          )
        }

        return <p key={index}>{block}</p>
      })}
    </>
  )
}

export default function SpaceTypeAssessmentGuidanceModal({
  spaceType,
  schoolClass,
  open,
  onClose,
}: {
  spaceType: string
  schoolClass?: string | null
  open: boolean
  onClose: () => void
}) {
  if (!open) return null

  const guidance = lookupSpaceTypeAssessmentGuidance(spaceType, schoolClass)
  const title = guidance?.title ?? `${spaceType} Assessment Selection Guidance`
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
          {guidance?.body ? (
            <GuidanceNoteBody body={guidance.body} />
          ) : (
            <p>Instructions for this space type are not available yet.</p>
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
