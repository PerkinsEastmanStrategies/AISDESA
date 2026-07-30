"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, HelpCircle } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import { OverallScoreDisplay, ScoreBadge, ScoreBar } from "@/components/score-display"
import { cn, scoreTextColor } from "@/lib/utils"
import type { CampusScoreSummary } from "@aisd/shared"
import { neighborhoodGroupId, neighborhoodGroupLabel } from "@aisd/shared"
import {
  buildCampusCategoryRows,
  buildQuestionRows,
  buildRoomRowsForFocus,
  buildSubcategoryRows,
  categoryWeightShare,
  ensureWalkthroughScoreDetails,
  scoredRoomIds,
  type WalkthroughFocus,
} from "@/lib/score-walkthrough"

export type { WalkthroughFocus }

export default function ScoreWalkthrough({
  campus,
  focusRoomId = null,
  onClearFocusRoom,
}: {
  campus: CampusScoreSummary
  focusRoomId?: string | null
  onClearFocusRoom?: () => void
}) {
  const { state } = useSurvey()
  const session = state.session
  const [focus, setFocus] = useState<WalkthroughFocus>({ level: "campus" })

  const roomIds = useMemo(() => scoredRoomIds(campus), [campus])
  const categories = useMemo(() => buildCampusCategoryRows(campus), [campus])

  const details = useMemo(() => {
    if (!session) return state.roomScoreDetails
    return ensureWalkthroughScoreDetails(
      session,
      state.roomScoreDetails,
      state.surveyType,
      roomIds,
      state.school?.schoolClass,
    )
  }, [session, state.roomScoreDetails, state.surveyType, state.school?.schoolClass, roomIds])

  const subcategories = useMemo(() => {
    if (focus.level === "campus") return []
    return buildSubcategoryRows(details, roomIds, focus.category)
  }, [focus, details, roomIds])

  const questions = useMemo(() => {
    if (focus.level !== "subcategory" && focus.level !== "question") return []
    if (!session) return []
    return buildQuestionRows(
      details,
      roomIds,
      focus.category,
      focus.subcategory,
      state.surveyType,
      session,
      state.school?.schoolClass,
    )
  }, [focus, details, roomIds, session, state.surveyType, state.school?.schoolClass])

  const roomRows = useMemo(() => {
    if (!session) return []
    return buildRoomRowsForFocus(
      focus,
      campus,
      details,
      session,
      state.surveyType,
      state.allRooms,
      focusRoomId,
      state.school?.schoolClass,
    )
  }, [focus, campus, details, session, state.surveyType, state.allRooms, state.school?.schoolClass, focusRoomId])

  const focusRoomName = focusRoomId
    ? campus.rooms.find((r) => r.roomId === focusRoomId)?.roomName ?? focusRoomId
    : null

  const activeQuestion =
    focus.level === "question" ? questions.find((q) => q.unitId === focus.unitId) : undefined

  const goCampus = () => setFocus({ level: "campus" })
  const goCategory = (category: string) => setFocus({ level: "category", category })
  const goSubcategory = (category: string, subcategory: string) =>
    setFocus({ level: "subcategory", category, subcategory })
  const goQuestion = (category: string, subcategory: string, unitId: string) =>
    setFocus({ level: "question", category, subcategory, unitId })

  if (!session) {
    return (
      <p className="rounded-2xl border border-slate-200/90 bg-white px-4 py-8 text-center text-sm text-slate-500">
        No survey session available to explain scores.
      </p>
    )
  }

  return (
    <div className="space-y-3.5">
      <Breadcrumb focus={focus} onCampus={goCampus} onCategory={goCategory} onSubcategory={goSubcategory} />

      {focusRoomName && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-200/80 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <span>
            Highlighting room <span className="font-semibold">{focusRoomName}</span> — lists still
            show all scored rooms for comparison.
          </span>
          {onClearFocusRoom && (
            <button
              type="button"
              onClick={onClearFocusRoom}
              className="shrink-0 font-medium underline underline-offset-2"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {focus.level === "campus" && (
        <>
          <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  How ESA scores work
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  Each surveyed room is scored from its answers. Those room scores roll up to the
                  campus score so you can see both the big picture and the details behind it.
                </p>
              </div>
              <OverallScoreDisplay score={campus.overallScore} label="Campus ESA" />
            </div>

            <ol className="mt-4 space-y-2.5 text-sm text-slate-600">
              <li className="flex gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                  1
                </span>
                <span>
                  Answers become question scores (Yes / Fair / No, etc.).{" "}
                  <strong className="font-semibold text-slate-800">Not Able to Assess</strong> is
                  left out of scoring and requires a note.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                  2
                </span>
                <span>
                  Questions roll into <strong className="font-semibold text-slate-800">subcategories</strong>,
                  then <strong className="font-semibold text-slate-800">categories</strong> (like
                  Infrastructure or Function), using the rubric weights.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                  3
                </span>
                <span>
                  Categories combine into each room’s overall %. The{" "}
                  <strong className="font-semibold text-slate-800">campus score is the average</strong>{" "}
                  of scored rooms (each room counts equally).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                  4
                </span>
                <span>
                  Color bands: <span className="font-semibold text-emerald-800">70%+ good</span>,{" "}
                  <span className="font-semibold text-amber-900">45–69% fair</span>,{" "}
                  <span className="font-semibold text-rose-800">below 45% poor</span>.
                </span>
              </li>
            </ol>
          </section>

          <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Campus by category
            </h3>
            <p className="mb-3 text-xs text-slate-500">
              Tap a category to see the subcategories and rooms that drive it.
            </p>
            {categories.length === 0 ? (
              <p className="text-sm text-slate-500">No category scores yet.</p>
            ) : (
              <div className="space-y-2">
                {categories.map((cat) => {
                  const share = Math.round(categoryWeightShare(categories, cat.category) * 100)
                  return (
                    <button
                      key={cat.category}
                      type="button"
                      onClick={() => goCategory(cat.category)}
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-3 text-left transition-colors active:bg-slate-100"
                    >
                      <div className="min-w-0 flex-1">
                        <ScoreBar score={cat.score} label={cat.category} />
                        <p className="mt-1 text-[10px] text-slate-500">
                          ~{share}% of room overall weight
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <RoomList
            title="Scored rooms (lowest overall first)"
            subtitle="Campus score averages these rooms."
            rows={roomRows}
            focusRoomId={focusRoomId}
            scoreLabel="Overall"
          />
        </>
      )}

      {focus.level === "category" && (
        <>
          <LevelHeader
            title={focus.category}
            score={categories.find((c) => c.category === focus.category)?.score ?? null}
            detail={`About ${Math.round(categoryWeightShare(categories, focus.category) * 100)}% of each room’s overall score comes from this category.`}
            onBack={goCampus}
          />

          <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Subcategories
            </h3>
            <p className="mb-3 text-xs text-slate-500">
              These pieces combine (by weight) into the {focus.category} score.
            </p>
            {subcategories.length === 0 ? (
              <p className="text-sm text-slate-500">No subcategory scores for this category yet.</p>
            ) : (
              <div className="space-y-2">
                {subcategories.map((sub) => (
                  <button
                    key={sub.subcategory}
                    type="button"
                    onClick={() => goSubcategory(sub.category, sub.subcategory)}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-3 text-left transition-colors active:bg-slate-100"
                  >
                    <div className="min-w-0 flex-1">
                      <ScoreBar score={sub.score} label={sub.subcategory} />
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <RoomList
            title={`Rooms by ${focus.category}`}
            subtitle="Sorted lowest → highest for this category."
            rows={roomRows}
            focusRoomId={focusRoomId}
            scoreLabel={focus.category}
          />
        </>
      )}

      {focus.level === "subcategory" && (
        <>
          <LevelHeader
            title={focus.subcategory}
            score={
              subcategories.find((s) => s.subcategory === focus.subcategory)?.score ?? null
            }
            detail={`Part of ${focus.category}. Tap a question to see each room’s answer.`}
            onBack={() => goCategory(focus.category)}
          />

          <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Questions
            </h3>
            <p className="mb-3 text-xs text-slate-500">
              Average score across rooms that answered each question.
            </p>
            {questions.length === 0 ? (
              <p className="text-sm text-slate-500">No scored questions in this subcategory yet.</p>
            ) : (
              <ul className="space-y-2">
                {questions.map((q) => (
                  <li key={q.unitId}>
                    <button
                      type="button"
                      onClick={() => goQuestion(q.category, q.subcategory, q.unitId)}
                      className="flex w-full items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-3 text-left transition-colors active:bg-slate-100"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-mono text-slate-400">{q.questionId}</p>
                        <p className="mt-0.5 text-sm leading-snug text-slate-800">{q.stem}</p>
                        {q.itemLabel && (
                          <p className="mt-1 text-xs text-slate-500">Item: {q.itemLabel}</p>
                        )}
                        <p className="mt-1 text-[10px] text-slate-500">
                          {q.roomCount} room{q.roomCount === 1 ? "" : "s"} scored
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <ScoreBadge score={q.averageScore} />
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <RoomList
            title={`Rooms by ${focus.subcategory}`}
            subtitle="Sorted lowest → highest for this subcategory."
            rows={roomRows}
            focusRoomId={focusRoomId}
            scoreLabel={focus.subcategory}
          />
        </>
      )}

      {focus.level === "question" && (
        <>
          <LevelHeader
            title={activeQuestion?.questionId ?? focus.unitId}
            score={activeQuestion?.averageScore ?? null}
            detail={activeQuestion?.stem ?? "Question detail"}
            onBack={() => goSubcategory(focus.category, focus.subcategory)}
          />

          {activeQuestion?.itemLabel && (
            <p className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-600">
              Scoring item: <span className="font-medium text-slate-800">{activeQuestion.itemLabel}</span>
            </p>
          )}

          <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="mb-3 flex items-start gap-2">
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Room answers
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Each row shows what was selected in that room and how it scored. Excluded answers
                  (Not Able to Assess) do not change the average.
                </p>
              </div>
            </div>

            {roomRows.length === 0 ? (
              <p className="text-sm text-slate-500">No room answers for this question yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {roomRows.map((row) => (
                  <li
                    key={row.roomId}
                    className={cn(
                      "py-3",
                      focusRoomId === row.roomId && "rounded-lg bg-blue-50/60 px-2 -mx-2",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{row.roomName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {neighborhoodGroupLabel(neighborhoodGroupId(row.neighborhood, row.roomId))}
                          {row.gradeType ? ` · ${row.gradeType}` : ""}
                        </p>
                        <p className="mt-1.5 text-sm text-slate-700">
                          <span className="text-slate-400">Answer: </span>
                          {row.answerLabel ?? "—"}
                        </p>
                        {row.comment?.trim() && (
                          <p className="mt-1 text-xs italic text-slate-500">
                            Note: {row.comment.trim()}
                          </p>
                        )}
                        {row.excludedFromScore && (
                          <p className="mt-1 text-[10px] font-medium text-amber-800">
                            Excluded from score
                          </p>
                        )}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-base font-bold tabular-nums",
                          scoreTextColor(row.levelScore),
                        )}
                      >
                        {row.levelScore !== null ? `${Math.round(row.levelScore)}%` : "—"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Breadcrumb({
  focus,
  onCampus,
  onCategory,
  onSubcategory,
}: {
  focus: WalkthroughFocus
  onCampus: () => void
  onCategory: (category: string) => void
  onSubcategory: (category: string, subcategory: string) => void
}) {
  const crumbs: { label: string; onClick?: () => void }[] = [{ label: "Campus", onClick: onCampus }]
  if (focus.level !== "campus") {
    crumbs.push({
      label: focus.category,
      onClick: focus.level === "category" ? undefined : () => onCategory(focus.category),
    })
  }
  if (focus.level === "subcategory" || focus.level === "question") {
    crumbs.push({
      label: focus.subcategory,
      onClick:
        focus.level === "subcategory"
          ? undefined
          : () => onSubcategory(focus.category, focus.subcategory),
    })
  }
  if (focus.level === "question") {
    crumbs.push({ label: focus.unitId })
  }

  return (
    <nav aria-label="Score walkthrough" className="flex flex-wrap items-center gap-1 text-xs">
      {crumbs.map((crumb, i) => (
        <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-slate-300">›</span>}
          {crumb.onClick ? (
            <button
              type="button"
              onClick={crumb.onClick}
              className="rounded px-1.5 py-0.5 font-medium text-[var(--color-primary)] active:bg-blue-50"
            >
              {crumb.label}
            </button>
          ) : (
            <span className="rounded px-1.5 py-0.5 font-semibold text-slate-800">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

function LevelHeader({
  title,
  score,
  detail,
  onBack,
}: {
  title: string
  score: number | null
  detail: string
  onBack: () => void
}) {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <button
        type="button"
        onClick={onBack}
        className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 active:text-slate-700"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back
      </button>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p>
        </div>
        <ScoreBadge score={score} size="lg" />
      </div>
    </section>
  )
}

function RoomList({
  title,
  subtitle,
  rows,
  focusRoomId,
  scoreLabel,
}: {
  title: string
  subtitle: string
  rows: ReturnType<typeof buildRoomRowsForFocus>
  focusRoomId?: string | null
  scoreLabel: string
}) {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{title}</h3>
      <p className="mt-1 mb-3 text-xs text-slate-500">{subtitle}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No scored rooms at this level.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li
              key={row.roomId}
              className={cn(
                "flex items-center justify-between gap-3 py-2.5",
                focusRoomId === row.roomId && "rounded-lg bg-blue-50/60 px-2 -mx-2",
              )}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{row.roomName}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {neighborhoodGroupLabel(neighborhoodGroupId(row.neighborhood, row.roomId))}
                  {row.gradeType ? ` · ${row.gradeType}` : ""}
                  {row.overallScore !== null && scoreLabel !== "Overall"
                    ? ` · overall ${Math.round(row.overallScore)}%`
                    : ""}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-base font-bold tabular-nums",
                  scoreTextColor(row.levelScore),
                )}
                title={scoreLabel}
              >
                {row.levelScore !== null ? `${Math.round(row.levelScore)}%` : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
