"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Camera, ImagePlus, Trash2, X } from "lucide-react"
import PhotoPrivacyReminderModal from "@/components/photo-privacy-reminder-modal"
import {
  deleteSurveyPhoto,
  isPhotoStorageEnabled,
  uploadSurveyPhoto,
  type SurveyPhotoUploadContext,
} from "@/lib/photo-storage"
import { compressImageFile } from "@/lib/photo-utils"

interface QuestionPhotoProps {
  photo?: string
  onChange: (photo: string | undefined) => void
  label?: string
  /** Show the picker expanded by default. */
  startExpanded?: boolean
  /** Optional note shown in the privacy popup before capture. */
  privacyContextNote?: string
  /** When set, uploads to Supabase Storage instead of keeping a local data URL. */
  uploadContext?: SurveyPhotoUploadContext | null
}

type PhotoPickerSource = "camera" | "gallery"

export default function QuestionPhoto({
  photo,
  onChange,
  label = "Photo",
  startExpanded = false,
  privacyContextNote,
  uploadContext = null,
}: QuestionPhotoProps) {
  const [open, setOpen] = useState(startExpanded || !!photo)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [privacyReminderOpen, setPrivacyReminderOpen] = useState(false)
  const [pendingPicker, setPendingPicker] = useState<PhotoPickerSource | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const fieldId = useId()
  const cameraId = `${fieldId}-camera`
  const galleryId = `${fieldId}-gallery`

  const hasPhoto = !!photo

  useEffect(() => {
    if (startExpanded && !photo) setOpen(true)
  }, [startExpanded, photo])

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const compressed = await compressImageFile(file)

      if (uploadContext && isPhotoStorageEnabled()) {
        setUploading(true)
        try {
          const uploaded = await uploadSurveyPhoto(uploadContext, compressed)
          onChange(uploaded.url)
          setOpen(true)
          return
        } catch {
          setError("Cloud upload failed — photo saved on this device only.")
        } finally {
          setUploading(false)
        }
      }

      onChange(compressed)
      setOpen(true)
    } catch {
      setError("Could not add photo. Try a smaller image.")
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = () => {
    void deleteSurveyPhoto(photo)
    onChange(undefined)
    setOpen(false)
    setError(null)
  }

  const requestPicker = (source: PhotoPickerSource) => {
    setPendingPicker(source)
    setPrivacyReminderOpen(true)
  }

  const cancelPicker = () => {
    setPrivacyReminderOpen(false)
    setPendingPicker(null)
  }

  const confirmPicker = () => {
    const source = pendingPicker
    setPrivacyReminderOpen(false)
    setPendingPicker(null)
    if (source === "camera") cameraRef.current?.click()
    else if (source === "gallery") galleryRef.current?.click()
  }

  if (!open && !hasPhoto) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200/80 active:bg-slate-50 active:text-slate-700"
      >
        <Camera className="h-3.5 w-3.5 shrink-0" />
        Add photo
      </button>
    )
  }

  if (!open && hasPhoto) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-[var(--color-primary)] ring-1 ring-blue-100"
      >
        <Camera className="h-3.5 w-3.5 shrink-0" />
        Photo added
      </button>
    )
  }

  return (
    <>
      <PhotoPrivacyReminderModal
        open={privacyReminderOpen}
        onContinue={confirmPicker}
        onClose={cancelPicker}
        contextNote={privacyContextNote}
      />
      <div className="w-full basis-full border-t border-dashed border-slate-200 pt-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
          {label}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-0.5 text-[var(--color-muted-foreground)] active:bg-slate-100"
          aria-label="Collapse photo"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {hasPhoto ? (
        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="Question attachment" className="max-h-40 w-full object-cover" />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[10px] font-medium text-white active:bg-black/80"
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => requestPicker("camera")}
            className="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2 py-2 text-xs text-[var(--color-muted-foreground)] active:bg-slate-100 disabled:opacity-50"
          >
            <Camera className="h-4 w-4" />
            Take photo
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => requestPicker("gallery")}
            className="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2 py-2 text-xs text-[var(--color-muted-foreground)] active:bg-slate-100 disabled:opacity-50"
          >
            <ImagePlus className="h-4 w-4" />
            Choose file
          </button>
        </div>
      )}

      {hasPhoto && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => requestPicker("camera")}
            className="text-[10px] text-[var(--color-primary)] active:underline disabled:opacity-50"
          >
            Retake
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => requestPicker("gallery")}
            className="text-[10px] text-[var(--color-primary)] active:underline disabled:opacity-50"
          >
            Replace
          </button>
        </div>
      )}

      {loading && (
        <p className="mt-1 text-[10px] text-[var(--color-muted-foreground)]">
          {uploading ? "Uploading to cloud…" : "Processing…"}
        </p>
      )}
      {error && <p className="mt-1 text-[10px] text-amber-700">{error}</p>}

      <input
        ref={cameraRef}
        id={cameraId}
        name={cameraId}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      <input
        ref={galleryRef}
        id={galleryId}
        name={galleryId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0])
          e.target.value = ""
        }}
      />
    </div>
    </>
  )
}
