"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import {
  ArrowRight,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Search,
  X,
} from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import { markActiveVisit } from "@/lib/survey-persistence"
import { cn } from "@/lib/utils"
import FieldSurveyRemindersModal from "@/components/field-survey-reminders-modal"
import type { AisdSchoolOption } from "@aisd/shared"

type OnboardingStep = "home" | "reminders" | "school"

export default function EsaLanding() {
  const { setView, setSchool, schools, schoolsLoading, schoolsLoadError, reloadSchools } = useSurvey()
  const [step, setStep] = useState<OnboardingStep>("home")
  const [pendingSchool, setPendingSchool] = useState<AisdSchoolOption | null>(null)
  const [schoolQuery, setSchoolQuery] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)

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
    if (step !== "school") return
    setSchoolQuery("")
    requestAnimationFrame(() => searchRef.current?.focus())
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [step])

  const handleSchoolContinue = () => {
    if (!pendingSchool) return
    setSchool(pendingSchool)
    markActiveVisit()
    setView("home")
    setStep("home")
    setPendingSchool(null)
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-gradient-to-b from-slate-100 via-white to-slate-200/90">
      <header className="shrink-0 border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm safe-top">
        <div className="flex items-center px-4 py-4 sm:px-6">
          <Image
            src="/images/aisd-logo.png"
            alt="Austin Independent School District"
            width={160}
            height={64}
            className="h-11 w-auto shrink-0 object-contain object-left sm:h-12"
            priority
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="mx-auto flex min-h-full max-w-4xl flex-col justify-start px-4 py-6 sm:px-6 sm:py-8">
          <div className="space-y-8">
            <section
              aria-labelledby="cache-clear-heading"
              className="rounded-3xl border-4 border-amber-500 bg-amber-50 px-4 py-7 text-center shadow-[0_8px_24px_rgba(245,158,11,0.18)] sm:px-8 sm:py-10"
            >
              <p
                id="cache-clear-heading"
                className="text-4xl font-black leading-[1.05] tracking-tight text-amber-950 sm:text-5xl md:text-6xl"
              >
                Before using this tool, clear your browsing history and cache
              </p>
              <p className="mt-5 text-xl font-bold leading-snug text-amber-900 sm:text-2xl md:text-3xl">
                This makes sure you are on the latest version.
              </p>

              <div className="mt-8 grid gap-6 text-left sm:grid-cols-2">
                <div className="rounded-2xl border-2 border-amber-300 bg-white/80 px-4 py-5 sm:px-5 sm:col-span-2">
                  <h2 className="text-2xl font-black text-amber-950 sm:text-3xl">Computer</h2>
                  <ol className="mt-3 list-decimal space-y-2 pl-6 text-lg font-semibold leading-snug text-slate-800 sm:text-xl">
                    <li>
                      Quick check: open an Incognito/InPrivate window (Ctrl+Shift+N, or
                      Command+Shift+N on a Mac) and go to this site again.
                    </li>
                    <li>
                      If that works, this browser is stuck on an old copy. Click the lock or tune
                      icon left of the address, open Cookies and site data, and delete data for
                      this site.
                    </li>
                    <li>
                      Press Ctrl+Shift+R (Command+Shift+R on a Mac) to hard refresh. If it still
                      fails, press Ctrl+Shift+Delete, clear cached images and files, close the
                      browser, and reopen this page.
                    </li>
                  </ol>
                </div>
                <div className="rounded-2xl border-2 border-amber-300 bg-white/80 px-4 py-5 sm:px-5">
                  <h2 className="text-2xl font-black text-amber-950 sm:text-3xl">iPhone</h2>
                  <ol className="mt-3 list-decimal space-y-2 pl-6 text-lg font-semibold leading-snug text-slate-800 sm:text-xl">
                    <li>Open the Settings app.</li>
                    <li>
                      Tap Safari. On newer iOS, tap Apps first, then Safari.
                    </li>
                    <li>Scroll down and tap Clear History and Website Data.</li>
                    <li>Tap Clear History and Data to confirm.</li>
                    <li>
                      Close Safari completely: swipe up from the bottom (or double-click the Home
                      button), then swipe Safari off the screen.
                    </li>
                    <li>Open Safari again and return to this page.</li>
                  </ol>
                </div>
                <div className="rounded-2xl border-2 border-amber-300 bg-white/80 px-4 py-5 sm:px-5">
                  <h2 className="text-2xl font-black text-amber-950 sm:text-3xl">iPad</h2>
                  <ol className="mt-3 list-decimal space-y-2 pl-6 text-lg font-semibold leading-snug text-slate-800 sm:text-xl">
                    <li>Open the Settings app.</li>
                    <li>
                      In the left sidebar, tap Safari. On newer iPadOS, tap Apps first, then Safari.
                    </li>
                    <li>Tap Clear History and Website Data.</li>
                    <li>Tap Clear History and Data to confirm.</li>
                    <li>
                      Close Safari completely: swipe up from the bottom (or double-click the Home
                      button), then swipe Safari off the screen.
                    </li>
                    <li>Open Safari again and return to this page.</li>
                  </ol>
                </div>
              </div>
            </section>

            <div className="space-y-4 text-center sm:text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Austin Independent School District
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Educational Suitability Assessment
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-slate-600">
                Field tool for documenting how well campus spaces support teaching and learning.
                Walk the building, score rooms against ESA rubrics, and capture evidence for
                district planning and bond work.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setStep("reminders")}
                className="group flex min-h-[120px] flex-col items-start rounded-2xl border border-slate-200/90 bg-white p-5 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-colors hover:border-blue-200 hover:shadow-md active:bg-slate-50"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[var(--color-primary)]">
                  <ClipboardList className="h-5 w-5" aria-hidden />
                </span>
                <span className="mt-4 text-lg font-semibold text-slate-900">Start a survey</span>
                <span className="mt-1 text-sm leading-relaxed text-slate-500">
                  Choose a campus, optionally map rooms, then score spaces in the field.
                </span>
                <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-semibold text-[var(--color-primary)]">
                  Continue
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => setView("admin")}
                className="group flex min-h-[120px] flex-col items-start rounded-2xl border border-slate-200/90 bg-white p-5 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300 hover:shadow-md active:bg-slate-50"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <LayoutDashboard className="h-5 w-5" aria-hidden />
                </span>
                <span className="mt-4 text-lg font-semibold text-slate-900">Admin overview</span>
                <span className="mt-1 text-sm leading-relaxed text-slate-500">
                  Review submitted surveys, compare campuses, and monitor district progress.
                </span>
                <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-semibold text-slate-700">
                  Open dashboard
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <FieldSurveyRemindersModal
        open={step === "reminders"}
        onClose={() => setStep("home")}
        onContinue={() => setStep("school")}
      />

      {step === "school" && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close school list"
            className="absolute inset-0 bg-slate-900/45"
            onClick={() => {
              setStep("home")
              setPendingSchool(null)
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="landing-school-title"
            className="relative flex max-h-[min(85dvh,36rem)] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--color-border)] bg-white shadow-xl sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 id="landing-school-title" className="text-base font-semibold">
                  Select a school
                </h2>
                <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                  {schoolsLoading
                    ? "Loading campuses…"
                    : schoolsLoadError
                      ? "School list unavailable"
                      : `${schools.length} campuses available`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep("home")
                  setPendingSchool(null)
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-muted-foreground)] active:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-2.5">
              <label htmlFor="landing-school-search" className="sr-only">
                Search schools
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]"
                  aria-hidden
                />
                <input
                  ref={searchRef}
                  id="landing-school-search"
                  type="search"
                  value={schoolQuery}
                  onChange={(e) => setSchoolQuery(e.target.value)}
                  placeholder="Search by name or campus ID…"
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
                  {schoolsLoadError ? (
                    <div className="space-y-3">
                      <p>{schoolsLoadError}</p>
                      <button
                        type="button"
                        onClick={reloadSchools}
                        className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white active:opacity-90"
                      >
                        Retry
                      </button>
                    </div>
                  ) : schoolQuery.trim() ? (
                    `No schools match “${schoolQuery.trim()}”`
                  ) : (
                    "No schools available"
                  )}
                </li>
              ) : (
                filteredSchools.map((school) => {
                  const active = pendingSchool?.id === school.id
                  return (
                    <li key={school.id}>
                      <button
                        type="button"
                        onClick={() => setPendingSchool(school)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm active:bg-slate-50",
                          active && "bg-blue-50 text-[var(--color-primary)]",
                        )}
                      >
                        <Building2
                          className={cn(
                            "h-4 w-4 shrink-0",
                            active ? "text-[var(--color-primary)]" : "text-slate-400",
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium leading-snug">{school.displayName}</span>
                          {!school.hasFloorPlan && (
                            <span className="mt-0.5 block text-[11px] text-slate-500">
                              No floor plan on file
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>

            <div className="shrink-0 border-t border-[var(--color-border)] bg-slate-50 px-4 py-3">
              <button
                type="button"
                disabled={!pendingSchool || schoolsLoading}
                onClick={handleSchoolContinue}
                className="flex w-full min-h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 active:opacity-90"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
