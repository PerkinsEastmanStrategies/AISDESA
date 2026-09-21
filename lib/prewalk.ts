import type { PreWalkRoomMapping, PreWalkState, RoomSurveySession, SurveyType } from "@aisd/shared"
import {
  SURVEY_TYPES,
  isSpaceTypeForSurveyModule,
  spaceTypeOptionsForSurvey,
  surveyModuleUsesSpaceTypePicker,
  surveyNavTypesForSchool,
  surveyTypesForSchool,
  surveyTypesInSameNavGroup,
} from "@aisd/shared"
import { roomHasAssessmentProgress } from "@/lib/school-assessment-index"

export const EMPTY_PREWALK: PreWalkState = { mappings: {}, spaceTypePhotos: {} }

export const PREWALK_DESIGN_INTENT_TITLE = "Select rooms by design intent"

export const PREWALK_DESIGN_INTENT_NOTE =
  "Choose rooms that are in active use and being used in a way that aligns with their design intent—for example, assess the room designed as the art studio, not a repurposed storage space."

export const PREWALK_DESIGN_INTENT_SHORT =
  "Map rooms in active use that match their design intent."

const PREWALK_PALETTE = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#ec4899",
  "#84cc16",
  "#0ea5e9",
  "#d946ef",
] as const

export function preWalkMappingKey(surveyType: SurveyType, roomId: string): string {
  return `${surveyType}::${roomId}`
}

export function preWalkSpaceTypePhotoKey(surveyType: SurveyType, spaceType: string): string {
  return `${surveyType}::${spaceType}`
}

export function preWalkSpaceTypeExistsKey(surveyType: SurveyType, spaceType: string): string {
  return `${surveyType}::${spaceType}`
}

export function parsePreWalkSpaceTypeExistsKey(
  key: string,
): { surveyType: SurveyType; spaceType: string } | null {
  const sep = key.indexOf("::")
  if (sep <= 0) return null
  const surveyType = key.slice(0, sep) as SurveyType
  const spaceType = key.slice(sep + 2).trim()
  if (!spaceType || spaceType.includes("::")) return null
  if (!SURVEY_TYPES.includes(surveyType)) return null
  if (!preWalkSurveyAllowsSpaceTypeExists(surveyType)) return null
  return { surveyType, spaceType }
}

export function readPreWalkSpaceTypeExists(
  preWalk: PreWalkState,
  surveyType: SurveyType,
  spaceType: string,
): boolean | null {
  const value = preWalk.spaceTypeExists?.[preWalkSpaceTypeExistsKey(surveyType, spaceType)]
  if (value === true || value === false) return value
  return null
}

/** Neighborhoods and outdoor skip the school-level existence pre-answer. */
export function preWalkSurveyAllowsSpaceTypeExists(surveyType: SurveyType): boolean {
  return surveyType !== "neighborhoods" && surveyType !== "outdoor" && surveyType !== "closeout"
}

export function preWalkRoomSpaceTypePhotoKey(
  surveyType: SurveyType,
  roomId: string,
  spaceType: string,
): string {
  return `${surveyType}::${roomId}::${spaceType}`
}

export function getPreWalkSpaceTypePhoto(
  preWalk: PreWalkState,
  surveyType: SurveyType,
  spaceType: string,
): string | undefined {
  const photo = preWalk.spaceTypePhotos?.[preWalkSpaceTypePhotoKey(surveyType, spaceType)]
  return photo?.trim() || undefined
}

/** Room-scoped space photo (room survey). Falls back to legacy global space-type key. */
export function getPreWalkRoomSpaceTypePhoto(
  preWalk: PreWalkState,
  surveyType: SurveyType,
  roomId: string,
  spaceType: string,
): string | undefined {
  const roomPhoto =
    preWalk.spaceTypePhotos?.[preWalkRoomSpaceTypePhotoKey(surveyType, roomId, spaceType)]
  if (roomPhoto?.trim()) return roomPhoto.trim()
  return getPreWalkSpaceTypePhoto(preWalk, surveyType, spaceType)
}

