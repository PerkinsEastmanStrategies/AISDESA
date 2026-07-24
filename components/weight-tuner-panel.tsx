"use client"

import { useId, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, RotateCcw, SlidersHorizontal } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import { cn, scoreTextColor } from "@/lib/utils"
import {
  getRoomSurveyRubric,
  subcategoryOverrideKey,
  type EsaQuestion,
  type QuestionScore,
  type SubcategoryScore,
} from "@aisd/shared"

function WeightInput({
  value,
  defaultValue,
  onChange,
  className,
}: {
  value: number
  defaultValue: number
  onChange: (weight: number | null) => void
  className?: string
}) {
  const inputId = useId()
  const isCustom = Math.abs(value - defaultValue) > 0.0001

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <input
        id={inputId}
        name={inputId}
        type="number"
        min={0}
        max={10}
        step={0.01}
        value={value}
        onChange={(e) => {
          const parsed = Number.parseFloat(e.target.value)
          if (Number.isNaN(parsed)) return
          if (Math.abs(parsed - defaultValue) < 0.0001) {
            onChange(null)
          } else {
            onChange(parsed)
          }
        }}
        className={cn(
          "w-16 rounded border px-1.5 py-0.5 text-right text-xs tabular-nums outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-blue-100",
          isCustom
            ? "border-amber-300 bg-amber-50 font-medium"
            : "border-[var(--color-border)] bg-white",
        )}
        aria-label={`Weight, default ${defaultValue}`}
      />
      {isCustom && (
        <span className="text-[10px] text-[var(--color-muted-foreground)]" title="Default weight">
          ({defaultValue})
        </span>
      )}
    </div>
  )
}

function ScorePill({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-xs text-slate-400">—</span>
  }
  return (
    <span className={cn("text-xs font-semibold tabular-nums", scoreTextColor(score))}>
      {Math.round(score)}%
    </span>
  )
}

function QuestionRow({
  question,
  questionScore,
  defaultWeight,
  effectiveWeight,
  onWeightChange,
}: {
  question: EsaQuestion
  questionScore: QuestionScore | undefined
  defaultWeight: number
  effectiveWeight: number
  onWeightChange: (weight: number | null) => void
}) {
  const responseScore = questionScore ? Math.round(questionScore.score * 100) : null

  return (
    <div className="flex items-start gap-2 border-l border-slate-200 py-1.5 pl-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-snug text-[var(--color-muted-foreground)]">
          <span className="font-mono text-[10px] text-slate-400">{question.questionId}</span>{" "}
          {question.question}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-400">Response</p>
        <ScorePill score={responseScore} />
      </div>
      <div className="shrink-0 text-right">
        <p className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-400">Wt</p>
        <WeightInput value={effectiveWeight} defaultValue={defaultWeight} onChange={onWeightChange} />
      </div>
    </div>
  )
}

