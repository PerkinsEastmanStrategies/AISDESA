/** Supabase Storage public URL for a floor plan SVG filename. */
export function getSupabaseFloorPlanUrlForFilename(filename: string): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_FLOOR_PLANS_BUCKET
  if (!supabaseUrl || !bucket || !filename) return null

  const base = supabaseUrl.replace(/\/$/, "")
  return `${base}/storage/v1/object/public/${bucket}/${encodeURIComponent(filename)}`
}

export function getFloorPlanPublicPathForFilename(filename: string): string {
  return `/floor-plans/${encodeURIComponent(filename)}`
}

/** Desktop `Foo L1.svg` → mobile `Foo L1.mobile.svg`. */
export function toMobileFloorPlanFilename(filename: string): string {
  const trimmed = filename.trim()
  if (!trimmed) return trimmed
  if (/\.mobile\.svg$/i.test(trimmed)) return trimmed
  if (/\.svg$/i.test(trimmed)) return trimmed.replace(/\.svg$/i, ".mobile.svg")
  return `${trimmed}.mobile.svg`
}

export function preferMobileFloorPlan(): boolean {
  if (typeof window === "undefined") return false
  try {
    if (window.matchMedia("(max-width: 767px)").matches) return true
    if (window.matchMedia("(pointer: coarse)").matches) return true
  } catch {
    /* ignore */
  }
  const ua = navigator.userAgent
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return true
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1
}

/** Yield before heavy floor-plan work so picker/gate UI can settle (Safari memory). */
export function deferFloorPlanDisplayWork(delayMs: number = 300): Promise<void> {
  if (delayMs <= 0) return Promise.resolve()
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve(), { timeout: delayMs + 150 })
      return
    }
    setTimeout(resolve, delayMs)
  })
}

/**
 * Safari / iPad WebKit cannot paint blob: URLs in SVG <image>. Cache SVG text and
 * render via data: URL instead (keeps plan styles isolated from room overlay polygons).
 */
export function needsInlineFloorPlanSvg(): boolean {
  if (typeof window === "undefined") return false
  const ua = navigator.userAgent
  const isTouchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1
  if (/iPad|iPhone|iPod/i.test(ua) || isTouchMac) return true
  return /AppleWebKit/i.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome/i.test(ua)
}

const svgCache = new Map<string, string>()
const svgInflight = new Map<string, Promise<string | null>>()
const FLOOR_PLAN_CACHE_NAME = "aisd-floor-plans-v1"

async function openFloorPlanCache(): Promise<Cache | null> {
  if (typeof window === "undefined" || !("caches" in window)) return null
  try {
    return await caches.open(FLOOR_PLAN_CACHE_NAME)
  } catch {
    return null
  }
}

async function readCachedFloorPlan(url: string): Promise<string | null> {
  const cache = await openFloorPlanCache()
  if (!cache) return null

  try {
    const response = await cache.match(url)
    if (!response?.ok) return null
    return await response.text()
  } catch {
    return null
  }
}

async function writeCachedFloorPlan(url: string, svgText: string): Promise<void> {
  const cache = await openFloorPlanCache()
  if (!cache) return

  try {
    await cache.put(
      url,
      new Response(svgText, {
        headers: { "Content-Type": "image/svg+xml" },
      }),
    )
  } catch {
    // Quota exceeded or storage unavailable — memory cache still applies.
  }
}

async function fetchFloorPlanSvgFromSources(filename: string): Promise<string | null> {
  const sources = [
    getSupabaseFloorPlanUrlForFilename(filename),
    getFloorPlanPublicPathForFilename(filename),
  ].filter((url): url is string => Boolean(url))

  for (const url of sources) {
    const cached = await readCachedFloorPlan(url)
    if (cached) return cached
  }

  for (const url of sources) {
    try {
      const response = await fetch(url)
      if (!response.ok) continue

      const text = await response.text()
      void writeCachedFloorPlan(url, text)
      return text
    } catch {
      // Try the next source.
    }
  }

  return null
}

/** Drop parsed SVG text from the in-memory cache to reduce heap use. */
export function evictFloorPlanSvgFromMemoryCache(filename: string): void {
  if (!filename) return
  svgCache.delete(filename)
  svgCache.delete(toMobileFloorPlanFilename(filename))
}

export type FloorPlanSvgFetchResult = {
  text: string
  filename: string
}

export async function fetchFloorPlanSvgWithFilename(
  filename: string,
  options?: { preferMobile?: boolean; allowDesktopFallback?: boolean },
): Promise<FloorPlanSvgFetchResult | null> {
  if (!filename) return null

  const preferMobile = options?.preferMobile ?? preferMobileFloorPlan()
  const allowDesktopFallback =
    options?.allowDesktopFallback ?? !preferMobile
  const candidates =
    preferMobile && !/\.mobile\.svg$/i.test(filename)
      ? allowDesktopFallback
        ? [toMobileFloorPlanFilename(filename), filename]
        : [toMobileFloorPlanFilename(filename)]
      : [filename]

  for (const candidate of candidates) {
    const cached = svgCache.get(candidate)
    if (cached) return { text: cached, filename: candidate }

    let inflight = svgInflight.get(candidate)
    if (!inflight) {
      inflight = fetchFloorPlanSvgFromSources(candidate).finally(() => {
        svgInflight.delete(candidate)
      })
      svgInflight.set(candidate, inflight)
    }

    const svg = await inflight
    if (svg) {
      svgCache.set(candidate, svg)
      return { text: svg, filename: candidate }
    }
  }

  return null
}

export async function fetchFloorPlanSvgByFilename(
  filename: string,
  options?: { preferMobile?: boolean; allowDesktopFallback?: boolean },
): Promise<string | null> {
  const result = await fetchFloorPlanSvgWithFilename(filename, options)
  return result?.text ?? null
}

/** Warm the cache for other floors without blocking the UI. */
export function prefetchFloorPlanSvgs(
  filenames: string[],
  options?: { preferMobile?: boolean },
): void {
  const preferMobile = options?.preferMobile ?? preferMobileFloorPlan()
  for (const filename of filenames) {
    if (!filename) continue
    void fetchFloorPlanSvgByFilename(filename, { preferMobile })
  }
}
