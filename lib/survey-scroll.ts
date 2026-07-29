export function scrollSurveyRootToTop(behavior: ScrollBehavior = "instant") {
  if (typeof document === "undefined") return

  const root = document.querySelector("[data-survey-scroll-root]") as HTMLElement | null
  if (root) {
    root.scrollTo({ top: 0, behavior })
    return
  }

  window.scrollTo({ top: 0, behavior })
}

/** Scroll after React has painted the next room's content. */
export function scrollSurveyRootToTopAfterPaint() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => scrollSurveyRootToTop())
  })
}
