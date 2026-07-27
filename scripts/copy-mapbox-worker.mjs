import { copyFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const source = join(root, "node_modules", "mapbox-gl", "dist", "mapbox-gl-csp-worker.js")
const target = join(root, "public", "mapbox-gl-csp-worker.js")

if (!existsSync(source)) {
  console.warn("[copy-mapbox-worker] mapbox-gl not installed; skipping worker copy")
  process.exit(0)
}

copyFileSync(source, target)
console.log("[copy-mapbox-worker] copied to public/mapbox-gl-csp-worker.js")
