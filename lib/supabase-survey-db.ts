import "server-only"

import type {
  AisdSchoolOption,
  OutdoorElementPin,
  ParsedPlanRoom,
  PreWalkState,
  RoomQuestionResponse,
  RoomSurveySession,
  SurveySession,
  SurveySubmission,
  SurveyType,
} from "@aisd/shared"
import { surveyTypeLabel } from "@aisd/shared"
import type { PersistedSurveyDraft } from "@/lib/survey-persistence"
import { sessionHasRegisteredAssessor } from "@/lib/assessor"
import { countDraftResponses } from "@/lib/school-draft-merge"
import {
  isSupabaseServerConfigured,
  supabaseRestDelete,
  supabaseRestInsert,
  supabaseRestSelect,
  supabaseRestUpsert,
} from "@/lib/supabase-rest"

import type { RemoteSurveyStatus } from "@/lib/survey-remote-types"
export type { RemoteSurveyStatus } from "@/lib/survey-remote-types"

interface DbSurveySession {
  id: string
  survey_id: string
  campus_assessment_id: string | null
  school_id: string
  campus_id: string
  school_name: string
  survey_type: SurveyType
  building: string
  assessor_name: string | null
  assessor_email: string | null
  assessor_registered_at: string | null
  started_at: string
  submitted_at: string | null
  final_comment: string | null
  campus_submitted_at: string | null
  updated_at: string
}

interface DbSurveyRoom {
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
  pending_question_ids: string[]
  pending_grade: boolean
  deferred_question_ids: string[]
  deferred_to_closeout: boolean
  traditional_studio_copied_from_room_id: string | null
  traditional_studio_copy_review_pending: boolean
}

interface DbQuestionResponse {
  survey_session_id: string
  room_id: string
  question_id: string
  value: unknown
  comment: string | null
  photos: string[]
}

interface DbOutdoorPin {
  survey_session_id: string
  pin_id: string
  element_type: string
  lng: number
  lat: number
  placed_at: string
}

interface DbPrewalkMapping {
  school_id: string
  campus_id: string
  survey_type: SurveyType
  room_id: string
  space_type: string
  note1: string | null
  note2: string | null
  mapped_at: string | null
}

interface DbManualRoom {
  school_id: string
  room_id: string
  name: string
  x: number
  y: number
  area: number
  building: string | null
  neighborhood: string | null
  area_sqft: number | null
  level_id: string
  points: unknown
  overlay_kind: string | null
}

function normalizeEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? ""
}

function sessionHasProgress(session: SurveySession): boolean {
  if ((session.outdoorElementPins?.length ?? 0) > 0) return true
  return Object.values(session.rooms).some(
    (room) =>
      room.responses.length > 0 ||
      !!room.gradeType ||
      (room.pendingQuestionIds?.length ?? 0) > 0 ||
      !!room.pendingGrade,
  )
}

function remoteStatusFromRow(row: DbSurveySession): RemoteSurveyStatus["remoteStatus"] {
  if (row.campus_submitted_at) return "campus_submitted"
  if (row.submitted_at) return "submitted"
  return "in_progress"
}

export async function fetchRemoteSurveyStatus(input: {
  schoolId: string
  surveyType: SurveyType
  assessorEmail?: string | null
}): Promise<RemoteSurveyStatus> {
  const surveyLabel = surveyTypeLabel(input.surveyType)
  if (!isSupabaseServerConfigured()) {
    return {
      configured: false,
      hasRemote: false,
      conflict: false,
      surveyLabel,
      remoteAssessorName: null,
      remoteAssessorEmail: null,
      remoteStatus: "not_started",
      remoteUpdatedAt: null,
      remoteSubmittedAt: null,
      remoteCampusSubmittedAt: null,
    }
  }

  const rows = await supabaseRestSelect<DbSurveySession>(
    "esa_survey_sessions",
    `school_id=eq.${encodeURIComponent(input.schoolId)}&survey_type=eq.${encodeURIComponent(input.surveyType)}&select=*`,
  )
  const row = rows[0]
  if (!row) {
    return {
      configured: true,
      hasRemote: false,
      conflict: false,
      surveyLabel,
      remoteAssessorName: null,
      remoteAssessorEmail: null,
      remoteStatus: "not_started",
      remoteUpdatedAt: null,
      remoteSubmittedAt: null,
      remoteCampusSubmittedAt: null,
    }
  }

  const currentEmail = normalizeEmail(input.assessorEmail)
  const remoteEmail = normalizeEmail(row.assessor_email)
  const hasRemote = true
  const remoteHasAssessor = !!(remoteEmail || row.assessor_name?.trim())
  const conflict =
    remoteHasAssessor &&
    (!currentEmail || (remoteEmail ? remoteEmail !== currentEmail : true))

  return {
    configured: true,
    hasRemote,
    conflict,
    surveyLabel,
    remoteAssessorName: row.assessor_name,
    remoteAssessorEmail: row.assessor_email,
    remoteStatus: remoteStatusFromRow(row),
    remoteUpdatedAt: row.updated_at,
    remoteSubmittedAt: row.submitted_at,
    remoteCampusSubmittedAt: row.campus_submitted_at,
  }
}

