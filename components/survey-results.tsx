"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Camera,
  GitCompare,
  Home,
  Info,
  LayoutGrid,
  Map,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import SurveyFloorPlan from "@/components/survey-floor-plan"
import ResultsPhotosPanel from "@/components/results-photos-panel"
import ScoringMethodologyModal from "@/components/scoring-methodology-modal"
import ScoringHierarchy, {
  NeighborhoodScoreCards,
  RoomScoreCards,
} from "@/components/scoring-hierarchy"
import FocusAreaComparisonPanel from "@/components/focus-area-comparison-panel"
import { OverallScoreDisplay } from "@/components/score-display"
import { cn } from "@/lib/utils"
import { buildCampusScoringSnapshot } from "@/lib/campus-scoring-tree"
import { useFloorPlanDisplay } from "@/lib/use-floor-plan-display"

type ResultsTab = "campus" | "room" | "neighborhood" | "compare" | "photos"

export default function SurveyResults() {
  const {
    state,
    currentResults,
    continueSurvey,
    resetSurvey,
    selectRoom,
    submission,
    schools,
    resultsInitialTab,
    clearResultsInitialTab,
    scoringDrafts,
  } = useSurvey()
  const [tab, setTab] = useState<ResultsTab>("campus")
  const [roomQuery, setRoomQuery] = useState("")
  const [scoringInfoOpen, setScoringInfoOpen] = useState(false)

  useEffect(() => {
    if (!resultsInitialTab) return
    setTab(resultsInitialTab)
    setRoomQuery("")
    clearResultsInitialTab()
  }, [resultsInitialTab, clearResultsInitialTab])

  const results = currentResults ?? submission
  const plan = state.floorPlan
  useFloorPlanDisplay(!!plan)
  const assessor =
    state.assessorByType[state.surveyType] ??
    (results?.session.assessorName
      ? { name: results.session.assessorName, email: results.session.assessorEmail ?? "" }
      : null)

  const snapshot = useMemo(() => {
    if (!state.school) return null
    return buildCampusScoringSnapshot({
      schoolId: state.school.id,
      schoolName: state.school.displayName,
      campusId: state.school.campusId,
      schoolClass: state.school.schoolClass,
      drafts: scoringDrafts,
      liveSurveyType: state.surveyType,
      liveSession: state.session,
      liveRoomScoreDetails: state.roomScoreDetails,
      liveNeighborhoodResolver: (roomId, roomSession) => {
        const fromSession = roomSession.neighborhood?.trim()
        if (fromSession) return fromSession
        return state.allRooms.find((r) => r.id === roomId)?.neighborhood?.trim()
      },
    })
  }, [
    state.school,
    scoringDrafts,
    state.surveyType,
    state.session,
    state.roomScoreDetails,
    state.allRooms,
  ])

  const roomScoreById = useMemo(() => {
    if (!snapshot) return {}
    const map: Record<string, number | null> = {}
    for (const room of snapshot.allRooms) {
      if (room.overallScore !== null) {
        map[room.roomId] = room.overallScore
      } else if (!(room.roomId in map)) {
        map[room.roomId] = null
      }
    }
    return map
  }, [snapshot])

  const neighborhoodScoreById = useMemo(() => {
    if (!snapshot) return {}
    const map: Record<string, number | null> = {}
    for (const neighborhood of snapshot.neighborhoods) {
      map[neighborhood.neighborhoodId] = neighborhood.overallScore
    }
    return map
  }, [snapshot])

  const roomNameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const room of state.allRooms) {
      map[room.id] = room.name?.trim() || room.id
    }
    return map
  }, [state.allRooms])

  const resultsFloorPlanScoreMode =
    tab === "room" ? "room" : tab === "neighborhood" ? "neighborhood" : undefined

  const filteredRooms = useMemo(() => {
    if (!snapshot) return []
    const q = roomQuery.trim().toLowerCase()
    if (!q) return snapshot.allRooms.filter((r) => r.overallScore !== null)
    return snapshot.allRooms.filter(
      (r) =>
        r.overallScore !== null &&
        (r.roomName.toLowerCase().includes(q) ||
          r.roomId.toLowerCase().includes(q) ||
          (r.schoolRoomNumber?.toLowerCase().includes(q) ?? false) ||
          (r.neighborhood?.toLowerCase().includes(q) ?? false) ||
          r.spaceType.toLowerCase().includes(q) ||
          (r.gradeType?.toLowerCase().includes(q) ?? false)),
    )
  }, [snapshot, roomQuery])

  if (!snapshot || !state.school) return null

  const campus =
    results?.campus ??
    ({
      schoolId: state.school.id,
      schoolName: state.school.displayName,
      campusId: state.school.campusId,
      overallScore: snapshot.campusOverallScore,
      neighborhoods: snapshot.neighborhoods,
      rooms: snapshot.allRooms.map((room) => ({
        roomId: room.roomId,
        roomName: room.roomName,
        schoolRoomNumber: room.schoolRoomNumber,
        neighborhood: room.neighborhood,
        gradeType: room.gradeType,
        overallScore: room.overallScore,
        categoryScores: room.categoryScores,
        answeredCount: room.answeredCount,
        totalCount: room.totalCount,
        complete: room.complete,
      })),
    } as NonNullable<typeof results>["campus"])

  const assessedCount = snapshot.allRooms.length
  const scoredCount = snapshot.allRooms.filter((r) => r.overallScore !== null).length

  const tabs: {
    id: ResultsTab
    label: string
    shortLabel: string
    icon: typeof Home
  }[] = [
    { id: "campus", label: "Campus", shortLabel: "Campus", icon: Home },
    { id: "room", label: "By Room", shortLabel: "Rooms", icon: LayoutGrid },
    { id: "neighborhood", label: "By Neighborhood", shortLabel: "Hood", icon: Map },
    { id: "compare", label: "Compare", shortLabel: "Compare", icon: GitCompare },
    { id: "photos", label: "Photos", shortLabel: "Photos", icon: Camera },
  ]

  return (
    <div className="flex flex-col bg-gradient-to-b from-slate-200 to-slate-300/90">
      <div className="border-b border-slate-200/80 bg-white px-3 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Results
            </p>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">
              {campus.schoolName}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {submission
                ? `Saved ${new Date(submission.submittedAt).toLocaleString()}`
                : "Live preview"}
              {" · "}
              {scoredCount} of {assessedCount} assessed spaces scored
            </p>
            {assessor?.name && (
              <p className="mt-1 text-xs text-slate-500">
                Assessor: {assessor.name}
                {assessor.email ? ` · ${assessor.email}` : ""}
              </p>
            )}
            {results?.session.finalComment?.trim() ? (
              <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
                <span className="font-semibold text-slate-900">Final thoughts: </span>
                {results.session.finalComment.trim()}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => setScoringInfoOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.03)] hover:bg-slate-50"
            >
              <Info className="h-3.5 w-3.5 text-[var(--color-primary)]" aria-hidden />
              How scoring works
            </button>
          </div>
          <OverallScoreDisplay score={snapshot.campusOverallScore} label="Campus ESA" />
        </div>

        <div className="mt-4 flex gap-1.5 rounded-xl bg-slate-100 p-1.5">
          {tabs.map(({ id, label, shortLabel, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id)
                setRoomQuery("")
              }}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-1.5 py-2.5 text-[11px] font-medium transition-colors sm:gap-1.5 sm:px-2.5 sm:text-xs",
                tab === id
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                  : "text-slate-500 active:text-slate-700",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate sm:hidden">{shortLabel}</span>
              <span className="hidden truncate sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {tab === "photos" ? (
          <div className="w-full p-3">
            <ResultsPhotosPanel
              campusId={state.school!.campusId}
              schoolId={state.school!.id}
              schoolClass={state.school?.schoolClass}
              sessionsBySurveyType={snapshot.sessionsBySurveyType}
              liveSurveyType={state.surveyType}
              liveSession={state.session}
              livePreWalk={state.preWalk}
              roomNameById={roomNameById}
            />
          </div>
        ) : (
          <>
            <div className="flex-1 p-3 lg:border-r lg:border-slate-200/80">
          {tab === "campus" && (
            <section className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <div className="mb-3 flex items-start justify-between gap-2 px-0.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Scoring focus areas
                </h3>
                <button
                  type="button"
                  onClick={() => setScoringInfoOpen(true)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-white hover:text-slate-900"
                >
                  <Info className="h-3 w-3" aria-hidden />
                  Scoring info
                </button>
              </div>
              <ScoringHierarchy snapshot={snapshot} />
            </section>
          )}

          {tab === "room" && (
            <div className="space-y-3">
              <div className="relative">
                <label htmlFor="results-room-search" className="sr-only">
                  Search rooms
                </label>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  id="results-room-search"
                  name="results-room-search"
                  type="search"
                  value={roomQuery}
                  onChange={(e) => setRoomQuery(e.target.value)}
                  placeholder="Search by room, space type, or neighborhood…"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-200/90 bg-white py-2.5 pl-10 pr-3 text-sm outline-none shadow-[0_1px_0_rgba(15,23,42,0.03)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-100"
                />
              </div>
              {filteredRooms.length === 0 ? (
                <p className="rounded-2xl border border-slate-200/90 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                  {roomQuery.trim()
                    ? `No rooms match “${roomQuery.trim()}”`
                    : "No scored rooms yet."}
                </p>
              ) : (
                <RoomScoreCards
                  rooms={filteredRooms}
                  snapshot={snapshot}
                  onSelectRoom={selectRoom}
                />
              )}
            </div>
          )}

          {tab === "neighborhood" && <NeighborhoodScoreCards snapshot={snapshot} />}

          {tab === "compare" && (
            <FocusAreaComparisonPanel snapshot={snapshot} schools={schools} />
          )}
            </div>

            {plan && (
              <div className="border-t border-slate-200/80 p-3 lg:w-[45%] lg:border-t-0 lg:pl-0">
                <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                  <SurveyFloorPlan
                    readOnly
                    resultsScoreMode={resultsFloorPlanScoreMode}
                    roomScoreById={roomScoreById}
                    neighborhoodScoreById={neighborhoodScoreById}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ScoringMethodologyModal open={scoringInfoOpen} onClose={() => setScoringInfoOpen(false)} />

      <div className="border-t border-slate-200/80 bg-white px-3 pt-3 shadow-[0_-1px_3px_rgba(15,23,42,0.03)] safe-bottom">
        <div className="mb-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => continueSurvey()}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] text-sm font-semibold text-white shadow-sm active:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Survey another room
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => continueSurvey()}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 active:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Edit rooms
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "Start a new survey? All saved room data for this school will be cleared.",
                  )
                ) {
                  resetSurvey()
                }
              }}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white text-sm font-medium text-red-600 active:bg-red-50"
            >
              <RotateCcw className="h-4 w-4" />
              Start over
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
