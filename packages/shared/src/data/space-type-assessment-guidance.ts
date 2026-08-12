import type { TableSchoolLevel } from "./table-of-surveys"
import { schoolLevelFromSchoolClass, TABLE_OF_SURVEY_ENTRIES } from "./table-of-surveys"

export interface SpaceTypeAssessmentGuidanceEntry {
  spaceType: string
  /** ES, MS, HS, ALL, or combined like "MS, HS" */
  schoolLevel: string
  note: string
}

/** From Scoring Tool Space Type Instructions.xlsx */
export const SPACE_TYPE_ASSESSMENT_GUIDANCE: SpaceTypeAssessmentGuidanceEntry[] = [
  {
    "spaceType": "Admin Offices",
    "schoolLevel": "ES",
    "note": "Admin Offices Assessment Selection Guidance \n\nFor Admin Offices assessments, assess 2 representative rooms, 1 of the 2 should be the principal's office. If offices have noticeably different conditions or configurations, assess a 3rd representative room.  "
  },
  {
    "spaceType": "Admin Offices",
    "schoolLevel": "MS",
    "note": "Admin Offices Assessment Selection Guidance \n\nFor Admin Offices assessments, assess 3 representative rooms, 1 of the 3 should be the principal's office. If offices have noticeably different conditions or configurations, assess a 4th representative room.  "
  },
  {
    "spaceType": "Admin Offices",
    "schoolLevel": "HS",
    "note": "Admin Offices Assessment Selection Guidance \n\nFor Admin Offices assessments, assess 4 representative rooms, 1 of the 4 should be the principal's office. If offices have noticeably different conditions or configurations, assess a 5th representative room.  "
  },
  {
    "spaceType": "Professional Learning Center",
    "schoolLevel": "ALL",
    "note": "Professional Learning Center Assessment Selection Guidance \n\nFor Professional Learning Center assessments, assess 1 representative room within each identified neighborhood. \n\nMore about this space: PLCs will support educator prep and teams with areas for independent and small group work. Activities include planning and collaboration, socializing, dining, and administrative tasks."
  },
  {
    "spaceType": "Early childhood studio",
    "schoolLevel": "ES",
    "note": "Early Childhood Studio Assessment Selection Guidance \n\nFor Early Childhood Studio assessments, assess 1 representative room. If classrooms have noticeably different conditions or configurations (such as renovated versus original classrooms), assess a 2nd representative room.  "
  },
  {
    "spaceType": "Early childhood special education studio",
    "schoolLevel": "ES",
    "note": "Early Childhood Special Education Studio Assessment Selection Guidance \n\nFor Early Childhood Special Education Studio assessments, assess 1 representative room. If classrooms have noticeably different conditions or configurations (such as renovated versus original classrooms), assess a 2nd representative room.  "
  },
  {
    "spaceType": "Traditional Studio",
    "schoolLevel": "ALL",
    "note": "Traditional Studios Classroom Assessment Selection Guidance \n\nFor Traditional Studios classroom assessments, assess 2 classrooms within each identified neighborhood. Selected classrooms should be representative of the classrooms in that wing or neighborhood. \n\nWhen selecting classrooms, consider differences in: \nSize and layout \nWindows and natural daylight \nOverall condition \nFurniture and built-in features \nOther distinguishing classroom characteristics \n\nIf classrooms within a neighborhood have noticeably different conditions or configurations (such as renovated versus original classrooms), assess at least 1 classroom representing each condition type, even if this results in more than two assessments. \n\nWhen possible, select classrooms serving different grade levels to capture a broader range of instructional environments. \n\nThe goal is to accurately represent the variety of classroom conditions within each neighborhood while avoiding unnecessary duplication. "
  },
  {
    "spaceType": "SPED Flex Studio",
    "schoolLevel": "ALL",
    "note": "SPED Flex Studio Assessment Selection Guidance \n\nFor SPED Flex Studio assessments, assess 1 representative room. If classrooms have noticeably different conditions or configurations (such as renovated versus original classrooms), assess a 2nd representative room.  \n\nMore about this space: SPED Flex Studios are special education spaces integrated into the learning neighborhood with access to shared learning space and not located in a Special Education Suite. "
  },
  {
    "spaceType": "Sensory Lab",
    "schoolLevel": "ALL",
    "note": "Sensory Lab Assessment Selection Guidance \n\nFor Sensory Lab assessments, assess 1 representative room. If classrooms have noticeably different conditions or configurations, assess a 2nd representative room.  \n\nMore about this space: Sensory labs are dedicated spaces that support development of learner's processing an gross-motor skills."
  },
  {
    "spaceType": "Art",
    "schoolLevel": "ES",
    "note": "Art Studio Assessment Selection Guidance \n\nFor Art Studio assessments, assess the 1 room that was designed to be an art room.  "
  },
  {
    "spaceType": "Art",
    "schoolLevel": "MS, HS",
    "note": "Art Studio Assessment Selection Guidance \n\nFor Art Studio assessments, assess the rooms that were designed to be art rooms. There should be a minimum of 2. If classrooms have noticeably different conditions, assess a 3rd room. "
  },
  {
    "spaceType": "Music",
    "schoolLevel": "ES",
    "note": "Music Studio Assessment Selection Guidance \n\nFor Music Studio assessments, assess the 1 room that was designed to be a music room."
  },
  {
    "spaceType": "Maker Space",
    "schoolLevel": "ES",
    "note": "Maker Space Assessment Selection Guidance \n\nFor Maker Space assessments, assess the 1 room that was designed to be a Maker Space.  \n\nMore about this space: Maker Spaces provide a multi-use, flexible, hands-on learning space for learners in all grade levels. These are intended to be easily accessible and/or embedded in the Learning Neighborhoods."
  },
  {
    "spaceType": "Maker Space",
    "schoolLevel": "MS, HS",
    "note": "Maker Space Assessment Selection Guidance \n\nFor Maker Space assessments, assess the rooms that were designed to be maker space rooms. There should be a minimum of 2. If classrooms have noticeably different conditions, assess a 3rd room. \n\nMore about this space: Maker Spaces provide a multi-use, flexible, hands-on learning space for learners in all grade levels. These are intended to be easily accessible and/or embedded in the Learning Neighborhoods."
  },
  {
    "spaceType": "Science",
    "schoolLevel": "MS, HS",
    "note": "Science Room Assessment Selection Guidance \n\nFor Science room assessments, assess the rooms that were designed to be science rooms. There should be a minimum of 2 rooms assessed. If classrooms have noticeably different conditions, assess a 3rd room. "
  },
  {
    "spaceType": "CTE Studio",
    "schoolLevel": "MS, HS",
    "note": "CTE Assessment Selection Guidance \n\nFor CTE room assessments, assess a minimum of 2 representative rooms. If classrooms have noticeably different conditions, assess a 3rd room. "
  },
  {
    "spaceType": "Low Intensity Lab",
    "schoolLevel": "MS, HS",
    "note": "CTE Assessment Selection Guidance \n\nFor CTE room assessments, assess a minimum of 2 representative rooms. If classrooms have noticeably different conditions, assess a 3rd room. "
  },
  {
    "spaceType": "Medium Intensity Lab",
    "schoolLevel": "MS, HS",
    "note": "CTE Assessment Selection Guidance \n\nFor CTE room assessments, assess a minimum of 2 representative rooms. If classrooms have noticeably different conditions, assess a 3rd room. "
  },
  {
    "spaceType": "High Intensity Lab",
    "schoolLevel": "MS, HS",
    "note": "CTE Assessment Selection Guidance \n\nFor CTE room assessments, assess a minimum of 2 representative rooms. If classrooms have noticeably different conditions, assess a 3rd room. "
  },
  {
    "spaceType": "Open Collaboration",
    "schoolLevel": "ALL",
    "note": "Open Collaboration Assessment Selection Guidance \n\nFor Open Collaboration assessments, complete 1 survey within each identified neighborhood — do not pick a floor-plan room. \n\nMore about this space: Open collaboration space must be distinct from circulation spaces – learning must occur without interruption by groups or learners passing through. The design may use physical walls, floor patterns, or flexible furniture to define spaces."
  },
  {
    "spaceType": "Small Group Room",
    "schoolLevel": "ALL",
    "note": "Small Group Room Assessment Selection Guidance \n\nFor Small Group Room assessments, assess 1 representative room within each identified neighborhood.  \n\nMore about this space: Group rooms are intended to be flexible spaces that allow for groups of learners to work together, have a meeting, and collaborate without disrupting other learners. "
  },
  {
    "spaceType": "Neighborhood",
    "schoolLevel": "ALL",
    "note": "Neighborhoods Assessment Selection Guidance \n\nFor Neighborhoods assessments, complete 1 neighborhood survey within each identified neighborhood. "
  },
  {
    "spaceType": "Theater Arts Studio",
    "schoolLevel": "MS",
    "note": "Theater Arts Assessment Selection Guidance \n\nFor Theater Arts assessments, assess 1 representative room.  "
  },
  {
    "spaceType": "Theater Arts Studio",
    "schoolLevel": "HS",
    "note": "Theater Arts Assessment Selection Guidance \n\nFor Theater Arts assessments, assess at least 1 representative room. If rooms have noticeably different conditions, assess multiple rooms. "
  },
  {
    "spaceType": "Rehearsal Hall",
    "schoolLevel": "MS, HS",
    "note": "Rehearsal Hall Assessment Selection Guidance \n\nFor Rehearsal Hall room assessments, assess a minimum of 2 representative rooms. If classrooms have noticeably different conditions, assess a 3rd room. "
  },
  {
    "spaceType": "Community Partners Suite",
    "schoolLevel": "ALL",
    "note": "About this space: The Community Partners Suite provides individual work space and one-on-one meeting areas for local non-profit and support services."
  },
  {
    "spaceType": "Life Skills Room",
    "schoolLevel": "ALL",
    "note": "About this space: Life skills rooms are spaces that support daily life activities including cooking and cleaning. "
  },
  {
    "spaceType": "Empower Center",
    "schoolLevel": "MS, HS",
    "note": "About this space: The Empower Center is a space that is not owned by any one department, allowing it to foster cross-disciplinary collaboration of learners, staff, curriculum, and community. A variety of learning activities and programs can be supported by the Empower Center from large gathering events such as performances, exhibitions, competitions, or job fairs to medium size activities such as whole-class learning and cross-disciplinary team teaching to small scale individual and team work. "
  },
  {
    "spaceType": "PE Fitness Room",
    "schoolLevel": "HS",
    "note": "About this space: The PE Fitness room is a flexible fitness space that is designed to accommodate a variety of physical education programming such as wellness, health education programming, and cheer."
  }
];

function normalizeSpaceTypeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
}

/** Map app space type labels to spreadsheet keys (via table-of-surveys raw names). */
function guidanceLookupKeys(spaceType: string): string[] {
  const keys = new Set<string>()
  keys.add(normalizeSpaceTypeKey(spaceType))
  for (const entry of TABLE_OF_SURVEY_ENTRIES) {
    if (entry.spaceType === spaceType || entry.spaceTypeRaw === spaceType) {
      keys.add(normalizeSpaceTypeKey(entry.spaceType))
      keys.add(normalizeSpaceTypeKey(entry.spaceTypeRaw))
    }
  }
  return [...keys]
}

function guidanceSchoolLevelMatches(entryLevel: string, level: TableSchoolLevel | null): boolean {
  const raw = entryLevel.toUpperCase().trim()
  if (raw === "ALL") return true
  if (!level) return false
  return raw.split(",").map((part) => part.trim()).includes(level)
}

export function spaceTypeGuidanceTitle(spaceType: string, noteTitle?: string): string {
  if (noteTitle?.trim()) return noteTitle.trim()
  if (spaceType === "Traditional studio") {
    return "Traditional Studios Classroom Assessment Selection Guidance"
  }
  return `${spaceType} Assessment Selection Guidance`
}

export function parseSpaceTypeGuidanceNote(
  note: string,
  spaceType: string,
): { title: string; body: string } {
  const trimmed = note.trim()
  if (/^About this space:/i.test(trimmed)) {
    return {
      title: `${spaceType} — About this space`,
      body: trimmed.replace(/^About this space:\s*/i, "").trim(),
    }
  }

  const parts = trimmed.split(/\n\n+/)
  const first = parts[0]?.trim() ?? ""
  if (/Assessment Selection Guidance/i.test(first)) {
    return {
      title: first,
      body: parts.slice(1).join("\n\n").trim(),
    }
  }

  return {
    title: spaceTypeGuidanceTitle(spaceType),
    body: trimmed,
  }
}

