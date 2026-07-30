"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  RefreshCw,
  Search,
  X,
} from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import { formatSavedAt, markActiveVisit } from "@/lib/survey-persistence"
import {
  buildAdminSchoolSummaries,
  buildAdminSurveyRecords,
  summarizeAdminRecords,
  type AdminMatrixCellStatus,
  type AdminSchoolStatus,
  type AdminSchoolSummary,
  type AdminSurveyRecord,
  type AdminSurveyStatus,
} from "@/lib/admin-survey-index"
import { seedAdminEsDemos } from "@/lib/seed-admin-es-demos"
import { seedAllisonEsFinalizedDemo } from "@/lib/seed-allison-es-demo"
import { seedDavisEsQaDemo } from "@/lib/seed-davis-es-demo"
import { clearAllFieldSurveyDataExceptDemos } from "@/lib/clear-field-survey-data"
import { hydrateLocalDraftsFromRemote } from "@/lib/school-draft-merge"
import { pullAllRemoteDraftsClient } from "@/lib/survey-remote-sync"
import type { PersistedSurveyDraft } from "@/lib/survey-persistence"
import QaSchoolReviewModal from "@/components/qa-school-review-modal"
import { ScoreBadge, ScoreBar } from "@/components/score-display"
import { SURVEY_TYPES, surveyTypeLabel, type SurveyType } from "@aisd/shared"
import { cn, scoreTextColor } from "@/lib/utils"

function statusLabel(status: AdminSurveyStatus): string {
  switch (status) {
    case "submitted":
      return "Submitted"
    case "complete":
      return "Complete"
    case "in_progress":
      return "In progress"
  }
}

function surveyTypeShortLabel(type: SurveyType): string {
  switch (type) {
    case "studios":
      return "Stu"
    case "outdoor":
      return "Out"
    case "neighborhoods":
      return "Nhd"
    case "arrival":
      return "Arr"
    case "administration":
      return "Adm"
    case "athletics":
      return "Ath"
    case "performing_arts":
      return "PA"
    case "cte":
      return "CTE"
    case "shared_spaces":
      return "Shd"
    case "closeout":
      return "CO"
  }
}

function matrixCellLabel(status: AdminMatrixCellStatus): string {
  switch (status) {
    case "complete":
      return "Complete"
    case "in_progress":
      return "In progress"
    case "not_started":
      return "Not started"
    case "na":
      return "Not required"
  }
}

function schoolStatusBadgeClass(status: AdminSchoolStatus): string {
  switch (status) {
    case "finalized":
      return "bg-violet-50 text-violet-800 ring-violet-200/80"
    case "complete":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200/80"
    case "not_started":
      return "bg-slate-50 text-slate-600 ring-slate-200/80"
    case "in_progress":
      return "bg-amber-50 text-amber-900 ring-amber-200/80"
  }
}

function schoolStatusBadgeLabel(status: AdminSchoolStatus): string {
  switch (status) {
    case "finalized":
      return "Finalized"
    case "complete":
      return "Ready for QA"
    case "not_started":
      return "Not started"
    case "in_progress":
      return "In progress"
  }
}

function schoolProgressClass(status: AdminSchoolStatus): string {
  switch (status) {
    case "finalized":
      return "text-violet-700"
    case "complete":
      return "text-emerald-700"
    case "not_started":
      return "text-slate-400"
    case "in_progress":
      return "text-amber-800"
  }
}

function MatrixCell({ status }: { status: AdminMatrixCellStatus }) {
  return (
    <span
      title={matrixCellLabel(status)}
      aria-label={matrixCellLabel(status)}
      className={cn(
        "mx-auto flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold ring-1",
        status === "complete" && "bg-emerald-50 text-emerald-700 ring-emerald-200/80",
        status === "in_progress" && "bg-amber-50 text-amber-800 ring-amber-200/80",
        status === "not_started" && "bg-slate-50 text-slate-300 ring-slate-200/70",
        status === "na" && "bg-transparent text-slate-300 ring-transparent",
      )}
    >
      {status === "complete" ? (
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
      ) : status === "in_progress" ? (
        "·"
      ) : status === "na" ? (
        "—"
      ) : (
        ""
      )}
    </span>
  )
}

function statusClass(status: AdminSurveyStatus): string {
  switch (status) {
    case "submitted":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200/80"
    case "complete":
      return "bg-sky-50 text-sky-800 ring-sky-200/80"
    case "in_progress":
      return "bg-amber-50 text-amber-900 ring-amber-200/80"
  }
}