/** Room-scoped photo only — no legacy global fallback (for upload UI gating). */
export function getPreWalkRoomSpaceTypePhotoOnly(
  preWalk: PreWalkState,
  surveyType: SurveyType,
  roomId: string,
  spaceType: string,
): string | undefined {
  const photo = preWalk.spaceTypePhotos?.[preWalkRoomSpaceTypePhotoKey(surveyType, roomId, spaceType)]
  return photo?.trim() || undefined
}

export function parsePreWalkSpaceTypePhotoKey(key: string): {
  surveyType: SurveyType
  roomId?: string
  spaceType: string
} | null {
  const parts = key.split("::")
  if (parts.length === 2) {
    return { surveyType: parts[0] as SurveyType, spaceType: parts[1] }
  }
  if (parts.length >= 3) {
    return {
      surveyType: parts[0] as SurveyType,
      roomId: parts[1],
      spaceType: parts.slice(2).join("::"),
    }
  }
  return null
}

export function inferSurveyTypeForSpaceType(
  spaceType: string,
  schoolClass?: string | null,
): SurveyType | null {
  for (const surveyType of surveyTypesForSchool(schoolClass)) {
    if (isSpaceTypeForSurveyModule(surveyType, spaceType, schoolClass)) {
      return surveyType
    }
  }
  return null
}

/** Migrate legacy room-only keys to survey-scoped composite keys. */
export function migratePreWalkState(
  preWalk: PreWalkState | undefined | null,
  schoolClass?: string | null,
): PreWalkState {
  if (!preWalk?.mappings) return EMPTY_PREWALK

  const next: Record<string, PreWalkRoomMapping> = {}
  for (const [key, mapping] of Object.entries(preWalk.mappings)) {
    if (!mapping?.spaceType) continue

    const roomId = mapping.roomId || key
    const parsedSurveyType =
      mapping.surveyType ??
      (key.includes("::") ? (key.split("::")[0] as SurveyType) : null) ??
      inferSurveyTypeForSpaceType(mapping.spaceType, schoolClass) ??
      "studios"

    const normalized: PreWalkRoomMapping = {
      ...mapping,
      roomId,
      surveyType: parsedSurveyType,
    }
    next[preWalkMappingKey(parsedSurveyType, roomId)] = normalized
  }

  return {
    ...preWalk,
    mappings: next,
    spaceTypePhotos: preWalk.spaceTypePhotos ?? {},
  }
}

export function preWalkSurveyTypesForSchool(schoolClass?: string | null): SurveyType[] {
  return surveyNavTypesForSchool(schoolClass).filter((surveyType) =>
    surveyModuleUsesSpaceTypePicker(surveyType, schoolClass),
  )
}

export function schoolSupportsPreWalk(schoolClass?: string | null): boolean {
  return preWalkSurveyTypesForSchool(schoolClass).length > 0
}

export function surveyTypeSupportsPreWalk(
  _surveyType: SurveyType,
  schoolClass?: string | null,
): boolean {
  return schoolSupportsPreWalk(schoolClass)
}

export function spaceTypeOptionsForPreWalk(
  surveyType: SurveyType,
  schoolClass?: string | null,
): readonly string[] {
  return spaceTypeOptionsForSurvey(surveyType, schoolClass)
}

export function getPreWalkMapping(
  mappings: Record<string, PreWalkRoomMapping>,
  surveyType: SurveyType,
  roomId: string,
): PreWalkRoomMapping | undefined {
  return mappings[preWalkMappingKey(surveyType, roomId)]
}

/**
 * Resolve a pre-walk mapping for the active survey module, including sibling modules
 * in the same nav group (e.g. Community Partner mapped under Arrival while surveying Administration).
 */