async function upsertSchool(school: AisdSchoolOption): Promise<void> {
  await supabaseRestUpsert(
    "esa_schools",
    {
      school_id: school.id,
      campus_id: school.campusId,
      name: school.name,
      display_name: school.displayName,
      school_class: school.schoolClass,
      address: school.address,
      lat: school.lat,
      lng: school.lng,
      has_floor_plan: school.hasFloorPlan,
    },
    "school_id",
  )
}

async function ensureCampusAssessment(school: AisdSchoolOption): Promise<string> {
  const existing = await supabaseRestSelect<{ id: string }>(
    "esa_campus_assessments",
    `school_id=eq.${encodeURIComponent(school.id)}&select=id&order=created_at.desc&limit=1`,
  )
  if (existing[0]?.id) return existing[0].id

  const inserted = await supabaseRestInsert("esa_campus_assessments", {
    school_id: school.id,
    campus_id: school.campusId,
    school_name: school.displayName,
    status: "in_progress",
  })
  return (inserted[0] as unknown as { id: string }).id
}

function roomToDb(sessionId: string, room: RoomSurveySession): DbSurveyRoom {
  return {
    survey_session_id: sessionId,
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
    traditional_studio_copy_review_pending: !!room.traditionalStudioCopyReviewPending,
  }
}

function responseToDb(
  sessionId: string,
  roomId: string,
  response: RoomQuestionResponse,
): DbQuestionResponse {
  return {
    survey_session_id: sessionId,
    room_id: roomId,
    question_id: response.questionId,
    value: response.value ?? null,
    comment: response.comment ?? null,
    photos: response.photos ?? (response.photo ? [response.photo] : []),
  }
}

function dbRoomToSession(row: DbSurveyRoom, responses: DbQuestionResponse[]): RoomSurveySession {
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
    sourceSurveyType: (row.source_survey_type as RoomSurveySession["sourceSurveyType"]) ?? undefined,
    pendingQuestionIds: row.pending_question_ids ?? undefined,
    pendingGrade: row.pending_grade || undefined,
    deferredQuestionIds: row.deferred_question_ids ?? undefined,
    deferredToCloseOut: row.deferred_to_closeout || undefined,
    traditionalStudioCopiedFromRoomId: row.traditional_studio_copied_from_room_id ?? undefined,
    traditionalStudioCopyReviewPending: row.traditional_studio_copy_review_pending || undefined,
    responses: responses.map((r) => ({
      questionId: r.question_id,
      value: r.value as string | string[],
      comment: r.comment ?? undefined,
      photos: r.photos ?? undefined,
    })),
  }
}

async function syncPrewalk(
  school: AisdSchoolOption,
  preWalk: PreWalkState | undefined,
): Promise<void> {
  if (!preWalk) return

  await supabaseRestUpsert(
    "esa_prewalk_state",
    {
      school_id: school.id,
      campus_id: school.campusId,
      completed_at: preWalk.completedAt ?? null,
      skipped_at: preWalk.skippedAt ?? null,
    },
    "school_id",
  )

  // Replace school pre-walk mappings wholesale so clears/removals sync to Supabase.
  await supabaseRestDelete(
    "esa_prewalk_mappings",
    `school_id=eq.${encodeURIComponent(school.id)}`,
  )

  const mappings = Object.values(preWalk.mappings ?? {})
  if (mappings.length > 0) {
    await supabaseRestUpsert(
      "esa_prewalk_mappings",
      mappings.map((m) => ({
        school_id: school.id,
        campus_id: school.campusId,
        survey_type: m.surveyType,
        room_id: m.roomId,
        space_type: m.spaceType,
        note1: m.note1 ?? null,
        note2: m.note2 ?? null,
        mapped_at: m.mappedAt ?? null,
      })),
      "school_id,survey_type,room_id",
    )
  }
}

