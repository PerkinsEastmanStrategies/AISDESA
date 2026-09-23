"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, ChevronUp } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import QuestionComment from "@/components/question-comment"
import QuestionPhoto from "@/components/question-photo"
import {
  asMultiSelectValues,
  getRoomSurveyRubric,
  isMultiSelectQuestionType,
  isNotAbleToAssessOption,
  canonicalizeResponseValues,
  isOptionValueSelected,
  isSpaceTypeForSurveyModule,
  surveyModuleUsesSpaceTypePicker,
  isNonScoringQuestion,
  isTextQuestionType,
  type EsaQuestion,
  type EsaQuestionOption,
  type RoomQuestionResponse,
  surveyTypeLabel,
} from "@aisd/shared"
import { getPreWalkRoomSpaceTypePhoto } from "@/lib/prewalk"
import { isSupabasePhotoUrl, type SurveyPhotoUploadContext } from "@/lib/photo-storage"
import { mergeResponsePhotoFields, normalizeResponsePhotos } from "@/lib/response-photos"
import { SURVEY_SPACE_TYPE_PHOTO_PROMPT } from "@/lib/photo-privacy"
import {
  dependentQuestionDisabledReason,
  isAutoAnsweredQuestion,
  isSkippedDependentQuestion,
} from "@/lib/question-dependencies"
import { isQuestionAnswered, isQuestionFullyAnswered, responseRequiresUnableToAssessNote } from "@/lib/survey-validation"
import SurveyProgressTracker from "@/components/survey-progress-tracker"
import TraditionalStudioCopyReviewBanner from "@/components/traditional-studio-copy-review-banner"
import { cn } from "@/lib/utils"
import { resolveRoomNeighborhoodForCopy } from "@/lib/traditional-studio-copy"

const CONTEXT_TOGGLE_KEY = "esa-show-question-context"

function readShowContextPreference(): boolean {
  if (typeof window === "undefined") return true
  const stored = sessionStorage.getItem(CONTEXT_TOGGLE_KEY)
  if (stored === "0") return false
  if (stored === "1") return true
  return true
}

function formatAnswerSummary(question: EsaQuestion, value: string | string[] | undefined): string {
  if (!isQuestionAnswered(question, value)) return "Not answered"
  const display = canonicalizeResponseValues(value)
  if (Array.isArray(display)) {
    if (display.length <= 2) return display.join(", ")
    return `${display.slice(0, 2).join(", ")} +${display.length - 2} more`
  }
  return typeof display === "string" ? display : "Not answered"
}

function categoryAccent(category: string): string {
  switch (category) {
    case "Infrastructure":
      return "border-l-blue-500"
    case "FF&E":
      return "border-l-amber-500"
    case "Function":
      return "border-l-violet-500"
    case "Environmental Quality":
      return "border-l-emerald-500"
    case "Size":
      return "border-l-cyan-500"
    case "Occupant Experience":
      return "border-l-rose-500"
    case "Amenities":
      return "border-l-orange-500"
    case "Observational":
      return "border-l-slate-400"
    default:
      return "border-l-slate-400"
  }
}

function categoryChip(category: string): string {
  switch (category) {
    case "Infrastructure":
      return "bg-blue-50 text-blue-700"
    case "FF&E":
      return "bg-amber-50 text-amber-800"
    case "Function":
      return "bg-violet-50 text-violet-700"
    case "Environmental Quality":
      return "bg-emerald-50 text-emerald-700"
    case "Size":
      return "bg-cyan-50 text-cyan-800"
    case "Occupant Experience":
      return "bg-rose-50 text-rose-700"
    case "Amenities":
      return "bg-orange-50 text-orange-800"
    case "Observational":
      return "bg-slate-100 text-slate-600"
    default:
      return "bg-slate-100 text-slate-600"
  }
}

