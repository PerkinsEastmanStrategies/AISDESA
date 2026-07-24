import type { RoomQuestionResponse } from "@aisd/shared"

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
    const photos = patch.photos.map((p) => p.trim()).filter(Boolean)
    return photos.length ? { photos } : {}
  }
  if (patch.photo !== undefined) {
    return patch.photo?.trim() ? { photos: [patch.photo.trim()] } : {}
  }
  const existingPhotos = normalizeResponsePhotos(existing)
  return existingPhotos.length ? { photos: existingPhotos } : {}
}
