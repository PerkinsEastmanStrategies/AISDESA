"use client"

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { createPortal } from "react-dom"
import { ClipboardCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  groupPilotCarryOverRooms,
  type PilotCarryOverGroup,
  type PilotCarryOverRoom,
} from "@/lib/pilot-carryover"

type Decision = "keep" | "remove"

interface PilotCarryOverModalProps {
  open: boolean
  schoolName: string
  rooms: PilotCarryOverRoom[]
  applying?: boolean
  onConfirm: (removed: Array<{ surveyType: PilotCarryOverRoom["surveyType"]; roomId: string }>) => void
}

function CarryOverGroupList({
  groups,
  decisions,
  setDecisions,
  setGroupDecision,
  absent,
}: {
  groups: PilotCarryOverGroup[]
  decisions: Record<string, Decision>
  setDecisions: Dispatch<SetStateAction<Record<string, Decision>>>
  setGroupDecision: (keys: string[], decision: Decision) => void
  absent: boolean
}) {
  return (
    <>
      {groups.map((group) => {
        const keys = group.rooms.map((room) => room.key)
        return (
          <section key={`${group.surveyType}:${group.spaceType}`} className="mb-4 last:mb-0">
            <div className="mb-2 flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {group.surveyLabel}
                </p>
                <h3 className="text-sm font-semibold text-slate-900">{group.spaceType}</h3>
              </div>
              <div className="flex shrink-0 gap-2 text-[11px] font-semibold">
                <button
                  type="button"
                  className="text-[var(--color-primary)]"
                  onClick={() => setGroupDecision(keys, "keep")}
                >
                  Keep all
                </button>
                <button
                  type="button"
                  className="text-slate-500"
                  onClick={() => setGroupDecision(keys, "remove")}
                >
                  Remove all
                </button>
              </div>
            </div>
            <ul className="space-y-2">
              {group.rooms.map((room) => {
                const decision = decisions[room.key] ?? "keep"
                return (
                  <li
                    key={room.key}
                    className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{room.label}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {absent
                            ? "Marked not at school on campus"
                            : `${room.percent}% complete${
                                room.complete
                                  ? " · complete"
                                  : ` · ${room.answered}/${room.total} answered`
                              }`}
                        </p>
                      </div>
                      <div className="flex shrink-0 rounded-lg bg-white p-0.5 ring-1 ring-slate-200">
                        <button
                          type="button"
                          onClick={() =>
                            setDecisions((current) => ({ ...current, [room.key]: "keep" }))
                          }
                          className={cn(
                            "min-h-8 rounded-md px-2.5 text-xs font-semibold",
                            decision === "keep"
                              ? "bg-[var(--color-primary)] text-white"
                              : "text-slate-600",
                          )}
                        >
                          Keep
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDecisions((current) => ({ ...current, [room.key]: "remove" }))
                          }
                          className={cn(
                            "min-h-8 rounded-md px-2.5 text-xs font-semibold",
                            decision === "remove"
                              ? "bg-red-600 text-white"
                              : "text-slate-600",
                          )}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    {!absent ? (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            room.complete ? "bg-emerald-500" : "bg-amber-400",
                          )}
                          style={{ width: `${Math.min(100, room.percent)}%` }}
                        />
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </>
  )
}

export default function PilotCarryOverModal({
  open,
  schoolName,
  rooms,
  applying = false,
  onConfirm,
}: PilotCarryOverModalProps) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})

  useEffect(() => {
    if (!open) return
    setDecisions(Object.fromEntries(rooms.map((room) => [room.key, "keep"])))
  }, [open, rooms])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const surveyedRooms = useMemo(() => rooms.filter((room) => !room.absent), [rooms])
  const absentRooms = useMemo(() => rooms.filter((room) => room.absent), [rooms])
  const surveyedGroups = useMemo(
    () => groupPilotCarryOverRooms(surveyedRooms),
    [surveyedRooms],
  )
  const absentGroups = useMemo(() => groupPilotCarryOverRooms(absentRooms), [absentRooms])
  const removeCount = rooms.filter((room) => decisions[room.key] === "remove").length
  const keepCount = rooms.length - removeCount
  const absentKeys = useMemo(() => absentRooms.map((room) => room.key), [absentRooms])

  const setGroupDecision = (keys: string[], decision: Decision) => {
    setDecisions((current) => {
      const next = { ...current }
      for (const key of keys) next[key] = decision
      return next
    })
  }

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/45" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pilot-carryover-title"
        className="relative flex max-h-[min(92dvh,44rem)] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--color-border)] bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-[var(--color-border)] px-4 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[var(--color-primary)]">
            <ClipboardCheck className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {schoolName}
            </p>
            <h2 id="pilot-carryover-title" className="mt-0.5 text-lg font-semibold text-slate-900">
              Confirm carried-over spaces
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Keep a room to finish unanswered questions, or remove it so it is not carried over.
              Spaces marked not at school need the same confirmation.
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3">
          {surveyedGroups.length > 0 ? (
            <CarryOverGroupList
              groups={surveyedGroups}
              decisions={decisions}
              setDecisions={setDecisions}
              setGroupDecision={setGroupDecision}
              absent={false}
            />
          ) : null}

          {absentGroups.length > 0 ? (
            <div className={surveyedGroups.length > 0 ? "mt-5 border-t border-slate-200 pt-4" : undefined}>
              <div className="mb-3 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Marked not at school
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    Keep leaves this space marked not at school. Remove it from this campus copy if it
                    should be surveyed.
                  </p>
                </div>
                <div className="flex shrink-0 gap-2 text-[11px] font-semibold">
                  <button
                    type="button"
                    className="text-[var(--color-primary)]"
                    onClick={() => setGroupDecision(absentKeys, "keep")}
                  >
                    Keep all
                  </button>
                  <button
                    type="button"
                    className="text-slate-500"
                    onClick={() => setGroupDecision(absentKeys, "remove")}
                  >
                    Remove all
                  </button>
                </div>
              </div>
              <CarryOverGroupList
                groups={absentGroups}
                decisions={decisions}
                setDecisions={setDecisions}
                setGroupDecision={setGroupDecision}
                absent
              />
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-[var(--color-border)] px-4 py-3">
          <p className="mb-2 text-xs text-slate-500">
            {keepCount} keep · {removeCount} remove
          </p>
          <button
            type="button"
            disabled={applying}
            onClick={() =>
              onConfirm(
                rooms
                  .filter((room) => decisions[room.key] === "remove")
                  .map((room) => ({ surveyType: room.surveyType, roomId: room.roomId })),
              )
            }
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white active:opacity-90 disabled:opacity-60"
          >
            {applying ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
