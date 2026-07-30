"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { BarChart3, ArrowLeft, Building2, Check, Home, LayoutDashboard, LogOut, Search, User } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import { formatSavedAt } from "@/lib/survey-persistence"
import { resolveCampusAssessor } from "@/lib/assessor"
import { PreWalkHeaderButton } from "@/components/pre-walk-launcher"
import { cn } from "@/lib/utils"

function AssessorProfileMenu() {
  const {
    state,
    hasAssessorRegistered,
    logoutAssessor,
    schools,
    schoolsLoading,
    setSchool,
    setView,
  } = useSurvey()
  const [open, setOpen] = useState(false)
  const [pickingSchool, setPickingSchool] = useState(false)
  const [schoolQuery, setSchoolQuery] = useState("")
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const assessor = resolveCampusAssessor(state.assessorByType, state.surveyType)

  const filteredSchools = useMemo(() => {
    const q = schoolQuery.trim().toLowerCase()
    if (!q) return schools
    return schools.filter(
      (school) =>
        school.displayName.toLowerCase().includes(q) ||
        school.name.toLowerCase().includes(q) ||
        school.campusId.toLowerCase().includes(q),
    )
  }, [schools, schoolQuery])

  useEffect(() => {
    if (!open) {
      setPickingSchool(false)
      setSchoolQuery("")
      return
    }
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pickingSchool) {
          setPickingSchool(false)
          setSchoolQuery("")
        } else setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, pickingSchool])

  useEffect(() => {
    if (pickingSchool) {
      setSchoolQuery("")
      // Focus after the search field mounts
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [pickingSchool])

  if (!hasAssessorRegistered || !assessor) return null

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Assessor profile"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 active:bg-slate-300"
      >
        <User className="h-4 w-4" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-[var(--color-border)] bg-white py-2 shadow-lg"
        >
          <div className="border-b border-[var(--color-border)] px-3 pb-2.5 pt-1">
            <p className="truncate text-sm font-medium text-slate-900">{assessor.name}</p>
            <p className="mt-0.5 truncate text-xs text-[var(--color-muted-foreground)]">
              {assessor.email}
            </p>
            {state.school && (
              <p className="mt-1.5 truncate text-xs text-[var(--color-muted-foreground)]">
                {state.school.displayName}
              </p>
            )}
          </div>

          {pickingSchool ? (
            <div className="flex flex-col">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setPickingSchool(false)
                  setSchoolQuery("")
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--color-muted-foreground)] hover:bg-slate-50"
              >
                <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Back
              </button>
              <div className="border-b border-[var(--color-border)] px-3 pb-2">
                <label htmlFor="school-switch-search" className="sr-only">
                  Search schools
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted-foreground)]"
                    aria-hidden
                  />
                  <input
                    ref={searchRef}
                    id="school-switch-search"
                    type="search"
                    value={schoolQuery}
                    onChange={(e) => setSchoolQuery(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="Search schools…"
                    autoComplete="off"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {schoolsLoading ? (
                  <p className="px-3 py-2 text-xs text-[var(--color-muted-foreground)]">Loading schools…</p>
                ) : filteredSchools.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-[var(--color-muted-foreground)]">
                    No schools match “{schoolQuery.trim()}”
                  </p>
                ) : (
                  filteredSchools.map((school) => {
                    const active = state.school?.id === school.id
                    return (
                      <button
                        key={school.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setSchool(school)
                          if (state.view === "results") setView("survey")
                          setOpen(false)
                          setPickingSchool(false)
                          setSchoolQuery("")
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50 active:bg-slate-100",
                          active && "bg-blue-50 text-[var(--color-primary)]",
                        )}
                      >
                        <Building2 className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{school.displayName}</span>
                        {active && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => setPickingSchool(true)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100"
              >
                <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                Switch school
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  logoutAssessor()
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 active:bg-red-100"
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                Log out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Fixed top bar: logo + ESA Survey title. Does not scroll with main content. */
export default function SurveyHeader() {
  const {
    state,
    setView,
    continueSurvey,
    openResults,
    schoolHasResults,
    schoolScoredRoomCount,
    hasAssessorRegistered,
  } = useSurvey()

  const showResults =
    schoolHasResults && state.view === "survey" && hasAssessorRegistered

  return (
    <header className="z-50 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-card)] shadow-sm safe-top">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Image
          src="/images/aisd-logo.png"
          alt="Austin Independent School District"
          width={120}
          height={48}
          className="h-10 w-auto shrink-0 object-contain object-left"
          priority
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold leading-tight">ESA Survey</h1>
          <p className="truncate text-xs text-[var(--color-muted-foreground)]">
            {state.view === "results" ? "Results" : "Field assessment"}
          </p>
        </div>
        <AssessorProfileMenu />
        <div className="flex max-w-[min(100%,14rem)] shrink-0 items-center gap-1.5 overflow-x-auto sm:max-w-none sm:gap-2">
          <button
            type="button"
            onClick={() => setView("landing")}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 active:bg-slate-100"
            aria-label="Back to home"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Home</span>
          </button>
          <button
            type="button"
            onClick={() => setView("admin")}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 active:bg-slate-100"
            aria-label="Open admin overview"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Admin</span>
          </button>
          {showResults && (
            <button
              type="button"
              onClick={() => openResults("campus")}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-[var(--color-primary)] active:bg-blue-100"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Results ({schoolScoredRoomCount})
            </button>
          )}
          {state.view === "results" && hasAssessorRegistered && (
            <button
              type="button"
              onClick={() => continueSurvey()}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-[var(--color-primary)] active:bg-blue-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Questions
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

/** School / auto-save status — scrolls with main content. Survey tabs are fixed above. */
export function SurveyHeaderControls() {
  const { state, lastSavedAt, hasAssessorRegistered } = useSurvey()

  if (state.view !== "survey") return null
  if (!hasAssessorRegistered || !state.school) return null

  return (
    <div className="border-b border-slate-200/80 bg-white px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            School
          </p>
          <p className="mt-0.5 text-base font-semibold tracking-tight text-slate-900">
            {state.school.displayName}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PreWalkHeaderButton />
          {state.session && lastSavedAt && (
            <p className="rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200/80">
              Saved {formatSavedAt(lastSavedAt)}
            </p>
          )}
        </div>
      </div>
      {state.school.hasFloorPlan && state.floorPlanLoading && (
        <p className="mt-2 text-xs text-slate-500">Loading room list…</p>
      )}
      {!state.school.hasFloorPlan && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200/80">
          No floor plan is available for this school yet.
        </p>
      )}
    </div>
  )
}
