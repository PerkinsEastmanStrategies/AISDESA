/**
 * Match floor plan room ids against CSV room-use / neighborhood data for a school.
 * Usage: node scripts/debug-room-match.mjs ORTEGA
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

const schoolQuery = (process.argv[2] ?? "ORTEGA").toUpperCase()

const csvUrl =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQhjfsjsbDHT0eEKZifiNn67Wup9CfA4flEB3Mcx9tlNEO3-A8tTc7Vj50sI_SyE38nDjI3vUkqpUmd/pub?output=csv"

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      field = ""
      if (row.length > 1 || row[0] !== "") rows.push(row)
      row = []
    } else field += c
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function roomLookupKeys(rawId) {
  const id = rawId.trim()
  if (!id) return []
  const upper = id.toUpperCase()
  const collapsed = upper.replace(/\s+/g, "")
  const alnum = upper.replace(/[^A-Z0-9]/g, "")
  const keys = new Set([id, upper])
  if (collapsed) keys.add(collapsed)
  if (alnum) keys.add(alnum)
  if (/^\d+$/.test(id)) keys.add(String(Number.parseInt(id, 10)))
  return [...keys]
}

function normalizeSchoolLookupName(name) {
  return name.toUpperCase().replace(/\s+/g, " ").trim()
}

function schoolNamesMatch(csvSchoolName, appSchoolName) {
  const csv = normalizeSchoolLookupName(csvSchoolName)
  const app = normalizeSchoolLookupName(appSchoolName)
  if (!csv || !app) return false
  if (csv === app) return true
  const csvNoTa = csv.replace(/^TA\s+/, "")
  const appNoTa = app.replace(/^TA\s+/, "")
  if (csvNoTa === app || csv === appNoTa || csvNoTa === appNoTa) return true
  const csvLast = csv.split(/\s+/).pop() ?? ""
  if (csvLast.length >= 4 && csvLast === app) return true
  if (app.startsWith(`${csv} `) || app.startsWith(`${csv}-`)) return true
  if (csv.startsWith(`${app} `) || csv.startsWith(`${app}-`)) return true
  if (app.startsWith(csv) || csv.startsWith(app)) return true
  if (csv.replace(/T+$/, "") === app.replace(/T+$/, "")) return true
  return false
}

const geojson = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/aisd-schools.geojson"), "utf8"),
)
const schools = geojson.features
  .filter((f) => f.properties.CLASS !== "DISTRICT")
  .map((f) => ({
    id: f.properties.NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: f.properties.NAME,
    campusId: f.properties.CAMPUS_ID,
  }))

const appSchool =
  schools.find((s) => s.name.toUpperCase() === schoolQuery) ??
  schools.find((s) => s.name.toUpperCase().includes(schoolQuery))

console.log("APP SCHOOL:", appSchool ?? "NOT FOUND")

const csvText = await (await fetch(csvUrl)).text()
const rows = parseCsv(csvText.replace(/^\uFEFF/, ""))
const header = rows[0].map((h) => h.trim())
const idx = Object.fromEntries(header.map((h, i) => [h.toLowerCase(), i]))

const csvSchoolNames = [...new Set(rows.slice(1).map((r) => (r[idx.school_name] ?? "").trim()))]
const csvSchool =
  csvSchoolNames.find((n) => normalizeSchoolLookupName(n) === schoolQuery) ??
  csvSchoolNames.find((n) => appSchool && schoolNamesMatch(n, appSchool.name))

console.log("CSV SCHOOL:", csvSchool ?? "NOT FOUND")

if (!csvSchool) {
  console.log("\nSimilar CSV schools:")
  for (const n of csvSchoolNames.filter((n) => n.toUpperCase().includes(schoolQuery.slice(0, 4))).slice(0, 10)) {
    console.log(" ", n)
  }
  process.exit(0)
}

const csvRows = rows.slice(1).filter((r) => (r[idx.school_name] ?? "").trim() === csvSchool)
const roomUseMap = new Map()
const nbhMap = new Map()
for (const row of csvRows) {
  const cafmId = (row[idx.cafm_id] ?? "").trim()
  const roomName = (row[idx.name] ?? "").trim()
  const neighborhood = (row[idx.neighborhood] ?? "").trim().toUpperCase()
  const useName = roomName || cafmId
  if (useName) {
    const entry = { id: cafmId || roomName, useName }
    for (const key of roomLookupKeys(cafmId)) roomUseMap.set(key, entry)
    for (const key of roomLookupKeys(roomName)) roomUseMap.set(key, entry)
  }
  if (neighborhood) {
    for (const key of roomLookupKeys(cafmId)) nbhMap.set(key, neighborhood)
    for (const key of roomLookupKeys(roomName)) nbhMap.set(key, neighborhood)
  }
}

console.log(`CSV rows=${csvRows.length} roomUse keys=${roomUseMap.size} nbh keys=${nbhMap.size}`)

// Load match results if available
const matchFile = path.join(root, "scripts/floor-plan-match-results.json")
if (fs.existsSync(matchFile)) {
  const matchData = JSON.parse(fs.readFileSync(matchFile, "utf8"))
  const svgName = matchData.find?.((f) => f.toUpperCase().includes(schoolQuery.replace(/\s+/g, " ")))
  console.log("Match file hint:", svgName ?? "none")
}

console.log("\nSample CSV CAFM ids:", csvRows.slice(0, 15).map((r) => r[idx.cafm_id]).join(", "))

function roomUseForRoom(map, roomId) {
  for (const key of roomLookupKeys(roomId)) {
    const hit = map.get(key)
    if (hit) return hit
  }
  const target = roomId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (!target) return undefined
  for (const entry of map.values()) {
    const nameKey = entry.useName.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
    if (nameKey && nameKey === target) return entry
  }
  return undefined
}

// Simulate typical floor plan ids from CAFM labels
const simulatedIds = csvRows.slice(0, 40).map((r) => r[idx.cafm_id]).filter(Boolean)
let useHits = 0
let nbhHits = 0
for (const id of simulatedIds) {
  if (roomUseForRoom(roomUseMap, id)) useHits++
  if (roomLookupKeys(id).some((k) => nbhMap.has(k))) nbhHits++
}
console.log(`Self-match on first 40 CAFM ids: use=${useHits}/40 nbh=${nbhHits}/40`)