export function getPreWalkMappingForSurveyModule(
  mappings: Record<string, PreWalkRoomMapping>,
  surveyType: SurveyType,
  roomId: string,
  schoolClass?: string | null,
): PreWalkRoomMapping | undefined {
  const direct = getPreWalkMapping(mappings, surveyType, roomId)
  if (
    direct?.spaceType?.trim() &&
    isSpaceTypeForSurveyModule(surveyType, direct.spaceType, schoolClass)
  ) {
    return direct
  }

  for (const moduleType of surveyTypesInSameNavGroup(surveyType, schoolClass)) {
    if (moduleType === surveyType) continue
    const sibling = getPreWalkMapping(mappings, moduleType, roomId)
    if (
      sibling?.spaceType?.trim() &&
      isSpaceTypeForSurveyModule(surveyType, sibling.spaceType, schoolClass)
    ) {
      return sibling
    }
  }

  return undefined
}

export function preWalkMappingsByRoomForSurvey(
  mappings: Record<string, PreWalkRoomMapping>,
  surveyType: SurveyType,
): Record<string, PreWalkRoomMapping> {
  const out: Record<string, PreWalkRoomMapping> = {}
  for (const mapping of Object.values(mappings)) {
    if (mapping.surveyType !== surveyType || !mapping.spaceType) continue
    out[mapping.roomId] = mapping
  }
  return out
}

export function preWalkSpaceTypeColor(
  spaceType: string,
  options: readonly string[],
): string {
  const idx = options.indexOf(spaceType)
  if (idx < 0) return "#94a3b8"
  return PREWALK_PALETTE[idx % PREWALK_PALETTE.length]
}

export function countMappingsBySpaceType(
  mappings: Record<string, PreWalkRoomMapping>,
  surveyType?: SurveyType,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const mapping of Object.values(mappings)) {
    if (!mapping.spaceType) continue
    if (surveyType && mapping.surveyType !== surveyType) continue
    counts.set(mapping.spaceType, (counts.get(mapping.spaceType) ?? 0) + 1)
  }
  return counts
}

export function preWalkMappingList(
  mappings: Record<string, PreWalkRoomMapping>,
  surveyType?: SurveyType,
): PreWalkRoomMapping[] {
  return Object.values(mappings).filter(
    (mapping) => mapping.spaceType && (!surveyType || mapping.surveyType === surveyType),
  )
}

export function hasPreWalkMappings(
  mappings: Record<string, PreWalkRoomMapping>,
  surveyType?: SurveyType,
  schoolClass?: string | null,
): boolean {
  if (!surveyType) return preWalkMappingList(mappings).length > 0

  const moduleTypes = new Set(surveyTypesInSameNavGroup(surveyType, schoolClass))
  return Object.values(mappings).some(
    (mapping) =>
      !!mapping.spaceType?.trim() &&
      moduleTypes.has(mapping.surveyType) &&
      isSpaceTypeForSurveyModule(surveyType, mapping.spaceType, schoolClass),
  )
}

export function preWalkSpaceTypeForRoom(
  mappings: Record<string, PreWalkRoomMapping>,
  roomId: string | null | undefined,
  surveyType: SurveyType,
  schoolClass?: string | null,
): string | null {
  if (!roomId) return null
  const mapping = getPreWalkMappingForSurveyModule(mappings, surveyType, roomId, schoolClass)
  const spaceType = mapping?.spaceType?.trim()
  return spaceType || null
}

export function preWalkRoomIdsForSpaceType(
  mappings: Record<string, PreWalkRoomMapping>,
  spaceType: string,
  surveyType: SurveyType,
): string[] {
  return Object.values(mappings)
    .filter((mapping) => mapping.surveyType === surveyType && mapping.spaceType === spaceType)
    .map((mapping) => mapping.roomId)
}

export function preWalkRoomIdsForSurvey(
  mappings: Record<string, PreWalkRoomMapping>,
  surveyType: SurveyType,
): string[] {
  return preWalkMappingList(mappings, surveyType).map((mapping) => mapping.roomId)
}

export function preWalkHasMappingsForSpaceType(
  mappings: Record<string, PreWalkRoomMapping>,
  spaceType: string,
  surveyType: SurveyType,
): boolean {
  return Object.values(mappings).some(
    (mapping) => mapping.surveyType === surveyType && mapping.spaceType === spaceType,
  )
}

export function surveyUsesSpaceTypePicker(
  surveyType: SurveyType,
  schoolClass?: string | null,
): boolean {
  return surveyModuleUsesSpaceTypePicker(surveyType, schoolClass)
}

