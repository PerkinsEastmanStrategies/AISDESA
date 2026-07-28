import { NextResponse } from "next/server"
import type { SurveyType } from "@aisd/shared"
import { fetchRemoteSurveyStatus, isSurveyDbConfigured } from "@/lib/supabase-survey-db"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const schoolId = searchParams.get("schoolId")?.trim()
  const surveyType = searchParams.get("surveyType")?.trim() as SurveyType | undefined
  const assessorEmail = searchParams.get("assessorEmail")?.trim() ?? null

  if (!schoolId || !surveyType) {
    return NextResponse.json({ error: "schoolId and surveyType are required" }, { status: 400 })
  }

  if (!isSurveyDbConfigured()) {
    return NextResponse.json({
      configured: false,
      hasRemote: false,
      conflict: false,
    })
  }

  try {
    const status = await fetchRemoteSurveyStatus({ schoolId, surveyType, assessorEmail })
    return NextResponse.json(status)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status check failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
