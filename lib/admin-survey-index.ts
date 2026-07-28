import type { AisdSchoolOption, CategoryScore, SurveyType } from "@aisd/shared"
import {
  requiredSurveyTypesForSchool,
  SURVEY_TYPES,
  surveyTypeAvailableForSchool,
  surveyTypeLabel,
} from "@aisd/shared"
import { getQaFinalization } from "@/lib/admin-qa"
import { buildCampusScoringSnapshot } from "@/lib/campus-scoring-tree"
import { listAllDrafts, loadDraft, type PersistedSurveyDraft } from "@/lib/survey-persistence"
import { getSurveyTypeInfo } from "@/lib/survey-status"

export type AdminSurveyStatus = "in_progress" | "complete" | "submitted"

export type AdminMatrixCellStatus = "complete" | "in_progress" | "not_started" | "na"

export type AdminSchoolStatus = "finalized" | "complete" | "not_started" | "in_progress"

export interface AdminSurveyRecord {
  key: string
  schoolId: string
  schoolName: string
  campusId: string
  surveyType: SurveyType
  surveyLabel: string
  status: AdminSurveyStatus
  assessorName: string | null
  assessorEmail: string | null
  overallScore: number | null
  categoryScores: CategoryScore[]
  roomCount: number
  scoredRoomCount: number
  completeRoomCount: number
  submittedAt: string | null
  savedAt: string
  hasSubmission: boolean
}

export interface AdminSchoolSummary {
  schoolId: string
  schoolName: string
  campusId: string
  schoolClass: string | null
  status: AdminSchoolStatus
  cells: Record<SurveyType, AdminMatrixCellStatus>
  completedRequiredCount: number
  requiredSurveyCount: number
  overallScore: number | null
  assessorNames: string[]
  surveyLabels: string[]
  lastUpdated: string | null
  qa: {
    reviewerName: string
    reviewerEmail: string
    finalizedAt: string
  } | null
}

const TRACKED_SURVEY_TYPES = SURVEY_TYPES.filter((type) => type !== "closeout")

function draftHasProgress(draft: PersistedSurveyDraft): boolean {
  if (draft.lastSubmission) return true
  return Object.values(draft.session.rooms).some(
    (room) =>
      room.responses.length > 0 ||
      !!room.gradeType ||
      (room.pendingQuestionIds?.length ?? 0) > 0 ||
      !!room.pendingGrade,
  )
}

function resolveAssessor(draft: PersistedSurveyDraft): {
  name: string | null
  email: string | null
} {
  const fromSubmission = draft.lastSubmission?.session
  const name =
    fromSubmission?.assessorName?.trim() ||
    draft.session.assessorName?.trim() ||
    null
  const email =
    fromSubmission?.assessorEmail?.trim() ||
    draft.session.assessorEmail?.trim() ||
    null
  return { name, email }
}

export function buildAdminSurveyRecords(
  schoolClassById?: Map<string, string>,
): AdminSurveyRecord[] {
  const drafts = listAllDrafts().filter(draftHasProgress)

  return drafts.map((draft) => {
    const submission = draft.lastSubmission
    const campus = submission?.campus
    const info = getSurveyTypeInfo(draft.surveyType, draft.schoolId, {}, {
      liveSession: draft.session,
      schoolClass: schoolClassById?.get(draft.schoolId),
    })
    const assessor = resolveAssessor(draft)

    let status: AdminSurveyStatus = "in_progress"
    if (submission) status = "submitted"
    else if (info.status === "complete") status = "complete"

    return {
      key: `${draft.schoolId}:${draft.surveyType}`,
      schoolId: draft.schoolId,
      schoolName:
        campus?.schoolName ||
        draft.session.schoolName ||
        draft.schoolId,
      campusId: campus?.campusId || draft.session.campusId || "",
      surveyType: draft.surveyType,
      surveyLabel: surveyTypeLabel(draft.surveyType),
      status,
      assessorName: assessor.name,
      assessorEmail: assessor.email,
      overallScore: campus?.overallScore ?? null,
      categoryScores: campus?.categoryScores ?? [],
      roomCount: campus?.roomCount ?? Object.keys(draft.session.rooms).length,
      scoredRoomCount: campus?.scoredRoomCount ?? 0,
      completeRoomCount: campus?.completeRoomCount ?? 0,
      submittedAt: submission?.submittedAt ?? draft.session.submittedAt ?? null,
      savedAt: draft.savedAt,
      hasSubmission: !!submission,
    }
  })
}

function recordToCellStatus(record: AdminSurveyRecord | undefined): AdminMatrixCellStatus {
  if (!record) return "not_started"
  if (record.status === "submitted" || record.status === "complete") return "complete"
  return "in_progress"
}

