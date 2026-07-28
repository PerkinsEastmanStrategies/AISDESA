import { NextResponse } from "next/server"
import type { AisdSchoolOption, SurveyType } from "@aisd/shared"
import {
  isSurveyDbConfigured,
  pullSurveyDraft,
  pushSurveyDraft,
} from "@/lib/supabase-survey-db"
import type { PersistedSurveyDraft } from "@/lib/survey-persistence"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const schoolId = searchParams.get("schoolId")?.trim()
  const surveyType = searchParams.get("surveyType")?.trim() as SurveyType | undefined

  if (!schoolId || !surveyType) {
    return NextResponse.json({ error: "schoolId and surveyType are required" }, { status: 400 })
  }

  if (!isSurveyDbConfigured()) {
    return NextResponse.json({ configured: false, draft: null })
  }

  try {
    const draft = await pullSurveyDraft({ schoolId, surveyType })
    return NextResponse.json({ configured: true, draft })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pull failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

interface SyncBody {
  school: AisdSchoolOption
  draft: PersistedSurveyDraft
  writeSnapshot?: boolean
}

export async function POST(request: Request) {
  if (!isSurveyDbConfigured()) {
    return NextResponse.json({ configured: false, action: "offline" })
  }

  let body: SyncBody
  try {
    body = (await request.json()) as SyncBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body?.school?.id || !body?.draft?.schoolId || !body?.draft?.surveyType || !body?.draft?.session) {
    return NextResponse.json({ error: "school and draft are required" }, { status: 400 })
  }

  try {
    const result = await pushSurveyDraft({
      school: body.school,
      draft: body.draft,
      writeSnapshot: !!body.writeSnapshot,
    })
    return NextResponse.json({ configured: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
