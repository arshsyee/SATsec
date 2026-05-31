import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { runAudit } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { saveGuestAudit } from '../utils/guestStorage'
import Backdrop from '../components/Backdrop'

const steps = [
  { label: 'Fetching HTML...', duration: 800 },
  { label: 'Running performance audit...', duration: 1000 },
  { label: 'Checking SEO meta tags and structure...', duration: 900 },
  { label: 'Running accessibility scan...', duration: 1100 },
  { label: 'Checking security headers...', duration: 700 },
 // { label: 'Generating AI summary...', duration: 1200 },
  { label: 'Compiling results...', duration: 500 },
]

const totalTime = steps.reduce((a, b) => a + b.duration, 0)

export default function Scanning() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn } = useAuth()
  const url = location.state?.url || 'yoursite.com'

  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [animDone, setAnimDone] = useState(false)
  const [apiResult, setApiResult] = useState(null)
  const [apiError, setApiError] = useState(null)

  // Fire the real API call immediately on mount.
  // AbortController ensures StrictMode's double-invoke only completes one request.
  useEffect(() => {
    const controller = new AbortController()
    runAudit(url, controller.signal)
      .then(setApiResult)
      .catch(err => {
        if (err.name !== 'AbortError') setApiError(err.message)
      })
    return () => controller.abort()
  }, [url])

  // Run the progress animation
  useEffect(() => {
    const timers = []
    let elapsed = 0

    steps.forEach((step, i) => {
      elapsed += step.duration
      const captured = elapsed
      const capturedIndex = i

      timers.push(setTimeout(() => {
        setCurrentStep(capturedIndex + 1)
        setProgress(Math.round((captured / totalTime) * 100))
        if (capturedIndex === steps.length - 1) {
          setAnimDone(true)
          setProgress(100)
        }
      }, captured))
    })

    return () => timers.forEach(clearTimeout)
  }, [])

  // Navigate once BOTH the animation AND the API call are done
  useEffect(() => {
    if (animDone && apiResult) {
      // Guests: persist audit to localStorage so it can be imported later
      if (!isLoggedIn) {
        saveGuestAudit(apiResult, url)
      }
      const t = setTimeout(() =>
        navigate('/results', { state: { result: apiResult, url } }), 800
      )
      return () => clearTimeout(t)
    }
    if (animDone && apiError) {
      navigate('/', { state: { error: apiError } })
    }
  }, [animDone, apiResult, apiError])

  const done = animDone && (apiResult || apiError)

  return (
    <div className="relative min-h-screen bg-void text-ink font-sans flex flex-col items-center justify-center px-6 overflow-x-hidden animate-flicker">

      <Backdrop />

      <div className="relative z-10 w-full max-w-lg text-center">

        {/* Logo */}
        <div className="font-display text-lg font-bold tracking-tight text-ink-bright mb-16">
          SAT<span className="text-accent">sec</span>
        </div>

        {/* Pulse ring */}
        <div className="relative flex items-center justify-center mb-10">
          <div className={`w-24 h-24 rounded-full border-2 flex items-center justify-center transition-colors ${done ? 'border-live/50 bg-live/10' : 'border-accent/50 bg-accent/10'}`}>
            {done ? (
              <span className="text-live text-3xl">✓</span>
            ) : (
              <span className="text-accent font-mono text-xl font-bold tabular-nums">{progress}%</span>
            )}
          </div>
          {!done && (
            <div className="absolute w-24 h-24 rounded-full border-2 border-accent/20 animate-ping" />
          )}
        </div>

        {/* URL */}
        <div className="inline-flex items-center gap-2 panel px-4 py-2 font-mono text-sm text-ink-dim mb-8">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse-live" />
          {url}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-white/[0.06] rounded-full h-1.5 mb-6 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-live' : 'bg-accent'}`}
            style={{ width: `${progress}%`, boxShadow: done ? '0 0 8px rgba(44,232,160,0.6)' : '0 0 8px rgba(59,130,246,0.6)' }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className={`flex items-center gap-3 text-sm font-mono transition-all duration-300 ${
              i < currentStep ? 'text-ink-faint' :
              i === currentStep ? 'text-ink-dim' : 'text-ink-ghost'
            }`}>
              <span className="w-4 text-center">
                {i < currentStep ? '✓' : i === currentStep ? '→' : '·'}
              </span>
              {step.label}
            </div>
          ))}
        </div>

        {animDone && !apiResult && !apiError && (
          <p className="text-accent font-mono text-sm mt-6 animate-pulse">
            finalizing results...
          </p>
        )}

        {done && !apiError && (
          <p className="text-live font-mono text-sm mt-6 animate-pulse">
            audit complete — loading results...
          </p>
        )}
      </div>
    </div>
  )
}