async function syncManualRooms(schoolId: string, manualRooms: ParsedPlanRoom[] | undefined): Promise<void> {
  if (!manualRooms?.length) return
  await supabaseRestUpsert(
    "esa_manual_rooms",
    manualRooms.map((room) => ({
      school_id: schoolId,
      room_id: room.id,
      name: room.name,
      x: room.x,
      y: room.y,
      area: room.area,
      building: room.building ?? null,
      neighborhood: room.neighborhood ?? null,
      area_sqft: room.areaSqft ?? null,
      level_id: room.levelId,
      points: room.points,
      overlay_kind: room.overlayKind ?? null,
    })),
    "school_id,room_id",
  )
}

export async function pushSurveyDraft(input: {
  school: AisdSchoolOption
  draft: PersistedSurveyDraft
  writeSnapshot?: boolean
}): Promise<{ updatedAt: string; action: "pushed" | "skipped_remote_newer" }> {
  const { school, draft, writeSnapshot = false } = input
  if (!isSupabaseServerConfigured()) {
    return { updatedAt: draft.savedAt, action: "pushed" }
  }

  const remoteRows = await supabaseRestSelect<DbSurveySession>(
    "esa_survey_sessions",
    `school_id=eq.${encodeURIComponent(draft.schoolId)}&survey_type=eq.${encodeURIComponent(draft.surveyType)}&select=id,updated_at`,
  )
  const remoteSessionId = remoteRows[0]?.id
  const remoteUpdatedAt = remoteRows[0]?.updated_at
  const localResponseCount = countDraftResponses(draft)

  if (remoteUpdatedAt && remoteUpdatedAt > draft.savedAt) {
    const remoteDraft = await pullSurveyDraft({
      schoolId: draft.schoolId,
      surveyType: draft.surveyType,
    })
    const remoteResponseCount = remoteDraft ? countDraftResponses(remoteDraft) : 0
    if (remoteResponseCount >= localResponseCount) {
      return { updatedAt: remoteUpdatedAt, action: "skipped_remote_newer" }
    }
  }

  await upsertSchool(school)
  const campusAssessmentId = await ensureCampusAssessment(school)

  const session = draft.session
  if (!sessionHasRegisteredAssessor(session)) {
    return { updatedAt: draft.savedAt, action: "pushed" }
  }

  const [upsertedSession] = await supabaseRestUpsert(
    "esa_survey_sessions",
    {
      survey_id: session.surveyId,
      campus_assessment_id: campusAssessmentId,
      school_id: session.schoolId,
      campus_id: session.campusId,
      school_name: session.schoolName,
      survey_type: session.surveyType,
      building: session.building || "Main",
      assessor_name: session.assessorName ?? null,
      assessor_email: session.assessorEmail ?? null,
      assessor_registered_at: session.assessorRegisteredAt ?? null,
      started_at: session.startedAt,
      submitted_at: session.submittedAt ?? draft.lastSubmission?.submittedAt ?? null,
      final_comment: session.finalComment ?? null,
      campus_submitted_at: session.campusSubmittedAt ?? null,
      updated_at: draft.savedAt,
    },
    "school_id,survey_type",
  )

  const sessionId = (upsertedSession as DbSurveySession).id

  const rooms = Object.values(session.rooms)
  if (localResponseCount === 0 && remoteSessionId) {
    const existingResponses = await supabaseRestSelect<{ room_id: string }>(
      "esa_question_responses",
      `survey_session_id=eq.${encodeURIComponent(remoteSessionId)}&select=room_id&limit=1`,
    )
    if (existingResponses.length > 0) {
      return { updatedAt: remoteUpdatedAt ?? draft.savedAt, action: "skipped_remote_newer" }
    }
  }

  await supabaseRestDelete(
    "esa_question_responses",
    `survey_session_id=eq.${encodeURIComponent(sessionId)}`,
  )
  await supabaseRestDelete(
    "esa_survey_rooms",
    `survey_session_id=eq.${encodeURIComponent(sessionId)}`,
  )
  await supabaseRestDelete(
    "esa_outdoor_pins",
    `survey_session_id=eq.${encodeURIComponent(sessionId)}`,
  )

  if (rooms.length > 0) {
    await supabaseRestInsert("esa_survey_rooms", rooms.map((room) => roomToDb(sessionId, room)))

    const responses = rooms.flatMap((room) =>
      room.responses.map((response) => responseToDb(sessionId, room.roomId, response)),
    )
    if (responses.length > 0) {
      await supabaseRestInsert("esa_question_responses", responses)
    }
  }

  const pins = session.outdoorElementPins ?? []
  if (pins.length > 0) {
    await supabaseRestInsert(
      "esa_outdoor_pins",
      pins.map((pin) => ({
        survey_session_id: sessionId,
        pin_id: pin.id,
        element_type: pin.elementType,
        lng: pin.lng,
        lat: pin.lat,
        placed_at: pin.placedAt,
      })),
    )
  }

  // Pre-walk is school-scoped and has its own endpoint. Draft sync must not
  // replace esa_prewalk_mappings — a module draft with empty preWalk would wipe
  // assignments for every other user.
  await syncManualRooms(school.id, draft.manualRooms)

  if (writeSnapshot && draft.lastSubmission) {
    const sub = draft.lastSubmission
    const revisionRows = await supabaseRestSelect<{ revision_number: number }>(
      "esa_submission_snapshots",
      `survey_session_id=eq.${encodeURIComponent(sessionId)}&kind=eq.module&select=revision_number&order=revision_number.desc&limit=1`,
    )
    const nextRevision = (revisionRows[0]?.revision_number ?? 0) + 1
    await supabaseRestInsert("esa_submission_snapshots", {
      survey_session_id: sessionId,
      campus_assessment_id: campusAssessmentId,
      school_id: draft.schoolId,
      campus_id: session.campusId,
      survey_type: draft.surveyType,
      kind: session.campusSubmittedAt ? "campus" : "module",
      revision_number: nextRevision,
      submitted_at: sub.submittedAt,
      submitted_by: session.assessorEmail ?? null,
      session_json: sub.session,
      campus_json: sub.campus,
      floor_plan_rooms: sub.floorPlanRooms,
    })
  }

  if (session.campusSubmittedAt) {
    await supabaseRestUpsert(
      "esa_campus_assessments",
      {
        id: campusAssessmentId,
        school_id: school.id,
        campus_id: school.campusId,
        school_name: school.displayName,
        status: "campus_submitted",
        final_comment: session.finalComment ?? null,
        campus_submitted_at: session.campusSubmittedAt,
        campus_submitted_by: session.assessorEmail ?? null,
        updated_at: draft.savedAt,
      },
      "id",
    )
  }

  return { updatedAt: draft.savedAt, action: "pushed" }
}

