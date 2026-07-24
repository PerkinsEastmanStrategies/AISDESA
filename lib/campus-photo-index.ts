import type { PreWalkState, RoomSurveySession, SurveySession, SurveyType } from "@aisd/shared"
import { getRoomSurveyRubric, surveyTypeLabel } from "@aisd/shared"
import {
  getPreWalkSpaceTypePhoto,
  parsePreWalkSpaceTypePhotoKey,
  preWalkMappingList,
} from "@/lib/prewalk"
import {
  displaySpaceTypeFromStoragePath,
  resolveSurveyPhotoPublicUrl,
  spaceTypesMatch,
  type SurveyPhotoUploadContext,
} from "@/lib/photo-storage"
import { floorPlanRoomLookupIds } from "@/lib/room-neighborhood-lookup"
import { normalizeResponsePhotos } from "@/lib/response-photos"
import { loadDraftsForSchool, type PersistedSurveyDraft } from "@/lib/survey-persistence"

export type CampusPhotoKind = "question" | "space-type"

export interface CampusPhotoEntry {
  id: string
  url: string
  roomId: string
  surveyType: SurveyType
  kind: CampusPhotoKind
  label: string
  questionId?: string
}

export function normalizePhotoRoomId(roomId: string): string {
  return roomId.trim().toUpperCase()
}

export type PhotoIndexFloorPlanRoom = {
  id: string
  name?: string | null
}

export type PhotoIndexRoomAliasMap = ReadonlyMap<string, readonly string[]>

/** Normalize room ids from Supabase path segments (underscores, encoding). */
function normalizeIndexRoomId(raw: string): string {
  let value = raw.trim()
  try {
    value = decodeURIComponent(value)
  } catch {
    /* keep raw */
  }
  return value.replace(/_/g, " ").trim()
}

function lookupKeysForRoomId(roomId: string, extraNames: Iterable<string> = []): Set<string> {
  const keys = new Set<string>()
  const normalized = normalizeIndexRoomId(roomId)
  for (const candidate of [roomId, normalized]) {
    for (const key of floorPlanRoomLookupIds({ id: candidate, name: candidate })) {
      keys.add(key)
    }
  }
  for (const alias of extraNames) {
    const aliasNorm = normalizeIndexRoomId(alias)
    for (const candidate of [alias, aliasNorm]) {
      for (const key of floorPlanRoomLookupIds({ id: candidate, name: candidate })) {
        keys.add(key)
      }
    }
  }
  return keys
}

function indexAliasesForRoom(
  indexRoomId: string,
  aliasMap?: PhotoIndexRoomAliasMap,
): readonly string[] {
  if (!aliasMap?.size) return []
  const candidates = [indexRoomId, normalizeIndexRoomId(indexRoomId)]
  for (const candidate of candidates) {
    const direct = aliasMap.get(candidate)
    if (direct?.length) return direct
  }

  const indexKeys = lookupKeysForRoomId(indexRoomId)
  for (const aliases of aliasMap.values()) {
    for (const alias of aliases) {
      for (const key of floorPlanRoomLookupIds({ id: alias, name: alias })) {
        if (indexKeys.has(key)) return aliases
      }
    }
  }
  return []
}

function dottedSubroomMatches(indexRoomId: string, planRoomId: string): boolean {
  const indexNorm = normalizePhotoRoomId(normalizeIndexRoomId(indexRoomId))
  const planNorm = normalizePhotoRoomId(planRoomId)
  if (!indexNorm || !planNorm) return false
  if (indexNorm === planNorm) return true
  // Index A112.1 → plan A112, or index A112 → plan A112.1 when parent polygon is absent
  if (indexNorm.startsWith(`${planNorm}.`)) return true
  if (planNorm.startsWith(`${indexNorm}.`)) return true
  return false
}

