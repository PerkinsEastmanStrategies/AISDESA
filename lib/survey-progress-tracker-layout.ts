/** Shared layout offset when the pinned question progress bar is visible (desktop sidebar). */
export const SURVEY_PROGRESS_TRACKER_HEIGHT_VAR = "--survey-progress-tracker-height"
export const SURVEY_PROGRESS_TRACKER_OFFSET_VAR = "--survey-progress-tracker-offset"

export function setSurveyProgressTrackerLayout(height: number, offsetFromViewportTop: number) {
  if (typeof document === "undefined") return
  document.documentElement.style.setProperty(
    SURVEY_PROGRESS_TRACKER_HEIGHT_VAR,
    height > 0 ? `${height}px` : "0px",
  )
  document.documentElement.style.setProperty(
    SURVEY_PROGRESS_TRACKER_OFFSET_VAR,
    height > 0 ? `${offsetFromViewportTop}px` : "0px",
  )
}

export function clearSurveyProgressTrackerLayout() {
  setSurveyProgressTrackerLayout(0, 0)
}
