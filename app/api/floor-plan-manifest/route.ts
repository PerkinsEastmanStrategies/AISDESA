import { NextResponse } from "next/server"
import { isSupabaseServerConfigured, supabaseRestSelect } from "@/lib/supabase-rest"

export const runtime = "nodejs"

export type FloorPlanManifestDbRow = {
  campus_id: string
  school_name: string
  school_class: string | null
  floor_level_id: string
  floor_label: string
  filename: string
  mobile_filename: string | null
}

export async function GET() {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ rows: [] as FloorPlanManifestDbRow[] })
  }

  try {
    const rows = await supabaseRestSelect<FloorPlanManifestDbRow>(
      "floor_plan_manifest",
      [
        "select=campus_id,school_name,school_class,floor_level_id,floor_label,filename,mobile_filename",
        "order=campus_id,floor_level_id",
        "limit=5000",
      ].join("&"),
    )
    return NextResponse.json({ rows: Array.isArray(rows) ? rows : [] })
  } catch {
    return NextResponse.json({ rows: [] as FloorPlanManifestDbRow[] })
  }
}
