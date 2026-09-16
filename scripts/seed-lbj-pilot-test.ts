import fs from "node:fs"
import type { RoomSurveySession, SurveySession, SurveyType, TestCampusClone } from "@aisd/shared"
import { TEST_CAMPUS_CLONES, sourceSchoolIdForTestClone } from "@aisd/shared"
import { remapRoomAnswersToCurrentQuestions, mergeRicherRoomSessions } from "../lib/remap-compatible-survey-answers"
import { spaceTypeBelongsToSurvey } from "../lib/pilot-carryover"

const SOURCE_SCHOOL_IDS = new Set(["lbj", "ortega", "casis", "eastside-echs"])

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=")
      return [
        line.slice(0, index).trim(),
        line.slice(index + 1).trim().replace(/^["']|["']$/g, ""),
      ]
    }),
)

const projectUrl = String(env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "")
const key = String(env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "")
if (!projectUrl || !key) throw new Error("Supabase env is missing")

const headers: Record<string, string> = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
}

async function restSelect<T>(table: string, query: string): Promise<T[]> {
  const response = await fetch(`${projectUrl}/rest/v1/${table}?${query}`, { headers })
  const text = await response.text()
  if (!response.ok) throw new Error(`${table} select ${response.status}: ${text.slice(0, 500)}`)
  return JSON.parse(text) as T[]
}

async function restUpsert<T extends object>(
  table: string,
  rows: T | T[],
  onConflict: string,
): Promise<T[]> {
  const response = await fetch(
    `${projectUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
    {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(rows),
    },
  )
  const text = await response.text()
  if (!response.ok) throw new Error(`${table} upsert ${response.status}: ${text.slice(0, 800)}`)
  const data = JSON.parse(text) as T[] | T
  return Array.isArray(data) ? data : [data]
}

async function restUpsertChunked(
  table: string,
  rows: object[],
  onConflict: string,
  chunkSize = 150,
): Promise<void> {
  for (let index = 0; index < rows.length; index += chunkSize) {
    await restUpsert(table, rows.slice(index, index + chunkSize), onConflict)
  }
}

async function restDelete(table: string, query: string): Promise<void> {
  const response = await fetch(`${projectUrl}/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers,
  })
  const text = await response.text()
  if (!response.ok && response.status !== 404) {
    throw new Error(`${table} delete ${response.status}: ${text.slice(0, 500)}`)
  }
}

async function restInsert<T extends object>(table: string, rows: T | T[]): Promise<T[]> {
  const response = await fetch(`${projectUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=representation",
    },
    body: JSON.stringify(rows),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${table} insert ${response.status}: ${text.slice(0, 800)}`)
  const data = JSON.parse(text) as T[] | T
  return Array.isArray(data) ? data : [data]
}

function inFilter(column: string, values: string[]): string {
  if (!values.length) return `${column}=eq.__none__`
  return `${column}=in.(${values.map((value) => encodeURIComponent(value)).join(",")})`
}

interface SessionRow {
  id: string
  survey_type: SurveyType
  building: string
  assessor_name: string | null
  assessor_email: string | null
  assessor_registered_at: string | null
  started_at: string
  final_comment: string | null
}

interface RoomRow {
  survey_session_id: string
  room_id: string
  room_number: string
  school_room_number: string | null
  room_type: string
  grade_type: string
  neighborhood: string | null
  area_sqft: number | null
  building: string | null
  level_id: string
  pre_walk_note1: string | null
  pre_walk_note2: string | null
  source_survey_type: SurveyType | null
  pending_question_ids: string[] | null
  pending_grade: boolean | null
  deferred_question_ids: string[] | null
  deferred_to_closeout: boolean | null
  traditional_studio_copied_from_room_id: string | null
}

interface ResponseRow {
  survey_session_id: string
  room_id: string
  question_id: string
  value: unknown
  comment: string | null
  photos: string[] | null
}