type DbSubmissionSnapshot = {
  survey_session_id: string
  submitted_at: string
  session_json: SurveySession
  campus_json: SurveySubmission["campus"]
  floor_plan_rooms: SurveySubmission["floorPlanRooms"]
}

function restInFilter(column: string, values: string[]): string {
  if (values.length === 0) return `${column}=eq.__none__`
  return `${column}=in.(${values.map((v) => encodeURIComponent(v)).join(",")})`
}

async function loadSchoolSharedDraftData(schoolId: string): Promise<{
  preWalk: PreWalkState
  manualRooms: ParsedPlanRoom[]
}> {
  const [prewalkStateRows, prewalkMappingRows, manualRoomRows] = await Promise.all([
    supabaseRestSelect<{ completed_at: string | null; skipped_at: string | null }>(
      "esa_prewalk_state",
      `school_id=eq.${encodeURIComponent(schoolId)}&select=completed_at,skipped_at`,
    ),
    supabaseRestSelect<DbPrewalkMapping>(
      "esa_prewalk_mappings",
      `school_id=eq.${encodeURIComponent(schoolId)}&select=*`,
    ),
    supabaseRestSelect<DbManualRoom>(
      "esa_manual_rooms",
      `school_id=eq.${encodeURIComponent(schoolId)}&select=*`,
    ),
  ])

  const mappings: PreWalkState["mappings"] = {}
  for (const row of prewalkMappingRows) {
    mappings[`${row.survey_type}::${row.room_id}`] = {
      roomId: row.room_id,
      surveyType: row.survey_type,
      spaceType: row.space_type,
      note1: row.note1 ?? undefined,
      note2: row.note2 ?? undefined,
      mappedAt: row.mapped_at ?? undefined,
    }
  }

  const preWalk: PreWalkState = {
    mappings,
    completedAt: prewalkStateRows[0]?.completed_at ?? null,
    skippedAt: prewalkStateRows[0]?.skipped_at ?? null,
  }

  const manualRooms: ParsedPlanRoom[] = manualRoomRows.map((room) => ({
    id: room.room_id,
    name: room.name,
    x: room.x,
    y: room.y,
    area: room.area,
    building: room.building ?? undefined,
    neighborhood: room.neighborhood ?? undefined,
    areaSqft: room.area_sqft ?? undefined,
    levelId: room.level_id,
    points: (room.points as ParsedPlanRoom["points"]) ?? [],
    overlayKind: (room.overlay_kind as ParsedPlanRoom["overlayKind"]) ?? undefined,
  }))

  return { preWalk, manualRooms }
}

