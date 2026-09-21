import type {
  AisdSchoolOption,
  ParsedPlanRoom,
  PreWalkState,
  RoomQuestionResponse,
  RoomSurveySession,
  SurveySession,
} from "@aisd/shared"
import {
  canonicalizeResponseValues,
  displayRoomNumberInSchool,
  getRoomSurveyRubric,
  surveyTypeLabel,
} from "@aisd/shared"
import { normalizeResponsePhotos } from "@/lib/response-photos"
import { preWalkMappingList } from "@/lib/prewalk"
import { loadDraft, loadDraftsForSchool } from "@/lib/survey-persistence"

const CSV_COLUMNS = [
  "record_type",
  "exported_at",
  "save_error",
  "school_id",
  "school_name",
  "campus_id",
  "school_class",
  "survey_type",
  "survey_label",
  "survey_id",
  "assessor_name",
  "assessor_email",
  "session_started_at",
  "session_updated_at",
  "last_local_save_at",
  "final_comment",
  "room_id",
  "room_name",
  "room_number",
  "school_room_number",
  "room_type",
  "grade",
  "neighborhood",
  "building",
  "level_id",
  "area_sqft",
  "space_type_absent",
  "deferred_to_closeout",
  "pending_question_ids",
  "pending_grade",
  "source_survey",
  "question_id",
  "question",
  "question_type",
  "category",
  "subcategory",
  "answer",
  "comment",
  "photo_urls",
  "existence_key",
  "exists",
  "pin_id",
  "pin_element",
  "pin_lng",
  "pin_lat",
  "prewalk_note1",
  "prewalk_note2",
] as const

type CsvColumn = (typeof CSV_COLUMNS)[number]
type CsvRow = Partial<Record<CsvColumn, string | number | boolean | null | undefined>>

export type SurveyCsvExportReason = "error" | "offline" | "backup"

export interface SurveySaveCsvInput {
  school: AisdSchoolOption
  session: SurveySession
  preWalk?: PreWalkState
  allRooms?: ParsedPlanRoom[]
  saveError: SurveyCsvExportReason
  lastSavedAt?: string | null
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function formatAnswer(value: RoomQuestionResponse["value"] | undefined): string {
  const canonical = canonicalizeResponseValues(value)
  if (canonical == null) return ""
  return Array.isArray(canonical) ? canonical.join("; ") : canonical
}

function formatPhotos(response: RoomQuestionResponse | undefined): string {
  const photos = normalizeResponsePhotos(response)
  if (photos.length === 0) return ""
  return photos
    .map((photo) => {
      if (photo.startsWith("data:")) return "[photo on this device — not uploaded]"
      return photo
    })
    .join("; ")
}

function safeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
}

function roomPlanName(allRooms: ParsedPlanRoom[] | undefined, roomId: string): string {
  return allRooms?.find((room) => room.id === roomId)?.name?.trim() || ""
}

function baseRow(input: SurveySaveCsvInput, exportedAt: string): CsvRow {
  const { school, session, saveError, lastSavedAt } = input
  return {
    exported_at: exportedAt,
    save_error: saveError,
    school_id: school.id,
    school_name: school.displayName || session.schoolName,
    campus_id: school.campusId || session.campusId,
    school_class: school.schoolClass ?? "",
    survey_type: session.surveyType,
    survey_label: surveyTypeLabel(session.surveyType),
    survey_id: session.surveyId,
    assessor_name: session.assessorName ?? "",
    assessor_email: session.assessorEmail ?? "",
    session_started_at: session.startedAt,
    session_updated_at: session.updatedAt,
    last_local_save_at: lastSavedAt ?? "",
    final_comment: session.finalComment ?? "",
  }
}

function rowLine(row: CsvRow): string {
  return CSV_COLUMNS.map((column) => csvCell(row[column])).join(",")
}

function roomFields(room: RoomSurveySession, allRooms: ParsedPlanRoom[] | undefined): CsvRow {
  return {
    room_id: room.roomId,
    room_name: roomPlanName(allRooms, room.roomId) || displayRoomNumberInSchool(room),
    room_number: room.roomNumber,
    school_room_number: room.schoolRoomNumber ?? "",
    room_type: room.roomType,
    grade: room.gradeType,
    neighborhood: room.neighborhood ?? "",
    building: room.building ?? "",
    level_id: room.levelId,
    area_sqft: room.areaSqft ?? "",
    space_type_absent: room.spaceTypeMarkedAbsent ? "true" : "false",
    deferred_to_closeout: room.deferredToCloseOut ? "true" : "false",
    pending_question_ids: (room.pendingQuestionIds ?? []).join("; "),
    pending_grade: room.pendingGrade ? "true" : "false",
    source_survey: room.sourceSurveyType ?? "",
    prewalk_note1: room.preWalkNote1 ?? "",
    prewalk_note2: room.preWalkNote2 ?? "",
  }
}

