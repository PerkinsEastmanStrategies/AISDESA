"use client"

import { preWalkQuestionsForSpaceType, spaceTypesWithPreWalkQuestions } from "@/lib/prewalk-questions"
import { preWalkSpaceTypeColor } from "@/lib/prewalk"
import { cn } from "@/lib/utils"
import type { SurveyType } from "@aisd/shared"

interface PreWalkQuestionsPanelProps {
  surveyType: SurveyType
  spaceTypes: readonly string[]
  mappingCounts: Map<string, number>
  existsForType: (spaceType: string) => boolean | null
  onExistsChange: (spaceType: string, exists: boolean) => void
}

export default function PreWalkQuestionsPanel({
  surveyType,
  spaceTypes,
  mappingCounts,
  existsForType,
  onExistsChange,
}: PreWalkQuestionsPanelProps) {
  const typesWithQuestions = spaceTypesWithPreWalkQuestions(surveyType, spaceTypes)

  if (typesWithQuestions.length === 0) {
    return (
      <p className="px-3 py-3 text-[12px] leading-snug text-slate-500">
        This survey does not have pre-answer questions yet. Use Map to assign rooms.
      </p>
    )
  }

  return (
    <div className="space-y-2 px-2 py-2">
      <p className="px-1 pb-1 text-[11px] leading-snug text-slate-500">
        Answer these now so they carry into the survey. Marking No lets you skip that space type
        for now — you can still open it later and change the answer.
      </p>
      {typesWithQuestions.map((type) => {
        const questions = preWalkQuestionsForSpaceType(surveyType, type)
        const color = preWalkSpaceTypeColor(type, spaceTypes)
        const exists = existsForType(type)
        const mapped = mappingCounts.get(type) ?? 0
        return (
          <section
            key={type}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-[0_1px_0_rgba(15,23,42,0.03)]"
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                {type}
              </h3>
              {mapped > 0 && (
                <span className="shrink-0 text-[10px] font-semibold text-slate-500">
                  {mapped} mapped
                </span>
              )}
            </div>
            <div className="mt-2 space-y-3">
              {questions.map((question) => {
                if (question.id === "spaceTypeExists") {
                  return (
                    <YesNoQuestion
                      key={question.id}
                      prompt={question.prompt}
                      help={question.help}
                      value={exists}
                      falseHint={`Marked as not at school — ${type} counts as 0% in Campus ESA. You can still open this space type in the survey and change the answer.`}
                      onChange={(next) => onExistsChange(type, next)}
                    />
                  )
                }
                return null
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function YesNoQuestion({
  prompt,
  help,
  value,
  falseHint,
  onChange,
}: {
  prompt: string
  help: string
  value: boolean | null
  falseHint: string
  onChange: (value: boolean) => void
}) {
  return (
    <div>
      <p className="text-[13px] font-medium leading-snug text-slate-900">{prompt}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{help}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
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
                "min-h-[40px] rounded-xl border px-3 text-sm font-semibold transition-colors",
                active
                  ? exists
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                    : "border-slate-400 bg-slate-700 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-800 active:bg-slate-100",
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
      {value === false && (
        <p className="mt-2 text-[11px] font-medium leading-snug text-slate-700">{falseHint}</p>
      )}
    </div>
  )
}
