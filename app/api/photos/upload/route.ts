import { uploadSurveyPhotoToSupabase } from "@/lib/photo-storage-server"
import type { SurveyPhotoUploadContext } from "@/lib/photo-storage"

export const runtime = "nodejs"

function isUploadContext(value: unknown): value is SurveyPhotoUploadContext {
  if (!value || typeof value !== "object") return false
  const ctx = value as Record<string, unknown>
  if (ctx.kind !== "question" && ctx.kind !== "prewalk-space-type") return false
  if (typeof ctx.campusId !== "string" || !ctx.campusId.trim()) return false
  if (typeof ctx.schoolId !== "string" || !ctx.schoolId.trim()) return false
  if (typeof ctx.surveyType !== "string" || !ctx.surveyType.trim()) return false
  return true
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SurveyPhotoUploadContext & { imageDataUrl?: string }
    if (!isUploadContext(body) || typeof body.imageDataUrl !== "string" || !body.imageDataUrl.startsWith("data:image/")) {
      return Response.json({ error: "Invalid photo upload request" }, { status: 400 })
    }

    const result = await uploadSurveyPhotoToSupabase(body, body.imageDataUrl)
    return Response.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photo upload failed"
    const status = message.includes("not configured") || message.includes("Add SUPABASE") ? 503 : 500
    return Response.json({ error: message }, { status })
  }
}
