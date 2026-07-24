/** Find neighborhood map keys that could cause broad false matches. */
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

const schoolQuery = (process.argv[2] ?? "UPHAUS").toUpperCase()
const csvText = await (await fetch(csvUrl)).text()
const rows = parseCsv(csvText.replace(/^\uFEFF/, ""))
const header = rows[0].map((h) => h.trim())
const idx = Object.fromEntries(header.map((h, i) => [h.toLowerCase(), i]))

const schoolNames = [...new Set(rows.slice(1).map((r) => (r[idx.school_name] ?? "").trim()))]
const csvSchool =
  schoolNames.find((n) => n.toUpperCase() === schoolQuery) ??
  schoolNames.find((n) => n.toUpperCase().includes(schoolQuery))

console.log("School:", csvSchool ?? "NOT FOUND")
if (!csvSchool) process.exit(0)

const csvRows = rows.slice(1).filter((r) => (r[idx.school_name] ?? "").trim() === csvSchool)
const map = new Map()
const keySources = new Map()

for (const row of csvRows) {
  const cafmId = (row[idx.cafm_id] ?? "").trim()
  const roomName = (row[idx.name] ?? "").trim()
  const neighborhood = (row[idx.neighborhood] ?? "").trim().toUpperCase()
  if (!neighborhood) continue
  for (const key of roomLookupKeys(cafmId)) {
    map.set(key, neighborhood)
    keySources.set(key, { from: "cafm", cafmId, roomName, neighborhood })
  }
  for (const key of roomLookupKeys(roomName)) {
    map.set(key, neighborhood)
    keySources.set(key, { from: "name", cafmId, roomName, neighborhood })
  }
}

const nbh4 = [...map.entries()].filter(([, v]) => v === "4")
console.log(`Neighborhood 4 keys (${nbh4.length}):`)
for (const [key] of nbh4.slice(0, 40)) {
  console.log(`  ${JSON.stringify(key)} <-`, keySources.get(key))
}

const short = nbh4.filter(([k]) => k.length <= 4)
console.log(`\nShort keys pointing to nbh 4 (${short.length}):`, short.map(([k]) => k).join(", "))
