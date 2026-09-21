"use client"

import { Download } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import { downloadSchoolLocalBackupCsv } from "@/lib/survey-save-csv"
import { cn } from "@/lib/utils"

type LocalCsvBackupButtonProps = {
  variant?: "icon" | "labeled"
  className?: string
  disabled?: boolean
}

export default function LocalCsvBackupButton({
  variant = "icon",
  className,
  disabled,
}: LocalCsvBackupButtonProps) {
  const { state } = useSurvey()
  const school = state.school
  const canDownload = !!school && !disabled

  const handleClick = () => {
    if (!school) return
    downloadSchoolLocalBackupCsv({
      school,
      liveSession: state.session,
      preWalk: state.preWalk,
      allRooms: state.allRooms,
      lastSavedAt: state.lastSavedAt,
    })
  }

  if (variant === "labeled") {
    return (
      <button
        type="button"
        disabled={!canDownload}
        onClick={handleClick}
        className={cn(
          "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition-colors active:bg-slate-50",
          !canDownload && "cursor-not-allowed text-slate-400",
          className,
        )}
      >
        <Download className="h-4 w-4" aria-hidden />
        Download CSV backup
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={!canDownload}
      onClick={handleClick}
      title="Download CSV backup of data on this device"
      aria-label="Download CSV backup of data on this device"
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors sm:h-12 sm:w-12",
        canDownload ? "active:bg-slate-50" : "cursor-not-allowed text-slate-300",
        className,
      )}
    >
      <Download className="h-4 w-4" aria-hidden />
    </button>
  )
}