/** Session roomNumber / schoolRoomNumber aliases keyed by plan room id. */
export function buildSessionRoomAliasMap(
  sessionsBySurveyType?: Partial<Record<SurveyType, SurveySession>>,
  liveSession?: SurveySession | null,
): PhotoIndexRoomAliasMap {
  const map = new Map<string, Set<string>>()
  const sessions: SurveySession[] = []
  for (const session of Object.values(sessionsBySurveyType ?? {})) {
    if (session) sessions.push(session)
  }
  if (liveSession) sessions.push(liveSession)

  const addAliases = (key: string, aliases: Iterable<string>) => {
    const bucket = map.get(key) ?? new Set<string>()
    for (const alias of aliases) {
      if (alias) bucket.add(alias)
    }
    map.set(key, bucket)
  }

  for (const session of sessions) {
    for (const [roomId, roomSession] of Object.entries(session.rooms)) {
      const labels = [
        roomId,
        roomSession.roomNumber?.trim(),
        roomSession.schoolRoomNumber?.trim(),
      ].filter((value): value is string => Boolean(value))

      for (const key of labels) {
        addAliases(key, labels)
      }
    }
  }

  const frozen = new Map<string, readonly string[]>()
  for (const [roomId, aliases] of map) {
    frozen.set(roomId, [...aliases])
  }
  return frozen
}

/** Match photo-index room ids to floor-plan ids (handles case, spaces, punctuation). */
export function photoIndexRoomMatchesPlanRoom(
  indexRoomId: string,
  planRoom: PhotoIndexFloorPlanRoom,
  aliasMap?: PhotoIndexRoomAliasMap,
  allPlanRooms?: readonly PhotoIndexFloorPlanRoom[],
): boolean {
  const indexAliases = indexAliasesForRoom(indexRoomId, aliasMap)
  const indexKeys = lookupKeysForRoomId(indexRoomId, indexAliases)
  for (const key of floorPlanRoomLookupIds(planRoom)) {
    if (indexKeys.has(key)) return true
  }

  if (dottedSubroomMatches(indexRoomId, planRoom.id)) {
    const indexNorm = normalizePhotoRoomId(normalizeIndexRoomId(indexRoomId))
    const planNorm = normalizePhotoRoomId(planRoom.id)
    if (planNorm.startsWith(`${indexNorm}.`)) {
      const parentOnPlan = allPlanRooms?.some(
        (room) => normalizePhotoRoomId(room.id) === indexNorm,
      )
      if (!parentOnPlan) return true
    } else {
      return true
    }
  }

  return false
}

function photoDedupeKey(entry: Pick<CampusPhotoEntry, "roomId" | "url">): string {
  return `${normalizePhotoRoomId(entry.roomId)}::${entry.url}`
}

function questionLabel(
  surveyType: SurveyType,
  roomSession: RoomSurveySession,
  questionId: string,
  schoolClass?: string | null,
): string {
  const rubric = getRoomSurveyRubric(
    surveyType,
    roomSession.roomType,
    roomSession.gradeType,
    schoolClass,
  )
  const question = rubric?.questions.find((q) => q.questionId === questionId)
  if (!question) return questionId
  const text = question.question.trim()
  return text.length > 72 ? `${text.slice(0, 69)}…` : text
}

function addPhoto(map: Map<string, CampusPhotoEntry>, entry: CampusPhotoEntry): void {
  map.set(photoDedupeKey(entry), entry)
}

function spaceTypePhotoLabel(surveyType: SurveyType, spaceType: string): string {
  return `General ${spaceType} photo · ${surveyTypeLabel(surveyType)}`
}

function legacyPreWalkMappedRoomIds(
  preWalk: PreWalkState | undefined | null,
  surveyType: SurveyType,
  spaceType: string,
): string[] {
  if (!preWalk) return []
  return [
    ...new Set(
      preWalkMappingList(preWalk.mappings)
        .filter(
          (m) => m.surveyType === surveyType && spaceTypesMatch(m.spaceType, spaceType),
        )
        .map((m) => m.roomId),
    ),
  ]
}

