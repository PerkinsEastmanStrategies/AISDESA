import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = dirname(fileURLToPath(import.meta.url))

function resolveBuildSha() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA

  const gitCandidates = ["git"]
  const bundledGit = join(projectRoot, ".tools", "MinGit", "cmd", "git.exe")
  if (existsSync(bundledGit)) gitCandidates.unshift(bundledGit)

  for (const git of gitCandidates) {
    try {
      return execSync(`"${git}" rev-parse HEAD`, {
        encoding: "utf8",
        cwd: projectRoot,
      }).trim()
    } catch {
      /* try next git binary */
    }
  }

  return "dev"
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@aisd/shared", "mapbox-gl"],
  env: {
    NEXT_PUBLIC_BUILD_SHA: resolveBuildSha(),
    NEXT_PUBLIC_BUILD_REF: process.env.VERCEL_GIT_COMMIT_REF ?? "local",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
}

export default nextConfig