/** After a tall question collapses, keep the next question (or this one) fully inside the scroll window. */
function keepWithinScrollWindow(el: HTMLElement) {
  const scrollRoot = el.closest(".overflow-y-auto") as HTMLElement | null
  if (!scrollRoot) return

  const maxScroll = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight)
  if (scrollRoot.scrollTop > maxScroll) {
    scrollRoot.scrollTop = maxScroll
  }

  const target = (el.nextElementSibling as HTMLElement | null) ?? el
  const rootRect = scrollRoot.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const stickyTop =
    (scrollRoot.querySelector("[data-survey-sticky-progress]") as HTMLElement | null) ??
    (scrollRoot.querySelector(".sticky.top-0") as HTMLElement | null)
  const stickyBottom = scrollRoot.querySelector(".sticky.bottom-0") as HTMLElement | null
  const topPad = (stickyTop?.offsetHeight ?? 0) + 12
  const bottomPad = (stickyBottom?.offsetHeight ?? 0) + 16

  // Pull into view if any part sits outside the visible scroll window
  if (targetRect.top < rootRect.top + topPad) {
    scrollRoot.scrollBy({ top: targetRect.top - rootRect.top - topPad, behavior: "smooth" })
    return
  }
  if (targetRect.bottom > rootRect.bottom - bottomPad) {
    scrollRoot.scrollBy({ top: targetRect.bottom - rootRect.bottom + bottomPad, behavior: "smooth" })
  }
}