export function effectiveSpaceTypeForSelection(args: {
  surveyType: SurveyType
  pendingStudioType: string | null
  selectedRoomId: string | null
  sessionRooms: Record<string, RoomSurveySession> | undefined
  preWalkMappings: Record<string, PreWalkRoomMapping>
  schoolClass?: string | null
}): string | null {
  const {
    surveyType,
    pendingStudioType,
    selectedRoomId,
    sessionRooms,
    preWalkMappings,
    schoolClass,
  } = args
  if (!surveyUsesSpaceTypePicker(surveyType, schoolClass)) return null

  const sessionRoom = selectedRoomId ? sessionRooms?.[selectedRoomId] : undefined
  const sessionType = sessionRoom?.roomType?.trim() || null
  const sessionHasProgress = roomHasAssessmentProgress(sessionRoom)
  const pendingType =
    pendingStudioType && isSpaceTypeForSurveyModule(surveyType, pendingStudioType, schoolClass)
      ? pendingStudioType
      : null

  // The space-type picker is the source of truth when the assessor just chose a
  // different type. A started room only fills the picker when resuming (pending
  // empty or already matching that room).
  if (pendingType) return pendingType
  if (
    sessionHasProgress &&
    sessionType &&
    isSpaceTypeForSurveyModule(surveyType, sessionType, schoolClass)
  ) {
    return sessionType
  }
  if (sessionType && isSpaceTypeForSurveyModule(surveyType, sessionType, schoolClass)) {
    return sessionType
  }
  const preWalkType = selectedRoomId
    ? preWalkSpaceTypeForRoom(preWalkMappings, selectedRoomId, surveyType, schoolClass)
    : null
  if (preWalkType && isSpaceTypeForSurveyModule(surveyType, preWalkType, schoolClass)) {
    return preWalkType
  }
  return null
}

/** Whether a room can be selected given pre-walk mappings and the active space type. */
export function canSelectRoomForSurvey(args: {
  surveyType: SurveyType
  preWalkMappings: Record<string, PreWalkRoomMapping>
  pendingStudioType: string | null
  selectedRoomId: string | null
  sessionRooms: Record<string, RoomSurveySession> | undefined
  roomId: string
  schoolClass?: string | null
  /** Prefer rooms already surveyed for this space type over pre-walk identification. */
  preferSurveyedRooms?: boolean
}): boolean {
  const { roomId, preWalkMappings, schoolClass, surveyType, sessionRooms, preferSurveyedRooms, ...rest } = args
  if (!surveyUsesSpaceTypePicker(surveyType, schoolClass)) return true

  const mappedType = preWalkSpaceTypeForRoom(preWalkMappings, roomId, surveyType, schoolClass)
  const existing = sessionRooms
    ? sessionRooms[roomId] ??
      Object.values(sessionRooms).find(
        (room) => room.roomId.trim().toUpperCase() === roomId.trim().toUpperCase(),
      )
    : undefined
  const spaceType = effectiveSpaceTypeForSelection({
    ...rest,
    sessionRooms,
    surveyType,
    preWalkMappings,
    schoolClass,
  })

  if (
    preferSurveyedRooms &&
    existing?.roomType &&
    isSpaceTypeForSurveyModule(surveyType, existing.roomType, schoolClass) &&
    (roomHasAssessmentProgress(existing) || !!existing.roomType)
  ) {
    return true
  }

  // Hide/block rooms pre-mapped to a different space type while surveying one type.
  if (spaceType && mappedType && mappedType !== spaceType) return false

  // Same for rooms that already have a started assessment of another type.
  if (
    spaceType &&
    roomHasAssessmentProgress(existing) &&
    existing?.roomType &&
    existing.roomType !== spaceType
  ) {
    return false
  }

  return true
}

export function shouldOfferPreWalk(
  preWalk: PreWalkState,
  hasScoringStarted: boolean,
  schoolClass?: string | null,
): boolean {
  if (!schoolSupportsPreWalk(schoolClass)) return false
  if (preWalk.completedAt || preWalk.skippedAt) return false
  if (hasScoringStarted) return false
  return true
}

