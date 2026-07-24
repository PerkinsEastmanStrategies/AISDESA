"use client"

import { CheckCircle2, Circle, LoaderCircle, User } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import {
  isMsHsOnlySurveyType,
  surveyTypeLabel,
  surveyTypesForSchool,
  type SurveyType,
} from "@aisd/shared"
import { surveyStatusLabel, type SurveyTypeStatus } from "@/lib/survey-status"
import { cn } from "@/lib/utils"

function StatusIcon({ status }: { status: SurveyTypeStatus }) {
  switch (status) {
    case "complete":
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
    case "in_progress":
      return <LoaderCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
    default:
      return <Circle className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
  }
}

interface SurveyTypeNavProps {
  variant: "sidebar" | "tabs"
}

export default function SurveyTypeNav({ variant }: SurveyTypeNavProps) {
  const { state, setSurveyType, surveyTypeInfos, setView } = useSurvey()

  const handleSelect = (type: SurveyType) => {
    if (state.view === "results") setView("survey")
    setSurveyType(type)
  }

  const schoolClass = state.school?.schoolClass
  const items = surveyTypesForSchool(schoolClass).map((type) => ({
    type,
    label: surveyTypeLabel(type),
    info: surveyTypeInfos[type],
    msHsOnly: isMsHsOnlySurveyType(type),
  }))

  if (variant === "tabs") {
    return (
      <div className="flex gap-1 overflow-x-auto px-3 pb-2 pt-3 scrollbar-none md:hidden">
        {items.map(({ type, label, info }) => (
          <button
            key={type}
            type="button"
            onClick={() => handleSelect(type)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
              state.surveyType === type
                ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)] active:bg-slate-200",
            )}
          >
            <StatusIcon status={info.status} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <nav
      aria-label="Surveys"
      className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-card)] md:flex"
    >
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="text-sm font-semibold">Surveys</h2>
        <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">Select an assessment</p>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-y-contain p-2">
        {items.map(({ type, label, info, msHsOnly }) => {
          const active = state.surveyType === type
          return (
            <li key={type}>
              <button
                type="button"
                onClick={() => handleSelect(type)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition-colors",
                  active
                    ? "bg-blue-50 ring-1 ring-blue-200"
                    : "hover:bg-slate-50 active:bg-slate-100",
                )}
              >
                <span className="flex items-start gap-2">
                  <StatusIcon status={info.status} />
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-sm font-medium leading-snug",
                        active && "text-[var(--color-primary)]",
                      )}
                    >
                      {label}
                    </span>
                    {msHsOnly && (
                      <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        MS/HS only
                      </span>
                    )}
                  </span>
                </span>
                <span className="mt-1 pl-6 text-xs text-[var(--color-muted-foreground)]">
                  {surveyStatusLabel(info.status)}
                </span>
                {info.assessor && (
                  <span className="mt-1 flex items-center gap-1 pl-6 text-xs text-[var(--color-muted-foreground)]">
                    <User className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                    <span className="truncate">{info.assessor.name}</span>
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
