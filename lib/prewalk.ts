import type {
  ParsedPlanRoom,
  PreWalkRoomMapping,
  PreWalkState,
  RoomSurveySession,
  SurveyType,
} from "@aisd/shared"
import { isNaSurveyRoomId } from "@aisd/shared"
import {
  isSpaceTypeForSurveyModule,
  spaceTypeOptionsForSurvey,
  surveyModuleUsesSpaceTypePicker,
  surveyNavTypesForSchool,
  surveyTypesForSchool,
  surveyTypesInSameNavGroup,
} from "@aisd/shared"

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

/** Combine pre-walk data from multiple sources (school storage, module drafts, live state, remote). */
export function mergePreWalkStates(
  ...sources: (PreWalkState | null | undefined)[]
): PreWalkState {
  let mappings: PreWalkState["mappings"] = {}
  let spaceTypePhotos: NonNullable<PreWalkState["spaceTypePhotos"]> = {}
  let completedAt: string | null | undefined
  let skippedAt: string | null | undefined

  for (const source of sources) {
    if (!source) continue
    for (const [key, mapping] of Object.entries(source.mappings ?? {})) {
      if (!mapping?.spaceType) continue
      const existing = mappings[key]
      if (!existing) {
        mappings[key] = mapping
        continue
      }
      const existingAt = existing.mappedAt ? Date.parse(existing.mappedAt) : 0
      const incomingAt = mapping.mappedAt ? Date.parse(mapping.mappedAt) : 0
      mappings[key] =
        incomingAt >= existingAt && Number.isFinite(incomingAt) ? mapping : existing
    }
    spaceTypePhotos = { ...spaceTypePhotos, ...(source.spaceTypePhotos ?? {}) }
    completedAt = latestPreWalkTimestamp(completedAt, source.completedAt)
    skippedAt = latestPreWalkTimestamp(skippedAt, source.skippedAt)
  }

  return {
    mappings,
    spaceTypePhotos,
    completedAt: completedAt ?? null,
    skippedAt: skippedAt ?? null,
  }
}

function latestPreWalkTimestamp(
  current: string | null | undefined,
  incoming: string | null | undefined,
): string | null | undefined {
  if (!incoming) return current
  if (!current) return incoming
  return Date.parse(incoming) >= Date.parse(current) ? incoming : current
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

/** Pre-walk mapped rooms that are missing from parsed floor plan data (fallback for load/parse gaps). */
export function mergePreWalkPlanRooms(
  planRooms: ParsedPlanRoom[],
  mappings: Record<string, PreWalkRoomMapping>,
  surveyType: SurveyType,
  levelId: string,
): ParsedPlanRoom[] {
  const byId = new Map(planRooms.map((room) => [room.id.toUpperCase(), room]))
  const extras: ParsedPlanRoom[] = []
  for (const mapping of preWalkMappingList(mappings, surveyType)) {
    const key = mapping.roomId.toUpperCase()
    if (byId.has(key)) continue
    byId.set(key, {
      id: mapping.roomId,
      name: mapping.roomId,
      x: 0,
      y: 0,
      area: 1,
      levelId,
      points: [],
      overlayKind: "hotspot",
    })
    extras.push(byId.get(key)!)
  }
  return extras.length ? [...planRooms, ...extras] : planRooms
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

  const sessionType =
    selectedRoomId && sessionRooms?.[selectedRoomId]?.roomType
      ? sessionRooms[selectedRoomId].roomType
      : null
  if (sessionType && isSpaceTypeForSurveyModule(surveyType, sessionType, schoolClass)) {
    return sessionType
  }
  if (
    pendingStudioType &&
    isSpaceTypeForSurveyModule(surveyType, pendingStudioType, schoolClass)
  ) {
    return pendingStudioType
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
}): boolean {
  const { roomId, preWalkMappings, schoolClass, surveyType, ...rest } = args
  if (isNaSurveyRoomId(roomId)) return true
  if (!surveyUsesSpaceTypePicker(surveyType, schoolClass)) return true

  const mappedType = preWalkSpaceTypeForRoom(preWalkMappings, roomId, surveyType, schoolClass)
  const spaceType = effectiveSpaceTypeForSelection({
    ...rest,
    surveyType,
    preWalkMappings,
    schoolClass,
  })

  // Hide/block rooms pre-mapped to a different space type while surveying one type.
  if (spaceType && mappedType && mappedType !== spaceType) return false

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

/** Show the yes/no pre-walk prompt after the user picks a school. */
export function shouldPromptPreWalkOnSchoolSelect(
  preWalk?: PreWalkState | null,
  schoolClass?: string | null,
): boolean {
  if (!schoolSupportsPreWalk(schoolClass)) return false
  if (preWalk?.completedAt || preWalk?.skippedAt) return false
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