function buildDraftFromSessionRow(
  sessionRow: DbSurveySession,
  roomRows: DbSurveyRoom[],
  responseRows: DbQuestionResponse[],
  pinRows: DbOutdoorPin[],
  snapshot: DbSubmissionSnapshot | undefined,
  shared: { preWalk: PreWalkState; manualRooms: ParsedPlanRoom[] },
): PersistedSurveyDraft | null {
  const responsesByRoom = new Map<string, DbQuestionResponse[]>()
  for (const response of responseRows) {
    const list = responsesByRoom.get(response.room_id) ?? []
    list.push(response)
    responsesByRoom.set(response.room_id, list)
  }

  const rooms: Record<string, RoomSurveySession> = {}
  for (const row of roomRows) {
    rooms[row.room_id] = dbRoomToSession(row, responsesByRoom.get(row.room_id) ?? [])
  }

  const outdoorElementPins: OutdoorElementPin[] = pinRows.map((pin) => ({
    id: pin.pin_id,
    elementType: pin.element_type,
    lng: pin.lng,
    lat: pin.lat,
    placedAt: pin.placed_at,
  }))

  const surveySession: SurveySession = {
    surveyId: sessionRow.survey_id,
    surveyType: sessionRow.survey_type,
    schoolId: sessionRow.school_id,
    schoolName: sessionRow.school_name,
    campusId: sessionRow.campus_id,
    building: sessionRow.building,
    rooms,
    outdoorElementPins: outdoorElementPins.length ? outdoorElementPins : undefined,
    assessorName: sessionRow.assessor_name ?? undefined,
    assessorEmail: sessionRow.assessor_email ?? undefined,
    assessorRegisteredAt: sessionRow.assessor_registered_at ?? undefined,
    startedAt: sessionRow.started_at,
    updatedAt: sessionRow.updated_at,
    submittedAt: sessionRow.submitted_at ?? undefined,
    finalComment: sessionRow.final_comment ?? undefined,
    campusSubmittedAt: sessionRow.campus_submitted_at ?? undefined,
  }

  const lastSubmission: SurveySubmission | null = snapshot
    ? {
        session: snapshot.session_json,
        submittedAt: snapshot.submitted_at,
        campus: snapshot.campus_json,
        floorPlanRooms: snapshot.floor_plan_rooms ?? [],
      }
    : null

  if (!sessionHasProgress(surveySession) && !lastSubmission) {
    if (!sessionRow.submitted_at && !sessionRow.campus_submitted_at) {
      return null
    }
  }

  return {
    version: 1,
    schoolId: sessionRow.school_id,
    surveyType: sessionRow.survey_type,
    session: surveySession,
    selectedLevelId: null,
    preWalk: shared.preWalk,
    manualRooms: shared.manualRooms,
    lastSubmission,
    savedAt: sessionRow.updated_at,
  }
}

