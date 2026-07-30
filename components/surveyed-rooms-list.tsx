"use client"

import { useState } from "react"
import { Check, ChevronDown, ChevronRight, ChevronUp } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import { ScoreBadge } from "@/components/score-display"
import { cn } from "@/lib/utils"
import { displayRoomNumberInSchool } from "@aisd/shared"

export default function SurveyedRoomsList() {
  const { surveyedRooms, state, selectRoom } = useSurvey()
  const [expanded, setExpanded] = useState(false)

  if (!surveyedRooms.length) return null

  const completeCount = surveyedRooms.filter((r) => r.complete).length

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-card)]">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-3 text-left active:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Surveyed rooms ({surveyedRooms.length})
          </h3>
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            {completeCount} complete
            {!expanded ? " · tap to expand" : ""}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" aria-hidden />
        )}
      </button>

      {expanded && (
        <ul className="max-h-36 space-y-1 overflow-y-auto border-t border-[var(--color-border)] px-3 pb-3 pt-2">
          {surveyedRooms.map((room) => {
            const session = state.session?.rooms[room.roomId]
            const schoolNumber = session
              ? displayRoomNumberInSchool(session)
              : room.schoolRoomNumber ?? room.roomId
            return (
            <li key={room.roomId}>
              <button
                type="button"
                onClick={() => selectRoom(room.roomId)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm active:bg-slate-100",
                  state.selectedRoomId === room.roomId && "bg-blue-50 ring-1 ring-blue-200",
                )}
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {schoolNumber}
                  {session?.schoolRoomNumber?.trim() && (
                    <span className="ml-1 text-xs font-normal text-[var(--color-muted-foreground)]">
                      · plan {room.roomId}
                    </span>
                  )}
                  {!session?.schoolRoomNumber?.trim() && room.roomName !== room.roomId && (
                    <span className="ml-1 text-xs font-normal text-[var(--color-muted-foreground)]">
                      · {room.roomName}
                    </span>
                  )}
                  {room.building && (
                    <span className="ml-1 text-xs font-normal text-[var(--color-muted-foreground)]">
                      · Bldg {room.building}
                    </span>
                  )}
                </span>
                {room.complete && (
                  <Check className="h-4 w-4 shrink-0 text-green-600" aria-label="Complete" />
                )}
                <ScoreBadge score={room.overallScore} />
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
