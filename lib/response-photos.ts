import type { RoomQuestionResponse, RoomSurveySession } from "@aisd/shared"
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

/** Cloud/http photo URLs only — not in-browser data URLs. */
export function linkedPhotoUrls(
  response: Pick<RoomQuestionResponse, "photo" | "photos"> | null | undefined,
): string[] {
  return [
    ...new Set(
      normalizeResponsePhotos(response).filter(
        (photo) => photo.startsWith("http") && !isLocalPhotoDataUrl(photo),
      ),
    ),
  ]
}

export function roomHasLinkedPhotos(
  room: { responses?: Array<Pick<RoomQuestionResponse, "photo" | "photos">> } | null | undefined,
): boolean {
  return !!room?.responses?.some((response) => linkedPhotoUrls(response).length > 0)
}

export function linkedPhotoCount(
  room: { responses?: Array<Pick<RoomQuestionResponse, "photo" | "photos">> } | null | undefined,
): number {
  return (room?.responses ?? []).reduce((total, response) => total + linkedPhotoUrls(response).length, 0)
}

/** Keep dest answers; union cloud photo URLs from the other copy of the same room. */
export function mergeRoomLinkedPhotos(
  keep: RoomSurveySession,
  other: RoomSurveySession | null | undefined,
): RoomSurveySession {
  if (!other?.responses?.length) return keep
  const byId = new Map((keep.responses ?? []).map((response) => [response.questionId, { ...response }]))
  let changed = false
  for (const response of other.responses) {
    const photos = linkedPhotoUrls(response)
    const existing = byId.get(response.questionId)
    if (!existing) {
      if (!photos.length) continue
      byId.set(response.questionId, { ...response, photos })
      changed = true
      continue
    }
    const merged = [...new Set([...linkedPhotoUrls(existing), ...photos])]
    if (merged.length > linkedPhotoUrls(existing).length) {
      byId.set(response.questionId, { ...existing, photos: merged })
      changed = true
    }
  }
  return changed ? { ...keep, responses: [...byId.values()] } : keep
}
