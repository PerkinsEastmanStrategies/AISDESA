"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { EsaQuestion, RoomQuestionResponse } from "@aisd/shared"
import { computeRoomQuestionProgress } from "@/lib/survey-question-progress"
import { cn } from "@/lib/utils"

function ProgressBarContent({
  progress,
  activeIndex,
  complete,
}: {
  progress: { answered: number; total: number; percent: number }
  activeIndex: number
  complete: boolean
}) {
  return (
    <div
      className="px-3 py-2.5"
      aria-label={`Survey progress: ${progress.answered} of ${progress.total} questions answered`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          Progress
        </p>
        <p className="text-xs font-medium tabular-nums text-slate-700">
          {progress.answered} / {progress.total} answered
        </p>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            complete ? "bg-emerald-500" : "bg-[var(--color-primary)]",
          )}
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
        <span className="tabular-nums">
          Question {activeIndex} of {progress.total}
        </span>
        <span className="font-medium tabular-nums text-slate-600">{progress.percent}%</span>
      </div>
    </div>
  )
}

export default function SurveyProgressTracker({
  roomId,
  questions,
  responses,
}: {
  roomId: string
  questions: EsaQuestion[]
  responses: RoomQuestionResponse[]
}) {
  const progress = useMemo(
    () => computeRoomQuestionProgress(questions, responses),
    [questions, responses],
  )
  const [activeIndex, setActiveIndex] = useState(1)
  const [barHeight, setBarHeight] = useState(72)

  const stickyBarRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setActiveIndex(1)
  }, [roomId])

  useLayoutEffect(() => {
    if (!stickyBarRef.current) return
    const node = stickyBarRef.current
    const measure = () => setBarHeight(node.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [progress.answered, progress.total, activeIndex])

  useEffect(() => {
    if (progress.total === 0) return

    const scrollRoot = document.querySelector("[data-survey-scroll-root]") as HTMLElement | null
    if (!scrollRoot || !questions.length) return

    const updateActive = () => {
      const rootRect = scrollRoot.getBoundingClientRect()
      const markerY = rootRect.top + Math.min(rootRect.height * 0.32, 180) + barHeight

      let bestIndex = 1
      let bestDistance = Infinity

      questions.forEach((q, index) => {
        const el = document.getElementById(`question-${q.questionId}`)
        if (!el) return
        const rect = el.getBoundingClientRect()
        if (rect.bottom < rootRect.top + barHeight + 8) return
        const distance = Math.abs(rect.top - markerY)
        if (distance < bestDistance) {
          bestDistance = distance
          bestIndex = index + 1
        }
      })

      setActiveIndex(bestIndex)
    }

    const onScrollOrResize = () => {
      updateActive()
    }

    onScrollOrResize()
    scrollRoot.addEventListener("scroll", onScrollOrResize, { passive: true })
    window.addEventListener("resize", onScrollOrResize)

    return () => {
      scrollRoot.removeEventListener("scroll", onScrollOrResize)
      window.removeEventListener("resize", onScrollOrResize)
    }
  }, [roomId, questions, barHeight, progress.total])

  if (progress.total === 0) return null

  const complete = progress.answered >= progress.total

  return (
    <div
      ref={stickyBarRef}
      className="sticky top-0 z-40 -mx-3 mb-3 border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-sm"
    >
      <ProgressBarContent progress={progress} activeIndex={activeIndex} complete={complete} />
    </div>
  )
}
