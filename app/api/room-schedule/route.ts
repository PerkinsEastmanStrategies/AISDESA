import { NextResponse } from "next/server"
import { isSupabaseServerConfigured, supabaseRestSelect } from "@/lib/supabase-rest"

export const runtime = "nodejs"

export type RoomScheduleDbRow = {
  campus_id: string
  school_name: string
  cafm_id: string
  building_label: string | null
  name: string | null
  neighborhood: string | null
  area: string | null
  program_type: string | null
  sf_deviation: string | null
  room_name_unsure: string | null
}

const PAGE_SIZE = 1000

export async function GET() {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ rows: [] as RoomScheduleDbRow[] })
  }

  try {
    const rows: RoomScheduleDbRow[] = []
    let offset = 0
    while (true) {
      const page = await supabaseRestSelect<RoomScheduleDbRow>(
        "roomschedule",
        [
          "select=campus_id,school_name,cafm_id,building_label,name,neighborhood,area,program_type,sf_deviation,room_name_unsure",
          "order=campus_id,cafm_id",
          `limit=${PAGE_SIZE}`,
          `offset=${offset}`,
        ].join("&"),
      )
      if (!Array.isArray(page) || page.length === 0) break
      rows.push(...page)
      if (page.length < PAGE_SIZE) break
      offset += PAGE_SIZE
      if (offset > 50_000) break
    }
    return NextResponse.json({ rows })
  } catch {
    return NextResponse.json({ rows: [] as RoomScheduleDbRow[] })
  }
}
