"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/** After a tall question collapses, keep the next question inside the scroll window. */
export function keepQuestionWithinScrollWindow(el: HTMLElement) {
  const scrollRoot = el.closest(".overflow-y-auto") as HTMLElement | null
  if (!scrollRoot) return

  const maxScroll = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight)
  if (scrollRoot.scrollTop > maxScroll) {
    scrollRoot.scrollTop = maxScroll
  }

  const target = (el.nextElementSibling as HTMLElement | null) ?? el
  const rootRect = scrollRoot.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const stickyBottom = scrollRoot.querySelector(".sticky.bottom-0") as HTMLElement | null
  const topPad = 12
  const bottomPad = (stickyBottom?.offsetHeight ?? 0) + 16

  if (targetRect.top < rootRect.top + topPad) {
    scrollRoot.scrollBy({ top: targetRect.top - rootRect.top - topPad, behavior: "smooth" })
    return
  }
  if (targetRect.bottom > rootRect.bottom - bottomPad) {
    scrollRoot.scrollBy({ top: targetRect.bottom - rootRect.bottom + bottomPad, behavior: "smooth" })
  }
}

interface UseQuestionFieldCollapseOptions {
  answered: boolean
  noteRequired: boolean
  highlighted: boolean
  multiSelect: boolean
  commentEditing: boolean
  autoAnswered?: boolean
  /** Answer value — included so collapse re-evaluates after selection changes. */
  value: string | string[] | undefined
}

export function useQuestionFieldCollapse({
  answered,
  noteRequired,
  highlighted,
  multiSelect,
  commentEditing,
  autoAnswered = false,
  value,
}: UseQuestionFieldCollapseOptions) {
  const rootRef = useRef<HTMLFieldSetElement>(null)
  const [collapsed, setCollapsed] = useState(
    () => answered && !highlighted && !noteRequired && !autoAnswered,
  )
  const [userExpanded, setUserExpanded] = useState(false)
  const wasAnsweredRef = useRef(answered)
  const prevCollapsedRef = useRef(collapsed)

  useEffect(() => {
    if (autoAnswered || highlighted || noteRequired || commentEditing) {
      setCollapsed(false)
      if (noteRequired || commentEditing) setUserExpanded(true)
    }
  }, [autoAnswered, highlighted, noteRequired, commentEditing])

  useEffect(() => {
    const justAnswered = answered && !wasAnsweredRef.current
    wasAnsweredRef.current = answered

    if (!answered || noteRequired || autoAnswered || commentEditing) {
      if (!answered) setUserExpanded(false)
      if (!answered || noteRequired || commentEditing) {
        setCollapsed(false)
        if (noteRequired || commentEditing) setUserExpanded(true)
      }
      return
    }

    if (!justAnswered || highlighted || userExpanded || multiSelect) return

    const timer = window.setTimeout(() => setCollapsed(true), 400)
    return () => window.clearTimeout(timer)
  }, [
    answered,
    highlighted,
    userExpanded,
    multiSelect,
    value,
    noteRequired,
    autoAnswered,
    commentEditing,
  ])

  useEffect(() => {
    const justCollapsed = collapsed && !prevCollapsedRef.current
    prevCollapsedRef.current = collapsed
    if (!justCollapsed) return

    const el = rootRef.current
    if (!el) return

    const frame = window.requestAnimationFrame(() => keepQuestionWithinScrollWindow(el))
    return () => window.cancelAnimationFrame(frame)
  }, [collapsed])

  useEffect(() => {
    const el = rootRef.current
    if (!el || autoAnswered || commentEditing) return

    const scrollRoot = el.closest(".overflow-y-auto") as Element | null
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!answered || commentEditing) {
          setCollapsed(false)
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
  }, [answered, autoAnswered, commentEditing])

  const expand = useCallback(() => {
    setCollapsed(false)
    setUserExpanded(true)
  }, [])

  const collapse = useCallback(() => {
    if (answered && !autoAnswered && !commentEditing) {
      setCollapsed(true)
      setUserExpanded(false)
    }
  }, [answered, autoAnswered, commentEditing])

  return { rootRef, collapsed, expand, collapse }
}