export type SpaceTypeCompletionRule =
  | { kind: "minRooms"; count: number }
  | { kind: "perNeighborhood"; minPerNeighborhood: number }

function parseMinimumRoomCountFromNote(note: string): number | null {
  const body = note.trim()
  const patterns = [
    /minimum of (\d+)/i,
    /assess (\d+) representative rooms?/i,
    /assess at least (\d+)/i,
    /assess the (\d+) room/i,
    /complete (\d+) neighborhood/i,
  ]
  for (const pattern of patterns) {
    const match = body.match(pattern)
    if (match) return Number.parseInt(match[1]!, 10)
  }
  return null
}

function guidanceEntryForSpaceType(
  spaceType: string,
  schoolClass: string | null | undefined,
): SpaceTypeAssessmentGuidanceEntry | null {
  const keys = guidanceLookupKeys(spaceType)
  const level = schoolLevelFromSchoolClass(schoolClass)
  const candidates = SPACE_TYPE_ASSESSMENT_GUIDANCE.filter((entry) =>
    keys.includes(normalizeSpaceTypeKey(entry.spaceType)),
  )
  if (!candidates.length) return null

  return (
    (level ? candidates.find((c) => guidanceSchoolLevelMatches(c.schoolLevel, level)) : null) ??
    candidates.find((c) => guidanceSchoolLevelMatches(c.schoolLevel, null)) ??
    candidates.find((c) => c.schoolLevel.toUpperCase() === "ALL") ??
    null
  )
}

