const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev"
const BUILD_REF = process.env.NEXT_PUBLIC_BUILD_REF ?? "local"
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? ""

export const BUILD_COMMIT_URL =
  BUILD_SHA !== "dev"
    ? `https://github.com/PerkinsEastmanStrategies/AISDESA/commit/${BUILD_SHA}`
    : null

function formatBuildDate(iso: string): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Short label for profile menu, e.g. "Build 256389f · Aug 11, 8:32 AM" */
export function buildVersionLabel(): string {
  const shortSha = BUILD_SHA.slice(0, 7)
  const parts = [`Build ${shortSha}`]
  if (BUILD_REF && BUILD_REF !== "local" && BUILD_REF !== "main") {
    parts.push(BUILD_REF)
  }
  const builtAt = BUILD_TIME ? formatBuildDate(BUILD_TIME) : null
  if (builtAt) parts.push(builtAt)
  return parts.join(" · ")
}