function csvRowsForSurvey(input: SurveySaveCsvInput, exportedAt: string): CsvRow[] {
  const shared = baseRow(input, exportedAt)
  const rows: CsvRow[] = [
    {
      ...shared,
      record_type: "survey",
    },
  ]

  for (const [key, exists] of Object.entries(input.session.spaceTypeExistsAtSchool ?? {})) {
    rows.push({
      ...shared,
      record_type: "existence",
      existence_key: key,
      exists: exists ? "true" : "false",
    })
  }

  for (const mapping of preWalkMappingList(input.preWalk?.mappings ?? {}, input.session.surveyType)) {
    rows.push({
      ...shared,
      record_type: "prewalk_mapping",
      room_id: mapping.roomId,
      room_name: roomPlanName(input.allRooms, mapping.roomId),
      room_type: mapping.spaceType,
      prewalk_note1: mapping.note1 ?? "",
      prewalk_note2: mapping.note2 ?? "",
    })
  }

  for (const pin of input.session.outdoorElementPins ?? []) {
    rows.push({
      ...shared,
      record_type: "outdoor_pin",
      pin_id: pin.id,
      pin_element: pin.elementType,
      pin_lng: pin.lng,
      pin_lat: pin.lat,
    })
  }

  const rooms = Object.values(input.session.rooms).sort((a, b) =>
    displayRoomNumberInSchool(a).localeCompare(displayRoomNumberInSchool(b), undefined, {
      numeric: true,
    }),
  )

  for (const room of rooms) {
    rows.push({
      ...shared,
      ...roomFields(room, input.allRooms),
      record_type: "room",
    })

    const rubric = getRoomSurveyRubric(
      input.session.surveyType,
      room.roomType,
      room.gradeType,
      input.school.schoolClass,
      room.sourceSurveyType,
    )
    const responseMap = new Map(room.responses.map((response) => [response.questionId, response]))
    const questionIds = [
      ...new Set([
        ...(rubric?.questions.map((question) => question.questionId) ?? []),
        ...room.responses.map((response) => response.questionId),
      ]),
    ]

    for (const questionId of questionIds) {
      const question = rubric?.questions.find((item) => item.questionId === questionId)
      const response = responseMap.get(questionId)
      rows.push({
        ...shared,
        ...roomFields(room, input.allRooms),
        record_type: "answer",
        question_id: questionId,
        question: question?.question ?? "",
        question_type: question?.questionType ?? "",
        category: question?.category ?? "",
        subcategory: question?.subcategory ?? "",
        answer: formatAnswer(response?.value),
        comment: response?.comment ?? "",
        photo_urls: formatPhotos(response),
      })
    }
  }

  return rows
}

function csvFromRows(rows: CsvRow[]): string {
  return `${CSV_COLUMNS.join(",")}\r\n${rows.map(rowLine).join("\r\n")}\r\n`
}

function triggerCsvDownload(csv: string, filename: string): string {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  return filename
}

function timestampStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

/** Build a CSV backup of the live survey that failed to save to the database. */
export function buildSurveySaveFailureCsv(input: SurveySaveCsvInput): string {
  return csvFromRows(csvRowsForSurvey(input, new Date().toISOString()))
}

export function buildSurveysCsv(inputs: SurveySaveCsvInput[]): string {
  const exportedAt = new Date().toISOString()
  const rows = inputs.flatMap((input) => csvRowsForSurvey(input, exportedAt))
  return csvFromRows(rows)
}

export function surveySaveFailureCsvFilename(input: SurveySaveCsvInput): string {
  const school = safeFilenamePart(input.school.displayName || input.session.schoolName || "school")
  const survey = safeFilenamePart(surveyTypeLabel(input.session.surveyType))
  return `AISD-ESA-${school}-${survey}-unsaved-${timestampStamp()}.csv`
}

export function schoolLocalBackupCsvFilename(school: AisdSchoolOption, session?: SurveySession): string {
  const name = safeFilenamePart(school.displayName || session?.schoolName || "school")
  return `AISD-ESA-${name}-local-backup-${timestampStamp()}.csv`
}

/** Download a local CSV backup when the database save cannot be confirmed. */
export function downloadSurveySaveFailureCsv(input: SurveySaveCsvInput): string {
  return triggerCsvDownload(buildSurveySaveFailureCsv(input), surveySaveFailureCsvFilename(input))
}

export function collectLocalSchoolBackupInputs(input: {
  school: AisdSchoolOption
  liveSession?: SurveySession | null
  preWalk?: PreWalkState
  allRooms?: ParsedPlanRoom[]
  lastSavedAt?: string | null
}): SurveySaveCsvInput[] {
  const drafts = [...loadDraftsForSchool(input.school.id)]
  const closeout = loadDraft(input.school.id, "closeout")
  if (closeout) drafts.push(closeout)

  const byType = new Map(
    drafts.map((draft) => [
      draft.surveyType,
      {
        session: draft.session,
        preWalk: draft.preWalk,
        savedAt: draft.savedAt,
      },
    ]),
  )
  if (input.liveSession) {
    const existing = byType.get(input.liveSession.surveyType)
    byType.set(input.liveSession.surveyType, {
      session: input.liveSession,
      preWalk: input.preWalk ?? existing?.preWalk,
      savedAt: input.lastSavedAt ?? existing?.savedAt ?? new Date().toISOString(),
    })
  }

  return [...byType.values()]
    .sort((a, b) => a.session.surveyType.localeCompare(b.session.surveyType))
    .map((draft) => ({
      school: input.school,
      session: draft.session,
      preWalk: input.preWalk ?? draft.preWalk,
      allRooms: input.allRooms,
      saveError: "backup" as const,
      lastSavedAt: draft.savedAt ?? input.lastSavedAt,
    }))
}

/** Download every local module for this school from this device. */
export function downloadSchoolLocalBackupCsv(input: {
  school: AisdSchoolOption
  liveSession?: SurveySession | null
  preWalk?: PreWalkState
  allRooms?: ParsedPlanRoom[]
  lastSavedAt?: string | null
}): string | null {
  const surveys = collectLocalSchoolBackupInputs(input)
  if (surveys.length === 0) return null
  return triggerCsvDownload(
    buildSurveysCsv(surveys),
    schoolLocalBackupCsvFilename(input.school, input.liveSession ?? surveys[0]?.session),
  )
}
