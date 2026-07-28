"use client"

import { useMemo, useState } from "react"
import { BarChart3, ClipboardCheck, Download, Layers, Map, X } from "lucide-react"
import QaFloorPlanPanel from "@/components/qa-floor-plan-panel"
import ScoringHierarchy from "@/components/scoring-hierarchy"
import { CategoryScoreList, ScoreBadge, ScoreBar } from "@/components/score-display"
import { saveQaFinalization } from "@/lib/admin-qa"
import type { AdminSchoolSummary } from "@/lib/admin-survey-index"
import { buildCampusScoringSnapshot } from "@/lib/campus-scoring-tree"
import { isValidAssessorEmail } from "@/lib/assessor"
import {
  buildQaPeerComparison,
  campusCategoryScoresFromSnapshot,
} from "@/lib/qa-peer-comparison"
import { downloadQaScoreCsv } from "@/lib/qa-score-export"
import type { PersistedSurveyDraft } from "@/lib/survey-persistence"
import { cn, scoreTextColor } from "@/lib/utils"
import type { AisdSchoolOption } from "@aisd/shared"

type QaReviewTab = "breakdown" | "compare" | "floorplan"

function ComparisonMetric({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  )
}

export default function QaSchoolReviewModal({
  school,
  schoolDisplayName,
  schools,
  schoolClassById,
  schoolDrafts,
  onClose,
  onFinalized,
}: {
  school: AdminSchoolSummary
  schoolDisplayName: string
  schools: AisdSchoolOption[]
  schoolClassById: Map<string, string>
  schoolDrafts?: PersistedSurveyDraft[]
  onClose: () => void
  onFinalized: () => void
}) {
  const [tab, setTab] = useState<QaReviewTab>("breakdown")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [touched, setTouched] = useState(false)

  const schoolMeta = useMemo(
    () => schools.find((s) => s.id === school.schoolId),
    [school.schoolId, schools],
  )

  const snapshot = useMemo(
    () =>
      buildCampusScoringSnapshot({
        schoolId: school.schoolId,
        schoolName: schoolDisplayName,
        campusId: school.campusId,
        schoolClass: school.schoolClass,
        drafts: schoolDrafts,
      }),
    [school.campusId, school.schoolClass, school.schoolId, schoolDisplayName, schoolDrafts],
  )

  const campusCategories = useMemo(
    () => campusCategoryScoresFromSnapshot(snapshot),
    [snapshot],
  )

  const peerComparison = useMemo(
    () => buildQaPeerComparison(school.schoolId, schools, schoolClassById),
    [school.schoolId, schoolClassById, schools],
  )

  const handleDownloadCsv = () => {
    downloadQaScoreCsv(snapshot, {
      schoolClass: school.schoolClass,
      peerComparison,
    })
  }

  const nameValid = name.trim().length > 0
  const emailValid = isValidAssessorEmail(email)
  const canSubmit = nameValid && emailValid

  const submit = () => {
    setTouched(true)
    if (!canSubmit) return
    saveQaFinalization({
      schoolId: school.schoolId,
      reviewerName: name,
      reviewerEmail: email,
    })
    onFinalized()
  }

  const delta =
    snapshot.campusOverallScore != null && peerComparison?.districtAverage != null
      ? snapshot.campusOverallScore - peerComparison.districtAverage
      : null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-0 sm:items-stretch sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qa-review-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:my-auto sm:max-h-[min(920px,calc(100dvh-2rem))] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-600">
                QA review
              </p>
              <h3 id="qa-review-title" className="mt-1 text-lg font-semibold text-slate-900">
                {schoolDisplayName}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Review campus scores, compare to peer schools, then sign off to move this school to
                finalized.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Download CSV</span>
                <span className="sm:hidden">CSV</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-slate-400">Campus</dt>
              <dd className="mt-0.5 font-semibold text-slate-800">
                {schoolMeta?.campusId || school.campusId || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Class</dt>
              <dd className="mt-0.5 font-semibold text-slate-800">{school.schoolClass || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Progress</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-slate-800">
                {school.completedRequiredCount}/{school.requiredSurveyCount} surveys
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Campus score</dt>
              <dd className="mt-0.5">
                <ScoreBadge score={snapshot.campusOverallScore} />
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setTab("breakdown")}
              className={cn(
                "inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors",
                tab === "breakdown"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              Score breakdown
            </button>
            <button
              type="button"
              onClick={() => setTab("compare")}
              className={cn(
                "inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors",
                tab === "compare"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Peer comparison</span>
              <span className="sm:hidden">Peers</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("floorplan")}
              className={cn(
                "inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors",
                tab === "floorplan"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <Map className="h-3.5 w-3.5" />
              Floor plan
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-32 sm:px-5 sm:pb-36">
          {tab === "breakdown" ? (
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Campus
                    </p>
                    <h4 className="mt-1 text-sm font-semibold text-slate-900">
                      {schoolDisplayName}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Overall campus ESA score and category rollup across all submitted surveys.
                    </p>
                  </div>
                  <ScoreBadge score={snapshot.campusOverallScore} size="lg" />
                </div>
                <div className="mt-4">
                  <CategoryScoreList scores={campusCategories} />
                </div>
              </section>

              <section>
                <div className="mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    Drill-down
                  </p>
                  <h4 className="mt-1 text-sm font-semibold text-slate-900">
                    Focus area → space type → room → category → subcategory → question
                  </h4>
                </div>
                {snapshot.allRooms.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
                    No scored spaces found for this school yet.
                  </p>
                ) : (
                  <ScoringHierarchy snapshot={snapshot} />
                )}
              </section>
            </div>
          ) : tab === "floorplan" ? (
            <div className="space-y-4">
              <section>
                <div className="mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    Floor plan
                  </p>
                  <h4 className="mt-1 text-sm font-semibold text-slate-900">
                    Campus scores on the plan
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Switch between ESA score bands and neighborhood groupings. Tap a room for its
                    score details.
                  </p>
                </div>
                {schoolMeta ? (
                  <QaFloorPlanPanel school={schoolMeta} snapshot={snapshot} />
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
                    School metadata is unavailable for this floor plan.
                  </p>
                )}
              </section>
            </div>
          ) : peerComparison ? (
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  {peerComparison.peerGroupLabel}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {peerComparison.scoredPeerCount} school
                  {peerComparison.scoredPeerCount === 1 ? "" : "s"} with campus scores in this peer
                  group.
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <ComparisonMetric
                    label="This school"
                    value={
                      snapshot.campusOverallScore != null
                        ? `${Math.round(snapshot.campusOverallScore)}%`
                        : "—"
                    }
                  />
                  <ComparisonMetric
                    label="Peer average"
                    value={
                      peerComparison.districtAverage != null
                        ? `${Math.round(peerComparison.districtAverage)}%`
                        : "—"
                    }
                  />
                  <ComparisonMetric
                    label="Rank"
                    value={
                      peerComparison.rank != null
                        ? `#${peerComparison.rank} of ${peerComparison.scoredPeerCount}`
                        : "—"
                    }
                  />
                  <ComparisonMetric
                    label="Percentile"
                    value={
                      peerComparison.percentile != null
                        ? `${peerComparison.percentile}th`
                        : "—"
                    }
                    hint={
                      delta != null
                        ? `${delta >= 0 ? "+" : ""}${Math.round(delta)} pts vs peer average`
                        : undefined
                    }
                  />
                </div>
              </section>

              {peerComparison.focusAreas.length > 0 ? (
                <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                  <h4 className="text-sm font-semibold text-slate-900">Focus area comparison</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    This school vs peer average for each scoring focus area.
                  </p>
                  <div className="mt-4 space-y-3">
                    {peerComparison.focusAreas.map((area) => (
                      <div key={area.focusAreaId} className="rounded-xl bg-slate-50/80 p-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-800">{area.label}</p>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            {area.rank != null ? (
                              <span>
                                Rank #{area.rank}
                                {area.percentile != null ? ` · ${area.percentile}th pct` : ""}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <ScoreBar score={area.targetScore} label="This school" compact />
                        <div className="mt-2">
                          <ScoreBar score={area.districtAverage} label="Peer average" compact />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {peerComparison.categories.length > 0 ? (
                <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                  <h4 className="text-sm font-semibold text-slate-900">Category comparison</h4>
                  <div className="mt-4 space-y-3">
                    {peerComparison.categories.map((cat) => (
                      <div key={cat.category} className="rounded-xl bg-slate-50/80 p-3">
                        <ScoreBar score={cat.targetScore} label={cat.category} compact />
                        <div className="mt-2">
                          <ScoreBar score={cat.districtAverage} label="Peer average" compact />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                <h4 className="text-sm font-semibold text-slate-900">All peer schools</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Sorted by campus score within {peerComparison.peerGroupLabel.toLowerCase()}.
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                        <th className="px-2 py-2">Rank</th>
                        <th className="px-2 py-2">School</th>
                        <th className="px-2 py-2">Score</th>
                        <th className="px-2 py-2">Percentile</th>
                      </tr>
                    </thead>
                    <tbody>
                      {peerComparison.peers.map((peer) => (
                        <tr
                          key={peer.schoolId}
                          className={cn(
                            "border-b border-slate-100 last:border-0",
                            peer.isTarget && "bg-violet-50/70",
                          )}
                        >
                          <td className="px-2 py-2 tabular-nums text-slate-500">
                            {peer.rank ?? "—"}
                          </td>
                          <td className="px-2 py-2">
                            <span
                              className={cn(
                                "font-medium",
                                peer.isTarget ? "text-violet-800" : "text-slate-900",
                              )}
                            >
                              {peer.schoolName}
                              {peer.isTarget ? " (this school)" : ""}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            {peer.campusOverallScore != null ? (
                              <span
                                className={cn(
                                  "font-semibold tabular-nums",
                                  scoreTextColor(peer.campusOverallScore),
                                )}
                              >
                                {Math.round(peer.campusOverallScore)}%
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2 tabular-nums text-slate-500">
                            {peer.percentile != null ? `${peer.percentile}th` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 sm:px-5">
          <div className="flex items-start gap-2">
            <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">QA sign-off</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Confirm the assessment review is complete, then enter your name and email to push
                this school to finalized.
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="qa-review-name" className="mb-1 block text-xs font-medium text-slate-600">
                Reviewer name <span className="text-red-500">*</span>
              </label>
              <input
                id="qa-review-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched(true)}
                className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none ring-violet-200 focus:bg-white focus:ring-2"
                placeholder="Full name"
              />
              {touched && !nameValid ? (
                <p className="mt-1 text-xs text-red-600">Enter your name.</p>
              ) : null}
            </div>
            <div>
              <label htmlFor="qa-review-email" className="mb-1 block text-xs font-medium text-slate-600">
                Reviewer email <span className="text-red-500">*</span>
              </label>
              <input
                id="qa-review-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched(true)}
                className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none ring-violet-200 focus:bg-white focus:ring-2"
                placeholder="name@example.com"
              />
              {touched && email.trim() && !emailValid ? (
                <p className="mt-1 text-xs text-red-600">Enter a valid email address.</p>
              ) : null}
              {touched && !email.trim() ? (
                <p className="mt-1 text-xs text-red-600">Enter your email.</p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="rounded-lg bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sign off and move to finalized
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
