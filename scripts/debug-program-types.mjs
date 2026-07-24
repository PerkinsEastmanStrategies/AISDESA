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

const rows = parseCsv((await (await fetch(url)).text()).replace(/^\uFEFF/, ""))
const header = rows[0].map((h) => h.trim())
const idx = Object.fromEntries(header.map((h, i) => [h.toLowerCase(), i]))

const types = new Map()
for (const row of rows.slice(1)) {
  const t = (row[idx["program type"]] ?? "").trim()
  if (!t) continue
  types.set(t, (types.get(t) ?? 0) + 1)
}
console.log("Unique program types:", types.size)
for (const [t, n] of [...types.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
  console.log(n, "|", t)
}

console.log("\nORTEGA samples:")
for (const row of rows.slice(1).filter((r) => r[idx.school_name] === "ORTEGA").slice(0, 15)) {
  console.log(row[idx.cafm_id], "|", row[idx["program type"]])
}
