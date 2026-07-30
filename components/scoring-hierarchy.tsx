"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import DrilldownScoreList from "@/components/drilldown-score-list"
import { ScoreBadge, ScoreBar } from "@/components/score-display"
import { sumPositiveWeights } from "@/lib/weight-display"
import { cn, scoreTextColor } from "@/lib/utils"
import type { CampusScoringSnapshot, AssessedRoomRecord } from "@/lib/campus-scoring-tree"
import { neighborhoodGroupLabel, UNASSIGNED_NEIGHBORHOOD_ID } from "@aisd/shared"

function spaceKey(focusAreaId: string, spaceType: string) {
  return `${focusAreaId}::${spaceType}`
}

function roomKey(focusAreaId: string, spaceType: string, roomId: string) {
  return `${focusAreaId}::${spaceType}::${roomId}`
}

export default function ScoringHierarchy({ snapshot }: { snapshot: CampusScoringSnapshot }) {
  const [openFocus, setOpenFocus] = useState<Set<string>>(() => new Set())
  const [openSpace, setOpenSpace] = useState<Set<string>>(() => new Set())
  const [openRoom, setOpenRoom] = useState<Set<string>>(() => new Set())

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setter(next)
  }

  const assessedCount = snapshot.allRooms.length
  const scoredCount = snapshot.allRooms.filter((r) => r.overallScore !== null).length
  const focusAreaWeightTotal = sumPositiveWeights(
    snapshot.focusAreas.map((area) => area.focusAreaWeight),
  )

  return (
    <div className="space-y-2">
      <p className="px-0.5 text-xs text-slate-500">
        {scoredCount} of {assessedCount} assessed space{assessedCount === 1 ? "" : "s"} scored
        {" · "}
        Tap to expand focus area → space type → room → category → subcategory → question.
      </p>

      {snapshot.focusAreas.map((area) => {
        const focusOpen = openFocus.has(area.id)
        const hasRooms = area.roomCount > 0

        return (
          <div
            key={area.id}
            className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
          >
            <button
              type="button"
              onClick={() => toggle(openFocus, area.id, setOpenFocus)}
              aria-expanded={focusOpen}
              className="flex w-full items-start gap-2 px-3 py-3 text-left transition-colors active:bg-slate-50"
            >
              {focusOpen ? (
                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              ) : (
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <ScoreBar
                  score={area.overallScore}
                  label={area.label}
                  weight={area.focusAreaWeight}
                  weightTotal={focusAreaWeightTotal}
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  {area.scoredRoomCount} of {area.roomCount} space{area.roomCount === 1 ? "" : "s"}{" "}
                  scored
                  {!hasRooms ? " · none assessed yet" : ""}
                </p>
              </div>
            </button>

            {focusOpen && (
              <div className="border-t border-slate-100 px-3 pb-3 pt-1">
                {area.spaceTypes.every((st) => st.roomCount === 0) ? (
                  <p className="py-2 pl-6 text-xs text-slate-500">
                    No rooms assessed in this focus area yet.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {area.spaceTypes
                      .filter((st) => st.roomCount > 0)
                      .map((st) => {
                        const sKey = spaceKey(area.id, st.spaceType)
                        const spaceOpen = openSpace.has(sKey)
                        const spaceTypeWeightTotal = sumPositiveWeights(
                          area.spaceTypes.map((group) => group.spaceTypeWeight),
                        )

                        return (
                          <div
                            key={sKey}
                            className="rounded-lg border border-slate-100 bg-slate-50/80"
                          >
                            <button
                              type="button"
                              onClick={() => toggle(openSpace, sKey, setOpenSpace)}
                              aria-expanded={spaceOpen}
                              className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors active:bg-slate-100/80"
                            >
                              {spaceOpen ? (
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
                                  score={st.overallScore}
                                  label={st.spaceType}
                                  weight={st.spaceTypeWeight}
                                  weightTotal={spaceTypeWeightTotal}
                                  compact
                                />
                                <p className="mt-0.5 text-[10px] text-slate-500">
                                  {st.scoredRoomCount} of {st.roomCount} room
                                  {st.roomCount === 1 ? "" : "s"}
                                </p>
                              </div>
                            </button>

                            {spaceOpen && (
                              <div className="border-t border-slate-100/80 px-2 pb-2 pt-1">
                                {st.rooms.map((room) => {
                                  const rKey = roomKey(area.id, st.spaceType, room.roomId)
                                  const roomOpen = openRoom.has(rKey)
                                  const session = snapshot.sessionsBySurveyType[room.surveyType]
                                  const neighborhoodLabel = neighborhoodGroupLabel(
                                    room.neighborhood?.trim() || UNASSIGNED_NEIGHBORHOOD_ID,
                                  )

                                  return (
                                    <div
                                      key={rKey}
                                      className="mb-1 last:mb-0 rounded-lg border border-slate-100 bg-white"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => toggle(openRoom, rKey, setOpenRoom)}
                                        aria-expanded={roomOpen}
                                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors active:bg-slate-50"
                                      >
                                        <div className="flex min-w-0 items-start gap-2">
                                          {roomOpen ? (
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
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-slate-900">
                                              {room.schoolRoomNumber ?? room.roomName}
                                            </p>
                                            <p className="mt-0.5 text-[10px] text-slate-500">
                                              {neighborhoodLabel}
                                              {room.gradeType ? ` · ${room.gradeType}` : ""}
                                              {room.complete ? " · complete" : ""}
                                              {st.roomCount > 0
                                                ? ` · ${Math.round(100 / st.roomCount)}% each`
                                                : ""}
                                            </p>
                                          </div>
                                        </div>
                                        <ScoreBadge score={room.overallScore} />
                                      </button>

                                      {roomOpen && session && (
                                        <div className="border-t border-slate-100 px-2 pb-2 pt-1">
                                          <DrilldownScoreList
                                            categories={room.categoryScores}
                                            roomIds={[room.roomId]}
                                            session={session}
                                            surveyType={room.surveyType}
                                            roomScoreDetails={
                                              snapshot.roomScoreDetailsBySurveyType[
                                                room.surveyType
                                              ]
                                            }
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
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

export function RoomScoreCards({
  rooms,
  snapshot,
  onSelectRoom,
}: {
  rooms: CampusScoringSnapshot["allRooms"]
  snapshot: CampusScoringSnapshot
  onSelectRoom?: (room: AssessedRoomRecord) => void
}) {
  const [openRoom, setOpenRoom] = useState<Set<string>>(() => new Set())

  if (!rooms.length) {
    return (
      <p className="rounded-2xl border border-slate-200/90 bg-white px-4 py-8 text-center text-sm text-slate-500">
        No assessed rooms yet.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {rooms.map((room) => {
        const roomOpen = openRoom.has(room.roomId)
        const session = snapshot.sessionsBySurveyType[room.surveyType]
        const neighborhoodLabel = neighborhoodGroupLabel(
          room.neighborhood?.trim() || UNASSIGNED_NEIGHBORHOOD_ID,
        )

        return (
          <li
            key={`${room.surveyType}:${room.roomId}`}
            className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
          >
            <button
              type="button"
              onClick={() => {
                const next = new Set(openRoom)
                if (next.has(room.roomId)) next.delete(room.roomId)
                else next.add(room.roomId)
                setOpenRoom(next)
                onSelectRoom?.(room)
              }}
              className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors active:bg-slate-50"
            >
              <div className="flex min-w-0 items-start gap-2">
                {roomOpen ? (
                  <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                ) : (
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {room.schoolRoomNumber ?? room.roomName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {room.spaceType} · {neighborhoodLabel}
                    {room.gradeType ? ` · ${room.gradeType}` : ""}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 text-lg font-bold tabular-nums",
                  scoreTextColor(room.overallScore),
                )}
              >
                {room.overallScore !== null ? `${Math.round(room.overallScore)}%` : "—"}
              </span>
            </button>

            {roomOpen && session && (
              <div className="border-t border-slate-100 px-3 pb-3 pt-1">
                <DrilldownScoreList
                  categories={room.categoryScores}
                  roomIds={[room.roomId]}
                  session={session}
                  surveyType={room.surveyType}
                  roomScoreDetails={snapshot.roomScoreDetailsBySurveyType[room.surveyType]}
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function NeighborhoodScoreCards({
  snapshot,
}: {
  snapshot: CampusScoringSnapshot
}) {
  const [openNeighborhood, setOpenNeighborhood] = useState<Set<string>>(() => new Set())
  const [openRoom, setOpenRoom] = useState<Set<string>>(() => new Set())

  const scorableNeighborhoods = snapshot.neighborhoods.filter(
    (n) => n.neighborhoodId !== UNASSIGNED_NEIGHBORHOOD_ID,
  )

  if (!scorableNeighborhoods.length) {
    return (
      <p className="rounded-2xl border border-slate-200/90 bg-white px-4 py-8 text-center text-sm text-slate-500">
        No neighborhood scores yet.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {scorableNeighborhoods.map((n) => {
        const nOpen = openNeighborhood.has(n.neighborhoodId)

        return (
          <div
            key={n.neighborhoodId}
            className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
          >
            <button
              type="button"
              onClick={() => {
                const next = new Set(openNeighborhood)
                if (next.has(n.neighborhoodId)) next.delete(n.neighborhoodId)
                else next.add(n.neighborhoodId)
                setOpenNeighborhood(next)
              }}
              className="flex w-full items-start gap-2 px-3 py-3 text-left transition-colors active:bg-slate-50"
            >
              {nOpen ? (
                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              ) : (
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <ScoreBar score={n.overallScore} label={n.neighborhoodLabel} />
                <p className="mt-1 text-[10px] text-slate-500">
                  {n.scoredRoomCount} of {n.roomCount} rooms scored
                </p>
              </div>
            </button>

            {nOpen && (
              <div className="border-t border-slate-100 px-3 pb-3 pt-1">
                <ul className="space-y-1">
                  {n.rooms
                    .filter((r) => r.overallScore !== null)
                    .map((room) => {
                      const assessed = snapshot.allRooms.find(
                        (a) => a.roomId === room.roomId,
                      )
                      if (!assessed) return null
                      const session = snapshot.sessionsBySurveyType[assessed.surveyType]
                      const roomOpen = openRoom.has(room.roomId)

                      return (
                        <li
                          key={room.roomId}
                          className="rounded-lg border border-slate-100 bg-slate-50/80"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              const next = new Set(openRoom)
                              if (next.has(room.roomId)) next.delete(room.roomId)
                              else next.add(room.roomId)
                              setOpenRoom(next)
                            }}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                          >
                            <div className="flex min-w-0 items-start gap-2">
                              {roomOpen ? (
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
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-900">
                                  {room.schoolRoomNumber ?? room.roomName}
                                </p>
                                <p className="mt-0.5 text-[10px] text-slate-500">
                                  {assessed.spaceType}
                                </p>
                              </div>
                            </div>
                            <ScoreBadge score={room.overallScore} />
                          </button>
                          {roomOpen && session && (
                            <div className="border-t border-slate-100/80 px-2 pb-2 pt-1">
                              <DrilldownScoreList
                                categories={room.categoryScores}
                                roomIds={[room.roomId]}
                                session={session}
                                surveyType={assessed.surveyType}
                                roomScoreDetails={
                                  snapshot.roomScoreDetailsBySurveyType[assessed.surveyType]
                                }
                              />
                            </div>
                          )}
                        </li>
                      )
                    })}
                </ul>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
