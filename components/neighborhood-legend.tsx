import { cn } from "@/lib/utils"

export interface NeighborhoodLegendItem {
  id: string
  color: string
}

export default function NeighborhoodLegend({
  items,
  className,
  label = "Neighborhood",
}: {
  items: NeighborhoodLegendItem[]
  className?: string
  label?: string
}) {
  if (items.length === 0) return null

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-[var(--color-border)] bg-white px-3 py-1.5",
        className,
      )}
      role="list"
      aria-label={`${label} color legend`}
    >
      <span className="text-[10px] font-medium text-[var(--color-muted-foreground)]">{label}</span>
      {items.map((item) => (
        <span
          key={item.id}
          role="listitem"
          className="inline-flex items-center gap-1 text-[10px] text-slate-700"
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm border border-slate-200/80"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          {item.id}
        </span>
      ))}
    </div>
  )
}
