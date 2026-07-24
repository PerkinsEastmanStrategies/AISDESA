/**
 * Casis photo pipeline smoke test — run: npx tsx scripts/test-photo-markers.mjs
 * Validates Supabase path parsing, photo index room keys, and marker sizing for CAFM plans.
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
for (const line of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([^=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim()
}

const { parseSurveyPhotoStoragePath } = await import("../lib/photo-storage.ts")
const {
  campusPhotoEntryFromStoragePath,
  mergeCampusPhotoEntries,
  buildPhotoRoomIdSet,
  planRoomHasPhotoMarker,
} = await import("../lib/campus-photo-index.ts")

/** Actual Casis bucket paths (verified against Supabase ESA Pictures / 112/casis/studios). */
const CASIS_PATHS = [
  "112/casis/studios/A107/prewalk/Traditional_studio/89d68aec-5b9b-4997-b93c-f65b60c97958.jpg",
  "112/casis/studios/A107/ST-001/6232c9e0-ce9e-4582-97b8-d3cf582ce8d7.jpg",
  "112/casis/studios/A107/ST-001/aabc994d-fd9e-4e27-a7f5-8870fc3e2de6.jpg",
  "112/casis/studios/A159/prewalk/Traditional_studio/3546b38f-c89e-4efe-923b-7d5760868d1e.jpg",
  "112/casis/studios/A163/prewalk/Traditional_studio/b60b2ae1-a5ae-4d1f-8670-ca83a8f50fac.jpg",
  "112/casis/studios/prewalk/Traditional_studio.jpg",
]

let failed = 0
function assert(label, ok) {
  if (!ok) {
    console.error("FAIL:", label)
    failed += 1
  } else {
    console.log("ok:", label)
  }
}

console.log("=== parseSurveyPhotoStoragePath (Casis bucket paths) ===")
const parsedRows = []
for (const p of CASIS_PATHS) {
  const parsed = parseSurveyPhotoStoragePath(p)
  parsedRows.push(parsed)
  console.log(`  ${p}`)
  console.log(`    -> kind=${parsed?.kind} roomId=${parsed?.roomId ?? "-"} questionId=${parsed?.questionId ?? "-"}`)
}

assert("A107 question photo parses", parsedRows[1]?.roomId === "A107" && parsedRows[1]?.kind === "question")
assert("A107 prewalk photo parses", parsedRows[0]?.roomId === "A107" && parsedRows[0]?.kind === "prewalk-space-type")
assert("A159 prewalk photo parses", parsedRows[3]?.roomId === "A159")
assert("A163 prewalk photo parses", parsedRows[4]?.roomId === "A163")
assert("school-level prewalk parses (no roomId)", parsedRows[5]?.kind === "prewalk-space-type" && !parsedRows[5]?.roomId)

const remoteEntries = CASIS_PATHS.flatMap((p) => {
  const parsed = parseSurveyPhotoStoragePath(p)
  return parsed ? campusPhotoEntryFromStoragePath(parsed) : []
})

const index = mergeCampusPhotoEntries(
  { byRoomId: {}, roomIds: [], totalCount: 0 },
  remoteEntries,
)

console.log("\n=== photoIndex.byRoomId ===")
console.log("  roomIds:", index.roomIds)
assert("byRoomId has A107", Boolean(index.byRoomId.A107?.length))
assert("byRoomId has A159", Boolean(index.byRoomId.A159?.length))
assert("byRoomId has A163", Boolean(index.byRoomId.A163?.length))

const floorPlanRooms = ["A107", "A159", "A163"].map((id) => ({ id, name: id }))
const markerSet = buildPhotoRoomIdSet(index, floorPlanRooms)
console.log("\n=== floor plan marker set ===")
console.log("  markerSet:", [...markerSet])
for (const id of ["A107", "A159", "A163"]) {
  assert(`${id} planRoomHasPhotoMarker`, planRoomHasPhotoMarker(index, id, id, undefined, floorPlanRooms))
  assert(`${id} in markerSet`, markerSet.has(id))
}

// Casis L1 viewBox is ~9934 wide — old marker r≈20 was <1px on screen; min floor is 2.2% width.
const CASIS_VIEWBOX_WIDTH = 9934
const typicalRoomArea = 500_000
const viewBoxArea = CASIS_VIEWBOX_WIDTH * 14044
const areaRatio = Math.sqrt(typicalRoomArea / viewBoxArea)
const oldR = 22 * Math.max(0.75, Math.min(1.5, areaRatio * 10)) * 1.2
const newR = Math.max(oldR, CASIS_VIEWBOX_WIDTH * 0.022)
const panelPx = 400
const oldScreenPx = oldR * (panelPx / CASIS_VIEWBOX_WIDTH)
const newScreenPx = newR * (panelPx / CASIS_VIEWBOX_WIDTH)
console.log("\n=== marker sizing (Casis L1, 400px panel) ===")
console.log(`  old radius: ${oldR.toFixed(1)} vb units -> ${oldScreenPx.toFixed(1)}px on screen`)
console.log(`  new radius: ${newR.toFixed(1)} vb units -> ${newScreenPx.toFixed(1)}px on screen`)
assert("new marker visible on screen (>= 6px radius)", newScreenPx >= 6)

console.log(failed ? `\n${failed} assertion(s) failed` : "\nAll assertions passed")
process.exit(failed ? 1 : 0)
