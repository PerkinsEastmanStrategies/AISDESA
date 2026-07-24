"use client"

import { ClipboardCheck } from "lucide-react"
import {
  TRADITIONAL_STUDIO_COPY_DIFFERENCES,
  TRADITIONAL_STUDIO_COPY_REVIEW_INTRO,
} from "@/lib/traditional-studio-copy"

interface TraditionalStudioCopyReviewBannerProps {
  sourceRoomName: string
  neighborhood: string
  onConfirm: () => void
}

export default function TraditionalStudioCopyReviewBanner({
  sourceRoomName,
  neighborhood,
  onConfirm,
}: TraditionalStudioCopyReviewBannerProps) {
  return (
    <div className="border-b border-amber-200/90 bg-amber-50 px-3 py-3 shadow-[0_1px_0_rgba(245,158,11,0.15)]">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
          <ClipboardCheck className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-800">
            Copied from {sourceRoomName} · Neighborhood {neighborhood}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-950">{TRADITIONAL_STUDIO_COPY_REVIEW_INTRO}</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs leading-relaxed text-amber-950">
            {TRADITIONAL_STUDIO_COPY_DIFFERENCES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={onConfirm}
          className="shrink-0 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white active:opacity-90 sm:self-center"
        >
          I&apos;ve verified and updated differences
        </button>
      </div>
    </div>
  )
}
