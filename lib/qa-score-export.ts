import type { CampusScoringSnapshot } from "@/lib/campus-scoring-tree"
import type { QaPeerComparison } from "@/lib/qa-peer-comparison"
import { campusCategoryScoresFromSnapshot } from "@/lib/qa-peer-comparison"
import { scoreBandLabel } from "@/lib/utils"

function escapeCsvField(value: string | number | null | undefined): string {
  if (value == null) return ""
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function csvRow(values: (string | number | null | undefined)[]): string {
  return values.map(escapeCsvField).join(",")
}

function formatScore(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return ""
  return String(Math.round(score * 10) / 10)
}

function sectionHeader(title: string): string[] {
  return ["", title]
}

export function buildQaScoreCsv(
  snapshot: CampusScoringSnapshot,
  options?: {
    schoolClass?: string | null
    peerComparison?: QaPeerComparison | null
  },
): string {
  const lines: string[] = []
  const campusCategories = campusCategoryScoresFromSnapshot(snapshot)
  const peerComparison = options?.peerComparison

  lines.push(csvRow(["QA score export", snapshot.schoolName]))
  lines.push(csvRow(["Generated", new Date().toISOString()]))
  lines.push("")

  lines.push(...sectionHeader("SUMMARY"))
  lines.push(
    csvRow([
      "School",
      "Campus ID",
      "School class",
      "Campus overall score",
      "Assessed spaces",
      "Scored spaces",
    ]),
  )
  lines.push(
    csvRow([
      snapshot.schoolName,
      snapshot.campusId,
      options?.schoolClass ?? "",
      formatScore(snapshot.campusOverallScore),
      snapshot.allRooms.length,
      snapshot.allRooms.filter((r) => r.overallScore != null).length,
    ]),
  )
  lines.push("")

  lines.push(...sectionHeader("CAMPUS CATEGORIES"))
  lines.push(csvRow(["Category", "Score", "Weight"]))
  for (const cat of campusCategories) {
    lines.push(csvRow([cat.category, formatScore(cat.score), cat.weight]))
  }
  lines.push("")

  lines.push(...sectionHeader("FOCUS AREAS"))
  lines.push(csvRow(["Focus area", "Space type", "Room count", "Scored rooms", "Overall score"]))
  for (const area of snapshot.focusAreas) {
    for (const space of area.spaceTypes) {
      lines.push(
        csvRow([
          area.label,
          space.spaceType,
          space.roomCount,
          space.scoredRoomCount,
          formatScore(space.overallScore),
        ]),
      )
    }
    if (area.spaceTypes.length === 0) {
      lines.push(
        csvRow([
          area.label,
          "",
          area.roomCount,
          area.scoredRoomCount,
          formatScore(area.overallScore),
        ]),
      )
    }
  }
  lines.push("")

  lines.push(...sectionHeader("ROOMS"))
  lines.push(
    csvRow([
      "Focus area",
      "Space type",
      "Survey type",
      "Room ID",
      "Room name",
      "School room number",
      "Neighborhood",
      "Grade type",
      "Overall score",
      "Score band",
      "Answered",
      "Total questions",
      "Complete",
    ]),
  )
  for (const area of snapshot.focusAreas) {
    for (const space of area.spaceTypes) {
      for (const room of space.rooms) {
        lines.push(
          csvRow([
            area.label,
            space.spaceType,
            room.surveyType,
            room.roomId,
            room.roomName,
            room.schoolRoomNumber ?? "",
            room.neighborhood ?? "",
            room.gradeType ?? "",
            formatScore(room.overallScore),
            scoreBandLabel(room.overallScore) ?? "",
            room.answeredCount ?? "",
            room.totalCount ?? "",
            room.complete ? "Yes" : "No",
          ]),
        )
      }
    }
  }
  lines.push("")

  lines.push(...sectionHeader("ROOM CATEGORIES"))
  lines.push(csvRow(["Room ID", "Room name", "Category", "Score", "Weight"]))
  for (const room of snapshot.allRooms) {
    if (room.overallScore == null) continue
    for (const cat of room.categoryScores) {
      lines.push(
        csvRow([
          room.roomId,
          room.roomName,
          cat.category,
          formatScore(cat.score),
          cat.weight,
        ]),
      )
    }
  }
  lines.push("")

  if (snapshot.neighborhoods.length > 0) {
    lines.push(...sectionHeader("NEIGHBORHOODS"))
    lines.push(csvRow(["Neighborhood", "Room count", "Scored rooms", "Overall score"]))
    for (const hood of snapshot.neighborhoods) {
      lines.push(
        csvRow([
          hood.neighborhoodLabel || hood.neighborhoodId,
          hood.roomCount,
          hood.scoredRoomCount,
          formatScore(hood.overallScore),
        ]),
      )
    }
    lines.push("")
  }

  if (peerComparison) {
    lines.push(...sectionHeader("PEER COMPARISON"))
    lines.push(
      csvRow([
        "Peer group",
        peerComparison.peerGroupLabel,
        "Scored peers",
        peerComparison.scoredPeerCount,
        "This school rank",
        peerComparison.rank ?? "",
        "Percentile",
        peerComparison.percentile ?? "",
        "Peer average",
        formatScore(peerComparison.districtAverage),
      ]),
    )
    lines.push("")

    if (peerComparison.focusAreas.length > 0) {
      lines.push(...sectionHeader("PEER FOCUS AREAS"))
      lines.push(
        csvRow([
          "Focus area",
          "This school",
          "Peer average",
          "Rank",
          "Percentile",
        ]),
      )
      for (const area of peerComparison.focusAreas) {
        lines.push(
          csvRow([
            area.label,
            formatScore(area.targetScore),
            formatScore(area.districtAverage),
            area.rank ?? "",
            area.percentile ?? "",
          ]),
        )
      }
      lines.push("")
    }

    if (peerComparison.categories.length > 0) {
      lines.push(...sectionHeader("PEER CATEGORIES"))
      lines.push(csvRow(["Category", "This school", "Peer average"]))
      for (const cat of peerComparison.categories) {
        lines.push(
          csvRow([
            cat.category,
            formatScore(cat.targetScore),
            formatScore(cat.districtAverage),
          ]),
        )
      }
      lines.push("")
    }

    lines.push(...sectionHeader("ALL PEER SCHOOLS"))
    lines.push(csvRow(["Rank", "School", "Campus score", "Percentile", "This school"]))
    for (const peer of peerComparison.peers) {
      lines.push(
        csvRow([
          peer.rank ?? "",
          peer.schoolName,
          formatScore(peer.campusOverallScore),
          peer.percentile ?? "",
          peer.isTarget ? "Yes" : "",
        ]),
      )
    }
  }

  return lines.join("\r\n")
}

export function downloadQaScoreCsv(
  snapshot: CampusScoringSnapshot,
  options?: {
    schoolClass?: string | null
    peerComparison?: QaPeerComparison | null
  },
): void {
  const content = buildQaScoreCsv(snapshot, options)
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  const date = new Date().toISOString().slice(0, 10)
  anchor.href = url
  anchor.download = `${snapshot.schoolId}-qa-scores-${date}.csv`
  anchor.style.display = "none"
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