export default function QuestionForm() {
  const {
    state,
    setResponse,
    currentRoomSession,
    flaggedQuestionIds,
    acknowledgeTraditionalStudioCopyReview,
    setRoomGeneralPhotos,
    completeCloseOutRoom,
  } = useSurvey()
  const [showContext, setShowContext] = useState(readShowContextPreference)
  const roomId = state.selectedRoomId
  // A sync merge reseats the session while the assessor is working, and for a render the room can
  // come back without its space type. Every module except Studios then has no rubric, so the form
  // below returns null and takes everything in flight with it, including a photo still uploading.
  // Keep the type this room last showed until the assessor actually moves somewhere else.
  const spaceTypeScope = `${state.surveyType}:${roomId ?? ""}`
  const lastSpaceTypeRef = useRef<{ scope: string; spaceType: string } | null>(null)
  if (currentRoomSession?.roomType) {
    lastSpaceTypeRef.current = { scope: spaceTypeScope, spaceType: currentRoomSession.roomType }
  }
  const spaceType =
    currentRoomSession?.roomType ||
    (lastSpaceTypeRef.current?.scope === spaceTypeScope
      ? lastSpaceTypeRef.current.spaceType
      : undefined)
  const rubric = getRoomSurveyRubric(
    state.surveyType,
    spaceType,
    currentRoomSession?.gradeType,
    state.school?.schoolClass,
    currentRoomSession?.sourceSurveyType,
  )

  const optionsByQuestion = useMemo(() => {
    if (!rubric) return new Map<string, EsaQuestionOption[]>()
    const map = new Map<string, EsaQuestionOption[]>()
    for (const q of rubric.questions) {
      map.set(
        q.questionId,
        rubric.options
          .filter((o) => o.questionId === q.questionId && o.option.trim().length > 0)
          .sort((a, b) => a.displayOrder - b.displayOrder),
      )
    }
    return map
  }, [rubric])

  const flaggedSet = useMemo(() => new Set(flaggedQuestionIds), [flaggedQuestionIds])

  useEffect(() => {
    const firstId = flaggedQuestionIds[0]
    if (!firstId) return
    const el = document.getElementById(`question-${firstId}`)
    el?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [flaggedQuestionIds, roomId])

  const pendingIds = currentRoomSession?.pendingQuestionIds
  const questions = useMemo(() => {
    if (!rubric) return []
    if (state.surveyType !== "closeout") return rubric.questions
    const ids = pendingIds ?? []
    return rubric.questions.filter((q) => ids.includes(q.questionId))
  }, [rubric, state.surveyType, pendingIds])

  const hasAnyContext = useMemo(
    () => questions.some((q) => q.context?.trim()),
    [questions],
  )

  const toggleShowContext = useCallback(() => {
    setShowContext((prev) => {
      const next = !prev
      sessionStorage.setItem(CONTEXT_TOGGLE_KEY, next ? "1" : "0")
      return next
    })
  }, [])

  const roomSessionRef = useRef(currentRoomSession)
  roomSessionRef.current = currentRoomSession

  const updateResponse = useCallback(
    (questionId: string, patch: Partial<RoomQuestionResponse>) => {
      if (!roomId || !rubric) return
      const existing = roomSessionRef.current?.responses.find((r) => r.questionId === questionId)
      const q = rubric.questions.find((item) => item.questionId === questionId)
      if (!q) return
      setResponse(roomId, {
        questionId,
        value:
          patch.value !== undefined
            ? patch.value
            : existing?.value ?? (isMultiSelectQuestionType(q.questionType) ? [] : ""),
        comment:
          patch.comment !== undefined ? patch.comment.trim() || undefined : existing?.comment,
        ...mergeResponsePhotoFields(existing, patch),
      })
    },
    [roomId, rubric, setResponse],
  )

  if (!rubric || !roomId) return null

  const showSpaceTypePhoto =
    state.surveyType !== "closeout" &&
    !!spaceType &&
    surveyModuleUsesSpaceTypePicker(state.surveyType, state.school?.schoolClass) &&
    isSpaceTypeForSurveyModule(state.surveyType, spaceType, state.school?.schoolClass)
  // Photos taken before the general photo moved onto the room survey still live in pre-walk
  // state; the room's own copy takes over as soon as this room records one.
  const legacyPreWalkPhoto = showSpaceTypePhoto
    ? getPreWalkRoomSpaceTypePhoto(state.preWalk, state.surveyType, roomId, spaceType)
    : undefined
  const generalPhotos = currentRoomSession?.generalPhotosUpdatedAt
    ? currentRoomSession.generalPhotos ?? []
    : legacyPreWalkPhoto
      ? [legacyPreWalkPhoto]
      : []
  const photoUploadBase: Pick<SurveyPhotoUploadContext, "campusId" | "schoolId" | "surveyType"> | null =
    state.school
      ? {
          campusId: state.session?.campusId ?? state.school.campusId,
          schoolId: state.school.id,
          surveyType: state.surveyType,
        }
      : null

  const copiedFromRoomId = currentRoomSession?.traditionalStudioCopiedFromRoomId
  const copyReviewPending = !!currentRoomSession?.traditionalStudioCopyReviewPending
  const copySourceRoomName = copiedFromRoomId
    ? state.allRooms.find((room) => room.id === copiedFromRoomId)?.name ??
      state.session?.rooms[copiedFromRoomId]?.roomNumber ??
      copiedFromRoomId
    : ""
  const copyNeighborhood = currentRoomSession
    ? resolveRoomNeighborhoodForCopy(state.allRooms, roomId, currentRoomSession)
    : ""

  const roomResponses = currentRoomSession?.responses ?? []
  const responses = new Map(roomResponses.map((r) => [r.questionId, r]))

  return (
    <>
      {copyReviewPending && copiedFromRoomId && (
        <TraditionalStudioCopyReviewBanner
          sourceRoomName={copySourceRoomName}
          neighborhood={copyNeighborhood}
          onConfirm={() => acknowledgeTraditionalStudioCopyReview(roomId)}
        />
      )}
      <div className="min-w-0 bg-gradient-to-b from-slate-200 to-slate-300/90 px-3 py-5 pb-10">
      {showSpaceTypePhoto && (
        <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            General space photo
          </p>
          <p className="mt-1 text-sm leading-snug text-slate-700">{SURVEY_SPACE_TYPE_PHOTO_PROMPT}</p>
          <div className="mt-3 [&>button]:w-full">
            <QuestionPhoto
              key={`space-photo:${state.surveyType}:${spaceType}:${roomId}`}
              photos={generalPhotos}
              maxPhotos={1}
              label="General photo"
              privacyContextNote={`General photo of ${spaceType}.`}
              uploadContext={
                photoUploadBase && spaceType
                  ? { ...photoUploadBase, kind: "prewalk-space-type", spaceType, roomId }
                  : null
              }
              onChange={(photos) => setRoomGeneralPhotos(roomId, photos)}
            />
          </div>
        </div>
      )}
      <div className="mb-4 px-0.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {state.surveyType === "closeout"
              ? "Close Out Questions"
              : state.surveyType === "administration"
                ? "Administration Questions"
                : state.surveyType === "arrival"
                  ? "Arrival/Main Office Questions"
                  : state.surveyType === "neighborhoods"
                    ? "Neighborhoods Questions"
                    : state.surveyType === "outdoor"
                      ? "Outdoor Questions"
                      : "Studios Questions"}
          </h2>
          {hasAnyContext && (
            <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-600">
              <input
                type="checkbox"
                checked={showContext}
                onChange={toggleShowContext}
                className="h-3.5 w-3.5 rounded border-slate-300 text-[var(--color-primary)] focus:ring-blue-200"
              />
              Show context
            </label>
          )}
        </div>
      </div>
      {state.surveyType === "closeout" && currentRoomSession?.sourceSurveyType ? (
        <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50/80 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-800">
            From {surveyTypeLabel(currentRoomSession.sourceSurveyType)} survey
          </p>
          <p className="mt-0.5 text-xs text-blue-900/80">
            {currentRoomSession.roomType?.trim() || "Room"} · finishing deferred questions from the
            original section
          </p>
        </div>
      ) : null}
      <SurveyProgressTracker roomId={roomId} questions={questions} responses={roomResponses} />
      {state.surveyType === "closeout" && questions.length === 0 ? (
        <p className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
          No pending questions for this room.
        </p>
      ) : null}
      <div className="relative z-0 min-w-0 space-y-3.5">
        {questions
          .filter(
            (q) =>
              !isSkippedDependentQuestion(q.questionId, roomResponses, rubric.questions),
          )
          .map((q, index) => {
          const response = responses.get(q.questionId)
          const skipped = isSkippedDependentQuestion(q.questionId, roomResponses, rubric.questions)
          const autoAnswered = isAutoAnsweredQuestion(q.questionId, roomResponses)
          const locked = skipped || autoAnswered
          const displayIndex =
            state.surveyType === "closeout"
              ? rubric.questions.findIndex((item) => item.questionId === q.questionId) + 1
              : index + 1
          return (
            <QuestionField
              key={`${roomId}-${q.questionId}`}
              id={`question-${q.questionId}`}
              index={displayIndex}
              question={q}
              options={optionsByQuestion.get(q.questionId) ?? []}
              value={response?.value}
              comment={response?.comment}
              photos={normalizeResponsePhotos(response)}
              uploadContext={
                photoUploadBase
                  ? {
                      ...photoUploadBase,
                      kind: "question",
                      roomId,
                      questionId: q.questionId,
                    }
                  : null
              }
              disabled={locked}
              autoAnswered={autoAnswered}
              highlighted={flaggedSet.has(q.questionId)}
              showContext={showContext}
              disabledReason={dependentQuestionDisabledReason(q.questionId, roomResponses, rubric.questions)}
              onChange={(value) =>
                updateResponse(q.questionId, {
                  value: canonicalizeResponseValues(value) ?? value,
                })
              }
              onCommentChange={(comment) => updateResponse(q.questionId, { comment })}
              onPhotoChange={(photos) => updateResponse(q.questionId, { photos })}
              stayOpen={state.surveyType === "closeout"}
            />
          )
        })}
      </div>
      {state.surveyType === "closeout" && roomId ? (
        <div className="mt-5 rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-4 shadow-sm">
          {flaggedQuestionIds.length > 0 ? (
            <p className="mb-3 text-center text-xs font-medium text-red-700">
              Answer the highlighted questions before submitting this room.
            </p>
          ) : (
            <p className="mb-3 text-center text-xs leading-snug text-slate-500">
              Submit this room when you are done. Campus submit below is for the whole survey.
            </p>
          )}
          <button
            type="button"
            onClick={() => completeCloseOutRoom(roomId)}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white active:opacity-90 sm:min-h-[48px]"
          >
            <Check className="h-4 w-4" />
            Submit this room
          </button>
        </div>
      ) : null}
    </div>
    </>
  )
}