function collectFromSession(
  map: Map<string, CampusPhotoEntry>,
  surveyType: SurveyType,
  session: SurveySession,
  campusId: string,
  schoolId: string,
  schoolClass?: string | null,
): void {
  for (const [roomId, roomSession] of Object.entries(session.rooms)) {
    for (const response of roomSession.responses) {
      const photoUrls = normalizeResponsePhotos(response)
      for (const photo of photoUrls) {
        const url = resolveSurveyPhotoPublicUrl(
          {
            kind: "question",
            campusId,
            schoolId,
            surveyType,
            roomId,
            questionId: response.questionId,
          },
          photo,
        )
        if (!url) continue
        addPhoto(map, {
          id: `${surveyType}:${roomId}:q:${response.questionId}:${url}`,
          url,
          roomId,
          surveyType,
          kind: "question",
          questionId: response.questionId,
          label: questionLabel(surveyType, roomSession, response.questionId, schoolClass),
        })
      }
    }
  }
}

function addSpaceTypePhotoForRoom(
  map: Map<string, CampusPhotoEntry>,
  input: {
    surveyType: SurveyType
    roomId: string
    spaceType: string
    url: string
    pathSuffix?: string
  },
): void {
  addPhoto(map, {
    id: `${input.surveyType}:${input.roomId}:space:${input.spaceType}${input.pathSuffix ?? ""}`,
    url: input.url,
    roomId: input.roomId,
    surveyType: input.surveyType,
    kind: "space-type",
    label: spaceTypePhotoLabel(input.surveyType, input.spaceType),
  })
}

function collectFromPreWalk(
  map: Map<string, CampusPhotoEntry>,
  preWalk: PreWalkState | undefined | null,
  campusId: string,
  schoolId: string,
): void {
  if (!preWalk) return

  for (const [key, photo] of Object.entries(preWalk.spaceTypePhotos ?? {})) {
    if (!photo?.trim()) continue
    const parsed = parsePreWalkSpaceTypePhotoKey(key)
    if (!parsed) continue

    const url = resolveSurveyPhotoPublicUrl(
      {
        kind: "prewalk-space-type",
        campusId,
        schoolId,
        surveyType: parsed.surveyType,
        spaceType: parsed.spaceType,
        roomId: parsed.roomId,
      },
      photo,
    )
    if (!url) continue

    if (parsed.roomId) {
      addSpaceTypePhotoForRoom(map, {
        surveyType: parsed.surveyType,
        roomId: parsed.roomId,
        spaceType: parsed.spaceType,
        url,
      })
      continue
    }

    const mappedRoomIds = legacyPreWalkMappedRoomIds(preWalk, parsed.surveyType, parsed.spaceType)
    for (const roomId of mappedRoomIds) {
      addSpaceTypePhotoForRoom(map, {
        surveyType: parsed.surveyType,
        roomId,
        spaceType: parsed.spaceType,
        url,
      })
    }
  }
}

function collectFromDraft(
  map: Map<string, CampusPhotoEntry>,
  draft: PersistedSurveyDraft,
  campusId: string,
  schoolClass?: string | null,
): void {
  if (draft.surveyType === "closeout") return
  collectFromSession(map, draft.surveyType, draft.session, campusId, draft.schoolId, schoolClass)
  collectFromPreWalk(map, draft.preWalk, campusId, draft.schoolId)
  if (draft.lastSubmission?.session) {
    collectFromSession(
      map,
      draft.surveyType,
      draft.lastSubmission.session,
      campusId,
      draft.schoolId,
      schoolClass,
    )
  }
}

