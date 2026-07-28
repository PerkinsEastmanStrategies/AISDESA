import "server-only"

export function supabaseProjectUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured")
  return url.replace(/\/$/, "")
}

export function supabaseServiceKey(): string {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!key) {
    throw new Error(
      "Add SUPABASE_SERVICE_ROLE_KEY (recommended) or NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local",
    )
  }
  return key
}

export function isSupabaseServerConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim())
  )
}

function restHeaders(prefer?: string): HeadersInit {
  const key = supabaseServiceKey()
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  }
}

export async function supabaseRestSelect<T>(
  table: string,
  query: string,
): Promise<T[]> {
  const url = `${supabaseProjectUrl()}/rest/v1/${table}?${query}`
  const response = await fetch(url, {
    method: "GET",
    headers: restHeaders(),
    cache: "no-store",
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(detail || `Supabase select failed (${response.status})`)
  }
  return (await response.json()) as T[]
}

export async function supabaseRestUpsert<T extends object>(
  table: string,
  rows: T | T[],
  onConflict: string,
): Promise<T[]> {
  const url = `${supabaseProjectUrl()}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`
  const response = await fetch(url, {
    method: "POST",
    headers: restHeaders("resolution=merge-duplicates,return=representation"),
    body: JSON.stringify(rows),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(detail || `Supabase upsert failed (${response.status})`)
  }
  const data = await response.json()
  return (Array.isArray(data) ? data : [data]) as T[]
}

export async function supabaseRestInsert<T extends object>(
  table: string,
  rows: T | T[],
): Promise<T[]> {
  const url = `${supabaseProjectUrl()}/rest/v1/${table}`
  const response = await fetch(url, {
    method: "POST",
    headers: restHeaders("return=representation"),
    body: JSON.stringify(rows),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(detail || `Supabase insert failed (${response.status})`)
  }
  const data = await response.json()
  return (Array.isArray(data) ? data : [data]) as T[]
}

export async function supabaseRestDelete(table: string, query: string): Promise<void> {
  const url = `${supabaseProjectUrl()}/rest/v1/${table}?${query}`
  const response = await fetch(url, {
    method: "DELETE",
    headers: restHeaders(),
  })
  if (!response.ok && response.status !== 404) {
    const detail = await response.text().catch(() => "")
    throw new Error(detail || `Supabase delete failed (${response.status})`)
  }
}
