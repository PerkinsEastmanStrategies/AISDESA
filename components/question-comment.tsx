"use client"

import { useEffect, useId, useState } from "react"
import { MessageSquare, MessageSquarePlus, Mic, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { isSpeechRecognitionSupported, useSpeechToText } from "@/lib/use-speech-to-text"

interface QuestionCommentProps {
  comment?: string
  onChange: (comment: string) => void
  /** When true, the note field stays open and must be filled. */
  required?: boolean
}

export default function QuestionComment({
  comment,
  onChange,
  required = false,
}: QuestionCommentProps) {
  const [open, setOpen] = useState(required)
  const noteId = useId()
  const text = comment ?? ""
  const hasComment = !!text.trim()
  const missingRequired = required && !hasComment

  const speech = useSpeechToText({
    value: text,
    onChange,
  })

  useEffect(() => {
    if (required) setOpen(true)
  }, [required])

  const handleStop = (e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
    speech.stop()
  }

  const handleClose = () => {
    speech.stop()
    if (required) return
    setOpen(false)
  }

  const handleDone = () => {
    speech.stop()
    const trimmed = (speech.isActive ? speech.displayValue : text).trim()
    if (required && !trimmed) return
    if (trimmed !== text.trim()) onChange(trimmed)
    setOpen(false)
  }

  const handleClear = () => {
    if (required) return
    speech.stop()
    onChange("")
    setOpen(false)
  }

  const handleTextChange = (next: string) => {
    if (speech.isActive) speech.stop()
    onChange(next)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
          hasComment
            ? "bg-blue-50 text-[var(--color-primary)] ring-1 ring-blue-100"
            : "bg-white text-slate-500 ring-1 ring-slate-200/80 active:bg-slate-50 active:text-slate-700",
        )}
      >
        {hasComment ? (
          <>
            <MessageSquare className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Note added</span>
          </>
        ) : (
          <>
            <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />
            <span>Add note</span>
          </>
        )}
      </button>
    )
  }

  const speechSupported = isSpeechRecognitionSupported()

  return (
    <div className="w-full basis-full border-t border-dashed border-slate-200 pt-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-[10px] font-medium uppercase tracking-wide",
            missingRequired ? "text-amber-700" : "text-slate-400",
          )}
        >
          {required ? "Required note" : "Note"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleDone}
            disabled={missingRequired}
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-semibold",
              missingRequired
                ? "cursor-not-allowed text-slate-300"
                : "text-[var(--color-primary)] active:bg-blue-50",
            )}
          >
            Done
          </button>
          {!required && (hasComment || speech.displayValue.trim()) && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded px-1.5 py-0.5 text-[10px] text-[var(--color-muted-foreground)] active:bg-slate-100"
            >
              Clear
            </button>
          )}
          {!required && (
            <button
              type="button"
              onClick={handleClose}
              className="rounded p-0.5 text-[var(--color-muted-foreground)] active:bg-slate-100"
              aria-label="Collapse note"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {speech.isActive && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-red-50 px-2.5 py-2 ring-1 ring-red-200">
          <p className="flex items-center gap-1.5 text-xs text-red-800">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
            {speech.starting ? "Starting microphone…" : "Recording — tap Stop when done"}
          </p>
          <button
            type="button"
            onClick={handleStop}
            onPointerDown={handleStop}
            className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white active:bg-red-700"
          >
            Stop
          </button>
        </div>
      )}

      <div className="relative">
        <label htmlFor={noteId} className="sr-only">
          {required ? "Required note explaining why this could not be assessed" : "Optional note"}
        </label>
        <textarea
          id={noteId}
          name={noteId}
          value={speech.isActive ? speech.displayValue : text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          rows={3}
          required={required}
          aria-invalid={missingRequired || undefined}
          placeholder={
            required
              ? "Explain why you were not able to assess…"
              : "Optional observations…"
          }
          className={cn(
            "w-full resize-none rounded-lg border bg-slate-50/80 px-2.5 py-2 text-sm text-[var(--color-foreground)] placeholder:text-slate-400 outline-none focus:border-[var(--color-primary)] focus:bg-white focus:ring-1 focus:ring-blue-100",
            speechSupported && !speech.isActive ? "pr-10" : "",
            speech.isActive
              ? "border-blue-300 ring-1 ring-blue-100"
              : missingRequired
                ? "border-amber-400 bg-amber-50/40 ring-1 ring-amber-200"
                : "border-slate-200",
          )}
        />
        {speechSupported && !speech.isActive && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              speech.start()
            }}
            aria-label="Start dictation"
            className="absolute bottom-3 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[var(--color-muted-foreground)] shadow-sm ring-1 ring-slate-200 active:bg-slate-50"
          >
            <Mic className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {missingRequired && (
        <p className="mt-1 text-[10px] font-medium text-amber-800" role="alert">
          A note is required when you select Not Able to Assess.
        </p>
      )}
      {!speechSupported && (
        <p className="mt-1 text-[10px] text-[var(--color-muted-foreground)]">
          Voice input works best in Chrome or Edge on mobile.
        </p>
      )}
      {speech.error && (
        <p className="mt-1 text-[10px] text-amber-700" role="alert">
          {speech.error}
        </p>
      )}
    </div>
  )
}
