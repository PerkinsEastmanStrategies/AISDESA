"use client"

import { useMemo } from "react"
import { CheckCircle2, ClipboardCheck, Send } from "lucide-react"
import { useSurvey } from "@/lib/survey-store"
import { countCloseOutPendingItems } from "@/lib/closeout"
import { cn } from "@/lib/utils"

export default function CloseOutPanel() {
  const {
    state,
    closeOutPending,
    canSubmitCampus,
    submitCampusHint,
    setFinalComment,
    submitCampusAssessment,
  } = useSurvey()

  const finalComment = state.session?.finalComment ?? ""
  const campusSubmittedAt = state.session?.campusSubmittedAt ?? state.submission?.session.campusSubmittedAt

  const pendingSummary = useMemo(() => {
    const pending = countCloseOutPendingItems(state.session)
    if (pending.rooms === 0) {
      return "No unanswered questions from other surveys."
    }
    const parts = [
      `${pending.rooms} room${pending.rooms === 1 ? "" : "s"} with open items`,
      pending.questions
        ? `${pending.questions} unanswered question${pending.questions === 1 ? "" : "s"}`
        : null,
      pending.grades ? "grade not selected" : null,
    ].filter(Boolean)
    return parts.join(" · ")
  }, [state.session])

  if (!state.school || state.surveyType !== "closeout") return null

  return (
    <div className="border-t border-[var(--color-border)] bg-white/95 px-3 pt-4 backdrop-blur safe-bottom">
      <div className="mb-4 rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3">
        <div className="flex items-start gap-2">
          <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Campus Close Out</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Unanswered questions from other survey sections appear here. Finish them, add any final
              thoughts, then submit the full campus assessment.
            </p>
            <p className="mt-2 text-xs font-medium text-slate-700">{pendingSummary}</p>
            {closeOutPending.roomIds.length > 0 ? (
              <p className="mt-1 text-xs text-slate-500">
                Open rooms:{" "}
                {closeOutPending.roomLabels.slice(0, 6).join(", ")}
                {closeOutPending.roomLabels.length > 6
                  ? ` +${closeOutPending.roomLabels.length - 6} more`
                  : ""}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <label htmlFor="closeout-final-comment" className="mb-1.5 block text-xs font-medium text-slate-600">
        Final thoughts <span className="font-normal text-slate-400">(optional)</span>
      </label>
      <textarea
        id="closeout-final-comment"
        value={finalComment}
        onChange={(e) => setFinalComment(e.target.value)}
        rows={4}
        disabled={!!campusSubmittedAt}
        placeholder="Share anything the review team should know about this campus walk — patterns, constraints, follow-ups…"
        className="mb-3 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-blue-200 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
      />

      {campusSubmittedAt ? (
        <div className="mb-5 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          Campus submitted {new Date(campusSubmittedAt).toLocaleString()}
        </div>
      ) : (
        <>
          <p className="mb-2 text-center text-xs leading-snug text-[var(--color-muted-foreground)]">
            {submitCampusHint}
          </p>
          <button
            type="button"
            disabled={!canSubmitCampus}
            onClick={() => submitCampusAssessment()}
            className={cn(
              "mb-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-opacity sm:min-h-[48px]",
              canSubmitCampus
                ? "bg-[var(--color-primary)] active:opacity-90"
                : "cursor-not-allowed bg-slate-300",
            )}
          >
            <Send className="h-4 w-4" />
            Submit campus assessment
          </button>
        </>
      )}
    </div>
  )
}
