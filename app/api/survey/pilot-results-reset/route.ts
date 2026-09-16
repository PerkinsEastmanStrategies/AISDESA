import { NextResponse } from "next/server"
import { isSurveyDbConfigured, wipePilotSubmissionSnapshots } from "@/lib/supabase-survey-db"

export async function POST(request: Request) {
  let schoolId = ""
  try {
    const body = (await request.json()) as { schoolId?: unknown }
    schoolId = typeof body?.schoolId === "string" ? body.schoolId.trim() : ""
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!schoolId) {
    return NextResponse.json({ error: "schoolId is required" }, { status: 400 })
  }

  if (!isSurveyDbConfigured()) {
    return NextResponse.json({ configured: false, ok: true })
  }

  try {
    await wipePilotSubmissionSnapshots(schoolId)
    return NextResponse.json({ configured: true, ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reset failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
