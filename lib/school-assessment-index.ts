import type { SurveyType } from "@aisd/shared"
import { surveyTypeLabel } from "@aisd/shared"
import { buildCampusScoringSnapshot } from "@/lib/campus-scoring-tree"
import { loadDraftsForSchool, type PersistedSurveyDraft } from "@/lib/survey-persistence"
import type { RoomScoreResult, SurveySession } from "@aisd/shared"

export interface SubmittedRoomAssessment {
  roomId: string
  surveyType: SurveyType
  spaceType: string
  surveyLabel: string
  submittedAt: string
}

function draftWasSubmitted(draft: PersistedSurveyDraft): boolean {
  return !!(draft.lastSubmission || draft.session.submittedAt)
}

function roomInSubmittedDraft(
  draft: PersistedSurveyDraft,
  roomId: string,
): SubmittedRoomAssessment | null {
  if (!draftWasSubmitted(draft)) return null

  const sub = draft.lastSubmission
  const submittedAt =
    sub?.submittedAt ?? draft.session.submittedAt ?? draft.savedAt

  const campusEntry = sub?.campus?.rooms?.find((r) => r.roomId === roomId)
  const sessionRoom = sub?.session.rooms[roomId] ?? draft.session.rooms[roomId]

  if (!campusEntry && !sessionRoom) return null

  const hasAssessment =
    !!campusEntry ||
    (sessionRoom &&
      (sessionRoom.responses.length > 0 ||
        !!sessionRoom.gradeType ||
        !!sessionRoom.deferredToCloseOut))

  if (!hasAssessment) return null

  const spaceType =
    sessionRoom?.roomType?.trim() ||
    draft.lastSubmission?.session.rooms[roomId]?.roomType?.trim() ||
    "Assessed space"

  return {
    roomId,
    surveyType: draft.surveyType,
    spaceType,
    surveyLabel: surveyTypeLabel(draft.surveyType),
    submittedAt,
  }
}

export function findSubmittedRoomAssessment(
  schoolId: string,
  roomId: string,
  drafts?: PersistedSurveyDraft[],
): SubmittedRoomAssessment | null {
  for (const draft of drafts ?? loadDraftsForSchool(schoolId)) {
    const match = roomInSubmittedDraft(draft, roomId)
    if (match) return match
  }
  return null
}

export function schoolHasAnySubmission(
  schoolId: string,
  drafts?: PersistedSurveyDraft[],
): boolean {
  return (drafts ?? loadDraftsForSchool(schoolId)).some(draftWasSubmitted)
}

export function buildSchoolCampusSnapshot(input: {
  schoolId: string
  schoolName: string
  campusId: string
  schoolClass?: string | null
  drafts?: PersistedSurveyDraft[]
  liveSurveyType?: SurveyType
  liveSession?: SurveySession | null
  liveRoomScoreDetails?: Record<string, RoomScoreResult>
  liveNeighborhoodResolver?: (
    roomId: string,
    roomSession: SurveySession["rooms"][string],
  ) => string | undefined
}) {
  return buildCampusScoringSnapshot(input)
}

export function schoolScoredRoomCount(input: Parameters<typeof buildSchoolCampusSnapshot>[0]): number {
  const snapshot = buildSchoolCampusSnapshot(input)
  return snapshot.allRooms.filter((room) => room.overallScore !== null).length
}

export function schoolHasResults(input: Parameters<typeof buildSchoolCampusSnapshot>[0]): boolean {
  const drafts = input.drafts
  if (schoolHasAnySubmission(input.schoolId, drafts)) return true
  const snapshot = buildSchoolCampusSnapshot(input)
  return snapshot.allRooms.some(
    (room) => room.overallScore !== null || room.answeredCount > 0,
  )
}
