import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(__dirname, "..")

const SCHOOL = {
  schoolName: "CASIS",
  schoolDisplayName: "Casis Elementary School",
  schoolLevel: "Elementary School",
  classCode: "ELEM",
  campusId: "112",
  schoolId: "casis",
  address: "2710 EXPOSITION BLVD.",
  city: "AUSTIN",
  state: "TX",
  zip: "78703",
}

const FLOORS = [
  {
    levelId: "LB",
    levelLabel: "Basement",
    levelOrder: 0,
    filename: "CASIS ES LB.svg",
    sources: [
      "C:/Users/p.davis/Downloads/CASIS ES LB.svg",
      "C:/Users/p.davis/Downloads/OneDrive_1_7-9-2026/CASIS ES LB.svg",
    ],
  },
  {
    levelId: "L1",
    levelLabel: "Floor 1",
    levelOrder: 1,
    filename: "CASIS ES L1.svg",
    sources: [
      "C:/Users/p.davis/Downloads/CASIS ES L1.svg",
      "C:/Users/p.davis/Downloads/OneDrive_1_7-9-2026/CASIS ES L1.svg",
    ],
  },
  {
    levelId: "L2",
    levelLabel: "Floor 2",
    levelOrder: 2,
    filename: "CASIS ES L2.svg",
    sources: [
      "C:/Users/p.davis/Downloads/CASIS ES L2.svg",
      "C:/Users/p.davis/Downloads/OneDrive_1_7-9-2026/CASIS ES L2.svg",
    ],
  },
]

function decodeXml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/** Extract the inner markup of `<g id="CAFM_ID" ...>...</g>` with nested groups. */
function extractGroupInnerById(svgText, groupId) {
  const startRe = new RegExp(`<g\\b[^>]*\\bid=["']${groupId}["'][^>]*>`, "i")
  const start = startRe.exec(svgText)
  if (!start) return null
  let i = start.index + start[0].length
  let depth = 1
  while (i < svgText.length && depth > 0) {
    const nextOpen = svgText.indexOf("<g", i)
    const nextClose = svgText.indexOf("</g>", i)
    if (nextClose === -1) return null
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1
      i = nextOpen + 2
    } else {
      depth -= 1
      if (depth === 0) return svgText.slice(start.index + start[0].length, nextClose)
      i = nextClose + 4
    }
  }
  return null
}

function flattenTextContent(inner) {
  // Keep character data from text/tspan; drop tags. Handles CAFM "A1" + tspan "17" => "A117".
  return decodeXml(inner.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
}

function extractTransformTranslate(attrs) {
  const m = attrs.match(/transform=["']([^"']+)["']/i)
  if (!m) return { x: "", y: "" }
  const t = m[1]
  const matrix = t.match(/matrix\(([^)]+)\)/i)
  if (matrix) {
    const parts = matrix[1].split(/[,\s]+/).map(Number)
    if (parts.length >= 6 && parts.every((n) => Number.isFinite(n))) {
      return { x: parts[4], y: parts[5] }
    }
  }
  const translate = t.match(/translate\(([^)]+)\)/i)
  if (translate) {
    const parts = translate[1].split(/[,\s]+/).map(Number)
    return {
      x: Number.isFinite(parts[0]) ? parts[0] : "",
      y: Number.isFinite(parts[1]) ? parts[1] : "",
    }
  }
  return { x: "", y: "" }
}

