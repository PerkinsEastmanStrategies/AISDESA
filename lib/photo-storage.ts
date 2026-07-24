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
  /** Unique file segment — new uploads should pass a fresh UUID; omit only for legacy path resolution. */
  photoId?: string
  /** When true with photoId, overwrite the object at that path (replace in place). */
  replaceExisting?: boolean
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

export function generateSurveyPhotoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
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

/**
 * Storage path — question photos use `{questionId}/{photoId}.jpg` when photoId is set;
 * legacy single-photo paths omit the photoId segment.
 */
export function buildSurveyPhotoStoragePath(context: SurveyPhotoUploadContext): string {
  const campus = sanitizePathSegment(context.campusId)
  const school = sanitizePathSegment(context.schoolId)
  const survey = sanitizePathSegment(context.surveyType)

  if (context.kind === "prewalk-space-type") {
    if (!context.spaceType?.trim()) throw new Error("spaceType is required for pre-walk photos")
    const space = sanitizePathSegment(context.spaceType)
    if (context.roomId?.trim()) {
      const room = sanitizePathSegment(context.roomId)
      if (context.photoId?.trim()) {
        return `${campus}/${school}/${survey}/${room}/prewalk/${space}/${sanitizePathSegment(context.photoId)}.jpg`
      }
      return `${campus}/${school}/${survey}/${room}/prewalk/${space}.jpg`
    }
    if (context.photoId?.trim()) {
      return `${campus}/${school}/${survey}/prewalk/${space}/${sanitizePathSegment(context.photoId)}.jpg`
    }
    return `${campus}/${school}/${survey}/prewalk/${space}.jpg`
  }

  if (!context.roomId?.trim() || !context.questionId?.trim()) {
    throw new Error("roomId and questionId are required for question photos")
  }

  const room = sanitizePathSegment(context.roomId)
  const questionId = sanitizePathSegment(context.questionId)
  if (context.photoId?.trim()) {
    return `${campus}/${school}/${survey}/${room}/${questionId}/${sanitizePathSegment(context.photoId)}.jpg`
  }
  return `${campus}/${school}/${survey}/${room}/${questionId}.jpg`
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

export function isLocalPhotoDataUrl(url: string | undefined | null): boolean {
  return !!url?.startsWith("data:image/")
}

export interface ParsedSurveyPhotoPath {
  path: string
  url: string
  campusId: string
  schoolId: string
  surveyType: string
  kind: SurveyPhotoUploadKind
  roomId?: string
  questionId?: string
  spaceType?: string
  photoId?: string
}

function parseFilenameStem(filename: string): { stem: string; photoId?: string } {
  const withoutExt = filename.replace(/\.jpg$/i, "")
  return { stem: withoutExt }
}

/** Parse a storage object path back into survey metadata (for bucket listing). */
export function parseSurveyPhotoStoragePath(path: string): ParsedSurveyPhotoPath | null {
  const trimmed = path.trim().replace(/^\/+/, "")
  if (!trimmed.toLowerCase().endsWith(".jpg")) return null

  const segments = trimmed.split("/").filter(Boolean)
  if (segments.length < 4) return null

  const [campusId, schoolId, surveyType, fourth] = segments
  const publicUrl = getSupabasePhotoPublicUrl(trimmed)
  if (!publicUrl) return null

  // Room-scoped pre-walk: .../{roomId}/prewalk/{spaceType}[/{photoId}].jpg
  if (segments.length >= 6 && segments[4] === "prewalk") {
    const roomId = fourth
    const spaceType = segments[5]
    if (segments.length >= 7) {
      const photoId = segments[6].replace(/\.jpg$/i, "")
      if (!roomId || !spaceType || !photoId) return null
      return {
        path: trimmed,
        url: publicUrl,
        campusId,
        schoolId,
        surveyType,
        kind: "prewalk-space-type",
        roomId,
        spaceType,
        photoId,
      }
    }
    if (!roomId || !spaceType) return null
    return {
      path: trimmed,
      url: publicUrl,
      campusId,
      schoolId,
      surveyType,
      kind: "prewalk-space-type",
      roomId,
      spaceType,
    }
  }

  // Legacy school-level pre-walk: .../prewalk/{spaceType}[/{photoId}].jpg
  if (fourth === "prewalk") {
    if (segments.length >= 6) {
      const spaceType = segments[4]
      const photoId = segments[5].replace(/\.jpg$/i, "")
      if (!spaceType || !photoId) return null
      return {
        path: trimmed,
        url: publicUrl,
        campusId,
        schoolId,
        surveyType,
        kind: "prewalk-space-type",
        spaceType,
        photoId,
      }
    }
    const spaceType = segments[4]?.replace(/\.jpg$/i, "")
    if (!spaceType) return null
    return {
      path: trimmed,
      url: publicUrl,
      campusId,
      schoolId,
      surveyType,
      kind: "prewalk-space-type",
      spaceType,
    }
  }

  if (segments.length < 5) return null
  const roomId = fourth

  // Multi-photo question: .../{roomId}/{questionId}/{photoId}.jpg
  if (segments.length >= 6) {
    const questionId = segments[4]
    const photoId = segments[5].replace(/\.jpg$/i, "")
    if (!roomId || !questionId || !photoId) return null
    return {
      path: trimmed,
      url: publicUrl,
      campusId,
      schoolId,
      surveyType,
      kind: "question",
      roomId,
      questionId,
      photoId,
    }
  }

  // Legacy single-photo question: .../{roomId}/{questionId}.jpg
  const questionId = segments.slice(4).join("/").replace(/\.jpg$/i, "")
  if (!roomId || !questionId) return null

  return {
    path: trimmed,
    url: publicUrl,
    campusId,
    schoolId,
    surveyType,
    kind: "question",
    roomId,
    questionId,
  }
}

/** Resolve a display URL from session data or the canonical Supabase object path. */
export function resolveSurveyPhotoPublicUrl(
  context: SurveyPhotoUploadContext,
  photo: string | undefined,
): string | null {
  if (isSupabasePhotoUrl(photo)) return photo!.trim()
  if (!photo?.trim()) return null
  if (!isPhotoStorageEnabled()) return isRemotePhotoUrl(photo) ? photo.trim() : null
  return getSupabasePhotoPublicUrl(buildSurveyPhotoStoragePath(context))
}

function isRemotePhotoUrl(url: string): boolean {
  return url.trim().startsWith("http")
}

/** Storage paths replace spaces with underscores — compare labels loosely. */
export function normalizeSpaceTypeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ")
}

export function spaceTypesMatch(a: string, b: string): boolean {
  return normalizeSpaceTypeKey(a) === normalizeSpaceTypeKey(b)
}

export function displaySpaceTypeFromStoragePath(spaceTypeSegment: string): string {
  return spaceTypeSegment.replace(/_/g, " ").replace(/\s+/g, " ").trim()
}

export async function uploadSurveyPhoto(
  context: SurveyPhotoUploadContext,
  imageDataUrl: string,
): Promise<SurveyPhotoUploadResult> {
  const photoId =
    context.replaceExisting && context.photoId?.trim()
      ? context.photoId.trim()
      : generateSurveyPhotoId()

  const response = await fetch("/api/photos/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...context,
      photoId,
      replaceExisting: !!context.replaceExisting && !!context.photoId?.trim(),
      imageDataUrl,
    }),
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
