"use client"

import { useEffect, useState } from "react"
import { SurveyProvider, useSurvey } from "@/lib/survey-store"
import SurveyHeader, { SurveyHeaderControls } from "@/components/survey-header"
import SurveyTypeNav from "@/components/survey-type-nav"
import ResumeBanner from "@/components/resume-banner"
import SurveyAssessorLanding from "@/components/survey-assessor-landing"
import SurveyCampusHome from "@/components/survey-campus-home"
import StudioSurvey from "@/components/studio-survey"
import PlaceholderSurvey from "@/components/placeholder-survey"
import SurveyResults from "@/components/survey-results"
import AdminDashboard from "@/components/admin-dashboard"
import EsaLanding from "@/components/esa-landing"
import PreWalkPromptModal from "@/components/pre-walk-prompt-modal"
import PilotCarryOverModal from "@/components/pilot-carryover-modal"
import SurveyRemoteConflictModal from "@/components/survey-remote-conflict-modal"
import SurveyActionBar from "@/components/survey-action-bar"
import { getSurveyRubric, surveyTypeLabel } from "@aisd/shared"
import {
  isPilotCarryOverSchool,
  listPilotCarryOverRooms,
  shouldPromptPilotCarryOver,
  type PilotCarryOverRoom,
} from "@/lib/pilot-carryover"

function SurveyActionBarHost() {
  const { state, hasAssessorRegistered } = useSurvey()
  if (!hasAssessorRegistered || !state.school) return null
  if (state.view !== "survey") return null
  if (state.surveyType === "closeout") return null
  return <SurveyActionBar />
}

function SurveyBody() {
  const { state, hasAssessorRegistered } = useSurvey()

  if (state.view === "results") {
    return <SurveyResults />
  }

  if (!state.school || !hasAssessorRegistered) {
    return <SurveyAssessorLanding />
  }

  if (state.view === "home") {
    return <SurveyCampusHome />
  }

  const rubric = getSurveyRubric(state.surveyType)

  if (
    state.surveyType === "studios" ||
    state.surveyType === "closeout" ||
    state.surveyType === "outdoor" ||
    state.surveyType === "administration" ||
    state.surveyType === "arrival" ||
    state.surveyType === "neighborhoods" ||
    state.surveyType === "shared_spaces" ||
    state.surveyType === "performing_arts" ||
    state.surveyType === "athletics" ||
    state.surveyType === "cte"
  ) {
    return <StudioSurvey />
  }

  return (
    <PlaceholderSurvey
      title={surveyTypeLabel(state.surveyType)}
      description={
        rubric
          ? "Questions coming soon."
          : "This survey module is not yet configured. Select a live module from the campus hub to begin ESA scoring."
      }
    />
  )
}

function SurveyAppContent() {
  const { state, answerPreWalkPrompt } = useSurvey()

  const preWalkPrompt = (
    <PreWalkPromptModal
      open={state.preWalkPromptPending && !!state.school}
      schoolName={state.school?.displayName ?? ""}
      hasFloorPlan={state.school?.hasFloorPlan ?? false}
      onYes={() => answerPreWalkPrompt("map")}
      onNo={() => answerPreWalkPrompt("skip")}
    />
  )

  // Hold the UI until drafts/assessors are restored so reload never flashes the landing page.
  if (!state.hydrated) {
    return (
      <>
        <div
          className="flex h-dvh items-center justify-center bg-[var(--color-background)]"
          aria-busy="true"
          aria-label="Loading survey"
        />
        {preWalkPrompt}
      </>
    )
  }

  if (state.view === "landing") {
    return (
      <>
        <EsaLanding />
        {preWalkPrompt}
      </>
    )
  }

  if (state.view === "admin") {
    return (
      <>
        <AdminDashboard />
        {preWalkPrompt}
      </>
    )
  }

  const showModuleChrome = state.view === "survey" || state.view === "results"
  const showModuleTabs = state.view === "survey"

  return (
    <>
      <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      {showModuleChrome && <SurveyTypeNav variant="sidebar" />}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <SurveyHeader />
        {showModuleTabs && (
          <div className="z-40 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-card)] md:hidden">
            <SurveyTypeNav variant="tabs" />
          </div>
        )}
        <div
          data-survey-scroll-root
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
        >
          <SurveyHeaderControls />
          <ResumeBanner />
          <main className="flex flex-col">
            <SurveyBody />
          </main>
        </div>
        <SurveyActionBarHost />
      </div>
      </div>
      {preWalkPrompt}
    </>
  )
}

function PilotCarryOverHost() {
  const {
    state,
    remoteSchoolDraftsLoading,
    applyPilotCarryOverDecisions,
  } = useSurvey()
  const [rooms, setRooms] = useState<PilotCarryOverRoom[]>([])
  const [open, setOpen] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    const school = state.school
    if (!state.hydrated || !school || !isPilotCarryOverSchool(school)) {
      setOpen(false)
      return
    }
    if (remoteSchoolDraftsLoading) return
    const listed = listPilotCarryOverRooms(school.id, school.schoolClass)
    const keys = listed.map((room) => room.key)
    if (!shouldPromptPilotCarryOver(school.id, keys)) {
      setOpen(false)
      return
    }
    setRooms(listed)
    setOpen(listed.length > 0)
  }, [state.hydrated, state.school?.id, state.school?.schoolClass, remoteSchoolDraftsLoading])

  return (
    <PilotCarryOverModal
      open={open}
      schoolName={state.school?.displayName ?? ""}
      rooms={rooms}
      applying={applying}
      onConfirm={async (removed) => {
        setApplying(true)
        try {
          await applyPilotCarryOverDecisions(
            removed,
            rooms.map((room) => room.key),
          )
          setOpen(false)
        } finally {
          setApplying(false)
        }
      }}
    />
  )
}

function SurveyRemoteConflictHost() {
  const {
    remoteConflictOpen,
    remoteConflict,
    dismissRemoteConflict,
    closeRemoteConflict,
    loadRemoteSurveyDraft,
  } = useSurvey()

  return (
    <SurveyRemoteConflictModal
      open={remoteConflictOpen}
      status={remoteConflict}
      onClose={closeRemoteConflict}
      onContinue={dismissRemoteConflict}
      onLoadRemote={() => void loadRemoteSurveyDraft()}
      showLoadRemote
    />
  )
}

export default function SurveyApp() {
  return (
    <SurveyProvider>
      <SurveyAppContent />
      <PilotCarryOverHost />
      <SurveyRemoteConflictHost />
    </SurveyProvider>
  )
}
