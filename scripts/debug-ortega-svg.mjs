const url =
  "https://mgflyiwrzcmxxuxpfotk.supabase.co/storage/v1/object/public/floor-plans/ORTEGA%20ES.svg"
const svg = await (await fetch(url)).text()
const dataK = [...svg.matchAll(/data-k="([^"]+)"/gi)].map((m) => m[1])
const dataI = [...svg.matchAll(/data-i="([^"]+)"/gi)].map((m) => m[1])
console.log("data-k count", dataK.length, "sample", dataK.slice(0, 15))
console.log("data-i count", dataI.length, "sample", dataI.slice(0, 15))
console.log("has CAFM_ID", svg.includes("CAFM_ID"))
console.log("has CAFM_SPACE", svg.includes("CAFM_SPACE"))

const csvUrl =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQhjfsjsbDHT0eEKZifiNn67Wup9CfA4flEB3Mcx9tlNEO3-A8tTc7Vj50sI_SyE38nDjI3vUkqpUmd/pub?output=csv"
const csv = await (await fetch(csvUrl)).text()
const cafmIds = new Set()
for (const line of csv.split(/\r?\n/).slice(1)) {
  if (!line.startsWith("ORTEGA,")) continue
  cafmIds.add(line.split(",")[1]?.trim())
}

const texts = [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/gi)]
  .map((m) => m[1].trim())
  .filter(Boolean)
console.log("text count", texts.length)
console.log("text sample", texts.slice(0, 40))

const keys = new Set(texts.map((t) => t.toUpperCase().replace(/\s+/g, "")))
let textHits = 0
for (const id of cafmIds) {
  if (keys.has(id.toUpperCase().replace(/\s+/g, ""))) textHits++
}
console.log("text label hits against csv cafm ids", textHits, "/", cafmIds.size)
