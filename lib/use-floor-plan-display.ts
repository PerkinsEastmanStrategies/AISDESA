"use client"

import { useEffect } from "react"
import { useSurvey } from "@/lib/survey-store"

/** Request floor-plan SVG memory only while a map UI is visible (pre-walk, room picker, results). */
export function useFloorPlanDisplay(active: boolean): void {
  const { requestFloorPlanDisplay, releaseFloorPlanDisplay } = useSurvey()

  useEffect(() => {
    if (!active) return
    requestFloorPlanDisplay()
    return () => releaseFloorPlanDisplay()
  }, [active, requestFloorPlanDisplay, releaseFloorPlanDisplay])
}
