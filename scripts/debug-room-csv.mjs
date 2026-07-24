const url =
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

const res = await fetch(url, { cache: "no-store" })
console.log("HTTP", res.status, res.statusText)
const text = await res.text()
const rows = parseCsv(text.replace(/^\uFEFF/, ""))
const header = rows[0].map((h) => h.trim())
console.log("COLUMNS:", header)
console.log("ROW COUNT:", rows.length - 1)

const idx = Object.fromEntries(header.map((h, i) => [h.toLowerCase(), i]))
console.log("INDEX:", idx)

const schools = new Map()
for (const row of rows.slice(1)) {
  const school = (row[idx.school_name] ?? "").trim()
  if (!school) continue
  const cur = schools.get(school) ?? { rows: 0, withNbh: 0, withCafm: 0, withName: 0 }
  cur.rows++
  if ((row[idx.neighborhood] ?? "").trim()) cur.withNbh++
  if ((row[idx.cafm_id] ?? "").trim()) cur.withCafm++
  if (idx.name >= 0 && (row[idx.name] ?? "").trim()) cur.withName++
  schools.set(school, cur)
}

const sorted = [...schools.entries()].sort((a, b) => b[1].rows - a[1].rows)
console.log("\nTOP SCHOOLS:")
for (const [name, stats] of sorted.slice(0, 15)) {
  console.log(
    `${name}: rows=${stats.rows} nbh=${stats.withNbh} cafm=${stats.withCafm} name=${stats.withName}`,
  )
}

// Sample DAVIS if present
for (const [name] of sorted) {
  if (/DAVIS/i.test(name)) {
    console.log(`\nSAMPLE ROWS FOR ${name}:`)
    for (const row of rows.slice(1).filter((r) => (r[idx.school_name] ?? "").trim() === name).slice(0, 8)) {
      console.log({
        cafm: row[idx.cafm_id],
        name: row[idx.name],
        nbh: row[idx.neighborhood],
        program: row[idx["program type"]],
      })
    }
    break
  }
}

for (const target of ["DAVIS", "ALLISON", "BRYKER", "COWAN"]) {
  const match = sorted.find(([name]) => name.toUpperCase().includes(target))
  console.log(`\nLOOKUP ${target}:`, match ? match[0] : "NOT FOUND")
}

if (sorted.some(([name]) => name === "ORTEGA")) {
  console.log("\nORTEGA sample cafm ids:")
  for (const row of rows.slice(1).filter((r) => (r[idx.school_name] ?? "").trim() === "ORTEGA").slice(0, 12)) {
    console.log(row[idx.cafm_id], "|", row[idx.name], "| nbh:", row[idx.neighborhood])
  }
}