function extractTextLabels(svgText) {
  const labels = []
  const cafmInner = extractGroupInnerById(svgText, "CAFM_ID")
  const scope = cafmInner ?? svgText

  // Labels are often wrapped: <g transform="..."><text>...</text></g>
  const blockRe = /<g\b([^>]*)>([\s\S]*?)<\/g>/gi
  let block
  let matchedBlocks = 0
  while ((block = blockRe.exec(scope))) {
    const attrs = block[1]
    const inner = block[2]
    if (!/<text\b/i.test(inner)) continue
    // Only leaf groups that directly contain text (avoid outer wrappers)
    if (/<g\b/i.test(inner)) continue
    const textMatch = /<text\b[^>]*>([\s\S]*?)<\/text>/i.exec(inner)
    if (!textMatch) continue
    const roomId = flattenTextContent(textMatch[1])
    if (!roomId) continue
    const { x, y } = extractTransformTranslate(attrs)
    labels.push({ roomId, x, y })
    matchedBlocks += 1
  }

  // Fallback: plain <text> nodes if no wrapped groups matched
  if (matchedBlocks === 0) {
    const textRe = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi
    let m
    while ((m = textRe.exec(scope))) {
      const roomId = flattenTextContent(m[2])
      if (!roomId) continue
      const x = Number((m[1].match(/\bx=["']([^"']+)["']/) || [])[1])
      const y = Number((m[1].match(/\by=["']([^"']+)["']/) || [])[1])
      labels.push({
        roomId,
        x: Number.isFinite(x) ? x : "",
        y: Number.isFinite(y) ? y : "",
      })
    }
  }

  return labels
}

function extractDataKRooms(svgText) {
  const rooms = []
  const re = /<(?:polygon|path|rect|g)\b([^>]*\bdata-k=["']([^"']+)["'][^>]*)>/gi
  let m
  while ((m = re.exec(svgText))) {
    const attrs = m[1]
    const key = decodeXml(m[2]).trim()
    if (!key) continue
    const building = (attrs.match(/\bdata-building=["']([^"']+)["']/) || [])[1] || ""
    rooms.push({ roomId: key, building: decodeXml(building) })
  }
  return rooms
}

function roomDisplayName(id) {
  const upper = id.toUpperCase()
  if (upper === "GYM") return "Gymnasium"
  if (upper.startsWith("KIT")) return "Kitchen"
  if (upper.startsWith("CAFE")) return "Cafeteria"
  if (/^COR(?!E)/.test(upper)) return `Corridor ${id}`
  if (/^[A-E]-\d/.test(upper)) return `Classroom ${id}`
  if (/^[A-Z]\d{2,4}(\.\d+)?[A-Z]?$/.test(upper)) return `Classroom ${id}`
  if (/^S\d+-[A-Z]/.test(upper)) return `Classroom ${id}`
  if (/^[ENW]\d{1,2}$/.test(upper)) return `Classroom ${id}`
  if (/^CORE\d*$/.test(upper)) return `Core ${id}`
  if (/^\d{2,4}(\.\d+)?[A-Z]?$/.test(upper)) return `Room ${id}`
  if (upper === "ART") return "Art"
  if (upper === "MUSIC" || upper.startsWith("MUSIC")) return "Music"
  if (upper === "LIBRARY" || upper.startsWith("LIB")) return "Library"
  if (/(RR|HRR)$/.test(upper) || upper.includes("RR")) return `Restroom ${id}`
  if (/(STO)$/.test(upper) || upper.includes("STO")) return `Storage ${id}`
  return id.replace(/_/g, " ")
}

function classifyRoom(id) {
  const upper = id.toUpperCase()
  if (/^[A-Z]\d{2,4}([A-Z]|\.\d+)?$/.test(upper)) return "classroom_like"
  if (/^[A-E]-\d/.test(upper)) return "classroom_like"
  if (/^[ENW]\d{1,2}$/.test(upper)) return "classroom_like"
  if (/^COR(?!E)/.test(upper)) return "corridor"
  if (/(RR|HRR)$/.test(upper) || upper.includes("RR")) return "restroom"
  if (/(STO)$/.test(upper) || upper.includes("STO")) return "storage"
  if (upper.includes("STAIR") || /^A-ST\d/.test(upper) || /^ST\d/.test(upper)) return "stair"
  if (upper.includes("ELEV") || /-EL\d/.test(upper) || /-E\d/.test(upper)) return "elevator"
  if (upper === "GYM" || upper.startsWith("GYM")) return "gym"
  if (upper.startsWith("LIB") || upper === "LIBRARY") return "library"
  if (upper.startsWith("CAFE") || upper.startsWith("KIT")) return "food_service"
  if (upper === "ART" || upper.startsWith("MUSIC")) return "specialty"
  return "other"
}