function requiredSurveyTypes(schoolClass: string | null | undefined): SurveyType[] {
  return requiredSurveyTypesForSchool(schoolClass)
}

export function buildAdminSchoolSummaries(
  records: AdminSurveyRecord[],
  schoolClassById: Map<string, string>,
  schools: AisdSchoolOption[],
): AdminSchoolSummary[] {
  const recordsByKey = new Map<string, AdminSurveyRecord>()
  for (const record of records) {
    recordsByKey.set(`${record.schoolId}:${record.surveyType}`, record)
  }

  const recordsBySchool = new Map<string, AdminSurveyRecord[]>()
  for (const record of records) {
    const list = recordsBySchool.get(record.schoolId) ?? []
    list.push(record)
    recordsBySchool.set(record.schoolId, list)
  }

  return schools
    .map((school) => {
      const schoolClass = schoolClassById.get(school.id) ?? school.schoolClass ?? null
      const required = requiredSurveyTypes(schoolClass)
      const qa = getQaFinalization(school.id)
      const closeOutDraft = loadDraft(school.id, "closeout")
      const campusSubmittedAt =
        closeOutDraft?.session.campusSubmittedAt ??
        closeOutDraft?.lastSubmission?.session.campusSubmittedAt ??
        null

      const cells = {} as Record<SurveyType, AdminMatrixCellStatus>
      for (const type of SURVEY_TYPES) {
        if (type === "closeout" || !surveyTypeAvailableForSchool(type, schoolClass)) {
          cells[type] = "na"
          continue
        }
        cells[type] = recordToCellStatus(recordsByKey.get(`${school.id}:${type}`))
      }

      const completedRequiredCount = required.filter((type) => cells[type] === "complete").length
      const requiredSurveyCount = required.length
      const schoolRecords = recordsBySchool.get(school.id) ?? []

      const assessorNames = [
        ...new Set(
          schoolRecords
            .map((record) => record.assessorName?.trim())
            .filter((name): name is string => Boolean(name)),
        ),
      ]

      const surveyLabels = [...new Set(schoolRecords.map((record) => record.surveyLabel))]

      const scoredSurveyRecords = schoolRecords.filter((record) => record.overallScore != null)
      let overallScore: number | null = null
      if (scoredSurveyRecords.length > 0 || schoolRecords.length > 0) {
        const snapshot = buildCampusScoringSnapshot({
          schoolId: school.id,
          schoolName: school.name,
          campusId: school.campusId ?? "",
          schoolClass,
        })
        overallScore = snapshot.campusOverallScore
      }
      if (overallScore == null && scoredSurveyRecords.length > 0) {
        overallScore =
          scoredSurveyRecords.reduce((sum, record) => sum + (record.overallScore as number), 0) /
          scoredSurveyRecords.length
      }

      const lastUpdated =
        schoolRecords.length > 0
          ? schoolRecords.reduce(
              (latest, record) => (record.savedAt > latest ? record.savedAt : latest),
              schoolRecords[0].savedAt,
            )
          : null

      let status: AdminSchoolStatus
      if (qa) {
        status = "finalized"
      } else if (campusSubmittedAt) {
        status = "complete"
      } else if (requiredSurveyCount === 0 || completedRequiredCount === 0) {
        status = schoolRecords.some((record) => record.status === "in_progress")
          ? "in_progress"
          : "not_started"
      } else if (completedRequiredCount === requiredSurveyCount) {
        status = "complete"
      } else {
        status = "in_progress"
      }

      return {
        schoolId: school.id,
        schoolName: school.name,
        campusId: school.campusId,
        schoolClass,
        status,
        cells,
        completedRequiredCount,
        requiredSurveyCount,
        overallScore,
        assessorNames,
        surveyLabels,
        lastUpdated,
        qa,
      }
    })
    .sort((a, b) => a.schoolName.localeCompare(b.schoolName))
}

export interface AdminOverviewStats {
  schoolCount: number
  surveyCount: number
  submittedCount: number
  inProgressCount: number
  scoredSurveyCount: number
  averageScore: number | null
}

export function summarizeAdminRecords(records: AdminSurveyRecord[]): AdminOverviewStats {
  const schools = new Set(records.map((r) => r.schoolId))
  const submitted = records.filter((r) => r.status === "submitted" || r.status === "complete")
  const inProgress = records.filter((r) => r.status === "in_progress")
  const scored = records.filter((r) => r.overallScore != null)
  const averageScore =
    scored.length > 0
      ? scored.reduce((sum, r) => sum + (r.overallScore as number), 0) / scored.length
      : null

  return {
    schoolCount: schools.size,
    surveyCount: records.length,
    submittedCount: submitted.length,
    inProgressCount: inProgress.length,
    scoredSurveyCount: scored.length,
    averageScore,
  }
}