export function campusPhotoEntryFromStoragePath(
  parsed: {
    url: string
    path: string
    surveyType: string
    kind: SurveyPhotoUploadContext["kind"]
    roomId?: string
    questionId?: string
    spaceType?: string
  },
  preWalk?: PreWalkState,
  schoolClass?: string | null,
  sessionsBySurveyType?: Partial<Record<SurveyType, SurveySession>>,
): CampusPhotoEntry[] {
  const surveyType = parsed.surveyType as SurveyType

  if (parsed.kind === "question" && parsed.roomId && parsed.questionId) {
    const roomSession =
      sessionsBySurveyType?.[surveyType]?.rooms[parsed.roomId] ??
      Object.values(sessionsBySurveyType ?? {}).flatMap((session) =>
        session?.rooms[parsed.roomId!] ? [session.rooms[parsed.roomId!]] : [],
      )[0]
    const label = roomSession
      ? questionLabel(surveyType, roomSession, parsed.questionId, schoolClass)
      : parsed.questionId
    return [
      {
        id: `${surveyType}:${parsed.roomId}:q:${parsed.questionId}:${parsed.path}`,
        url: parsed.url,
        roomId: parsed.roomId,
        surveyType,
        kind: "question",
        questionId: parsed.questionId,
        label,
      },
    ]
  }

  if (parsed.kind === "prewalk-space-type" && parsed.spaceType) {
    const spaceType = displaySpaceTypeFromStoragePath(parsed.spaceType)
    const label = spaceTypePhotoLabel(surveyType, spaceType)

    if (parsed.roomId) {
      return [
        {
          id: `${surveyType}:${parsed.roomId}:space:${spaceType}:${parsed.path}`,
          url: parsed.url,
          roomId: parsed.roomId,
          surveyType,
          kind: "space-type",
          label,
        },
      ]
    }

    const mappedRoomIds = legacyPreWalkMappedRoomIds(preWalk, surveyType, spaceType)
    return mappedRoomIds.map((roomId) => ({
      id: `${surveyType}:${roomId}:space:${spaceType}:${parsed.path}`,
      url: parsed.url,
      roomId,
      surveyType,
      kind: "space-type" as const,
      label,
    }))
  }

  return []
}

function indexFromMap(map: Map<string, CampusPhotoEntry>): CampusPhotoIndex {
  const byRoomId: Record<string, CampusPhotoEntry[]> = {}
  const uniqueUrls = new Set<string>()

  for (const entry of map.values()) {
    uniqueUrls.add(entry.url)
    const list = byRoomId[entry.roomId] ?? []
    list.push(entry)
    byRoomId[entry.roomId] = list
  }

  for (const roomId of Object.keys(byRoomId)) {
    byRoomId[roomId].sort((a, b) => a.label.localeCompare(b.label))
  }

  const roomIds = Object.keys(byRoomId).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  )

  return {
    byRoomId,
    roomIds,
    totalCount: uniqueUrls.size,
  }
}

export function mergeCampusPhotoEntries(
  base: CampusPhotoIndex,
  extra: CampusPhotoEntry[],
): CampusPhotoIndex {
  const map = new Map<string, CampusPhotoEntry>()
  for (const entries of Object.values(base.byRoomId)) {
    for (const entry of entries) addPhoto(map, entry)
  }
  for (const entry of extra) addPhoto(map, entry)
  return indexFromMap(map)
}

export interface CampusPhotoIndex {
  byRoomId: Record<string, CampusPhotoEntry[]>
  roomIds: string[]
  totalCount: number
}

export function buildCampusPhotoIndex(input: {
  campusId: string
  schoolId: string
  schoolClass?: string | null
  sessionsBySurveyType?: Partial<Record<SurveyType, SurveySession>>
  liveSurveyType?: SurveyType
  liveSession?: SurveySession | null
  livePreWalk?: PreWalkState
}): CampusPhotoIndex {
  const map = new Map<string, CampusPhotoEntry>()
  const drafts = loadDraftsForSchool(input.schoolId)

  const sessionsBySurveyType: Partial<Record<SurveyType, SurveySession>> = {
    ...input.sessionsBySurveyType,
  }
  if (input.liveSession && input.liveSurveyType && input.liveSurveyType !== "closeout") {
    sessionsBySurveyType[input.liveSurveyType] = input.liveSession
  }

  for (const draft of drafts) {
    collectFromDraft(map, draft, input.campusId, input.schoolClass)
  }

  for (const [surveyType, session] of Object.entries(sessionsBySurveyType) as [
    SurveyType,
    SurveySession,
  ][]) {
    if (!session || surveyType === "closeout") continue
    collectFromSession(
      map,
      surveyType,
      session,
      input.campusId,
      input.schoolId,
      input.schoolClass,
    )
  }

  const preWalkSources = [input.livePreWalk, ...drafts.map((draft) => draft.preWalk)]
  for (const preWalk of preWalkSources) {
    collectFromPreWalk(map, preWalk, input.campusId, input.schoolId)
  }

  return indexFromMap(map)
}

