import { NextResponse } from "next/server"
import {
  isSurveyDbConfigured,
  pullAllSurveyDrafts,
  pullSurveyDraftsForSchool,
} from "@/lib/supabase-survey-db"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const schoolId = searchParams.get("schoolId")?.trim()

  if (!isSurveyDbConfigured()) {
    return NextResponse.json({ configured: false, drafts: [] })
  }

  try {
    const drafts = schoolId ? await pullSurveyDraftsForSchool(schoolId) : await pullAllSurveyDrafts()
    return NextResponse.json({ configured: true, drafts })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pull failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