interface PinRow {
  survey_session_id: string
  pin_id: string
  element_type: string
  lng: number
  lat: number
  placed_at: string
}

function roomFromDb(row: RoomRow, responses: ResponseRow[]): RoomSurveySession {
  return {
    roomId: row.room_id,
    roomNumber: row.room_number,
    schoolRoomNumber: row.school_room_number ?? undefined,
    roomType: row.room_type,
    gradeType: (row.grade_type || "") as RoomSurveySession["gradeType"],
    neighborhood: row.neighborhood ?? undefined,
    areaSqft: row.area_sqft ?? undefined,
    building: row.building ?? undefined,
    levelId: row.level_id,
    preWalkNote1: row.pre_walk_note1 ?? undefined,
    preWalkNote2: row.pre_walk_note2 ?? undefined,
    sourceSurveyType: row.source_survey_type ?? undefined,
    pendingQuestionIds: row.pending_question_ids ?? undefined,
    pendingGrade: row.pending_grade || undefined,
    deferredQuestionIds: row.deferred_question_ids ?? undefined,
    deferredToCloseOut: row.deferred_to_closeout || undefined,
    traditionalStudioCopiedFromRoomId: row.traditional_studio_copied_from_room_id ?? undefined,
    traditionalStudioCopyReviewPending: false,
    responses: responses.map((response) => ({
      questionId: response.question_id,
      value: response.value as string | string[],
      comment: response.comment ?? undefined,
      photos: response.photos ?? undefined,
    })),
  }
}