function blurActiveTextInput() {
  const active = document.activeElement
  if (
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLInputElement && active.type !== "radio" && active.type !== "checkbox")
  ) {
    active.blur()
  }
}

function optionGridClass(options: EsaQuestionOption[]): string {
  const longest = Math.max(...options.map((o) => o.option.length), 0)
  const count = options.length

  // Long labels wrap inside the same grid cells as short ones (no full-width spans).
  if (longest > 70) {
    return "grid grid-cols-1 gap-2 sm:grid-cols-2"
  }
  if (count === 1) return "grid grid-cols-1 gap-2"
  if (count === 3) {
    // 2 + 1: keep grid; last item centered visually by full-width optional later
    return "grid grid-cols-2 gap-2 sm:grid-cols-3"
  }
  if (count <= 4) return "grid grid-cols-2 gap-2 sm:grid-cols-4"
  if (longest > 36) return "grid grid-cols-2 gap-2 lg:grid-cols-3"
  return "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
}

function OptionTile({
  questionId,
  option,
  label,
  selected,
  disabled,
  multiple,
  onToggle,
}: {
  questionId: string
  option: string
  label: string
  selected: boolean
  disabled?: boolean
  multiple: boolean
  onToggle: () => void
}) {
  return (
    <label
      onPointerDown={blurActiveTextInput}
      className={cn(
        "relative flex h-full min-h-12 cursor-pointer touch-manipulation items-center rounded-xl border px-3 py-2.5 text-left text-sm leading-snug transition-all duration-150",
        disabled && !selected ? "cursor-not-allowed opacity-55" : null,
        disabled && selected ? "cursor-default" : null,
        !disabled && "active:scale-[0.98]",
        selected
          ? "border-[var(--color-primary)] bg-blue-50 text-slate-900 shadow-sm ring-2 ring-blue-200/90"
          : "border-slate-300 bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.08)] hover:border-slate-400 hover:bg-slate-50 hover:shadow-[0_2px_4px_rgba(15,23,42,0.08)]",
      )}
    >
      <input
        type={multiple ? "checkbox" : "radio"}
        name={questionId}
        checked={selected}
        disabled={disabled}
        onChange={onToggle}
        className="sr-only"
      />
      {selected && (
        <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-[var(--color-primary)]" aria-hidden />
      )}
      <span
        className={cn(
          "w-full break-words hyphens-auto",
          selected && "pr-5 font-medium",
        )}
      >
        {label || "\u00A0"}
      </span>
    </label>
  )
}