async function buildDraftsForSessionRows(
  sessionRows: DbSurveySession[],
  sharedBySchool: Map<string, { preWalk: PreWalkState; manualRooms: ParsedPlanRoom[] }>,
): Promise<PersistedSurveyDraft[]> {
  if (!sessionRows.length) return []

  const sessionIds = sessionRows.map((row) => row.id)
  const [roomRows, responseRows, pinRows, snapshotRows] = await Promise.all([
    supabaseRestSelect<DbSurveyRoom>(
      "esa_survey_rooms",
      `${restInFilter("survey_session_id", sessionIds)}&select=*`,
    ),
    supabaseRestSelect<DbQuestionResponse>(
      "esa_question_responses",
      `${restInFilter("survey_session_id", sessionIds)}&select=*`,
    ),
    supabaseRestSelect<DbOutdoorPin>(
      "esa_outdoor_pins",
      `${restInFilter("survey_session_id", sessionIds)}&select=*`,
    ),
    supabaseRestSelect<DbSubmissionSnapshot>(
      "esa_submission_snapshots",
      `${restInFilter("survey_session_id", sessionIds)}&select=survey_session_id,submitted_at,session_json,campus_json,floor_plan_rooms&order=submitted_at.desc`,
    ),
  ])

  const roomsBySession = new Map<string, DbSurveyRoom[]>()
  for (const row of roomRows) {
    const list = roomsBySession.get(row.survey_session_id) ?? []
    list.push(row)
    roomsBySession.set(row.survey_session_id, list)
  }

  const responsesBySession = new Map<string, DbQuestionResponse[]>()
  for (const row of responseRows) {
    const list = responsesBySession.get(row.survey_session_id) ?? []
    list.push(row)
    responsesBySession.set(row.survey_session_id, list)
  }

  const pinsBySession = new Map<string, DbOutdoorPin[]>()
  for (const row of pinRows) {
    const list = pinsBySession.get(row.survey_session_id) ?? []
    list.push(row)
    pinsBySession.set(row.survey_session_id, list)
  }

  const snapshotBySession = new Map<string, DbSubmissionSnapshot>()
  for (const row of snapshotRows) {
    if (!snapshotBySession.has(row.survey_session_id)) {
      snapshotBySession.set(row.survey_session_id, row)
    }
  }

  const drafts: PersistedSurveyDraft[] = []
  for (const sessionRow of sessionRows) {
    const shared = sharedBySchool.get(sessionRow.school_id)
    if (!shared) continue
    const draft = buildDraftFromSessionRow(
      sessionRow,
      roomsBySession.get(sessionRow.id) ?? [],
      responsesBySession.get(sessionRow.id) ?? [],
      pinsBySession.get(sessionRow.id) ?? [],
      snapshotBySession.get(sessionRow.id),
      shared,
    )
    if (draft) drafts.push(draft)
  }

  return drafts
}

export async function pullSurveyDraftsForSchool(schoolId: string): Promise<PersistedSurveyDraft[]> {
  if (!isSupabaseServerConfigured()) return []

  const sessionRows = await supabaseRestSelect<DbSurveySession>(
    "esa_survey_sessions",
    `school_id=eq.${encodeURIComponent(schoolId)}&select=*`,
  )
  if (!sessionRows.length) return []

  const shared = await loadSchoolSharedDraftData(schoolId)
  const sharedBySchool = new Map([[schoolId, shared]])
  return buildDraftsForSessionRows(sessionRows, sharedBySchool)
}

export async function pullAllSurveyDrafts(): Promise<PersistedSurveyDraft[]> {
  if (!isSupabaseServerConfigured()) return []

  const sessionRows = await supabaseRestSelect<DbSurveySession>(
    "esa_survey_sessions",
    "select=*&order=updated_at.desc",
  )
  if (!sessionRows.length) return []

  const schoolIds = [...new Set(sessionRows.map((row) => row.school_id))]
  const sharedBySchool = new Map<string, { preWalk: PreWalkState; manualRooms: ParsedPlanRoom[] }>()
  await Promise.all(
    schoolIds.map(async (schoolId) => {
      sharedBySchool.set(schoolId, await loadSchoolSharedDraftData(schoolId))
    }),
  )

  return buildDraftsForSessionRows(sessionRows, sharedBySchool)
}

export async function pullSurveyDraft(input: {
  schoolId: string
  surveyType: SurveyType
}): Promise<PersistedSurveyDraft | null> {
  const drafts = await pullSurveyDraftsForSchool(input.schoolId)
  return drafts.find((draft) => draft.surveyType === input.surveyType) ?? null
}

export function isSurveyDbConfigured(): boolean {
  return isSupabaseServerConfigured()
}

/** Push school pre-walk mappings without requiring a registered assessor or survey session. */
export async function pushPrewalkOnly(input: {
  school: AisdSchoolOption
  preWalk: PreWalkState
}): Promise<{ updatedAt: string }> {
  if (!isSupabaseServerConfigured()) {
    return { updatedAt: new Date().toISOString() }
  }

  await upsertSchool(input.school)
  await syncPrewalk(input.school, input.preWalk)
  return { updatedAt: new Date().toISOString() }
}

/** Load pre-walk room assignments for a school from Supabase. */
export async function pullPrewalkForSchool(schoolId: string): Promise<PreWalkState | null> {
  if (!isSupabaseServerConfigured()) return null
  const shared = await loadSchoolSharedDraftData(schoolId)
  return shared.preWalk
}