async function fillDestFromSourceSnapshots(clone: TestCampusClone, sourceId: string): Promise<void> {
  const sourceSchool = (
    await restSelect<{ school_class: string }>(
      "esa_schools",
      `school_id=eq.${encodeURIComponent(sourceId)}&select=school_class`,
    )
  )[0]
  if (!sourceSchool) throw new Error(`Source school ${sourceId} is missing from esa_schools`)

  const sourceSessions = await restSelect<SessionRow>(
    "esa_survey_sessions",
    `school_id=eq.${encodeURIComponent(sourceId)}&select=*`,
  )
  const destSessions = await restSelect<SessionRow & { id: string }>(
    "esa_survey_sessions",
    `school_id=eq.${encodeURIComponent(clone.id)}&select=*`,
  )
  const destByType = new Map(destSessions.map((row) => [row.survey_type, row]))
  const sourceIds = sourceSessions.map((row) => row.id)
  const [sourceRooms, sourceResponses, snapshotRows] = await Promise.all([
    restSelect<RoomRow>("esa_survey_rooms", `${inFilter("survey_session_id", sourceIds)}&select=*`),
    restSelect<ResponseRow>(
      "esa_question_responses",
      `${inFilter("survey_session_id", sourceIds)}&select=*`,
    ),
    restSelect<{ survey_session_id: string; session_json: { rooms?: Record<string, RoomSurveySession> } }>(
      "esa_submission_snapshots",
      `${inFilter("survey_session_id", sourceIds)}&select=survey_session_id,session_json`,
    ),
  ])

  const roomsBySession = new Map<string, RoomRow[]>()
  for (const row of sourceRooms) {
    const list = roomsBySession.get(row.survey_session_id) ?? []
    list.push(row)
    roomsBySession.set(row.survey_session_id, list)
  }
  const responsesBySessionRoom = new Map<string, ResponseRow[]>()
  for (const row of sourceResponses) {
    const key = `${row.survey_session_id}::${row.room_id}`
    const list = responsesBySessionRoom.get(key) ?? []
    list.push(row)
    responsesBySessionRoom.set(key, list)
  }
  const snapsBySession = new Map<string, Array<{ rooms?: Record<string, RoomSurveySession> }>>()
  for (const row of snapshotRows) {
    const list = snapsBySession.get(row.survey_session_id) ?? []
    list.push(row.session_json)
    snapsBySession.set(row.survey_session_id, list)
  }

  let filledRooms = 0
  let filledAnswers = 0

  for (const session of sourceSessions) {
    const destSession = destByType.get(session.survey_type)
    if (!destSession) continue

    const liveRooms: Record<string, RoomSurveySession> = {}
    for (const roomRow of roomsBySession.get(session.id) ?? []) {
      const room = roomFromDb(
        roomRow,
        responsesBySessionRoom.get(`${session.id}::${roomRow.room_id}`) ?? [],
      )
      liveRooms[room.roomId] = room
    }
    const merged = mergeRicherRoomSessions(
      { rooms: liveRooms } as SurveySession,
      ...(snapsBySession.get(session.id) ?? []).map(
        (snap) => ({ rooms: snap.rooms ?? {} }) as SurveySession,
      ),
    )

    const destRooms = await restSelect<RoomRow>(
      "esa_survey_rooms",
      `survey_session_id=eq.${encodeURIComponent(destSession.id)}&select=*`,
    )
    const destResponses = await restSelect<ResponseRow>(
      "esa_question_responses",
      `survey_session_id=eq.${encodeURIComponent(destSession.id)}&select=room_id,question_id`,
    )
    const destCount = new Map<string, number>()
    for (const row of destResponses) {
      destCount.set(row.room_id, (destCount.get(row.room_id) ?? 0) + 1)
    }
    const destRoomById = new Map(destRooms.map((row) => [row.room_id, row]))

    const roomsToUpsert: Record<string, unknown>[] = []
    const responsesToUpsert: Record<string, unknown>[] = []

    for (const room of Object.values(merged)) {
      if (!spaceTypeBelongsToSurvey(session.survey_type, room.roomType, sourceSchool.school_class)) {
        continue
      }
      const remapped = remapRoomAnswersToCurrentQuestions(
        room,
        session.survey_type,
        sourceSchool.school_class,
      ).room
      if (!remapped.responses.length) continue
      if ((destCount.get(remapped.roomId) ?? 0) >= remapped.responses.length) continue

      const existing = destRoomById.get(remapped.roomId)
      roomsToUpsert.push({
        survey_session_id: destSession.id,
        room_id: remapped.roomId,
        room_number: remapped.roomNumber,
        school_room_number: remapped.schoolRoomNumber ?? existing?.school_room_number ?? null,
        room_type: remapped.roomType,
        grade_type: remapped.gradeType ?? existing?.grade_type ?? "",
        neighborhood: remapped.neighborhood ?? existing?.neighborhood ?? null,
        area_sqft: remapped.areaSqft ?? existing?.area_sqft ?? null,
        building: remapped.building ?? existing?.building ?? null,
        level_id: remapped.levelId || existing?.level_id || "",
        pre_walk_note1: remapped.preWalkNote1 ?? existing?.pre_walk_note1 ?? null,
        pre_walk_note2: remapped.preWalkNote2 ?? existing?.pre_walk_note2 ?? null,
        source_survey_type: remapped.sourceSurveyType ?? existing?.source_survey_type ?? null,
        pending_question_ids: remapped.pendingQuestionIds ?? existing?.pending_question_ids ?? [],
        pending_grade: !!remapped.pendingGrade,
        deferred_question_ids: remapped.deferredQuestionIds ?? existing?.deferred_question_ids ?? [],
        deferred_to_closeout: !!remapped.deferredToCloseOut,
        traditional_studio_copied_from_room_id:
          remapped.traditionalStudioCopiedFromRoomId ??
          existing?.traditional_studio_copied_from_room_id ??
          null,
        traditional_studio_copy_review_pending: false,
      })
      for (const response of remapped.responses) {
        responsesToUpsert.push({
          survey_session_id: destSession.id,
          room_id: remapped.roomId,
          question_id: response.questionId,
          value: response.value ?? null,
          comment: response.comment ?? null,
          photos: response.photos ?? [],
        })
      }
      filledRooms += 1
      filledAnswers += remapped.responses.length
      console.log(
        `${session.survey_type} ${remapped.roomId} (${remapped.roomType}): filled ${remapped.responses.length} answers`,
      )
    }

    if (roomsToUpsert.length) {
      await restUpsertChunked("esa_survey_rooms", roomsToUpsert, "survey_session_id,room_id")
    }
    if (responsesToUpsert.length) {
      await restUpsertChunked(
        "esa_question_responses",
        responsesToUpsert,
        "survey_session_id,room_id,question_id",
      )
    }
  }

  console.log(
    `Filled ${clone.displayName} from ${sourceId} snapshots: ${filledRooms} rooms, ${filledAnswers} answers.`,
  )
}

