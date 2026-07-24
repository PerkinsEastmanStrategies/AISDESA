"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Camera, ImageOff, Loader2 } from "lucide-react"
import SurveyFloorPlan from "@/components/survey-floor-plan"
import {
  buildCampusPhotoIndex,
  buildPhotoRoomIdSet,
  buildSessionRoomAliasMap,
  campusPhotoEntryFromStoragePath,
  mergeCampusPhotoEntries,
  photosForRoom,
  planRoomHasPhotoMarker,
  resolvePhotoIndexRoomId,
  selectedPhotoIndexRoomMatchesPlanRoom,
  type CampusPhotoEntry,
} from "@/lib/campus-photo-index"
import type { ParsedSurveyPhotoPath } from "@/lib/photo-storage"
import { useSurvey } from "@/lib/survey-store"
import type { PreWalkState, SurveySession, SurveyType } from "@aisd/shared"
import { cn } from "@/lib/utils"

export default function ResultsPhotosPanel({
  campusId,
  schoolId,
  schoolClass,
  sessionsBySurveyType,
  liveSurveyType,
  liveSession,
  livePreWalk,
  roomNameById,
}: {
  campusId: string
  schoolId: string
  schoolClass?: string | null
  sessionsBySurveyType?: Partial<Record<SurveyType, SurveySession>>
  liveSurveyType?: SurveyType
  liveSession?: SurveySession | null
  livePreWalk?: PreWalkState
  roomNameById: Record<string, string>
}) {
  const { state, setLevel } = useSurvey()

  const localPhotoIndex = useMemo(
    () =>
      buildCampusPhotoIndex({
        campusId,
        schoolId,
        schoolClass,
        sessionsBySurveyType,
        liveSurveyType,
        liveSession,
        livePreWalk,
      }),
    [
      campusId,
      schoolId,
      schoolClass,
      sessionsBySurveyType,
      liveSurveyType,
      liveSession,
      livePreWalk,
    ],
  )

  const [remoteParsed, setRemoteParsed] = useState<ParsedSurveyPhotoPath[]>([])
  const [remoteLoading, setRemoteLoading] = useState(true)
  const [remoteError, setRemoteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setRemoteLoading(true)
    setRemoteError(null)

    void fetch(
      `/api/photos/index?campusId=${encodeURIComponent(campusId)}&schoolId=${encodeURIComponent(schoolId)}`,
    )
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { parsed?: ParsedSurveyPhotoPath[]; error?: string }
          | null
        if (!response.ok) {
          throw new Error(payload?.error || "Could not load photos from Supabase")
        }
        if (!cancelled) setRemoteParsed(payload?.parsed ?? [])
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRemoteParsed([])
          setRemoteError(error instanceof Error ? error.message : "Could not load photos from Supabase")
        }
      })
      .finally(() => {
        if (!cancelled) setRemoteLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [campusId, schoolId])

  const remotePhotos = useMemo(
    () =>
      remoteParsed.flatMap((parsed) =>
        campusPhotoEntryFromStoragePath(
          parsed,
          livePreWalk,
          schoolClass,
          sessionsBySurveyType,
        ),
      ),
    [remoteParsed, livePreWalk, schoolClass, sessionsBySurveyType],
  )

  const photoIndex = useMemo(
    () => mergeCampusPhotoEntries(localPhotoIndex, remotePhotos),
    [localPhotoIndex, remotePhotos],
  )

  const floorPlanRooms = useMemo(
    () =>
      Object.entries(roomNameById).map(([id, name]) => ({
        id,
        name,
      })),
    [roomNameById],
  )

  const sessionRoomAliasMap = useMemo(
    () => buildSessionRoomAliasMap(sessionsBySurveyType, liveSession),
    [sessionsBySurveyType, liveSession],
  )

  const photoRoomIds = useMemo(
    () => buildPhotoRoomIdSet(photoIndex, floorPlanRooms, sessionRoomAliasMap),
    [photoIndex, floorPlanRooms, sessionRoomAliasMap],
  )

  const photoRoomHasMarker = useCallback(
    (roomId: string, roomName?: string | null) =>
      planRoomHasPhotoMarker(
        photoIndex,
        roomId,
        roomName,
        sessionRoomAliasMap,
        floorPlanRooms,
      ),
    [photoIndex, sessionRoomAliasMap, floorPlanRooms],
  )

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  /** Room id we already auto-leveled for — skip re-sync so manual floor toggles stick. */
  const autoLeveledForRoomRef = useRef<string | null>(null)

  const selectedPhotoRoomMatchesPlan = useCallback(
    (roomId: string, roomName?: string | null) =>
      selectedPhotoIndexRoomMatchesPlanRoom(
        selectedRoomId,
        { id: roomId, name: roomName },
        sessionRoomAliasMap,
        floorPlanRooms,
      ),
    [selectedRoomId, sessionRoomAliasMap, floorPlanRooms],
  )

  useEffect(() => {
    if (
      selectedRoomId &&
      (photoIndex.byRoomId[selectedRoomId] ||
        floorPlanRooms.some((room) =>
          resolvePhotoIndexRoomId(
            photoIndex,
            room.id,
            room.name,
            sessionRoomAliasMap,
            floorPlanRooms,
          ) === selectedRoomId,
        ))
    ) {
      return
    }
    setSelectedRoomId(photoIndex.roomIds[0] ?? null)
  }, [photoIndex, selectedRoomId, floorPlanRooms, sessionRoomAliasMap])

  useEffect(() => {
    if (!selectedRoomId) {
      autoLeveledForRoomRef.current = null
      return
    }
    const planRoom = state.allRooms.find(
      (room) =>
        resolvePhotoIndexRoomId(
          photoIndex,
          room.id,
          room.name,
          sessionRoomAliasMap,
          floorPlanRooms,
        ) === selectedRoomId,
    )
    if (!planRoom?.levelId) return
    if (autoLeveledForRoomRef.current === selectedRoomId) return
    autoLeveledForRoomRef.current = selectedRoomId
    setLevel(planRoom.levelId)
  }, [photoIndex, selectedRoomId, state.allRooms, setLevel, sessionRoomAliasMap, floorPlanRooms])

  const handlePhotoRoomSelect = useCallback(
    (roomId: string) => {
      const roomName = roomNameById[roomId]
      setSelectedRoomId(
        resolvePhotoIndexRoomId(
          photoIndex,
          roomId,
          roomName,
          sessionRoomAliasMap,
          floorPlanRooms,
        ) ?? roomId,
      )
    },
    [photoIndex, roomNameById, sessionRoomAliasMap, floorPlanRooms],
  )

  const selectedPhotos = useMemo(() => {
    if (!selectedRoomId) return []
    const planRoom = floorPlanRooms.find(
      (room) =>
        resolvePhotoIndexRoomId(
          photoIndex,
          room.id,
          room.name,
          sessionRoomAliasMap,
          floorPlanRooms,
        ) === selectedRoomId,
    )
    return planRoom
      ? photosForRoom(
          photoIndex,
          planRoom.id,
          planRoom.name,
          sessionRoomAliasMap,
          floorPlanRooms,
        )
      : photosForRoom(
          photoIndex,
          selectedRoomId,
          undefined,
          sessionRoomAliasMap,
          floorPlanRooms,
        )
  }, [photoIndex, floorPlanRooms, selectedRoomId, sessionRoomAliasMap])

  const selectedRoomName = selectedRoomId
    ? roomNameById[selectedRoomId] ?? selectedRoomId
    : null

  if (remoteLoading && photoIndex.totalCount === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white px-4 py-10 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-slate-400" aria-hidden />
        <p className="mt-3 text-sm font-medium text-slate-700">Loading photos from Supabase…</p>
      </div>
    )
  }

  if (photoIndex.totalCount === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white px-4 py-10 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <ImageOff className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
        <p className="mt-3 text-sm font-medium text-slate-700">No submitted photos yet</p>
        <p className="mt-1 text-xs text-slate-500">
          Photos appear here after you confirm submission during the survey. If you already uploaded
          one, check that it lives under this school&apos;s folder in the ESA Pictures bucket.
        </p>
        {remoteError && (
          <p className="mt-3 text-xs text-amber-700">
            Supabase lookup: {remoteError}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-[min(70vh,720px)] flex-col gap-3 lg:flex-row">
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] lg:min-h-0 lg:w-[45%] lg:shrink-0">
        <div className="border-b border-slate-200/80 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Floor plan
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Tap a camera icon on the plan to view that room&apos;s photos.
          </p>
        </div>
        <SurveyFloorPlan
          readOnly
          photoGalleryMode
          photoRoomIds={photoRoomIds}
          photoRoomHasMarker={photoRoomHasMarker}
          selectedPhotoRoomMatchesPlan={selectedPhotoRoomMatchesPlan}
          selectedPhotoRoomId={selectedRoomId}
          onPhotoRoomSelect={handlePhotoRoomSelect}
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-200/80 px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Room photos
              </p>
              <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                {selectedRoomName ?? "Select a room"}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {selectedPhotos.length
                  ? `${selectedPhotos.length} photo${selectedPhotos.length === 1 ? "" : "s"} from Supabase`
                  : "Choose a marked room on the floor plan"}
              </p>
            </div>
            <div className="shrink-0 rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80">
              {photoIndex.totalCount} total
            </div>
          </div>
          {remoteLoading && (
            <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Syncing bucket…
            </p>
          )}
          {remoteError && (
            <p className="mt-2 text-[10px] text-amber-700">Bucket sync: {remoteError}</p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {selectedPhotos.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Tap a camera icon on the floor plan to view photos for that room.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
              {selectedPhotos.map((photo) => (
                <PhotoTile
                  key={photo.id}
                  photo={photo}
                  roomLabel={roomNameById[photo.roomId] ?? photo.roomId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PhotoTile({ photo, roomLabel: room }: { photo: CampusPhotoEntry; roomLabel: string }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50/80">
      <a
        href={photo.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block"
        aria-label={`Open full photo: ${photo.label}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.label}
          loading="lazy"
          decoding="async"
          className="aspect-[4/3] w-full object-cover transition-opacity group-hover:opacity-95"
        />
      </a>
      <figcaption className="space-y-1 px-2.5 py-2">
        <p className="line-clamp-2 text-[11px] font-medium leading-snug text-slate-800">
          {photo.label}
        </p>
        <p className="flex items-center gap-1 text-[10px] text-slate-500">
          <Camera className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{room}</span>
        </p>
        <p
          className={cn(
            "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium",
            photo.kind === "space-type"
              ? "bg-violet-50 text-violet-700"
              : "bg-blue-50 text-blue-700",
          )}
        >
          {photo.kind === "space-type" ? "Space overview" : "Question photo"}
        </p>
      </figcaption>
    </figure>
  )
}
