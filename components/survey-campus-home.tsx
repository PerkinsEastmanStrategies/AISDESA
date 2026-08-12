"use client"

import { useState } from "react"
import { ArrowRight, CheckCircle2, Circle, LoaderCircle, Map } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import PreWalkModal from "@/components/pre-walk-modal"
import {
  surveyNavLabel,
  surveyNavTypesForSchool,
  surveyTypesInSameNavGroup,
  type SurveyType,
} from "@aisd/shared"
import { surveyStatusLabel, type SurveyTypeInfo, type SurveyTypeStatus } from "@/lib/survey-status"
import { preWalkMappingList, schoolSupportsPreWalk } from "@/lib/prewalk"

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

function combinedNavStatus(
  surveyTypes: SurveyType[],
  infos: Record<SurveyType, SurveyTypeInfo>,
): SurveyTypeStatus {
  const statuses = surveyTypes.map((type) => infos[type]?.status ?? "not_started")
  if (statuses.every((status) => status === "complete")) return "complete"
  if (statuses.some((status) => status === "complete" || status === "in_progress")) {
    return "in_progress"
  }
  return "not_started"
}

export default function SurveyCampusHome() {
  const { state, surveyTypeInfos, enterSurveyModule, setView } = useSurvey()
  const [preWalkOpen, setPreWalkOpen] = useState(false)
  const schoolClass = state.school?.schoolClass
  const supportsPreWalk = schoolSupportsPreWalk(schoolClass)
  const mappedCount = preWalkMappingList(state.preWalk.mappings).length
  const preWalkSkipped = !!state.preWalk.skippedAt && mappedCount === 0
  const preWalkCompleted = !!state.preWalk.completedAt

  const modules = surveyNavTypesForSchool(schoolClass)
    .map((type) => {
      const group = surveyTypesInSameNavGroup(type, schoolClass)
      return {
        type,
        label: surveyNavLabel(type, schoolClass),
        status: combinedNavStatus(group, surveyTypeInfos),
      }
    })
    .filter((item, index, list) => list.findIndex((other) => other.label === item.label) === index)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Campus hub
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {state.school?.displayName ?? "Select a school"}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
          You are signed in. Choose a survey module to begin scoring, or start the building
          pre-walk first to map rooms by design intent.
        </p>
      </div>

      {supportsPreWalk && (
        <section className="mt-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            Before scoring
          </h2>
          <button
            type="button"
            onClick={() => setPreWalkOpen(true)}
            className="mt-3 flex w-full min-h-[88px] items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-colors hover:border-blue-200 hover:shadow-md active:bg-slate-50"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[var(--color-primary)]">
              <Map className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-slate-900">
                {mappedCount > 0
                  ? preWalkCompleted
                    ? "Edit building pre-walk"
                    : "Continue pre-walk"
                  : "Start building pre-walk"}
              </span>
              <span className="mt-0.5 block text-sm text-slate-500">
                {mappedCount > 0
                  ? `${mappedCount} room${mappedCount === 1 ? "" : "s"} mapped · optional before scoring`
                  : preWalkSkipped
                    ? "Pre-walk was skipped earlier — you can still map rooms now."
                    : "Map rooms to space types before you score — optional, recommended."}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          </button>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          Survey modules
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {modules.map(({ type, label, status }) => (
            <li key={type}>
              <button
                type="button"
                onClick={() => enterSurveyModule(type)}
                className="flex w-full min-h-[72px] items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-colors hover:border-blue-200 hover:shadow-md active:bg-slate-50"
              >
                <StatusIcon status={status} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {surveyStatusLabel(status)}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setView("results")}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition-colors active:bg-slate-50"
        >
          View results
        </button>
        <button
          type="button"
          onClick={() => setView("landing")}
          className="rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-500 transition-colors active:bg-slate-100"
        >
          Back to start
        </button>
      </div>

      <PreWalkModal
        open={preWalkOpen}
        initialFlow={mappedCount === 0 && !preWalkCompleted && !preWalkSkipped}
        onClose={() => setPreWalkOpen(false)}
      />
    </div>
  )
}