async function seedClone(
  clone: TestCampusClone,
  options: { force: boolean; fillFromSnapshots: boolean },
): Promise<void> {
  const sourceId = sourceSchoolIdForTestClone(clone)
  if (clone.id === sourceId || SOURCE_SCHOOL_IDS.has(clone.id)) {
    throw new Error(`Refusing to seed onto original campus ${clone.id}`)
  }
  const destExisting = await restSelect<{ id: string }>(
    "esa_survey_sessions",
    `school_id=eq.${encodeURIComponent(clone.id)}&select=id`,
  )
  if (destExisting.length > 0 && !options.force && !options.fillFromSnapshots) {
    console.log(
      `${clone.displayName} already has ${destExisting.length} survey session(s); leaving it unchanged.`,
    )
    return
  }
  if (options.fillFromSnapshots) {
    await fillDestFromSourceSnapshots(clone, sourceId)
    return
  }
  if (destExisting.length > 0 && options.force) {
    await restDelete(
      "esa_survey_sessions",
      `school_id=eq.${encodeURIComponent(clone.id)}`,
    )
    console.log(`Cleared ${destExisting.length} existing ${clone.displayName} session(s).`)
  }

  const sourceSchool = (
    await restSelect<{
      school_class: string
      address: string | null
      lat: number | null
      lng: number | null
      has_floor_plan: boolean | null
    }>("esa_schools", `school_id=eq.${encodeURIComponent(sourceId)}&select=*`)
  )[0]
  if (!sourceSchool) throw new Error(`Source school ${sourceId} is missing from esa_schools`)

  await restUpsert(
    "esa_schools",
    {
      school_id: clone.id,
      campus_id: clone.campusId,
      name: clone.name,
      display_name: clone.displayName,
      school_class: sourceSchool.school_class,
      address: sourceSchool.address,
      lat: sourceSchool.lat,
      lng: sourceSchool.lng,
      has_floor_plan: sourceSchool.has_floor_plan,
    },
    "school_id",
  )

  const existingAssessment = await restSelect<{ id: string }>(
    "esa_campus_assessments",
    `school_id=eq.${encodeURIComponent(clone.id)}&select=id&order=created_at.desc&limit=1`,
  )
  const campusAssessmentId =
    existingAssessment[0]?.id ??
    (
      await restInsert<{ id: string }>("esa_campus_assessments", {
        school_id: clone.id,
        campus_id: clone.campusId,
        school_name: clone.displayName,
        status: "in_progress",
      })
    )[0].id

  const sourceSessions = await restSelect<SessionRow>(
    "esa_survey_sessions",
    `school_id=eq.${encodeURIComponent(sourceId)}&select=*`,
  )
  if (!sourceSessions.length) throw new Error(`No survey sessions on ${sourceId}`)

  const sourceIds = sourceSessions.map((row) => row.id)
  const [sourceRooms, sourceResponses, sourcePins] = await Promise.all([
    restSelect<RoomRow>("esa_survey_rooms", `${inFilter("survey_session_id", sourceIds)}&select=*`),
    restSelect<ResponseRow>(
      "esa_question_responses",
      `${inFilter("survey_session_id", sourceIds)}&select=*`,
    ),
    restSelect<PinRow>("esa_outdoor_pins", `${inFilter("survey_session_id", sourceIds)}&select=*`),
  ])

  const roomsBySession = new Map<string, RoomRow[]>()
  for (const row of sourceRooms) {
    const list = roomsBySession.get(row.survey_session_id) ?? []
    list.push(row)
    roomsBySession.set(row.survey_session_id, list)
  }
  const responsesBySessionRoom = new Map<string, ResponseRow[]>()
  for (const row of sourceResponses) {
    const key = `${row.survey_session_id}::${row.room_id}`
    const list = responsesBySessionRoom.get(key) ?? []
    list.push(row)
    responsesBySessionRoom.set(key, list)
  }
  const pinsBySession = new Map<string, PinRow[]>()
  for (const row of sourcePins) {
    const list = pinsBySession.get(row.survey_session_id) ?? []
    list.push(row)
    pinsBySession.set(row.survey_session_id, list)
  }

  let keptTotal = 0
  let droppedTotal = 0

  for (const session of sourceSessions) {
    const now = new Date().toISOString()
    const [destSession] = await restUpsert<SessionRow & { id: string }>(
      "esa_survey_sessions",
      {
        survey_id: `AISD-${clone.id}-${session.survey_type}`,
        campus_assessment_id: campusAssessmentId,
        school_id: clone.id,
        campus_id: clone.campusId,
        school_name: clone.displayName,
        survey_type: session.survey_type,
        building: session.building || "Main",
        assessor_name: session.assessor_name,
        assessor_email: session.assessor_email,
        assessor_registered_at: session.assessor_registered_at,
        started_at: session.started_at,
        submitted_at: null,
        final_comment: session.final_comment,
        campus_submitted_at: null,
        updated_at: now,
      },
      "school_id,survey_type",
    )

    const destRooms: Record<string, unknown>[] = []
    const destResponses: Record<string, unknown>[] = []
    let kept = 0
    let dropped = 0

    for (const roomRow of roomsBySession.get(session.id) ?? []) {
      const remapped = remapRoomAnswersToCurrentQuestions(
        roomFromDb(roomRow, responsesBySessionRoom.get(`${session.id}::${roomRow.room_id}`) ?? []),
        session.survey_type,
        sourceSchool.school_class,
      )
      kept += remapped.kept
      dropped += remapped.dropped
      const room = remapped.room
      destRooms.push({
        survey_session_id: destSession.id,
        room_id: room.roomId,
        room_number: room.roomNumber,
        school_room_number: room.schoolRoomNumber ?? null,
        room_type: room.roomType,
        grade_type: room.gradeType ?? "",
        neighborhood: room.neighborhood ?? null,
        area_sqft: room.areaSqft ?? null,
        building: room.building ?? null,
        level_id: room.levelId,
        pre_walk_note1: room.preWalkNote1 ?? null,
        pre_walk_note2: room.preWalkNote2 ?? null,
        source_survey_type: room.sourceSurveyType ?? null,
        pending_question_ids: room.pendingQuestionIds ?? [],
        pending_grade: !!room.pendingGrade,
        deferred_question_ids: room.deferredQuestionIds ?? [],
        deferred_to_closeout: !!room.deferredToCloseOut,
        traditional_studio_copied_from_room_id: room.traditionalStudioCopiedFromRoomId ?? null,
        traditional_studio_copy_review_pending: false,
      })
      for (const response of room.responses) {
        destResponses.push({
          survey_session_id: destSession.id,
          room_id: room.roomId,
          question_id: response.questionId,
          value: response.value ?? null,
          comment: response.comment ?? null,
          photos: response.photos ?? [],
        })
      }
    }

    if (destRooms.length) {
      await restUpsertChunked("esa_survey_rooms", destRooms, "survey_session_id,room_id")
    }
    if (destResponses.length) {
      await restUpsertChunked(
        "esa_question_responses",
        destResponses,
        "survey_session_id,room_id,question_id",
      )
    }

    const pins = (pinsBySession.get(session.id) ?? []).map((pin) => ({
      survey_session_id: destSession.id,
      pin_id: pin.pin_id,
      element_type: pin.element_type,
      lng: pin.lng,
      lat: pin.lat,
      placed_at: pin.placed_at,
    }))
    if (pins.length) {
      await restUpsert("esa_outdoor_pins", pins, "survey_session_id,pin_id")
    }

    keptTotal += kept
    droppedTotal += dropped
    console.log(
      `${session.survey_type}: kept ${kept} answers, left ${dropped} empty, ${destRooms.length} rooms`,
    )
  }

  const prewalkState = await restSelect<Record<string, unknown>>(
    "esa_prewalk_state",
    `school_id=eq.${encodeURIComponent(sourceId)}&select=*`,
  )
  if (prewalkState[0]) {
    await restUpsert(
      "esa_prewalk_state",
      {
        school_id: clone.id,
        campus_id: clone.campusId,
        completed_at: prewalkState[0].completed_at ?? null,
        skipped_at: prewalkState[0].skipped_at ?? null,
      },
      "school_id",
    )
  }

  const mappings = await restSelect<Record<string, unknown>>(
    "esa_prewalk_mappings",
    `school_id=eq.${encodeURIComponent(sourceId)}&select=*`,
  )
  if (mappings.length) {
    await restUpsert(
      "esa_prewalk_mappings",
      mappings.map((row) => ({
        school_id: clone.id,
        campus_id: clone.campusId,
        survey_type: row.survey_type,
        room_id: row.room_id,
        space_type: row.space_type,
        note1: row.note1 ?? null,
        note2: row.note2 ?? null,
        mapped_at: row.mapped_at ?? null,
      })),
      "school_id,survey_type,room_id",
    )
  }

  try {
    const existence = await restSelect<Record<string, unknown>>(
      "esa_prewalk_existence_20260914",
      `school_id=eq.${encodeURIComponent(sourceId)}&select=*`,
    )
    if (existence.length) {
      await restUpsert(
        "esa_prewalk_existence_20260914",
        existence.map((row) => ({
          school_id: clone.id,
          campus_id: clone.campusId,
          survey_type: row.survey_type,
          space_type: row.space_type,
          does_exist: row.does_exist,
          answered_at: row.answered_at ?? null,
        })),
        "school_id,survey_type,space_type",
      )
    }
  } catch (error) {
    console.warn("Pre-walk existence copy skipped:", error)
  }

  const manuals = await restSelect<Record<string, unknown>>(
    "esa_manual_rooms",
    `school_id=eq.${encodeURIComponent(sourceId)}&select=*`,
  )
  if (manuals.length) {
    await restUpsert(
      "esa_manual_rooms",
      manuals.map((row) => ({
        school_id: clone.id,
        room_id: row.room_id,
        name: row.name,
        x: row.x,
        y: row.y,
        area: row.area,
        building: row.building ?? null,
        neighborhood: row.neighborhood ?? null,
        area_sqft: row.area_sqft ?? null,
        level_id: row.level_id,
        points: row.points,
        overlay_kind: row.overlay_kind ?? null,
      })),
      "school_id,room_id",
    )
  }

  console.log(
    `Seeded ${clone.displayName} from ${sourceId}: kept ${keptTotal} answers, left ${droppedTotal} empty.`,
  )
}

async function main() {
  const force = process.argv.includes("--force")
  const fillFromSnapshots = process.argv.includes("--fill-from-snapshots")
  const cloneIds = process.argv.slice(2).filter((arg) => !arg.startsWith("--"))
  const defaultIds = cloneIds.length ? cloneIds : ["lbj-pilot-test"]
  for (const id of defaultIds) {
    const clone = TEST_CAMPUS_CLONES.find((entry) => entry.id === id)
    if (!clone) throw new Error(`Unknown test campus clone: ${id}`)
    await seedClone(clone, { force, fillFromSnapshots })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
