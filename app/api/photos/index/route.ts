import { listSurveyPhotosForSchool } from "@/lib/photo-storage-server"
import type { ParsedSurveyPhotoPath } from "@/lib/photo-storage"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const campusId = searchParams.get("campusId")?.trim()
    const schoolId = searchParams.get("schoolId")?.trim()

    if (!campusId || !schoolId) {
      return Response.json({ error: "campusId and schoolId are required" }, { status: 400 })
    }

    const parsed: ParsedSurveyPhotoPath[] = await listSurveyPhotosForSchool(campusId, schoolId)
    return Response.json({ parsed })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photo index failed"
    const status = message.includes("not configured") || message.includes("Add SUPABASE") ? 503 : 500
    return Response.json({ error: message }, { status })
  }
}
