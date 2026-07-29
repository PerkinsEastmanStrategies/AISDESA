"use client"

import { SurveyProvider, useSurvey } from "@/lib/survey-store"
import SurveyHeader, { SurveyHeaderControls } from "@/components/survey-header"
import SurveyTypeNav from "@/components/survey-type-nav"
import ResumeBanner from "@/components/resume-banner"
import SurveyAssessorLanding from "@/components/survey-assessor-landing"
import StudioSurvey from "@/components/studio-survey"
import PlaceholderSurvey from "@/components/placeholder-survey"
import SurveyResults from "@/components/survey-results"
import AdminDashboard from "@/components/admin-dashboard"
import EsaLanding from "@/components/esa-landing"
import PreWalkPromptModal from "@/components/pre-walk-prompt-modal"
import SurveyRemoteConflictModal from "@/components/survey-remote-conflict-modal"
import { getSurveyRubric, surveyTypeLabel } from "@aisd/shared"

function SurveyBody() {
  const { state, hasAssessorRegistered } = useSurvey()

  if (state.view === "results") {
    return <SurveyResults />
  }

  if (!state.school || !hasAssessorRegistered) {
    return <SurveyAssessorLanding />
  }

  const rubric = getSurveyRubric(state.surveyType)

  if (
    state.surveyType === "studios" ||
    state.surveyType === "closeout" ||
    state.surveyType === "outdoor" ||
    state.surveyType === "administration" ||
    state.surveyType === "arrival" ||
    state.surveyType === "neighborhoods"
  ) {
    return <StudioSurvey />
  }

  return (
    <PlaceholderSurvey
      title={surveyTypeLabel(state.surveyType)}
      description={
        rubric
          ? "Questions coming soon."
          : "This survey module is not yet configured. Select Studios, Neighborhoods, Arrival/Main Office, or Administration to begin ESA scoring."
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

  return (
    <>
      <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <SurveyTypeNav variant="sidebar" />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <SurveyHeader />
        {state.view === "survey" && (
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
      </div>
      </div>
      {preWalkPrompt}
    </>
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
      <SurveyRemoteConflictHost />
    </SurveyProvider>
  )
}
