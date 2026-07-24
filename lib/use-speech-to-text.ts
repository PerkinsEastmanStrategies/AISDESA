"use client"

import { useCallback, useEffect, useRef, useState } from "react"

function getSpeechRecognitionCtor(): (typeof SpeechRecognition) | null {
  if (typeof window === "undefined") return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return !!getSpeechRecognitionCtor()
}

interface UseSpeechToTextOptions {
  value: string
  onChange: (value: string) => void
}

export interface UseSpeechToTextResult {
  supported: boolean
  /** True while starting, listening, or waiting on mic permission. */
  isActive: boolean
  starting: boolean
  listening: boolean
  error: string | null
  displayValue: string
  start: () => void
  stop: () => void
  toggle: () => void
  clearError: () => void
}

const MAX_SESSION_MS = 120_000

export function useSpeechToText({ value, onChange }: UseSpeechToTextOptions): UseSpeechToTextResult {
  const [listening, setListening] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wantListeningRef = useRef(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const restartTimerRef = useRef<number | null>(null)
  const maxSessionTimerRef = useRef<number | null>(null)
  const baseTextRef = useRef("")
  const sessionFinalRef = useRef("")
  const interimRef = useRef("")
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const setInterim = useCallback((next: string) => {
    interimRef.current = next
  }, [])

  const clearTimers = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
    if (maxSessionTimerRef.current !== null) {
      window.clearTimeout(maxSessionTimerRef.current)
      maxSessionTimerRef.current = null
    }
  }, [])

  const commitSession = useCallback(() => {
    const combined = [baseTextRef.current, sessionFinalRef.current, interimRef.current]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ")
    if (combined !== valueRef.current) {
      onChangeRef.current(combined)
      valueRef.current = combined
    }
    return combined
  }, [])

  /** Hard stop — always resets UI immediately, never waits on the browser. */
  const forceStop = useCallback(() => {
    wantListeningRef.current = false
    clearTimers()

    const rec = recognitionRef.current
    recognitionRef.current = null
    if (rec) {
      rec.onend = null
      rec.onresult = null
      rec.onerror = null
      try {
        rec.abort()
      } catch {
        try {
          rec.stop()
        } catch {
          /* ignore */
        }
      }
    }

    commitSession()
    sessionFinalRef.current = ""
    setInterim("")
    setListening(false)
    setStarting(false)
  }, [clearTimers, commitSession, setInterim])

  const bindRecognition = useCallback(
    (rec: SpeechRecognition) => {
      rec.onstart = () => {
        if (!wantListeningRef.current) {
          try {
            rec.abort()
          } catch {
            /* ignore */
          }
          return
        }
        setStarting(false)
        setListening(true)
        setError(null)
      }

      rec.onresult = (event: SpeechRecognitionEvent) => {
        if (!wantListeningRef.current) return

        let newFinal = ""
        let liveInterim = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const transcript = result[0]?.transcript ?? ""
          if (result.isFinal) {
            newFinal += transcript
          } else {
            liveInterim += transcript
          }
        }

        if (liveInterim) setInterim(liveInterim.trim())

        if (newFinal) {
          const trimmed = newFinal.trim()
          sessionFinalRef.current = [sessionFinalRef.current, trimmed].filter(Boolean).join(" ").trim()
          setInterim("")

          const combined = [baseTextRef.current, sessionFinalRef.current].filter(Boolean).join(" ").trim()
          onChangeRef.current(combined)
          valueRef.current = combined
        }
      }

      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (!wantListeningRef.current) return
        if (event.error === "aborted") return

        if (event.error === "no-speech") {
          // Harmless — keep session open
          return
        }

        if (event.error === "not-allowed") {
          setError("Allow microphone access, then try again.")
          forceStop()
          return
        }

        if (event.error === "network") {
          setError("Voice input needs an internet connection.")
          forceStop()
          return
        }

        setError("Voice input interrupted. Tap Stop, then try again.")
        forceStop()
      }

      rec.onend = () => {
        if (!wantListeningRef.current) {
          setListening(false)
          setStarting(false)
          setInterim("")
          return
        }

        // One controlled restart after brief silence (mobile Chrome)
        clearTimers()
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null
          if (!wantListeningRef.current) return

          const SR = getSpeechRecognitionCtor()
          if (!SR) {
            forceStop()
            return
          }

          try {
            const next = new SR()
            next.continuous = true
            next.interimResults = true
            next.lang = "en-US"
            next.maxAlternatives = 1
            bindRecognition(next)
            recognitionRef.current = next
            next.start()
          } catch {
            setError("Dictation paused. Tap the mic to continue.")
            forceStop()
          }
        }, 250)
      }
    },
    [clearTimers, forceStop, setInterim],
  )

  const startRecognition = useCallback(() => {
    if (!wantListeningRef.current) return

    const SR = getSpeechRecognitionCtor()
    if (!SR) {
      setError("Voice input is not supported in this browser. Try Chrome or Edge.")
      forceStop()
      return
    }

    const existing = recognitionRef.current
    if (existing) {
      existing.onend = null
      try {
        existing.abort()
      } catch {
        /* ignore */
      }
      recognitionRef.current = null
    }

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = "en-US"
    rec.maxAlternatives = 1
    bindRecognition(rec)
    recognitionRef.current = rec

    try {
      rec.start()
    } catch {
      setError("Could not start the microphone. Tap to try again.")
      forceStop()
    }
  }, [bindRecognition, forceStop])

  const start = useCallback(() => {
    if (wantListeningRef.current || starting) return

    setError(null)
    setStarting(true)
    wantListeningRef.current = true
    baseTextRef.current = valueRef.current.trim()
    sessionFinalRef.current = ""
    setInterim("")

    clearTimers()
    maxSessionTimerRef.current = window.setTimeout(() => {
      setError("Dictation stopped after 2 minutes. Tap the mic to continue.")
      forceStop()
    }, MAX_SESSION_MS)

    // Sync mic permission — don't await; check flag before starting recognition
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          stream.getTracks().forEach((t) => t.stop())
          if (!wantListeningRef.current) return
          startRecognition()
        })
        .catch(() => {
          setError("Microphone access is required for voice input.")
          forceStop()
        })
      return
    }

    startRecognition()
  }, [clearTimers, forceStop, setInterim, startRecognition, starting])

  const stop = useCallback(() => {
    forceStop()
  }, [forceStop])

  const toggle = useCallback(() => {
    if (wantListeningRef.current || listening || starting) {
      stop()
    } else {
      start()
    }
  }, [listening, start, starting, stop])

  useEffect(() => {
    return () => {
      wantListeningRef.current = false
      clearTimers()
      try {
        recognitionRef.current?.abort()
      } catch {
        /* ignore */
      }
    }
  }, [clearTimers])

  const isActive = listening || starting

  const displayValue = isActive
    ? [baseTextRef.current, sessionFinalRef.current, interimRef.current].filter(Boolean).join(" ").trim() ||
      valueRef.current
    : value

  // Re-render while listening so interim text updates (stored in refs)
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!isActive) return
    const id = window.setInterval(() => setTick((t) => t + 1), 200)
    return () => window.clearInterval(id)
  }, [isActive])

  return {
    supported: isSpeechRecognitionSupported(),
    isActive,
    starting,
    listening: isActive,
    error,
    displayValue,
    start,
    stop,
    toggle,
    clearError: () => setError(null),
  }
}
