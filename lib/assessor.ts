import type { AssessorInfo } from "@aisd/shared"

export function isValidAssessorEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function isAssessorRegistered(info: AssessorInfo | null | undefined): boolean {
  if (!info) return false
  return info.name.trim().length > 0 && isValidAssessorEmail(info.email)
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