function QuestionField({
  id,
  index,
  question,
  options,
  value,
  comment,
  photos = [],
  uploadContext = null,
  disabled = false,
  autoAnswered = false,
  highlighted = false,
  showContext = true,
  disabledReason,
  onChange,
  onCommentChange,
  onPhotoChange,
  stayOpen = false,
}: {
  id: string
  index: number
  question: EsaQuestion
  options: EsaQuestionOption[]
  value: string | string[] | undefined
  comment?: string
  photos?: string[]
  uploadContext?: SurveyPhotoUploadContext | null
  disabled?: boolean
  /** Locked because a parent answer forced this value — keep options visible with selection. */
  autoAnswered?: boolean
  highlighted?: boolean
  /** When true, show CSV Context subtext under the question prompt. */
  showContext?: boolean
  disabledReason?: string
  onChange: (value: string | string[]) => void
  onCommentChange: (comment: string) => void
  onPhotoChange: (photos: string[]) => void
  /** Close Out keeps every deferred question expanded until the room is submitted. */
  stayOpen?: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const answered = isQuestionFullyAnswered(question, { value: value ?? "", comment })
  const noteRequired = responseRequiresUnableToAssessNote(value)
  const multiSelect = isMultiSelectQuestionType(question.questionType)
  const textEntry = isTextQuestionType(question.questionType)
  const [collapsed, setCollapsed] = useState(
    () => answered && !highlighted && !noteRequired && !autoAnswered && !stayOpen,
  )
  const [userExpanded, setUserExpanded] = useState(false)
  const wasAnsweredRef = useRef(answered)
  const prevCollapsedRef = useRef(collapsed)
  const userExpandedRef = useRef(userExpanded)
  userExpandedRef.current = userExpanded
  const skipObserverCollapseRef = useRef(false)

  useEffect(() => {
    if (stayOpen || autoAnswered || highlighted) {
      setCollapsed(false)
    }
    // Keep the card open only while the required NATA note is still missing.
    if (noteRequired && !answered) {
      setCollapsed(false)
    }
  }, [autoAnswered, highlighted, noteRequired, answered, stayOpen])

  useEffect(() => {
    const justAnswered = answered && !wasAnsweredRef.current
    wasAnsweredRef.current = answered

    if (autoAnswered) {
      setCollapsed(false)
      return
    }
    if (!answered) {
      setCollapsed(false)
      setUserExpanded(false)
      return
    }
    if (!justAnswered || highlighted || userExpanded || multiSelect || textEntry || stayOpen) return

    const timer = window.setTimeout(() => setCollapsed(true), 400)
    return () => window.clearTimeout(timer)
  }, [answered, highlighted, userExpanded, multiSelect, textEntry, value, autoAnswered, stayOpen])

  // When a question is manually collapsed, keep following content inside the scroll window.
  useEffect(() => {
    const justCollapsed = collapsed && !prevCollapsedRef.current
    prevCollapsedRef.current = collapsed
    if (!justCollapsed) return

    const el = rootRef.current
    if (!el) return

    const frame = window.requestAnimationFrame(() => keepWithinScrollWindow(el))
    return () => window.cancelAnimationFrame(frame)
  }, [collapsed])

  // Collapse answered questions once they scroll mostly out of view.
  useEffect(() => {
    const el = rootRef.current
    if (!el || autoAnswered) return

    const scrollRoot = el.closest(".overflow-y-auto") as Element | null
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (skipObserverCollapseRef.current) return
        if (!answered) {
          setCollapsed(false)
          return
        }
        // An expanded last question often sits at the bottom with a low visible
        // ratio; only auto-collapse it once it is fully off-screen.
        if (userExpandedRef.current) {
          if (!entry.isIntersecting) {
            setCollapsed(true)
            setUserExpanded(false)
          }
          return
        }
        if (!entry.isIntersecting || entry.intersectionRatio < 0.35) {
          setCollapsed(true)
          setUserExpanded(false)
        }
      },
      {
        root: scrollRoot,
        threshold: [0, 0.35, 0.6, 1],
        rootMargin: "-8% 0px -8% 0px",
      },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [answered, autoAnswered, collapsed])

  const expand = useCallback(() => {
    skipObserverCollapseRef.current = true
    setCollapsed(false)
    setUserExpanded(true)
  }, [])

  useEffect(() => {
    if (collapsed || !skipObserverCollapseRef.current) return
    const el = rootRef.current
    const frame = window.requestAnimationFrame(() => {
      skipObserverCollapseRef.current = false
      el?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [collapsed])

  const collapse = useCallback(() => {
    if (answered && !autoAnswered) {
      setCollapsed(true)
      setUserExpanded(false)
    }
  }, [answered, autoAnswered])

  const summary = formatAnswerSummary(question, value)
  const hasExtras =
    !!(comment?.trim() || photos.some((p) => !isSupabasePhotoUrl(p)) || photos.length > 0)
  const accent = categoryAccent(question.category)
  const contextText = showContext ? question.context?.trim() : ""

  if (collapsed && answered && !highlighted && !autoAnswered) {
    return (
      <div
        ref={rootRef}
        id={id}
        className="w-full min-w-0 max-w-full scroll-mt-[calc(var(--survey-sticky-progress-height,5.5rem)+0.75rem)] overflow-hidden rounded-2xl border border-emerald-200/80 border-l-[3px] border-l-emerald-500 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] [overflow-anchor:none]"
      >
        <button
          type="button"
          onClick={expand}
          className="flex w-full min-w-0 max-w-full items-start gap-3 px-3.5 py-3.5 text-left transition-colors active:bg-emerald-50/40"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
            {index}
          </span>
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="line-clamp-2 break-words text-sm font-medium leading-snug text-slate-800">
              {question.question}
            </p>
            {contextText && (
              <p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-slate-500">
                {contextText}
              </p>
            )}
            <p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-slate-500">
              {summary}
              {hasExtras ? " · note/photo" : ""}
            </p>
            {comment?.trim() && (
              <p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-slate-600">
                Note: {comment.trim()}
              </p>
            )}
          </div>
          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      id={id}
      className={cn(
        "w-full min-w-0 max-w-full scroll-mt-[calc(var(--survey-sticky-progress-height,5.5rem)+0.75rem)] overflow-clip rounded-2xl border border-slate-200/90 border-l-[3px] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.05)] [overflow-anchor:none]",
        accent,
        disabled && !autoAnswered && "opacity-90",
        highlighted && "border-red-300 ring-2 ring-red-100",
      )}
    >
      <fieldset
        disabled={disabled && !autoAnswered}
        className="min-w-0 border-0 p-0 [margin-inline:0]"
      >
      <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white px-3.5 py-3.5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
              highlighted
                ? "bg-red-100 text-red-700"
                : answered
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/80",
            )}
          >
            {index}
          </span>
          <div className="min-w-0 flex-1">
            <legend className="px-0 text-[15px] font-semibold leading-snug tracking-tight text-slate-900">
              {question.question}
              {question.required && (
                <span className="text-red-500" aria-hidden>
                  {"\u00A0"}*
                </span>
              )}
            </legend>
            {contextText && (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{contextText}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  categoryChip(question.category),
                )}
              >
                {question.category}
              </span>
              {isNonScoringQuestion(question) && (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                  Not scored
                </span>
              )}
              {multiSelect && (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                  Select all that apply
                </span>
              )}
              {textEntry && (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                  Open response
                </span>
              )}
            </div>
            {highlighted && (
              <p className="mt-2 text-xs font-semibold text-red-700">Required before submitting</p>
            )}
            {disabledReason && (
              <p className="mt-2 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-800">
                {disabledReason}
              </p>
            )}
          </div>
          {answered && !autoAnswered && (
            <button
              type="button"
              onClick={collapse}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors active:bg-slate-100 active:text-slate-600"
              aria-label="Collapse question"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-50/80 px-3.5 py-3.5">
        {textEntry ? (
          <textarea
            id={`${question.questionId}-text`}
            rows={4}
            value={typeof value === "string" ? value : ""}
            disabled={disabled}
            placeholder="Optional. Leave blank if there is nothing to note."
            onChange={(e) => onChange(e.target.value)}
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
          />
        ) : multiSelect ? (
          <div className={cn("items-stretch", optionGridClass(options))}>
            {options.map((opt) => {
              const selected = isOptionValueSelected(opt.option, value)
              return (
                <OptionTile
                  key={`${question.questionId}-${opt.displayOrder}`}
                  questionId={question.questionId}
                  option={opt.option}
                  label={opt.option}
                  selected={selected}
                  disabled={disabled}
                  multiple
                  onToggle={() => {
                    const current = asMultiSelectValues(value)
                    if (selected) {
                      onChange(
                        current.filter((v) =>
                          isOptionValueSelected(opt.option, v) ? false : true,
                        ),
                      )
                    } else if (isNotAbleToAssessOption(opt.option)) {
                      onChange([opt.option])
                    } else {
                      onChange([
                        ...current.filter((v) => !isNotAbleToAssessOption(v)),
                        opt.option,
                      ])
                    }
                  }}
                />
              )
            })}
          </div>
        ) : (
          <div className={cn("items-stretch", optionGridClass(options))}>
            {options.map((opt) => {
              const selected = isOptionValueSelected(opt.option, value)
              return (
                <OptionTile
                  key={`${question.questionId}-${opt.displayOrder}`}
                  questionId={question.questionId}
                  option={opt.option}
                  label={opt.option}
                  selected={selected}
                  disabled={disabled}
                  multiple={false}
                  onToggle={() => onChange(opt.option)}
                />
              )
            })}
          </div>
        )}
      </div>
      </fieldset>

      <div
        className={cn(
          "flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-3.5 py-2.5",
          disabled && "pointer-events-none opacity-70",
        )}
      >
        <QuestionComment
          comment={comment}
          onChange={onCommentChange}
          required={noteRequired}
        />
        <QuestionPhoto
          key={
            uploadContext
              ? `${uploadContext.kind}:${uploadContext.roomId ?? ""}:${uploadContext.questionId ?? ""}:${uploadContext.spaceType ?? ""}`
              : id
          }
          photos={photos}
          uploadContext={uploadContext}
          onChange={onPhotoChange}
        />
      </div>
    </div>
  )
}
