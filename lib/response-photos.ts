import type { RoomQuestionResponse } from "@aisd/shared"
import { isLocalPhotoDataUrl, isSupabasePhotoUrl } from "@/lib/photo-storage"

/** Keep only Supabase URLs after a successful upload — drops local data URLs from memory/draft. */
export function photosAfterCloudUpload(existing: string[], uploadedUrl: string): string[] {
  const cloud = existing
    .map((photo) => photo.trim())
    .filter((photo) => isSupabasePhotoUrl(photo))
  const url = uploadedUrl.trim()
  if (isSupabasePhotoUrl(url) && !cloud.includes(url)) cloud.push(url)
  return cloud
}

/** Remove embedded data URLs when cloud URLs are present (e.g. after sync). */
export function stripLocalPhotosWhenCloudPresent(photos: string[]): string[] {
  const trimmed = photos.map((photo) => photo.trim()).filter(Boolean)
  const cloud = trimmed.filter((photo) => isSupabasePhotoUrl(photo))
  if (cloud.length > 0) return cloud
  return trimmed.filter((photo) => isLocalPhotoDataUrl(photo) || !photo.startsWith("data:"))
}

/** Normalize legacy single `photo` and new `photos[]` into one array. */
export function normalizeResponsePhotos(
  response: Pick<RoomQuestionResponse, "photo" | "photos"> | null | undefined,
): string[] {
  if (!response) return []
  if (response.photos?.length) {
    return response.photos.map((p) => p.trim()).filter(Boolean)
  }
  if (response.photo?.trim()) return [response.photo.trim()]
  return []
}

/** Merge photo fields when patching a question response — always stores `photos[]`. */
export function mergeResponsePhotoFields(
  existing: RoomQuestionResponse | undefined,
  patch: Partial<RoomQuestionResponse>,
): Pick<RoomQuestionResponse, "photos"> | Record<string, never> {
  if (patch.photos !== undefined) {
    const photos = stripLocalPhotosWhenCloudPresent(patch.photos)
    return photos.length ? { photos } : {}
  }
  if (patch.photo !== undefined) {
    return patch.photo?.trim() ? { photos: [patch.photo.trim()] } : {}
  }
  const existingPhotos = normalizeResponsePhotos(existing)
  return existingPhotos.length ? { photos: existingPhotos } : {}
}
