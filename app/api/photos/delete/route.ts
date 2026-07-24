import { deleteSurveyPhotoFromSupabase } from "@/lib/photo-storage-server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string }
    if (!body.url || typeof body.url !== "string") {
      return Response.json({ error: "Missing photo URL" }, { status: 400 })
    }

    await deleteSurveyPhotoFromSupabase(body.url)
    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photo delete failed"
    return Response.json({ error: message }, { status: 500 })
  }
}
