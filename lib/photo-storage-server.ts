import "server-only"

import {
  buildSurveyPhotoStoragePath,
  getSupabasePhotoPublicUrl,
  photosBucketName,
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
  const path = buildSurveyPhotoStoragePath(context)
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
      "x-upsert": "true",
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
