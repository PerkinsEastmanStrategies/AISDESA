"use client"

import { Copy } from "lucide-react"
import { TRADITIONAL_STUDIO_COPY_OFFER_INTRO } from "@/lib/traditional-studio-copy"

interface TraditionalStudioCopyOfferProps {
  sourceRoomName: string
  neighborhood: string
  onCopy: () => void
}

export default function TraditionalStudioCopyOffer({
  sourceRoomName,
  neighborhood,
  onCopy,
}: TraditionalStudioCopyOfferProps) {
  return (
    <div className="rounded-xl border border-blue-200/80 bg-blue-50/80 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-blue-800">
        Neighborhood {neighborhood} · Optional shortcut
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-blue-950">{TRADITIONAL_STUDIO_COPY_OFFER_INTRO}</p>
      <button
        type="button"
        onClick={onCopy}
        className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white active:opacity-90"
      >
        <Copy className="h-4 w-4" aria-hidden />
        Copy responses from {sourceRoomName}
      </button>
    </div>
  )
}
