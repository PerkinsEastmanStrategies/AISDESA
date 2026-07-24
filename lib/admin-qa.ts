const QA_KEY = "aisd-survey-qa-finalizations"

export interface QaFinalization {
  schoolId: string
  reviewerName: string
  reviewerEmail: string
  finalizedAt: string
}

export function loadQaFinalizations(): Record<string, QaFinalization> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(QA_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, QaFinalization>
  } catch {
    return {}
  }
}

export function getQaFinalization(schoolId: string): QaFinalization | null {
  return loadQaFinalizations()[schoolId] ?? null
}

export function clearQaFinalization(schoolId: string): void {
  if (typeof window === "undefined") return
  const all = loadQaFinalizations()
  delete all[schoolId]
  localStorage.setItem(QA_KEY, JSON.stringify(all))
}

export function saveQaFinalization(input: {
  schoolId: string
  reviewerName: string
  reviewerEmail: string
  finalizedAt?: string
}): void {
  if (typeof window === "undefined") return
  const all = loadQaFinalizations()
  all[input.schoolId] = {
    schoolId: input.schoolId,
    reviewerName: input.reviewerName.trim(),
    reviewerEmail: input.reviewerEmail.trim(),
    finalizedAt: input.finalizedAt ?? new Date().toISOString(),
  }
  localStorage.setItem(QA_KEY, JSON.stringify(all))
}
