import "server-only"

import {
  buildSurveyPhotoStoragePath,
  generateSurveyPhotoId,
  getSupabasePhotoPublicUrl,
  parseSurveyPhotoStoragePath,
  photosBucketName,
  type ParsedSurveyPhotoPath,
  type SurveyPhotoUploadContext,
} from "@/lib/photo-storage"

function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured")
  return url.replace(/\/$/, "")
}

function supabaseUploadKey(): string {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!key) {
    throw new Error(
      "Add SUPABASE_SERVICE_ROLE_KEY (recommended) or NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local",
    )
  }
  return key
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!match) throw new Error("Invalid image data")
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") }
}

function storagePathFromPublicUrl(url: string): string | null {
  const base = supabaseUrl()
  const bucket = encodeURIComponent(photosBucketName())
  const prefix = `${base}/storage/v1/object/public/${bucket}/`
  if (!url.startsWith(prefix)) return null
  const encodedPath = url.slice(prefix.length)
  return decodeURIComponent(encodedPath)
}

export async function uploadSurveyPhotoToSupabase(
  context: SurveyPhotoUploadContext,
  imageDataUrl: string,
): Promise<{ url: string; path: string }> {
  const replaceExisting = !!(context.replaceExisting && context.photoId?.trim())
  const photoId = replaceExisting ? context.photoId!.trim() : context.photoId?.trim() || generateSurveyPhotoId()
  const path = buildSurveyPhotoStoragePath({ ...context, photoId })
  const { mime, buffer } = parseDataUrl(imageDataUrl)
  const bucket = photosBucketName()
  const uploadUrl = `${supabaseUrl()}/storage/v1/object/${encodeURIComponent(bucket)}/${path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseUploadKey()}`,
      "Content-Type": mime,
      "x-upsert": replaceExisting ? "true" : "false",
    },
    body: new Uint8Array(buffer),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(detail || `Supabase upload failed (${response.status})`)
  }

  const publicUrl = getSupabasePhotoPublicUrl(path)
  if (!publicUrl) throw new Error("Could not build public photo URL")

  return { url: publicUrl, path }
}

export async function deleteSurveyPhotoFromSupabase(url: string): Promise<void> {
  const path = storagePathFromPublicUrl(url)
  if (!path) return

  const bucket = photosBucketName()
  const objectUrl = `${supabaseUrl()}/storage/v1/object/${encodeURIComponent(bucket)}/${path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`

  const response = await fetch(objectUrl, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${supabaseUploadKey()}`,
    },
  })

  if (!response.ok && response.status !== 404) {
    const detail = await response.text().catch(() => "")
    throw new Error(detail || `Supabase delete failed (${response.status})`)
  }
}

interface StorageListEntry {
  name: string
  id: string | null
  metadata: Record<string, unknown> | null
}

const MAX_LISTED_PHOTOS = 250

async function listStoragePrefix(prefix: string): Promise<StorageListEntry[]> {
  const bucket = photosBucketName()
  const response = await fetch(`${supabaseUrl()}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseUploadKey()}`,
      apikey: supabaseUploadKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prefix,
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(detail || `Supabase list failed (${response.status})`)
  }

  return (await response.json()) as StorageListEntry[]
}

async function walkJpegPaths(prefix: string, results: string[], depth: number): Promise<void> {
  if (results.length >= MAX_LISTED_PHOTOS || depth > 8) return

  const entries = await listStoragePrefix(prefix)
  for (const entry of entries) {
    if (results.length >= MAX_LISTED_PHOTOS) break
    const childPath = `${prefix}${entry.name}`
    const isFolder = entry.id === null
    const isJpeg = entry.name.toLowerCase().endsWith(".jpg")
    if (!isFolder && isJpeg) {
      results.push(childPath)
      continue
    }
    if (isFolder) {
      await walkJpegPaths(`${childPath}/`, results, depth + 1)
    }
  }
}

/** List uploaded survey photos for one school (called only from the Photos results tab). */
export async function listSurveyPhotosForSchool(
  campusId: string,
  schoolId: string,
): Promise<ParsedSurveyPhotoPath[]> {
  const rootPrefix = buildSurveyPhotoStoragePath({
    kind: "question",
    campusId,
    schoolId,
    surveyType: "studios",
    roomId: "_",
    questionId: "_",
  })
    .split("/")
    .slice(0, 2)
    .join("/")

  const paths: string[] = []
  await walkJpegPaths(`${rootPrefix}/`, paths, 0)

  return paths
    .map((path) => parseSurveyPhotoStoragePath(path))
    .filter((parsed): parsed is NonNullable<typeof parsed> => parsed != null)
}