/** True when the photo index has at least one photo for this floor-plan room. */
export function photoIndexHasRoom(
  index: CampusPhotoIndex,
  roomId: string,
  roomName?: string | null,
  aliasMap?: PhotoIndexRoomAliasMap,
  allPlanRooms?: readonly PhotoIndexFloorPlanRoom[],
): boolean {
  const planRoom: PhotoIndexFloorPlanRoom = { id: roomId, name: roomName }
  return index.roomIds.some((id) =>
    photoIndexRoomMatchesPlanRoom(id, planRoom, aliasMap, allPlanRooms),
  )
}

/** Floor-plan room ids that should show a camera marker (exact plan ids, not index keys). */
export function buildPhotoRoomIdSet(
  index: CampusPhotoIndex,
  floorPlanRooms: Iterable<PhotoIndexFloorPlanRoom>,
  aliasMap?: PhotoIndexRoomAliasMap,
): Set<string> {
  const planRooms = [...floorPlanRooms]
  const ids = new Set<string>()
  for (const room of planRooms) {
    if (
      index.roomIds.some((indexRoomId) =>
        photoIndexRoomMatchesPlanRoom(indexRoomId, room, aliasMap, planRooms),
      )
    ) {
      ids.add(room.id)
    }
  }
  return ids
}

export function photosForRoom(
  index: CampusPhotoIndex,
  roomId: string,
  roomName?: string | null,
  aliasMap?: PhotoIndexRoomAliasMap,
  allPlanRooms?: readonly PhotoIndexFloorPlanRoom[],
): CampusPhotoEntry[] {
  if (index.byRoomId[roomId]) return index.byRoomId[roomId] ?? []
  const planRoom: PhotoIndexFloorPlanRoom = { id: roomId, name: roomName }
  const matchId = index.roomIds.find((id) =>
    photoIndexRoomMatchesPlanRoom(id, planRoom, aliasMap, allPlanRooms),
  )
  return matchId ? index.byRoomId[matchId] ?? [] : []
}

export function resolvePhotoIndexRoomId(
  index: CampusPhotoIndex,
  roomId: string,
  roomName?: string | null,
  aliasMap?: PhotoIndexRoomAliasMap,
  allPlanRooms?: readonly PhotoIndexFloorPlanRoom[],
): string | null {
  const planRoom: PhotoIndexFloorPlanRoom = { id: roomId, name: roomName }
  return (
    index.roomIds.find((id) =>
      photoIndexRoomMatchesPlanRoom(id, planRoom, aliasMap, allPlanRooms),
    ) ?? null
  )
}

/** Whether a plan room should show a photo marker (index id may differ from plan id). */
export function planRoomHasPhotoMarker(
  index: CampusPhotoIndex,
  roomId: string,
  roomName?: string | null,
  aliasMap?: PhotoIndexRoomAliasMap,
  allPlanRooms?: readonly PhotoIndexFloorPlanRoom[],
): boolean {
  return photoIndexHasRoom(index, roomId, roomName, aliasMap, allPlanRooms)
}

/** Whether the selected gallery room (index key) matches a floor-plan room. */
export function selectedPhotoIndexRoomMatchesPlanRoom(
  selectedIndexRoomId: string | null | undefined,
  planRoom: PhotoIndexFloorPlanRoom,
  aliasMap?: PhotoIndexRoomAliasMap,
  allPlanRooms?: readonly PhotoIndexFloorPlanRoom[],
): boolean {
  if (!selectedIndexRoomId) return false
  return photoIndexRoomMatchesPlanRoom(
    selectedIndexRoomId,
    planRoom,
    aliasMap,
    allPlanRooms,
  )
}
