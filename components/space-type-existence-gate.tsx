"use client"

import { cn } from "@/lib/utils"

interface SpaceTypeExistenceGateProps {
  spaceType: string
  value: boolean | null
  onChange: (exists: boolean) => void
  /** When set (Neighborhoods survey), question refers to this neighborhood instead of the school. */
  neighborhood?: string | null
}

export default function SpaceTypeExistenceGate({
  spaceType,
  value,
  onChange,
  neighborhood,
}: SpaceTypeExistenceGateProps) {
  const neighborhoodLabel = neighborhood?.trim() ?? ""
  const scopedToNeighborhood = !!neighborhoodLabel

  return (
    <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-3 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
      <p className="text-sm font-medium leading-snug text-slate-900">
        {scopedToNeighborhood
          ? "Does this space type exist in this neighborhood?"
          : "Does this space exist in the school?"}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {scopedToNeighborhood ? (
          <>
            {spaceType} · Neighborhood {neighborhoodLabel} — if not, you can skip room selection
            and survey questions for this space type in this neighborhood.
          </>
        ) : (
          <>
            {spaceType} — if not, you can skip room selection and survey questions for this space
            type.
          </>
        )}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(
          [
            { label: "Yes", exists: true },
            { label: "No", exists: false },
          ] as const
        ).map(({ label, exists }) => {
          const active = value === exists
          return (
            <button
              key={label}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(exists)}
              className={cn(
                "min-h-[44px] rounded-xl border px-3 text-sm font-semibold transition-colors",
                active
                  ? exists
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                    : "border-slate-400 bg-slate-700 text-white"
                  : "border-slate-200 bg-white text-slate-800 active:bg-slate-50",
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
      {value === false && (
        <p className="mt-3 text-xs font-medium text-emerald-800">
          {scopedToNeighborhood
            ? `Marked as not present — no room or questions required for ${spaceType} in Neighborhood ${neighborhoodLabel}.`
            : `Marked as not present — no room or questions required for ${spaceType}.`}
        </p>
      )}
    </div>
  )
}