export function preWalkHasAssignments(preWalk?: PreWalkState | null): boolean {
  return preWalkMappingList(preWalk?.mappings ?? {}).length > 0
}

export function preWalkHasCloudState(preWalk?: PreWalkState | null): boolean {
  return (
    preWalkHasAssignments(preWalk) ||
    !!preWalk?.completedAt ||
    !!preWalk?.skippedAt ||
    Object.keys(preWalk?.spaceTypeExists ?? {}).length > 0
  )
}

export type PreWalkMappingRef = { surveyType: SurveyType; roomId: string }

function mappingTimestamp(mapping: PreWalkRoomMapping | undefined): number {
  if (!mapping?.mappedAt) return 0
  const ms = Date.parse(mapping.mappedAt)
  return Number.isFinite(ms) ? ms : 0
}

export function parsePreWalkMappingKey(key: string): PreWalkMappingRef | null {
  const sep = key.indexOf("::")
  if (sep <= 0) return null
  const surveyType = key.slice(0, sep) as SurveyType
  const roomId = key.slice(sep + 2).trim()
  if (!surveyType || !roomId) return null
  return { surveyType, roomId }
}

const PREWALK_ACK_STORAGE_PREFIX = "aisd-esa:prewalk-acked:"
/** Unacked local-only rows older than this are treated as stale copies of a cloud delete. */
const LOCAL_PREWALK_ADD_GRACE_MS = 20_000

function preWalkAckStorageKey(schoolId: string): string {
  return `${PREWALK_ACK_STORAGE_PREFIX}${schoolId}`
}

