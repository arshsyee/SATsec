import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { runAudit } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { saveGuestAudit } from '../utils/guestStorage'

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
    <div className="min-h-screen bg-[#080c14] text-[#e8edf5] font-sans flex flex-col items-center justify-center px-6">

      {/* Grid bg */}
      <div className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(99,179,237,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,179,237,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />

      <div className="relative z-10 w-full max-w-lg text-center">

        {/* Logo */}
        <div className="font-mono text-lg font-bold mb-16">
          SAT<span className="text-blue-500">sec</span>
        </div>

        {/* Pulse ring */}
        <div className="relative flex items-center justify-center mb-10">
          <div className={`w-24 h-24 rounded-full border-2 flex items-center justify-center ${done ? 'border-green-500/50 bg-green-500/10' : 'border-blue-500/50 bg-blue-500/10'}`}>
            {done ? (
              <span className="text-green-400 text-3xl">✓</span>
            ) : (
              <span className="text-blue-400 font-mono text-xl font-bold">{progress}%</span>
            )}
          </div>
          {!done && (
            <div className="absolute w-24 h-24 rounded-full border-2 border-blue-500/20 animate-ping" />
          )}
        </div>

        {/* URL */}
        <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2 font-mono text-sm text-[#7a9ab8] mb-8">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          {url}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-white/[0.04] rounded-full h-1.5 mb-6 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className={`flex items-center gap-3 text-sm font-mono transition-all duration-300 ${
              i < currentStep ? 'text-[#3a5068]' :
              i === currentStep ? 'text-[#7a9ab8]' : 'text-[#1e3040]'
            }`}>
              <span className="w-4 text-center">
                {i < currentStep ? '✓' : i === currentStep ? '→' : '·'}
              </span>
              {step.label}
            </div>
          ))}
        </div>

        {animDone && !apiResult && !apiError && (
          <p className="text-blue-400 font-mono text-sm mt-6 animate-pulse">
            finalizing results...
          </p>
        )}

        {done && !apiError && (
          <p className="text-green-400 font-mono text-sm mt-6 animate-pulse">
            audit complete — loading results...
          </p>
        )}
      </div>
    </div>
  )
}
