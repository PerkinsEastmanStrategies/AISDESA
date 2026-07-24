/** Survey photo paths in Supabase Storage (default bucket: ESA Pictures). */

export type SurveyPhotoUploadKind = "question" | "prewalk-space-type"

export interface SurveyPhotoUploadContext {
  kind: SurveyPhotoUploadKind
  campusId: string
  schoolId: string
  surveyType: string
  roomId?: string
  questionId?: string
  spaceType?: string
}

export interface SurveyPhotoUploadResult {
  url: string
  path: string
}

const DEFAULT_PHOTOS_BUCKET = "ESA Pictures"

export function photosBucketName(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_PHOTOS_BUCKET?.trim() || DEFAULT_PHOTOS_BUCKET
}

export function isPhotoStorageEnabled(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
}

function sanitizePathSegment(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120) || "unknown"
  )
}

/** Storage path — question ID (or space type) is encoded in the folder/file name. */
export function buildSurveyPhotoStoragePath(context: SurveyPhotoUploadContext): string {
  const campus = sanitizePathSegment(context.campusId)
  const school = sanitizePathSegment(context.schoolId)
  const survey = sanitizePathSegment(context.surveyType)

  if (context.kind === "prewalk-space-type") {
    if (!context.spaceType?.trim()) throw new Error("spaceType is required for pre-walk photos")
    return `${campus}/${school}/${survey}/prewalk/${sanitizePathSegment(context.spaceType)}.jpg`
  }

  if (!context.roomId?.trim() || !context.questionId?.trim()) {
    throw new Error("roomId and questionId are required for question photos")
  }

  return `${campus}/${school}/${survey}/${sanitizePathSegment(context.roomId)}/${sanitizePathSegment(context.questionId)}.jpg`
}

export function getSupabasePhotoPublicUrl(path: string): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const bucket = photosBucketName()
  if (!supabaseUrl || !path) return null
  const base = supabaseUrl.replace(/\/$/, "")
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
  return `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`
}

export function isSupabasePhotoUrl(url: string | undefined | null): boolean {
  if (!url?.startsWith("http")) return false
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!supabaseUrl) return false
  const base = supabaseUrl.replace(/\/$/, "")
  return url.startsWith(`${base}/storage/v1/object/`)
}

export async function uploadSurveyPhoto(
  context: SurveyPhotoUploadContext,
  imageDataUrl: string,
): Promise<SurveyPhotoUploadResult> {
  const response = await fetch("/api/photos/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...context, imageDataUrl }),
  })

  const payload = (await response.json().catch(() => null)) as
    | SurveyPhotoUploadResult
    | { error?: string }
    | null

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : "Photo upload failed",
    )
  }

  if (!payload || !("url" in payload) || !payload.url) {
    throw new Error("Photo upload returned an invalid response")
  }

  return payload
}

export async function deleteSurveyPhoto(url: string | undefined): Promise<void> {
  if (!url || !isSupabasePhotoUrl(url)) return
  await fetch("/api/photos/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  }).catch(() => {
    // Best-effort cleanup — local state is already cleared.
  })
}