export function loadPreWalkAckedMappingKeys(schoolId: string): Set<string> {
  if (typeof window === "undefined" || !schoolId) return new Set()
  try {
    const raw = window.localStorage.getItem(preWalkAckStorageKey(schoolId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((value): value is string => typeof value === "string" && value.includes("::")))
  } catch {
    return new Set()
  }
}

export function savePreWalkAckedMappingKeys(schoolId: string, keys: Iterable<string>): void {
  if (typeof window === "undefined" || !schoolId) return
  try {
    window.localStorage.setItem(preWalkAckStorageKey(schoolId), JSON.stringify([...new Set(keys)]))
  } catch {
    // Private mode / quota — in-memory reconcile still runs for this session.
  }
}

/** Union mappings/photos for multi-user sync; newer mappedAt wins on conflicts. */
export function mergePreWalkStates(
  base: PreWalkState | null | undefined,
  incoming: PreWalkState | null | undefined,
): PreWalkState {
  const left = base ?? EMPTY_PREWALK
  const right = incoming ?? EMPTY_PREWALK
  const mappings: Record<string, PreWalkRoomMapping> = { ...left.mappings }

  for (const [key, remoteMapping] of Object.entries(right.mappings ?? {})) {
    const localMapping = mappings[key]
    if (!localMapping || mappingTimestamp(remoteMapping) >= mappingTimestamp(localMapping)) {
      mappings[key] = remoteMapping
    }
  }

  return {
    mappings,
    spaceTypePhotos: {
      ...(left.spaceTypePhotos ?? {}),
      ...(right.spaceTypePhotos ?? {}),
    },
    // First argument wins on the same key so a just-answered Yes/No is not
    // overwritten by a stale cloud copy. Keys only on the other side are kept.
    spaceTypeExists: {
      ...(right.spaceTypeExists ?? {}),
      ...(left.spaceTypeExists ?? {}),
    },
    completedAt: left.completedAt ?? right.completedAt ?? null,
    skippedAt: left.skippedAt ?? right.skippedAt ?? null,
  }
}

/**
 * Cloud pull: keep remote rows, keep very recent unpushed local adds, drop
 * local rows the cloud no longer has (another device removed them).
 */
export function reconcileLocalPreWalkWithCloud(
  local: PreWalkState | null | undefined,
  remote: PreWalkState | null | undefined,
  ackedKeys: ReadonlySet<string>,
  deletions?: PreWalkMappingRef[],
): { preWalk: PreWalkState; droppedKeys: string[]; nextAckedKeys: Set<string> } {
  const left = local ?? EMPTY_PREWALK
  const right = remote ?? EMPTY_PREWALK
  const deleteKeys = new Set(
    (deletions ?? []).map((entry) => preWalkMappingKey(entry.surveyType, entry.roomId)),
  )
  const now = Date.now()
  const mappings: Record<string, PreWalkRoomMapping> = {}
  const remoteMappings = right.mappings ?? {}
  const localMappings = left.mappings ?? {}

  for (const [key, remoteMapping] of Object.entries(remoteMappings)) {
    if (deleteKeys.has(key)) continue
    const localMapping = localMappings[key]
    mappings[key] =
      localMapping && mappingTimestamp(localMapping) > mappingTimestamp(remoteMapping)
        ? localMapping
        : remoteMapping
  }

  const droppedKeys: string[] = []
  for (const [key, localMapping] of Object.entries(localMappings)) {
    if (mappings[key] || deleteKeys.has(key)) continue
    const mappedAt = mappingTimestamp(localMapping)
    const recentUnackedAdd =
      !ackedKeys.has(key) && mappedAt > 0 && now - mappedAt < LOCAL_PREWALK_ADD_GRACE_MS
    if (recentUnackedAdd) {
      mappings[key] = localMapping
      continue
    }
    droppedKeys.push(key)
  }

  const nextAckedKeys = new Set(Object.keys(remoteMappings))
  for (const key of deleteKeys) nextAckedKeys.delete(key)

  return {
    preWalk: {
      mappings,
      spaceTypePhotos: {
        ...(left.spaceTypePhotos ?? {}),
        ...(right.spaceTypePhotos ?? {}),
      },
      spaceTypeExists: {
        ...(right.spaceTypeExists ?? {}),
        ...(left.spaceTypeExists ?? {}),
      },
      completedAt: left.completedAt ?? right.completedAt ?? null,
      skippedAt: left.skippedAt ?? right.skippedAt ?? null,
    },
    droppedKeys,
    nextAckedKeys,
  }
}

export function applyPreWalkMappingDeletes(
  preWalk: PreWalkState,
  deletions: PreWalkMappingRef[] | undefined,
): PreWalkState {
  if (!deletions?.length) return preWalk
  const mappings = { ...preWalk.mappings }
  for (const deletion of deletions) {
    delete mappings[preWalkMappingKey(deletion.surveyType, deletion.roomId)]
  }
  return { ...preWalk, mappings }
}

export function queuePreWalkMappingDeletes(
  existing: PreWalkMappingRef[],
  next: PreWalkMappingRef[],
): PreWalkMappingRef[] {
  const seen = new Set(existing.map((entry) => preWalkMappingKey(entry.surveyType, entry.roomId)))
  const out = [...existing]
  for (const deletion of next) {
    const key = preWalkMappingKey(deletion.surveyType, deletion.roomId)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(deletion)
  }
  return out
}

export function dropPushedPreWalkDeletes(
  existing: PreWalkMappingRef[],
  pushed: PreWalkMappingRef[],
): PreWalkMappingRef[] {
  if (!pushed.length) return existing
  const done = new Set(pushed.map((entry) => preWalkMappingKey(entry.surveyType, entry.roomId)))
  return existing.filter((entry) => !done.has(preWalkMappingKey(entry.surveyType, entry.roomId)))
}

/** Show the yes/no pre-walk prompt after the user picks a school. */
export function shouldPromptPreWalkOnSchoolSelect(
  preWalk?: PreWalkState | null,
  schoolClass?: string | null,
): boolean {
  if (!schoolSupportsPreWalk(schoolClass)) return false
  if (preWalk?.completedAt || preWalk?.skippedAt) return false
  if (preWalkHasAssignments(preWalk)) return false
  return true
}

export function defaultPreWalkSurveyType(
  surveyType: SurveyType,
  schoolClass?: string | null,
): SurveyType {
  const options = preWalkSurveyTypesForSchool(schoolClass)
  if (options.includes(surveyType)) return surveyType
  return options[0] ?? surveyType
}