function csvEscape(value) {
  const s = String(value ?? "")
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function resolveSource(sources) {
  for (const p of sources) {
    if (fs.existsSync(p)) return p
  }
  return null
}

const rows = []
for (const floor of FLOORS) {
  const src = resolveSource(floor.sources)
  if (!src) {
    console.warn(`Missing SVG for ${floor.filename}`)
    continue
  }
  const svgText = fs.readFileSync(src, "utf8")
  const hasCafmId = /id=["']CAFM_ID["']/i.test(svgText)
  const hasCafmSpace = /id=["']CAFM_SPACE["']/i.test(svgText)
  const labels = extractTextLabels(svgText)
  const dataK = extractDataKRooms(svgText)

  const byId = new Map()
  for (const label of labels) {
    const id = label.roomId.trim()
    if (!id) continue
    byId.set(id, {
      roomId: id,
      roomName: roomDisplayName(id),
      roomCategory: classifyRoom(id),
      building: "",
      centroidX: label.x,
      centroidY: label.y,
      sourceTag: hasCafmId ? "CAFM_ID" : "text",
    })
  }
  for (const room of dataK) {
    const id = room.roomId.trim()
    if (!id) continue
    const existing = byId.get(id)
    if (existing) {
      if (room.building) existing.building = room.building
      existing.sourceTag = existing.sourceTag.includes("data-k")
        ? existing.sourceTag
        : `${existing.sourceTag}+data-k`
    } else {
      byId.set(id, {
        roomId: id,
        roomName: roomDisplayName(id),
        roomCategory: classifyRoom(id),
        building: room.building,
        centroidX: "",
        centroidY: "",
        sourceTag: "data-k",
      })
    }
  }

  const sorted = [...byId.values()].sort((a, b) =>
    a.roomId.localeCompare(b.roomId, undefined, { numeric: true, sensitivity: "base" }),
  )

  for (const room of sorted) {
    rows.push({
      school_id: SCHOOL.schoolId,
      school_name: SCHOOL.schoolName,
      school_display_name: SCHOOL.schoolDisplayName,
      school_level: SCHOOL.schoolLevel,
      class_code: SCHOOL.classCode,
      campus_id: SCHOOL.campusId,
      address: SCHOOL.address,
      city: SCHOOL.city,
      state: SCHOOL.state,
      zip: SCHOOL.zip,
      level_id: floor.levelId,
      level_label: floor.levelLabel,
      level_order: floor.levelOrder,
      floor_plan_filename: floor.filename,
      room_id: room.roomId,
      room_name: room.roomName,
      room_category: room.roomCategory,
      building: room.building,
      centroid_x: room.centroidX,
      centroid_y: room.centroidY,
      source_tag: room.sourceTag,
      has_cafm_id: hasCafmId ? "TRUE" : "FALSE",
      has_cafm_space: hasCafmSpace ? "TRUE" : "FALSE",
      lookup_key: `${SCHOOL.campusId}|${floor.levelId}|${room.roomId}`,
    })
  }

  console.log(
    `${floor.filename}: rooms=${sorted.length} cafmId=${hasCafmId} cafmSpace=${hasCafmSpace}`,
  )
}

const headers = [
  "school_id",
  "school_name",
  "school_display_name",
  "school_level",
  "class_code",
  "campus_id",
  "address",
  "city",
  "state",
  "zip",
  "level_id",
  "level_label",
  "level_order",
  "floor_plan_filename",
  "room_id",
  "room_name",
  "room_category",
  "building",
  "centroid_x",
  "centroid_y",
  "source_tag",
  "has_cafm_id",
  "has_cafm_space",
  "lookup_key",
]

const outDir = path.join(workspaceRoot, "public", "data")
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, "casis-room-lookup.csv")
const lines = [
  headers.join(","),
  ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
]
fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8")
console.log(`Wrote ${rows.length} rows -> ${outPath}`)
