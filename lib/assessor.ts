import type { AssessorInfo, SurveySession, SurveyType } from "@aisd/shared"
import { SURVEY_TYPES } from "@aisd/shared"
import type { AssessorBySurveyType } from "@/lib/survey-persistence"

export function isValidAssessorEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function isAssessorRegistered(info: AssessorInfo | null | undefined): boolean {
  if (!info) return false
  return info.name.trim().length > 0 && isValidAssessorEmail(info.email)
}

/** First registered assessor for this browser visit (any survey module). */
export function resolveCampusAssessor(
  assessorByType: AssessorBySurveyType,
  preferredSurveyType?: SurveyType,
): AssessorInfo | undefined {
  if (preferredSurveyType && isAssessorRegistered(assessorByType[preferredSurveyType])) {
    return assessorByType[preferredSurveyType]
  }
  for (const surveyType of SURVEY_TYPES) {
    const info = assessorByType[surveyType]
    if (isAssessorRegistered(info)) return info
  }
  return undefined
}

export function sessionHasRegisteredAssessor(session: {
  assessorName?: string
  assessorEmail?: string
}): boolean {
  return isAssessorRegistered(assessorFromSession(session))
}

export function assessorFromSession(session: {
  assessorName?: string
  assessorEmail?: string
  assessorRegisteredAt?: string
}): AssessorInfo | null {
  if (!session.assessorName?.trim() || !session.assessorEmail?.trim()) return null
  return {
    name: session.assessorName.trim(),
    email: session.assessorEmail.trim(),
    registeredAt: session.assessorRegisteredAt ?? new Date().toISOString(),
  }
}

export function assessorSessionFields(info: AssessorInfo) {
  return {
    assessorName: info.name.trim(),
    assessorEmail: info.email.trim(),
    assessorRegisteredAt: info.registeredAt,
  }
}

export function assessorEmailsMatch(a?: string | null, b?: string | null): boolean {
  const left = (a ?? "").trim().toLowerCase()
  const right = (b ?? "").trim().toLowerCase()
  return left.length > 0 && left === right
}

/** Stamp this browser's user onto a session only when it has no author, or they are the author. */
export function shouldStampSessionAssessor(
  session: { assessorName?: string; assessorEmail?: string } | null | undefined,
  next: AssessorInfo,
  previousForType?: AssessorInfo | null,
): boolean {
  if (!session) return false
  if (!sessionHasRegisteredAssessor(session)) return true
  return (
    assessorEmailsMatch(session.assessorEmail, next.email) ||
    assessorEmailsMatch(session.assessorEmail, previousForType?.email)
  )
}

/** Stamp the campus assessor onto a module session when switching surveys. */
export function withCampusAssessorOnSession(
  session: SurveySession,
  assessorByType: AssessorBySurveyType,
  surveyType: SurveyType,
): { session: SurveySession; assessorByType: AssessorBySurveyType } {
  if (sessionHasRegisteredAssessor(session)) {
    return { session, assessorByType }
  }

  const assessor = resolveCampusAssessor(assessorByType, surveyType)
  if (!assessor) return { session, assessorByType }

  const now = new Date().toISOString()
  const nextAssessorByType = isAssessorRegistered(assessorByType[surveyType])
    ? assessorByType
    : { ...assessorByType, [surveyType]: assessor }

  return {
    session: {
      ...session,
      ...assessorSessionFields(assessor),
      updatedAt: now,
    },
    assessorByType: nextAssessorByType,
  }
}
