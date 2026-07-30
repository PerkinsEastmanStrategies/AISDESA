import { NextResponse } from "next/server"
import type { AisdSchoolOption, PreWalkState } from "@aisd/shared"
import {
  isSurveyDbConfigured,
  pullSchoolPreWalk,
  pushSchoolPreWalk,
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
    const preWalk = await pullSchoolPreWalk(schoolId)
    return NextResponse.json({ configured: true, preWalk })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pull failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

interface PrewalkSyncBody {
  school: AisdSchoolOption
  preWalk: PreWalkState
}

export async function POST(request: Request) {
  if (!isSurveyDbConfigured()) {
    return NextResponse.json({ configured: false, action: "offline" })
  }

  let body: PrewalkSyncBody
  try {
    body = (await request.json()) as PrewalkSyncBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body?.school?.id || !body.preWalk) {
    return NextResponse.json({ error: "school and preWalk are required" }, { status: 400 })
  }

  try {
    const result = await pushSchoolPreWalk({ school: body.school, preWalk: body.preWalk })
    return NextResponse.json({ configured: true, action: "pushed", ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
