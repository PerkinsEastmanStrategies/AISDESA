import type { AisdSchoolOption, ScoringFocusAreaId } from "@aisd/shared"
import {
  buildCampusScoringSnapshot,
  type CampusScoringSnapshot,
  type FocusAreaGroup,
} from "@/lib/campus-scoring-tree"
import { loadDraftsForSchool } from "@/lib/survey-persistence"

export interface WalkedSchoolSummary {
  schoolId: string
  schoolName: string
  campusId: string
  schoolClass?: string | null
}

export interface FocusAreaComparisonSeries {
  id: string
  label: string
  color: string
  dashed?: boolean
  scores: Record<ScoringFocusAreaId, number | null>
}

export interface FocusAreaComparisonAxis {
  id: ScoringFocusAreaId
  label: string
  currentScore: number | null
  walkedAverage: number | null
  comparisonScores: { schoolId: string; schoolName: string; score: number | null }[]
}

export interface FocusAreaComparisonResult {
  axes: FocusAreaComparisonAxis[]
  walkedSchoolCount: number
  benchmarkSchoolCount: number
  series: FocusAreaComparisonSeries[]
}

function average(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function schoolHasWalkedData(schoolId: string): boolean {
  return loadDraftsForSchool(schoolId).some(
    (draft) =>
      !!draft.lastSubmission ||
      !!draft.session.submittedAt ||
      Object.values(draft.session.rooms).some((room) => room.responses.length > 0),
  )
}

export function listWalkedSchools(schools: AisdSchoolOption[]): WalkedSchoolSummary[] {
  const byId = new Map<string, WalkedSchoolSummary>()

  for (const school of schools) {
    if (!schoolHasWalkedData(school.id)) continue
    byId.set(school.id, {
      schoolId: school.id,
      schoolName: school.displayName,
      campusId: school.campusId,
      schoolClass: school.schoolClass,
    })
  }

  return [...byId.values()].sort((a, b) => a.schoolName.localeCompare(b.schoolName))
}

function snapshotForSchool(school: WalkedSchoolSummary): CampusScoringSnapshot | null {
  try {
    return buildCampusScoringSnapshot({
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      campusId: school.campusId,
      schoolClass: school.schoolClass,
    })
  } catch {
    return null
  }
}

function focusAreaScoreMap(focusAreas: FocusAreaGroup[]): Record<ScoringFocusAreaId, number | null> {
  const map = {} as Record<ScoringFocusAreaId, number | null>
  for (const area of focusAreas) {
    map[area.id] = area.overallScore
  }
  return map
}

const COMPARISON_COLORS = ["#d97706", "#7c3aed", "#059669"] as const

export function buildFocusAreaComparison(params: {
  currentSchoolId: string
  currentSnapshot: CampusScoringSnapshot
  schools: AisdSchoolOption[]
  comparisonSchoolIds: string[]
}): FocusAreaComparisonResult {
  const walked = listWalkedSchools(params.schools)
  const walkedById = new Map(walked.map((school) => [school.schoolId, school]))

  const benchmarkSchools = walked.filter((school) => school.schoolId !== params.currentSchoolId)
  const benchmarkSnapshots = benchmarkSchools
    .map((school) => ({
      school,
      snapshot: snapshotForSchool(school),
    }))
    .filter((row): row is { school: WalkedSchoolSummary; snapshot: CampusScoringSnapshot } =>
      row.snapshot !== null,
    )

  const comparisonSnapshots = params.comparisonSchoolIds
    .map((schoolId) => {
      const school = walkedById.get(schoolId)
      if (!school || schoolId === params.currentSchoolId) return null
      const snapshot = snapshotForSchool(school)
      return snapshot ? { school, snapshot } : null
    })
    .filter((row): row is { school: WalkedSchoolSummary; snapshot: CampusScoringSnapshot } => row !== null)

  const axisDefs = params.currentSnapshot.focusAreas
  const chartAxes = axisDefs.filter((area) => {
    if (area.overallScore !== null) return true
    const benchmarkScores = benchmarkSnapshots
      .map(({ snapshot }) => snapshot.focusAreas.find((fa) => fa.id === area.id)?.overallScore)
      .filter((score): score is number => score != null)
    if (benchmarkScores.length > 0) return true
    return comparisonSnapshots.some(
      ({ snapshot }) =>
        snapshot.focusAreas.find((fa) => fa.id === area.id)?.overallScore != null,
    )
  })

  const axes: FocusAreaComparisonAxis[] = chartAxes.map((area) => {
    const benchmarkScores = benchmarkSnapshots
      .map(({ snapshot }) => snapshot.focusAreas.find((fa) => fa.id === area.id)?.overallScore)
      .filter((score): score is number => score != null)

    return {
      id: area.id,
      label: area.label,
      currentScore: area.overallScore,
      walkedAverage: average(benchmarkScores),
      comparisonScores: comparisonSnapshots.map(({ school, snapshot }) => ({
        schoolId: school.schoolId,
        schoolName: school.schoolName,
        score: snapshot.focusAreas.find((fa) => fa.id === area.id)?.overallScore ?? null,
      })),
    }
  })

  const currentScores = focusAreaScoreMap(params.currentSnapshot.focusAreas)
  const benchmarkScores = {} as Record<ScoringFocusAreaId, number | null>
  for (const axis of axes) {
    benchmarkScores[axis.id] = axis.walkedAverage
  }

  const series: FocusAreaComparisonSeries[] = [
    {
      id: "current",
      label: params.currentSnapshot.schoolName,
      color: "#2563eb",
      scores: currentScores,
    },
    {
      id: "walked-average",
      label: `Walked average (${benchmarkSnapshots.length})`,
      color: "#64748b",
      dashed: true,
      scores: benchmarkScores,
    },
    ...comparisonSnapshots.map(({ school }, index) => ({
      id: school.schoolId,
      label: school.schoolName,
      color: COMPARISON_COLORS[index % COMPARISON_COLORS.length],
      scores: focusAreaScoreMap(comparisonSnapshots[index]!.snapshot.focusAreas),
    })),
  ]

  return {
    axes,
    walkedSchoolCount: walked.length,
    benchmarkSchoolCount: benchmarkSnapshots.length,
    series,
  }
}