/** Minimum completed room surveys before a space type counts as complete in the picker. */
export function spaceTypeCompletionRule(
  spaceType: string,
  schoolClass: string | null | undefined,
): SpaceTypeCompletionRule {
  if (spaceType === "Traditional studio") {
    return { kind: "perNeighborhood", minPerNeighborhood: 2 }
  }

  const entry = guidanceEntryForSpaceType(spaceType, schoolClass)
  if (!entry) return { kind: "minRooms", count: 1 }

  const note = entry.note.trim()
  if (/^About this space:/i.test(note)) {
    return { kind: "minRooms", count: 1 }
  }

  if (/within each identified neighborhood/i.test(note)) {
    const match = note.match(/(?:assess|complete)\s+(\d+)/i)
    return { kind: "perNeighborhood", minPerNeighborhood: match ? Number.parseInt(match[1]!, 10) : 1 }
  }

  const parsed = parseMinimumRoomCountFromNote(note)
  return { kind: "minRooms", count: parsed ?? 1 }
}

export function requiredCompletedRoomsForSpaceType(
  spaceType: string,
  schoolClass: string | null | undefined,
): number {
  const rule = spaceTypeCompletionRule(spaceType, schoolClass)
  return rule.kind === "minRooms" ? rule.count : rule.minPerNeighborhood
}

export interface SpaceTypeRoomSession {
  neighborhood?: string | null
}

export function isSpaceTypeRoomsComplete<T extends SpaceTypeRoomSession>(
  spaceType: string,
  rooms: T[],
  schoolClass: string | null | undefined,
  isFilledOut: (room: T) => boolean,
): boolean {
  const rule = spaceTypeCompletionRule(spaceType, schoolClass)
  const filled = rooms.filter((room) => isFilledOut(room))

  if (rule.kind === "minRooms") {
    return filled.length >= rule.count
  }

  const identified = new Set(
    rooms.map((room) => room.neighborhood?.trim()).filter((n): n is string => !!n),
  )
  if (identified.size === 0) return false

  for (const neighborhood of identified) {
    const count = filled.filter((room) => room.neighborhood?.trim() === neighborhood).length
    if (count < rule.minPerNeighborhood) return false
  }
  return true
}

export function spaceTypeCompletionProgress<T extends SpaceTypeRoomSession>(
  spaceType: string,
  rooms: T[],
  schoolClass: string | null | undefined,
  isFilledOut: (room: T) => boolean,
): { complete: number; required: number } {
  const rule = spaceTypeCompletionRule(spaceType, schoolClass)
  const filled = rooms.filter((room) => isFilledOut(room))

  if (rule.kind === "minRooms") {
    return { complete: filled.length, required: rule.count }
  }

  const identified = new Set(
    rooms.map((room) => room.neighborhood?.trim()).filter((n): n is string => !!n),
  )
  const required = identified.size * rule.minPerNeighborhood
  return { complete: filled.length, required: Math.max(required, rule.minPerNeighborhood) }
}

export function lookupSpaceTypeAssessmentGuidance(
  spaceType: string,
  schoolClass: string | null | undefined,
): { title: string; body: string } | null {
  const entry = guidanceEntryForSpaceType(spaceType, schoolClass)
  if (!entry) return null
  return parseSpaceTypeGuidanceNote(entry.note, spaceType)
}