export default function WeightTunerPanel() {
  const {
    state,
    currentRoomScore,
    hasCustomWeights,
    setCategoryWeight,
    setSubcategoryWeight,
    setQuestionWeight,
    resetWeightOverrides,
  } = useSurvey()
  const [open, setOpen] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  const currentRoom = state.selectedRoomId
    ? state.session?.rooms[state.selectedRoomId]
    : null
  const rubric = getRoomSurveyRubric(
    state.surveyType,
    currentRoom?.roomType,
    currentRoom?.gradeType,
    state.school?.schoolClass,
  )

  const defaults = useMemo(() => {
    if (!rubric) return null
    return {
      categories: Object.fromEntries(rubric.categories.map((c) => [c.category, c.categoryWeight])),
      subcategories: Object.fromEntries(
        rubric.subcategories.map((s) => [
          subcategoryOverrideKey(s.category, s.subcategory),
          s.subcategoryWeight,
        ]),
      ),
      questions: Object.fromEntries(rubric.questions.map((q) => [q.questionId, q.weight])),
    }
  }, [rubric])

  if (!rubric || !defaults || !currentRoomScore) return null

  const subScoreMap = new Map(
    currentRoomScore.subcategoryScores.map((s) => [
      subcategoryOverrideKey(s.category, s.subcategory),
      s,
    ]),
  )
  const questionScoreMap = new Map(
    currentRoomScore.questionScores.map((q) => [q.questionId, q]),
  )

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }))
  }

  const categories = rubric.categories.filter((c) => c.assessmentArea === rubric.assessmentArea)

  return (
    <div className="border-t border-[var(--color-border)] bg-slate-50/80">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left active:bg-slate-100"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-[var(--color-muted-foreground)]">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Tune scoring weights
          {hasCustomWeights && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              Custom
            </span>
          )}
        </span>
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
      </button>

      {open && (
        <div className="max-h-[min(50vh,28rem)] overflow-y-auto border-t border-[var(--color-border)] px-3 pb-3">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-slate-50/95 py-2 backdrop-blur-sm">
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Adjust weights to see scores update live. Custom weights reset on submit.
            </p>
            <button
              type="button"
              onClick={resetWeightOverrides}
              disabled={!hasCustomWeights}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium",
                hasCustomWeights
                  ? "bg-white text-[var(--color-primary)] shadow-sm active:bg-slate-100"
                  : "cursor-not-allowed text-slate-400",
              )}
            >
              <RotateCcw className="h-3 w-3" />
              Revert
            </button>
          </div>

          <div className="space-y-3">
            {categories.map((cat) => {
              const catScore = currentRoomScore.categoryScores.find((c) => c.category === cat.category)
              const effectiveCatWeight =
                state.weightOverrides.categories[cat.category] ?? cat.categoryWeight
              const isExpanded = expandedCategories[cat.category] ?? true

              const subcategories = rubric.subcategories.filter((s) => s.category === cat.category)

              return (
                <div key={cat.category} className="rounded-lg border border-[var(--color-border)] bg-white p-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat.category)}
                      className="flex min-w-0 flex-1 items-center gap-1 text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      )}
                      <span className="truncate text-sm font-semibold">{cat.category}</span>
                      <ScorePill score={catScore?.score ?? null} />
                    </button>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">Cat. wt</p>
                      <WeightInput
                        value={effectiveCatWeight}
                        defaultValue={defaults.categories[cat.category] ?? cat.categoryWeight}
                        onChange={(w) => setCategoryWeight(cat.category, w)}
                      />
                    </div>
                  </div>

                  {isExpanded &&
                    subcategories.map((sub) => {
                      const subKey = subcategoryOverrideKey(sub.category, sub.subcategory)
                      const subScore = subScoreMap.get(subKey) as SubcategoryScore | undefined
                      const effectiveSubWeight =
                        state.weightOverrides.subcategories[subKey] ?? sub.subcategoryWeight
                      const questions = rubric.questions.filter(
                        (q) => q.category === sub.category && q.subcategory === sub.subcategory,
                      )

                      return (
                        <div key={subKey} className="mt-2 border-t border-slate-100 pt-2">
                          <div className="flex items-center gap-2 pl-4">
                            <span className="min-w-0 flex-1 truncate text-xs font-medium">{sub.subcategory}</span>
                            <ScorePill score={subScore?.score ?? null} />
                            <div className="shrink-0 text-right">
                              <p className="text-[10px] uppercase tracking-wide text-slate-400">Sub. wt</p>
                              <WeightInput
                                value={effectiveSubWeight}
                                defaultValue={defaults.subcategories[subKey] ?? sub.subcategoryWeight}
                                onChange={(w) => setSubcategoryWeight(sub.category, sub.subcategory, w)}
                              />
                            </div>
                          </div>

                          <div className="mt-1 space-y-0.5">
                            {questions.length === 0 &&
                            sub.category === "Room Area" &&
                            cat.category === "Size" ? (
                              <p className="pl-4 text-[11px] leading-snug text-slate-500">
                                Auto-scored from the room Area field vs the 875 sf baseline.
                              </p>
                            ) : null}
                            {questions.map((q) => (
                              <QuestionRow
                                key={q.questionId}
                                question={q}
                                questionScore={questionScoreMap.get(q.questionId)}
                                defaultWeight={defaults.questions[q.questionId] ?? q.weight}
                                effectiveWeight={state.weightOverrides.questions[q.questionId] ?? q.weight}
                                onWeightChange={(w) => setQuestionWeight(q.questionId, w)}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
