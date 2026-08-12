"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import { isValidAssessorEmail, resolveCampusAssessor } from "@/lib/assessor"
import { cn } from "@/lib/utils"

export default function SurveyAssessorLanding() {
  const {
    state,
    registerAssessor,
    schools,
    schoolsLoading,
    setSchool,
  } = useSurvey()
  const existing =
    state.assessorByType[state.surveyType] ?? resolveCampusAssessor(state.assessorByType)

  const [name, setName] = useState(existing?.name ?? "")
  const [email, setEmail] = useState(existing?.email ?? "")
  const [touched, setTouched] = useState(false)
  const [schoolPickerOpen, setSchoolPickerOpen] = useState(false)
  const [schoolQuery, setSchoolQuery] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)

  const schoolValid = !!state.school
  const nameValid = name.trim().length > 0
  const emailValid = isValidAssessorEmail(email)
  const canContinue = schoolValid && nameValid && emailValid

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
    if (!schoolPickerOpen) return
    setSchoolQuery("")
    requestAnimationFrame(() => searchRef.current?.focus())
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSchoolPickerOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [schoolPickerOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!canContinue) return
    registerAssessor(name.trim(), email.trim())
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Field assessor
        </p>
        <h2 className="mt-1 text-xl font-semibold leading-tight">Sign in to continue</h2>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Select the school, then enter your name and email. You will choose a survey module next.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="school-select-trigger"
              className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]"
            >
              School <span className="text-red-500">*</span>
            </label>
            <button
              id="school-select-trigger"
              type="button"
              disabled={schoolsLoading}
              onClick={() => {
                if (schoolsLoading) return
                setSchoolPickerOpen(true)
              }}
              className={cn(
                "flex w-full min-h-[48px] items-center gap-2 rounded-lg border bg-white px-3 py-3 text-left text-base outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-100",
                touched && !schoolValid
                  ? "border-red-400 ring-2 ring-red-200"
                  : "border-[var(--color-border)]",
                schoolsLoading && "cursor-not-allowed opacity-60",
              )}
            >
              <span
                className={cn(
                  "min-w-0 flex-1 truncate",
                  !state.school && "text-[var(--color-muted-foreground)]",
                )}
              >
                {schoolsLoading
                  ? "Loading schools…"
                  : state.school?.displayName || "Select a school"}
              </span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]"
                aria-hidden
              />
            </button>
            {touched && !schoolValid && (
              <p className="mt-1 text-xs text-red-600">School is required.</p>
            )}
            {state.school && !state.school.hasFloorPlan && (
              <p className="mt-1.5 text-xs text-amber-600">
                No floor plan is available for this school yet.
              </p>
            )}
            {state.school?.hasFloorPlan && state.floorPlanLoading && (
              <p className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">
                Loading room list…
              </p>
            )}
          </div>

          <div>
            <label htmlFor="assessor-name" className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              id="assessor-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Jane Doe"
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-3 text-base outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-100"
            />
            {touched && !nameValid && (
              <p className="mt-1 text-xs text-red-600">Name is required.</p>
            )}
          </div>

          <div>
            <label htmlFor="assessor-email" className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
              Email address <span className="text-red-500">*</span>
            </label>
            <input
              id="assessor-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="name@aisd.org"
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-3 text-base outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-100"
            />
            {touched && email.trim() && !emailValid && (
              <p className="mt-1 text-xs text-red-600">Enter a valid email address.</p>
            )}
            {touched && !email.trim() && (
              <p className="mt-1 text-xs text-red-600">Email is required.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!canContinue}
            className={cn(
              "flex min-h-[48px] w-full items-center justify-center rounded-xl px-4 text-sm font-semibold text-white transition-opacity",
              canContinue
                ? "bg-[var(--color-primary)] active:opacity-90"
                : "cursor-not-allowed bg-slate-300",
            )}
          >
            Continue to survey
          </button>
        </form>
      </div>

      {schoolPickerOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close school list"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setSchoolPickerOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="school-picker-title"
            className="relative flex max-h-[min(85dvh,36rem)] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--color-border)] bg-white shadow-xl sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 id="school-picker-title" className="text-base font-semibold">
                  Select a school
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSchoolPickerOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-muted-foreground)] active:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-2.5">
              <label htmlFor="school-picker-search" className="sr-only">
                Search schools
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]"
                  aria-hidden
                />
                <input
                  ref={searchRef}
                  id="school-picker-search"
                  type="search"
                  value={schoolQuery}
                  onChange={(e) => setSchoolQuery(e.target.value)}
                  placeholder="Search by name…"
                  autoComplete="off"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-slate-50 py-2.5 pl-10 pr-3 text-base outline-none focus:border-[var(--color-primary)] focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2">
              {schoolsLoading ? (
                <li className="px-3 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                  Loading schools…
                </li>
              ) : filteredSchools.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                  No schools match “{schoolQuery.trim()}”
                </li>
              ) : (
                filteredSchools.map((school) => {
                  const active = state.school?.id === school.id
                  return (
                    <li key={school.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSchool(school)
                          setSchoolPickerOpen(false)
                          setSchoolQuery("")
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium active:bg-slate-50",
                          active && "bg-blue-50 text-[var(--color-primary)]",
                        )}
                      >
                        <span className="min-w-0 flex-1 break-words leading-snug">
                          {school.displayName}
                        </span>
                        {active && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
