import { NextResponse } from "next/server"
import type { AisdSchoolOption, PreWalkState } from "@aisd/shared"
import {
  isSurveyDbConfigured,
  pullPrewalkForSchool,
  pushPrewalkOnly,
} from "@/lib/supabase-survey-db"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const schoolId = searchParams.get("schoolId")?.trim()

  if (!schoolId) {
    return NextResponse.json({ error: "schoolId is required" }, { status: 400 })
  }

  if (!isSurveyDbConfigured()) {
    return NextResponse.json({ configured: false, preWalk: null })
  }

  try {
    const preWalk = await pullPrewalkForSchool(schoolId)
    return NextResponse.json({ configured: true, preWalk })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pull failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

interface PrewalkBody {
  school: AisdSchoolOption
  preWalk: PreWalkState
  deletions?: Array<{ surveyType: string; roomId: string }>
}

export async function POST(request: Request) {
  if (!isSurveyDbConfigured()) {
    return NextResponse.json({ configured: false, action: "offline" as const })
  }

  let body: PrewalkBody
  try {
    body = (await request.json()) as PrewalkBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body?.school?.id || !body.preWalk) {
    return NextResponse.json({ error: "school and preWalk are required" }, { status: 400 })
  }

  try {
    const result = await pushPrewalkOnly({
      school: body.school,
      preWalk: body.preWalk,
      deletions: body.deletions,
    })
    return NextResponse.json({ configured: true, action: "pushed" as const, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pre-walk sync failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
