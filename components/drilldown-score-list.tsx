"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import { ScoreBar, WeightLabel } from "@/components/score-display"
import { sumPositiveWeights } from "@/lib/weight-display"
import { cn, scoreTextColor } from "@/lib/utils"
import type { CategoryScore, RoomScoreResult, SurveySession, SurveyType } from "@aisd/shared"
import { getRoomSurveyRubric } from "@aisd/shared"
import {
  buildQuestionRows,
  buildSubcategoryRows,
  ensureWalkthroughScoreDetails,
  resolveParentQuestionId,
} from "@/lib/score-walkthrough"

function subKey(category: string, subcategory: string) {
  return `${category}::${subcategory}`
}

export default function DrilldownScoreList({
  categories,
  roomIds,
  session,
  surveyType,
  roomScoreDetails,
}: {
  categories: CategoryScore[]
  roomIds: string[]
  session: SurveySession
  surveyType: SurveyType
  /** When provided, used instead of live survey-store score details (campus rollup). */
  roomScoreDetails?: Record<string, RoomScoreResult>
}) {
  const { state } = useSurvey()
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set())
  const [openSubcategories, setOpenSubcategories] = useState<Set<string>>(() => new Set())

  const scoredRoomIds = useMemo(
    () => roomIds.filter((id) => session.rooms[id]),
    [roomIds, session.rooms],
  )

  const details = useMemo(
    () =>
      ensureWalkthroughScoreDetails(
        session,
        roomScoreDetails ?? state.roomScoreDetails,
        surveyType,
        scoredRoomIds,
        state.school?.schoolClass,
      ),
    [session, roomScoreDetails, state.roomScoreDetails, surveyType, scoredRoomIds, state.school?.schoolClass],
  )

  const toggleCategory = (category: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const toggleSubcategory = (category: string, subcategory: string) => {
    const key = subKey(category, subcategory)
    setOpenSubcategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (!categories.length) {
    return <p className="text-sm text-slate-500">No category scores yet.</p>
  }

  const categoryWeightTotal = sumPositiveWeights(categories.map((cat) => cat.weight))

  return (
    <div className="space-y-1">
      {categories.map((cat) => {
        const categoryOpen = openCategories.has(cat.category)
        const subcategories = categoryOpen
          ? buildSubcategoryRows(details, scoredRoomIds, cat.category)
          : []
        const subcategoryWeightTotal = sumPositiveWeights(subcategories.map((row) => row.weight))

        return (
          <div key={cat.category} className="rounded-xl border border-slate-200/80 bg-white">
            <button
              type="button"
              onClick={() => toggleCategory(cat.category)}
              aria-expanded={categoryOpen}
              className="flex w-full items-start gap-2 px-3 py-3 text-left transition-colors active:bg-slate-50"
            >
              {categoryOpen ? (
                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              ) : (
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <ScoreBar
                  score={cat.score}
                  label={cat.category}
                  weight={cat.weight}
                  weightTotal={categoryWeightTotal}
                />
              </div>
            </button>

            {categoryOpen && (
              <div className="border-t border-slate-100 px-3 pb-3 pt-1">
                {subcategories.length === 0 ? (
                  <p className="py-2 pl-6 text-xs text-slate-500">No subcategory scores yet.</p>
                ) : (
                  <div className="space-y-1">
                    {subcategories.map((sub) => {
                      const key = subKey(sub.category, sub.subcategory)
                      const subOpen = openSubcategories.has(key)
                      const questions = subOpen
                        ? buildQuestionRows(
                            details,
                            scoredRoomIds,
                            sub.category,
                            sub.subcategory,
                            surveyType,
                            session,
                            state.school?.schoolClass,
                          )
                        : []
                      const questionWeightTotal = sumPositiveWeights(questions.map((row) => row.weight))

                      return (
                        <div
                          key={key}
                          className="rounded-lg border border-slate-100 bg-slate-50/80"
                        >
                          <button
                            type="button"
                            onClick={() => toggleSubcategory(sub.category, sub.subcategory)}
                            aria-expanded={subOpen}
                            className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors active:bg-slate-100/80"
                          >
                            {subOpen ? (
                              <ChevronDown
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400"
                                aria-hidden
                              />
                            ) : (
                              <ChevronRight
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400"
                                aria-hidden
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <ScoreBar
                                score={sub.score}
                                label={sub.subcategory}
                                weight={sub.weight}
                                weightTotal={subcategoryWeightTotal}
                                compact
                              />
                            </div>
                          </button>

                          {subOpen && (
                            <ul className="border-t border-slate-100/80 px-3 pb-2 pt-1">
                              {questions.length === 0 ? (
                                <li className="py-2 pl-5 text-xs text-slate-500">
                                  No scored questions yet.
                                </li>
                              ) : (
                                questions.map((q) => {
                                  const singleRoomId =
                                    scoredRoomIds.length === 1 ? scoredRoomIds[0] : null
                                  const answerLabel = singleRoomId
                                    ? formatQuestionAnswer(
                                        singleRoomId,
                                        q.unitId,
                                        session,
                                        surveyType,
                                        state.school?.schoolClass,
                                      )
                                    : null

                                  return (
                                  <li
                                    key={q.unitId}
                                    className="border-b border-slate-100/80 py-2.5 pl-5 last:border-0"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="font-mono text-[10px] text-slate-400">
                                          {q.questionId}
                                          <WeightLabel
                                            weight={q.weight}
                                            weightTotal={questionWeightTotal}
                                          />
                                        </p>
                                        <p className="mt-0.5 text-xs leading-snug text-slate-800">
                                          {q.stem}
                                        </p>
                                        {q.itemLabel && (
                                          <p className="mt-0.5 text-[11px] text-slate-500">
                                            {q.itemLabel}
                                          </p>
                                        )}
                                        {answerLabel && (
                                          <p className="mt-1 text-[11px] text-slate-600">
                                            <span className="text-slate-400">Answer: </span>
                                            {answerLabel}
                                          </p>
                                        )}
                                      </div>
                                      <span
                                        className={cn(
                                          "shrink-0 text-xs font-bold tabular-nums",
                                          scoreTextColor(q.averageScore),
                                        )}
                                      >
                                        {q.averageScore !== null
                                          ? `${Math.round(q.averageScore)}%`
                                          : "—"}
                                      </span>
                                    </div>
                                  </li>
                                  )
                                })
                              )}
                            </ul>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function formatQuestionAnswer(
  roomId: string,
  unitId: string,
  session: SurveySession,
  surveyType: SurveyType,
  schoolClass?: string | null,
): string | null {
  const roomSession = session.rooms[roomId]
  if (!roomSession) return null

  const effectiveType =
    surveyType === "closeout" ? roomSession.sourceSurveyType ?? surveyType : surveyType
  const rubric = getRoomSurveyRubric(
    effectiveType,
    roomSession.roomType,
    roomSession.gradeType,
    schoolClass,
  )
  if (!rubric) return null

  const parentId = resolveParentQuestionId(unitId, rubric.options)
  const response = roomSession.responses.find((r) => r.questionId === (parentId ?? unitId))
  if (!response?.value) return null

  if (Array.isArray(response.value)) {
    return response.value.length ? response.value.join(", ") : null
  }
  return response.value
}
