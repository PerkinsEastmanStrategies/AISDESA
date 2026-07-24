import type { AisdSchoolOption, CategoryScore } from "@aisd/shared"
import { aggregateCampusScores } from "@aisd/shared"
import {
  buildCampusScoringSnapshot,
  type CampusScoringSnapshot,
} from "@/lib/campus-scoring-tree"
import { loadDraftsForSchool } from "@/lib/survey-persistence"

export interface PeerSchoolRow {
  schoolId: string
  schoolName: string
  campusOverallScore: number | null
  rank: number | null
  percentile: number | null
  isTarget: boolean
}

export interface FocusAreaPeerComparison {
  focusAreaId: string
  label: string
  targetScore: number | null
  districtAverage: number | null
  rank: number | null
  percentile: number | null
}

export interface CategoryPeerComparison {
  category: string
  targetScore: number | null
  districtAverage: number | null
}

export interface QaPeerComparison {
  peerGroupLabel: string
  scoredPeerCount: number
  target: PeerSchoolRow
  peers: PeerSchoolRow[]
  focusAreas: FocusAreaPeerComparison[]
  categories: CategoryPeerComparison[]
  districtAverage: number | null
  rank: number | null
  percentile: number | null
}

function average(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function averageCategoryScores(
  rows: { categoryScores: CategoryScore[]; overallScore: number | null }[],
): CategoryScore[] {
  const byCat = new Map<string, { scores: number[]; weight: number }>()
  for (const row of rows) {
    if (row.overallScore === null) continue
    for (const cat of row.categoryScores) {
      const entry = byCat.get(cat.category) ?? { scores: [], weight: cat.weight }
      entry.scores.push(cat.score)
      byCat.set(cat.category, entry)
    }
  }
  return Array.from(byCat.entries()).map(([category, { scores, weight }]) => ({
    category,
    score: average(scores) ?? 0,
    weight,
  }))
}

function computeRankAndPercentile(
  scores: { schoolId: string; score: number }[],
  targetId: string,
): { rank: number | null; percentile: number | null } {
  if (!scores.length) return { rank: null, percentile: null }
  const sorted = [...scores].sort((a, b) => b.score - a.score)
  const idx = sorted.findIndex((s) => s.schoolId === targetId)
  if (idx < 0) return { rank: null, percentile: null }
  const rank = idx + 1
  const percentile =
    scores.length <= 1 ? 100 : Math.round((1 - idx / (scores.length - 1)) * 100)
  return { rank, percentile }
}

function schoolHasScorableData(schoolId: string): boolean {
  return loadDraftsForSchool(schoolId).some(
    (draft) =>
      !!draft.lastSubmission ||
      !!draft.session.submittedAt ||
      Object.values(draft.session.rooms).some((room) => room.responses.length > 0),
  )
}

function peerGroupLabel(schoolClass: string | null | undefined): string {
  switch (schoolClass) {
    case "ELEM":
      return "Elementary schools"
    case "MID":
      return "Middle schools"
    case "HIGH":
      return "High schools"
    default:
      return "All schools with scores"
  }
}

export function buildQaPeerComparison(
  targetSchoolId: string,
  schools: AisdSchoolOption[],
  schoolClassById: Map<string, string>,
): QaPeerComparison {
  const targetMeta = schools.find((s) => s.id === targetSchoolId)
  const targetClass =
    schoolClassById.get(targetSchoolId) ?? targetMeta?.schoolClass ?? null

  const peerCandidates = schools.filter((school) => {
    if (!schoolHasScorableData(school.id)) return false
    if (!targetClass) return true
    const cls = schoolClassById.get(school.id) ?? school.schoolClass
    return cls === targetClass
  })

  const snapshots: {
    schoolId: string
    schoolName: string
    snapshot: CampusScoringSnapshot
    categoryScores: CategoryScore[]
  }[] = []

  for (const school of peerCandidates) {
    try {
      const snapshot = buildCampusScoringSnapshot({
        schoolId: school.id,
        schoolName: school.displayName,
        campusId: school.campusId,
        schoolClass: schoolClassById.get(school.id) ?? school.schoolClass,
      })
      if (snapshot.campusOverallScore === null && snapshot.allRooms.length === 0) continue

      const campusAgg = aggregateCampusScores(snapshot.allRooms, {
        schoolId: school.id,
        schoolName: school.displayName,
        campusId: school.campusId,
      })

      snapshots.push({
        schoolId: school.id,
        schoolName: school.displayName,
        snapshot,
        categoryScores: campusAgg.categoryScores,
      })
    } catch {
      continue
    }
  }

  const campusScores = snapshots
    .filter((s) => s.snapshot.campusOverallScore !== null)
    .map((s) => ({ schoolId: s.schoolId, score: s.snapshot.campusOverallScore! }))

  const targetSnapshot = snapshots.find((s) => s.schoolId === targetSchoolId)
  const targetOverall = targetSnapshot?.snapshot.campusOverallScore ?? null
  const districtAverage = average(campusScores.map((s) => s.score))
  const { rank, percentile } = computeRankAndPercentile(campusScores, targetSchoolId)

  const peers: PeerSchoolRow[] = snapshots
    .map((s) => {
      const hasScore = s.snapshot.campusOverallScore !== null
      const peerRank = hasScore
        ? computeRankAndPercentile(campusScores, s.schoolId)
        : { rank: null, percentile: null }
      return {
        schoolId: s.schoolId,
        schoolName: s.schoolName,
        campusOverallScore: s.snapshot.campusOverallScore,
        rank: peerRank.rank,
        percentile: peerRank.percentile,
        isTarget: s.schoolId === targetSchoolId,
      }
    })
    .sort((a, b) => {
      if (a.campusOverallScore === null && b.campusOverallScore === null) {
        return a.schoolName.localeCompare(b.schoolName)
      }
      if (a.campusOverallScore === null) return 1
      if (b.campusOverallScore === null) return -1
      return b.campusOverallScore - a.campusOverallScore
    })

  const targetRow =
    peers.find((p) => p.isTarget) ??
    ({
      schoolId: targetSchoolId,
      schoolName: targetMeta?.displayName ?? targetSchoolId,
      campusOverallScore: targetOverall,
      rank,
      percentile,
      isTarget: true,
    } satisfies PeerSchoolRow)

  const focusAreas: FocusAreaPeerComparison[] = (targetSnapshot?.snapshot.focusAreas ?? []).map(
    (area) => {
      const areaScores = snapshots
        .map((s) => {
          const match = s.snapshot.focusAreas.find((fa) => fa.id === area.id)
          return match?.overallScore != null
            ? { schoolId: s.schoolId, score: match.overallScore }
            : null
        })
        .filter((row): row is { schoolId: string; score: number } => row !== null)

      const peerRank = computeRankAndPercentile(areaScores, targetSchoolId)
      return {
        focusAreaId: area.id,
        label: area.label,
        targetScore: area.overallScore,
        districtAverage: average(areaScores.map((s) => s.score)),
        rank: peerRank.rank,
        percentile: peerRank.percentile,
      }
    },
  )

  const targetCategories = targetSnapshot?.categoryScores ?? []
  const categoryNames = new Set<string>()
  for (const snapshot of snapshots) {
    for (const cat of snapshot.categoryScores) categoryNames.add(cat.category)
  }
  for (const cat of targetCategories) categoryNames.add(cat.category)

  const categories: CategoryPeerComparison[] = [...categoryNames]
    .sort((a, b) => a.localeCompare(b))
    .map((category) => {
      const districtScores = snapshots
        .map((s) => s.categoryScores.find((c) => c.category === category)?.score)
        .filter((score): score is number => score != null)
      const targetScore =
        targetCategories.find((c) => c.category === category)?.score ?? null
      return {
        category,
        targetScore,
        districtAverage: average(districtScores),
      }
    })

  return {
    peerGroupLabel: peerGroupLabel(targetClass),
    scoredPeerCount: campusScores.length,
    target: targetRow,
    peers,
    focusAreas,
    categories,
    districtAverage,
    rank,
    percentile,
  }
}

export function campusCategoryScoresFromSnapshot(
  snapshot: CampusScoringSnapshot,
): CategoryScore[] {
  return averageCategoryScores(snapshot.allRooms.filter((room) => room.overallScore !== null))
}
