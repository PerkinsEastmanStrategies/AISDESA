import { NextResponse } from "next/server"
import { DEFAULT_ROOM_NEIGHBORHOOD_CSV_URL } from "@/lib/room-neighborhood-lookup"

export const runtime = "nodejs"

function sheetUrl(): string {
  return process.env.NEXT_PUBLIC_ROOM_NEIGHBORHOOD_CSV_URL ?? DEFAULT_ROOM_NEIGHBORHOOD_CSV_URL
}

export async function GET() {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    const response = await fetch(sheetUrl(), {
      cache: "no-store",
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!response.ok) {
      return new NextResponse("", { status: 502 })
    }

    const text = await response.text()
    if (!text.trim() || text.trimStart().startsWith("<")) {
      return new NextResponse("", { status: 502 })
    }

    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    })
  } catch {
    return new NextResponse("", { status: 502 })
  }
}