function OverviewMetric({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint?: string
  icon: typeof Building2
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/70 text-slate-700 ring-1 ring-slate-200/70">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {label}
        </p>
      </div>
      <p className="mt-1.5 text-xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-2xl">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs leading-snug text-slate-600">{hint}</p> : null}
    </div>
  )
}

function SurveyTypePicker({
  value,
  onChange,
}: {
  value: SurveyType
  onChange: (type: SurveyType) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-800 outline-none ring-blue-200 transition-colors hover:bg-white focus:bg-white focus:ring-2"
      >
        <span className="min-w-0 truncate font-medium">{surveyTypeLabel(value)}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <ul className="max-h-56 overflow-y-auto py-1">
            {SURVEY_TYPES.map((t) => {
              const selected = t === value
              return (
                <li key={t}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(t)
                      setOpen(false)
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                      selected ? "bg-blue-50 text-blue-900" : "text-slate-800 hover:bg-slate-50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        selected
                          ? "border-blue-500 bg-blue-500 text-white"
                          : "border-slate-300 bg-white",
                      )}
                    >
                      {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {surveyTypeLabel(t)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function SchoolComparePicker({
  candidates,
  selectedIds,
  schoolNameLookup,
  onChange,
}: {
  candidates: AdminSurveyRecord[]
  selectedIds: string[]
  schoolNameLookup: Map<string, string>
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const labelFor = useCallback(
    (id: string, fallback: string) => schoolNameLookup.get(id) || fallback,
    [schoolNameLookup],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter((c) => {
      const name = labelFor(c.schoolId, c.schoolName).toLowerCase()
      return (
        name.includes(q) ||
        c.schoolName.toLowerCase().includes(q) ||
        c.campusId.toLowerCase().includes(q)
      )
    })
  }, [candidates, search, labelFor])

  useEffect(() => {
    if (!open) {
      setSearch("")
      return
    }
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    requestAnimationFrame(() => searchRef.current?.focus())
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const toggle = (schoolId: string) => {
    if (selectedIds.includes(schoolId)) {
      onChange(selectedIds.filter((id) => id !== schoolId))
      return
    }
    onChange([...selectedIds, schoolId])
  }

  const selectedCount = selectedIds.filter((id) =>
    candidates.some((c) => c.schoolId === id),
  ).length

  const summary =
    selectedCount === 0
      ? "Select schools to compare"
      : `${selectedCount} school${selectedCount === 1 ? "" : "s"} selected`

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-800 outline-none ring-blue-200 transition-colors hover:bg-white focus:bg-white focus:ring-2"
      >
        <span className="min-w-0 truncate font-medium">{summary}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable
          className="absolute left-0 right-0 z-40 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search schools…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-900 outline-none ring-blue-200 focus:bg-white focus:ring-2"
              />
            </div>
            <p className="mt-1.5 px-0.5 text-[11px] text-slate-400">
              Select any schools to compare
            </p>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-slate-500">No schools match</li>
            ) : (
              filtered.map((c) => {
                const selected = selectedIds.includes(c.schoolId)
                const name = labelFor(c.schoolId, c.schoolName)
                return (
                  <li key={c.schoolId}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => toggle(c.schoolId)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                        selected ? "bg-blue-50 text-blue-900" : "text-slate-800 hover:bg-slate-50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          selected
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-slate-300 bg-white",
                        )}
                      >
                        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{name}</span>
                        {c.campusId ? (
                          <span className="block truncate text-xs text-slate-400">{c.campusId}</span>
                        ) : null}
                      </span>
                      {c.overallScore != null ? (
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">
                          {Math.round(c.overallScore)}%
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function AdminDashboard() {
  const { setView, schools } = useSurvey()
  const [tab, setTab] = useState<"overview" | "schools" | "compare">("schools")
  const [records, setRecords] = useState<AdminSurveyRecord[]>([])
  const [remoteDrafts, setRemoteDrafts] = useState<PersistedSurveyDraft[] | null>(null)
  const [remoteDraftsConfigured, setRemoteDraftsConfigured] = useState(false)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [schoolQuery, setSchoolQuery] = useState("")
  const [surveyFilter, setSurveyFilter] = useState<SurveyType | "all">("all")
  const [schoolStatusFilter, setSchoolStatusFilter] = useState<"all" | AdminSchoolStatus>("all")
  const [compareType, setCompareType] = useState<SurveyType>("studios")
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([])
  const [refreshedAt, setRefreshedAt] = useState(() => new Date())
  const [qaSchoolId, setQaSchoolId] = useState<string | null>(null)

  const schoolClassById = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of schools) map.set(s.id, s.schoolClass)
    return map
  }, [schools])

  const refresh = useCallback(async () => {
    setRemoteLoading(true)
    try {
      const remote = await pullAllRemoteDraftsClient()
      if (remote.configured) {
        hydrateLocalDraftsFromRemote(remote.drafts)
        setRemoteDraftsConfigured(true)
        setRemoteDrafts(remote.drafts)
        setRecords(buildAdminSurveyRecords(schoolClassById, remote.drafts))
      } else {
        setRemoteDraftsConfigured(false)
        setRemoteDrafts(null)
        setRecords(buildAdminSurveyRecords(schoolClassById))
      }
    } finally {
      setRemoteLoading(false)
      setRefreshedAt(new Date())
    }
  }, [schoolClassById])

  const draftsBySchool = useMemo(() => {
    if (!remoteDraftsConfigured || !remoteDrafts) return undefined
    const map = new Map<string, PersistedSurveyDraft[]>()
    for (const draft of remoteDrafts) {
      const list = map.get(draft.schoolId) ?? []
      list.push(draft)
      map.set(draft.schoolId, list)
    }
    return map
  }, [remoteDraftsConfigured, remoteDrafts])

  useEffect(() => {
    void refresh()
    const onFocus = () => {
      void refresh()
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [refresh])

  const stats = useMemo(() => summarizeAdminRecords(records), [records])

  const schoolSummaries = useMemo(
    () => buildAdminSchoolSummaries(records, schoolClassById, schools, draftsBySchool),
    [records, schoolClassById, schools, draftsBySchool],
  )

  const filteredSchools = useMemo(() => {
    const q = schoolQuery.trim().toLowerCase()
    return schoolSummaries.filter((s) => {
      if (schoolStatusFilter !== "all" && s.status !== schoolStatusFilter) return false
      if (!q) return true
      return (
        s.schoolName?.toLowerCase().includes(q) ||
        s.campusId?.toLowerCase().includes(q) ||
        s.assessorNames.some((name) => name?.toLowerCase().includes(q)) ||
        s.surveyLabels.some((label) => label?.toLowerCase().includes(q))
      )
    })
  }, [schoolSummaries, schoolStatusFilter, schoolQuery])

  const schoolStatusCounts = useMemo(() => {
    let complete = 0
    let inProgress = 0
    let notStarted = 0
    let finalized = 0
    for (const s of schoolSummaries) {
      if (s.status === "complete") complete += 1
      else if (s.status === "finalized") finalized += 1
      else if (s.status === "not_started") notStarted += 1
      else inProgress += 1
    }
    return { complete, inProgress, notStarted, finalized }
  }, [schoolSummaries])

  const qaSchool = useMemo(
    () => (qaSchoolId ? schoolSummaries.find((s) => s.schoolId === qaSchoolId) ?? null : null),
    [qaSchoolId, schoolSummaries],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return records.filter((r) => {
      if (surveyFilter !== "all" && r.surveyType !== surveyFilter) return false
      if (!q) return true
      return (
        r.schoolName?.toLowerCase().includes(q) ||
        r.assessorName?.toLowerCase().includes(q) ||
        r.assessorEmail?.toLowerCase().includes(q) ||
        r.surveyLabel?.toLowerCase().includes(q) ||
        r.campusId?.toLowerCase().includes(q)
      )
    })
  }, [records, query, surveyFilter])

  const compareCandidates = useMemo(() => {
    const bySchool = new Map<string, AdminSurveyRecord>()
    for (const r of records) {
      if (r.surveyType !== compareType) continue
      if (r.overallScore == null) continue
      const prev = bySchool.get(r.schoolId)
      if (!prev || (r.submittedAt || r.savedAt) > (prev.submittedAt || prev.savedAt)) {
        bySchool.set(r.schoolId, r)
      }
    }
    return Array.from(bySchool.values()).sort((a, b) =>
      a.schoolName.localeCompare(b.schoolName),
    )
  }, [records, compareType])

  useEffect(() => {
    if (compareCandidates.length === 0) {
      setSelectedSchoolIds([])
      return
    }
    setSelectedSchoolIds((prev) => {
      const valid = prev.filter((id) => compareCandidates.some((c) => c.schoolId === id))
      if (valid.length > 0) return valid
      return compareCandidates.slice(0, Math.min(3, compareCandidates.length)).map((c) => c.schoolId)
    })
  }, [compareCandidates])

  const compared = useMemo(
    () =>
      selectedSchoolIds
        .map((id) => compareCandidates.find((c) => c.schoolId === id))
        .filter((c): c is AdminSurveyRecord => !!c),
    [compareCandidates, selectedSchoolIds],
  )

  const compareCategories = useMemo(() => {
    const names = new Set<string>()
    for (const r of compared) {
      for (const cat of r.categoryScores) names.add(cat.category)
    }
    return Array.from(names)
  }, [compared])

  const enterFieldSurvey = () => {
    markActiveVisit()
    setView("survey")
  }

  const showAllDemoSchools = () => {
    setTab("schools")
    setSchoolStatusFilter("all")
    setSchoolQuery("")
  }

  const loadBothDemos = () => {
    seedAdminEsDemos()
    refresh()
    showAllDemoSchools()
  }

  const loadDavisDemo = () => {
    seedDavisEsQaDemo()
    refresh()
    showAllDemoSchools()
  }

  const loadAllisonDemo = () => {
    seedAllisonEsFinalizedDemo()
    refresh()
    showAllDemoSchools()
  }

  const clearFieldSurveyData = () => {
    if (
      !window.confirm(
        "Remove all saved survey data for real schools in this browser? Davis and Allison demo data will be kept.",
      )
    ) {
      return
    }
    const removed = clearAllFieldSurveyDataExceptDemos()
    refresh()
    showAllDemoSchools()
  }

  const changeTab = (next: "overview" | "schools" | "compare") => {
    if (next !== "schools") setQaSchoolId(null)
    setTab(next)
  }

  const closeQaReview = () => setQaSchoolId(null)

  const schoolNameLookup = useMemo(() => {
    const map = new Map(schools.map((s) => [s.id, s.displayName]))
    return map
  }, [schools])

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-gradient-to-b from-slate-200 to-slate-300/90">
      <header className="z-50 shrink-0 border-b border-slate-200/80 bg-white shadow-sm safe-top">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Image
            src="/images/aisd-logo.png"
            alt="Austin Independent School District"
            width={120}
            height={48}
            className="h-10 w-auto shrink-0 object-contain object-left"
            priority
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Admin
            </p>
            <h1 className="truncate text-base font-semibold tracking-tight text-slate-900">
              ESA District Overview
            </h1>
          </div>
          <button
            type="button"
            onClick={clearFieldSurveyData}
            className="hidden items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 lg:flex"
            title="Remove saved survey drafts for all schools except Davis and Allison demos"
          >
            Clear field data
          </button>
          <button
            type="button"
            onClick={loadBothDemos}
            className="hidden items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 lg:flex"
          >
            Load both demos
          </button>
          <button
            type="button"
            onClick={loadAllisonDemo}
            className="hidden items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100 sm:flex"
          >
            Allison (finalized)
          </button>
          <button
            type="button"
            onClick={loadDavisDemo}
            className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-800 transition-colors hover:bg-violet-100"
          >
            <span className="hidden sm:inline">Davis (Ready for QA)</span>
            <span className="sm:hidden">Davis</span>
          </button>
          <button
            type="button"
            onClick={refresh}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            aria-label="Refresh data"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={enterFieldSurvey}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            Field surveys
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-12">
          <div className="flex gap-1.5 rounded-xl bg-slate-100 p-1.5">
            <button
              type="button"
              onClick={() => changeTab("schools")}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-[13px] font-medium transition-colors sm:gap-1.5 sm:px-3 sm:text-sm",
                tab === "schools"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                  : "text-slate-500 active:text-slate-700",
              )}
            >
              <Building2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">Schools</span>
            </button>
            <button
              type="button"
              onClick={() => changeTab("overview")}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-[13px] font-medium transition-colors sm:gap-1.5 sm:px-3 sm:text-sm",
                tab === "overview"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                  : "text-slate-500 active:text-slate-700",
              )}
            >
              <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">Overview</span>
            </button>
            <button
              type="button"
              onClick={() => changeTab("compare")}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-[13px] font-medium transition-colors sm:gap-1.5 sm:px-3 sm:text-sm",
                tab === "compare"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                  : "text-slate-500 active:text-slate-700",
              )}
            >
              <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">Compare</span>
            </button>
          </div>

          {tab === "overview" ? (
            <>
              <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-blue-50/60 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.35]"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 12% 20%, rgba(37,99,235,0.12), transparent 42%), radial-gradient(circle at 88% 10%, rgba(15,23,42,0.06), transparent 36%)",
                  }}
                />
                <div className="relative px-4 py-4 sm:px-5 sm:py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        District snapshot
                      </p>
                      <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                        Survey activity across campuses
                      </h2>
                      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600 sm:text-sm">
                        Completion status and scores from field surveys on this device. Use{" "}
                        <span className="font-medium text-slate-800">Field surveys</span> to collect
                        new assessments.
                      </p>
                    </div>
                    <p className="shrink-0 rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200/80">
                      Updated{" "}
                      {refreshedAt.toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-col gap-3 border-t border-slate-200/80 pt-3 sm:flex-row sm:items-stretch sm:gap-8">
                    <OverviewMetric
                      label="Schools"
                      value={String(stats.schoolCount)}
                      hint="With survey activity"
                      icon={Building2}
                    />
                    <div className="hidden w-px shrink-0 self-stretch bg-slate-200/90 sm:block" aria-hidden />
                    <div className="h-px w-full bg-slate-200/90 sm:hidden" aria-hidden />
                    <OverviewMetric
                      label="Surveys"
                      value={String(stats.surveyCount)}
                      hint={`${stats.submittedCount} submitted · ${stats.inProgressCount} in progress`}
                      icon={ClipboardList}
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                      Survey completion
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Who completed each survey and current campus scores
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative min-w-0 flex-1 sm:w-56">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search school or assessor"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-900 outline-none ring-blue-200 focus:bg-white focus:ring-2"
                      />
                    </div>
                    <select
                      value={surveyFilter}
                      onChange={(e) =>
                        setSurveyFilter(
                          e.target.value === "all" ? "all" : (e.target.value as SurveyType),
                        )
                      }
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none ring-blue-200 focus:bg-white focus:ring-2"
                    >
                      <option value="all">All survey types</option>
                      {SURVEY_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {surveyTypeLabel(t)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
                    <p className="mt-3 text-sm font-medium text-slate-700">No survey activity yet</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Start a field survey to see completion and scores here.
                    </p>
                    <button
                      type="button"
                      onClick={enterFieldSurvey}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white"
                    >
                      Start field survey
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Phone: stacked cards — no horizontal scroll */}
                    <ul className="mt-4 space-y-2.5 md:hidden">
                      {filtered.map((r) => (
                        <li
                          key={r.key}
                          className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-900">
                                {schoolNameLookup.get(r.schoolId) || r.schoolName}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {r.surveyLabel}
                                {r.campusId ? (
                                  <span className="text-slate-400"> · {r.campusId}</span>
                                ) : null}
                              </p>
                            </div>
                            <ScoreBadge score={r.overallScore} />
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1",
                                statusClass(r.status),
                              )}
                            >
                              {statusLabel(r.status)}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {r.completeRoomCount}/{r.roomCount || "—"} rooms
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {formatSavedAt(r.submittedAt || r.savedAt)}
                            </span>
                          </div>

                          {r.assessorName ? (
                            <p className="mt-2 truncate text-xs text-slate-600">
                              {r.assessorName}
                              {r.assessorEmail ? (
                                <span className="text-slate-400"> · {r.assessorEmail}</span>
                              ) : null}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>

                    {/* Desktop / tablet: table */}
                    <div className="mt-4 hidden overflow-x-auto md:block">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                            <th className="pb-2 pr-3 font-semibold">School</th>
                            <th className="pb-2 pr-3 font-semibold">Survey</th>
                            <th className="pb-2 pr-3 font-semibold">Assessor</th>
                            <th className="pb-2 pr-3 font-semibold">Status</th>
                            <th className="pb-2 pr-3 font-semibold">Score</th>
                            <th className="pb-2 font-semibold">Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((r) => (
                            <tr key={r.key} className="border-b border-slate-100 last:border-0">
                              <td className="py-3 pr-3 align-top">
                                <p className="font-medium text-slate-900">
                                  {schoolNameLookup.get(r.schoolId) || r.schoolName}
                                </p>
                                {r.campusId ? (
                                  <p className="mt-0.5 text-xs text-slate-400">{r.campusId}</p>
                                ) : null}
                              </td>
                              <td className="py-3 pr-3 align-top text-slate-700">
                                {r.surveyLabel}
                              </td>
                              <td className="py-3 pr-3 align-top">
                                {r.assessorName ? (
                                  <>
                                    <p className="font-medium text-slate-800">{r.assessorName}</p>
                                    {r.assessorEmail ? (
                                      <p className="mt-0.5 text-xs text-slate-500">
                                        {r.assessorEmail}
                                      </p>
                                    ) : null}
                                  </>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-3 pr-3 align-top">
                                <span
                                  className={cn(
                                    "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1",
                                    statusClass(r.status),
                                  )}
                                >
                                  {statusLabel(r.status)}
                                </span>
                                <p className="mt-1 text-[11px] text-slate-400">
                                  {r.completeRoomCount}/{r.roomCount || "—"} rooms complete
                                </p>
                              </td>
                              <td className="py-3 pr-3 align-top">
                                <ScoreBadge score={r.overallScore} />
                              </td>
                              <td className="py-3 align-top text-xs text-slate-500">
                                {formatSavedAt(r.submittedAt || r.savedAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            </>
          ) : tab === "schools" ? (
            <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                    School completion
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {schoolStatusFilter === "in_progress"
                      ? "Survey-by-survey status for campuses still in progress"
                      : schoolStatusFilter === "complete"
                        ? "Assessments complete — review and finalize in QA"
                        : schoolStatusFilter === "finalized"
                          ? "Schools reviewed and pushed to finalized"
                          : "Field assessment → QA review → finalized"}
                  </p>
                </div>
                <div className="relative min-w-0 sm:w-56">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={schoolQuery}
                    onChange={(e) => setSchoolQuery(e.target.value)}
                    placeholder="Search schools"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-900 outline-none ring-blue-200 focus:bg-white focus:ring-2"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {(
                  [
                    { id: "all" as const, label: "All", count: schoolSummaries.length },
                    {
                      id: "not_started" as const,
                      label: "Not started",
                      count: schoolStatusCounts.notStarted,
                    },
                    {
                      id: "in_progress" as const,
                      label: "In progress",
                      count: schoolStatusCounts.inProgress,
                    },
                    {
                      id: "complete" as const,
                      label: "Ready for QA",
                      count: schoolStatusCounts.complete,
                    },
                    {
                      id: "finalized" as const,
                      label: "Finalized",
                      count: schoolStatusCounts.finalized,
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSchoolStatusFilter(opt.id)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      schoolStatusFilter === opt.id
                        ? opt.id === "finalized"
                          ? "border-violet-300 bg-violet-50 text-violet-800"
                          : opt.id === "complete"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border-blue-300 bg-blue-50 text-blue-800"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {opt.label}
                    <span className="ml-1 tabular-nums text-slate-400">{opt.count}</span>
                  </button>
                ))}
              </div>

              {filteredSchools.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
                  {schoolSummaries.length === 0
                    ? "No schools loaded yet."
                    : "No schools match this filter."}
                </p>
              ) : schoolStatusFilter === "in_progress" ? (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80">
                        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                      </span>
                      Complete
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-50 text-amber-800 ring-1 ring-amber-200/80">
                        ·
                      </span>
                      In progress
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-5 w-5 rounded bg-slate-50 ring-1 ring-slate-200/70" />
                      Not started
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center text-slate-300">
                        —
                      </span>
                      Not required
                    </span>
                  </div>

                  {/* Phone: stacked cards with wrapping survey grid */}
                  <ul className="mt-4 space-y-2.5 md:hidden">
                    {filteredSchools.map((s) => (
                      <li
                        key={s.schoolId}
                        className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">
                              {schoolNameLookup.get(s.schoolId) || s.schoolName}
                            </p>
                            {s.schoolClass ? (
                              <p className="mt-0.5 text-[11px] text-slate-400">{s.schoolClass}</p>
                            ) : null}
                          </div>
                          <span className="shrink-0 tabular-nums text-xs font-semibold text-amber-800">
                            {s.completedRequiredCount}/{s.requiredSurveyCount}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {SURVEY_TYPES.filter((type) => s.cells[type] !== "na").map((type) => (
                            <div
                              key={type}
                              className="flex flex-col items-center gap-1 rounded-lg bg-white/80 px-1 py-1.5 ring-1 ring-slate-200/70"
                              title={`${surveyTypeLabel(type)}: ${matrixCellLabel(s.cells[type])}`}
                            >
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                {surveyTypeShortLabel(type)}
                              </span>
                              <MatrixCell status={s.cells[type]} />
                            </div>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* Desktop / tablet: full matrix */}
                  <div className="mt-4 hidden overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200/90 md:block">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80">
                          <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                            School
                          </th>
                          {SURVEY_TYPES.map((type) => (
                            <th
                              key={type}
                              title={surveyTypeLabel(type)}
                              className="px-1.5 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400"
                            >
                              {surveyTypeShortLabel(type)}
                            </th>
                          ))}
                          <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                            Progress
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSchools.map((s) => (
                          <tr
                            key={s.schoolId}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                          >
                            <td className="sticky left-0 z-10 bg-white px-3 py-2.5 hover:bg-slate-50/60">
                              <p className="max-w-[14rem] truncate font-medium text-slate-900">
                                {schoolNameLookup.get(s.schoolId) || s.schoolName}
                              </p>
                              {s.schoolClass ? (
                                <p className="mt-0.5 text-[11px] text-slate-400">{s.schoolClass}</p>
                              ) : null}
                            </td>
                            {SURVEY_TYPES.map((type) => (
                              <td key={type} className="px-1.5 py-2.5 text-center">
                                <MatrixCell status={s.cells[type]} />
                              </td>
                            ))}
                            <td className="px-3 py-2.5 text-right">
                              <span className="tabular-nums text-xs font-semibold text-amber-800">
                                {s.completedRequiredCount}/{s.requiredSurveyCount}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : schoolStatusFilter === "not_started" ? (
                <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {filteredSchools.map((s) => (
                    <li
                      key={s.schoolId}
                      className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-3"
                    >
                      <p className="line-clamp-2 text-sm font-medium leading-snug text-slate-900">
                        {schoolNameLookup.get(s.schoolId) || s.schoolName}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {s.schoolClass ? (
                          <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200/80">
                            {s.schoolClass}
                          </span>
                        ) : null}
                        <span className="tabular-nums text-[11px] font-semibold text-slate-400">
                          0/{s.requiredSurveyCount}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : schoolStatusFilter === "finalized" ? (
                <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredSchools.map((s) => (
                    <li
                      key={s.schoolId}
                      className="rounded-xl border border-violet-200/80 bg-gradient-to-b from-violet-50/50 to-white p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">
                            {schoolNameLookup.get(s.schoolId) || s.schoolName}
                          </p>
                          {s.schoolClass ? (
                            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              {s.schoolClass}
                            </p>
                          ) : null}
                        </div>
                        <ScoreBadge score={s.overallScore} />
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1",
                            schoolStatusBadgeClass(s.status),
                          )}
                        >
                          Finalized
                        </span>
                        <span className="tabular-nums text-xs font-semibold text-violet-700">
                          {s.completedRequiredCount}/{s.requiredSurveyCount}
                        </span>
                      </div>
                      {s.qa ? (
                        <p className="mt-2 text-xs text-slate-600">
                          QA: {s.qa.reviewerName}
                          <span className="text-slate-400"> · {s.qa.reviewerEmail}</span>
                          <span className="block text-slate-400">
                            {formatSavedAt(s.qa.finalizedAt)}
                          </span>
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  {/* Phone: school info cards */}
                  <ul className="mt-4 space-y-2.5 md:hidden">
                    {filteredSchools.map((s) => (
                      <li
                        key={s.schoolId}
                        className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">
                              {schoolNameLookup.get(s.schoolId) || s.schoolName}
                            </p>
                            {s.schoolClass ? (
                              <p className="mt-0.5 text-[11px] text-slate-400">{s.schoolClass}</p>
                            ) : null}
                          </div>
                          {s.status === "not_started" ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <ScoreBadge score={s.overallScore} />
                          )}
                        </div>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1",
                              schoolStatusBadgeClass(s.status),
                            )}
                          >
                            {schoolStatusBadgeLabel(s.status)}
                          </span>
                          <span
                            className={cn(
                              "tabular-nums text-xs font-semibold",
                              schoolProgressClass(s.status),
                            )}
                          >
                            {s.completedRequiredCount}/{s.requiredSurveyCount}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {s.lastUpdated ? formatSavedAt(s.lastUpdated) : "—"}
                          </span>
                        </div>
                        {s.assessorNames.length > 0 ? (
                          <p className="mt-2 truncate text-xs text-slate-600">
                            {s.assessorNames.join(", ")}
                          </p>
                        ) : null}
                        {s.status === "finalized" && s.qa ? (
                          <p className="mt-1.5 text-xs text-violet-700">
                            QA: {s.qa.reviewerName} · {formatSavedAt(s.qa.finalizedAt)}
                          </p>
                        ) : null}
                        {s.status === "complete" ? (
                          <button
                            type="button"
                            onClick={() => setQaSchoolId(s.schoolId)}
                            className="mt-3 w-full rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
                          >
                            Review & finalize
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  {/* Desktop / tablet: info table */}
                  <div className="mt-4 hidden overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200/90 md:block">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                          <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2.5">School</th>
                          <th className="px-3 py-2.5">Class</th>
                          <th className="px-3 py-2.5">Status</th>
                          <th className="px-3 py-2.5">Progress</th>
                          <th className="px-3 py-2.5">Avg score</th>
                          <th className="px-3 py-2.5">Updated</th>
                          <th className="px-3 py-2.5">Assessors / QA</th>
                          <th className="px-3 py-2.5">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSchools.map((s) => (
                          <tr
                            key={s.schoolId}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                          >
                            <td className="sticky left-0 z-10 bg-white px-3 py-2.5 hover:bg-slate-50/60">
                              <p className="max-w-[16rem] truncate font-medium text-slate-900">
                                {schoolNameLookup.get(s.schoolId) || s.schoolName}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-500">
                              {s.schoolClass || "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={cn(
                                  "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1",
                                  schoolStatusBadgeClass(s.status),
                                )}
                              >
                                {schoolStatusBadgeLabel(s.status)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={cn(
                                  "tabular-nums text-xs font-semibold",
                                  schoolProgressClass(s.status),
                                )}
                              >
                                {s.completedRequiredCount}/{s.requiredSurveyCount}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              {s.status === "not_started" ? (
                                <span className="text-xs text-slate-400">—</span>
                              ) : (
                                <ScoreBadge score={s.overallScore} />
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-500">
                              {s.lastUpdated ? formatSavedAt(s.lastUpdated) : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-500">
                              {s.status === "finalized" && s.qa ? (
                                <span className="line-clamp-2 max-w-[12rem]">
                                  <span className="font-medium text-violet-700">
                                    {s.qa.reviewerName}
                                  </span>
                                  <span className="block text-slate-400">{s.qa.reviewerEmail}</span>
                                </span>
                              ) : s.assessorNames.length > 0 ? (
                                <span className="line-clamp-2 max-w-[10rem]">
                                  {s.assessorNames.join(", ")}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              {s.status === "complete" ? (
                                <button
                                  type="button"
                                  onClick={() => setQaSchoolId(s.schoolId)}
                                  className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-700"
                                >
                                  Review & finalize
                                </button>
                              ) : (
                                <span className="text-xs text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                  Compare school scores
                </h2>
                <p className="text-xs text-slate-500">
                  Side-by-side campus ESA scores for a survey type
                </p>
              </div>

              {compareCandidates.length === 0 ? (
                <>
                  <div className="mt-4">
                    <div className="block max-w-xs space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                        Survey type
                      </span>
                      <SurveyTypePicker value={compareType} onChange={setCompareType} />
                    </div>
                  </div>
                  <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
                    No scored {surveyTypeLabel(compareType)} surveys yet. Submit surveys to compare
                    schools.
                  </p>
                </>
              ) : (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                        Survey type
                      </span>
                      <SurveyTypePicker value={compareType} onChange={setCompareType} />
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                        Schools
                      </span>
                      <SchoolComparePicker
                        candidates={compareCandidates}
                        selectedIds={selectedSchoolIds}
                        schoolNameLookup={schoolNameLookup}
                        onChange={setSelectedSchoolIds}
                      />
                    </div>
                  </div>

                  {compared.length > 0 && (
                    <div className="mt-3 flex w-full flex-wrap gap-1.5">
                      {compared.map((c) => {
                        const name = schoolNameLookup.get(c.schoolId) || c.schoolName
                        return (
                          <span
                            key={c.schoolId}
                            className="inline-flex max-w-full items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800"
                          >
                            <span className="truncate">{name}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedSchoolIds((prev) =>
                                  prev.filter((id) => id !== c.schoolId),
                                )
                              }
                              className="shrink-0 rounded p-0.5 text-blue-600 hover:bg-blue-100"
                              aria-label={`Remove ${name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {compared.map((r) => (
                      <div
                        key={r.key}
                        className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {schoolNameLookup.get(r.schoolId) || r.schoolName}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {r.assessorName || "Unknown assessor"}
                            </p>
                          </div>
                          <p
                            className={cn(
                              "shrink-0 text-2xl font-bold tabular-nums",
                              scoreTextColor(r.overallScore),
                            )}
                          >
                            {r.overallScore != null ? `${Math.round(r.overallScore)}%` : "—"}
                          </p>
                        </div>
                        <div className="mt-4 space-y-2.5">
                          {compareCategories.map((cat) => {
                            const score =
                              r.categoryScores.find((c) => c.category === cat)?.score ?? null
                            return score != null ? (
                              <ScoreBar key={cat} score={score} label={cat} />
                            ) : (
                              <div key={cat} className="text-xs text-slate-400">
                                {cat}: —
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </div>

      {qaSchool ? (
        <QaSchoolReviewModal
          school={qaSchool}
          schoolDisplayName={schoolNameLookup.get(qaSchool.schoolId) || qaSchool.schoolName}
          schools={schools}
          schoolClassById={schoolClassById}
          schoolDrafts={draftsBySchool?.get(qaSchool.schoolId)}
          onClose={closeQaReview}
          onFinalized={() => {
            closeQaReview()
            setSchoolStatusFilter("finalized")
            void refresh()
          }}
        />
      ) : null}
    </div>
  )
}
