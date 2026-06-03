import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { runAuditStream, runAudit } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { saveGuestAudit } from '../utils/guestStorage'
import Backdrop from '../components/Backdrop'

// Shown before the backend's `init` event arrives, and as the fallback when
// streaming isn't available. Mirrors the backend's AUDIT_STAGES order.
const FALLBACK_STAGES = [
  { id: 'fetch',         label: 'Fetching page' },
  { id: 'performance',   label: 'Auditing performance' },
  { id: 'seo',           label: 'Analyzing SEO & links' },
  { id: 'accessibility', label: 'Scanning accessibility (WCAG)' },
  { id: 'security',      label: 'Inspecting security & SSL' },
  { id: 'compile',       label: 'Compiling report' },
]

export default function Scanning() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn } = useAuth()
  const url = location.state?.url || 'yoursite.com'

  const [stages,   setStages]   = useState(FALLBACK_STAGES)
  const [statuses, setStatuses] = useState({})   // id -> 'running' | 'done'
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState(null)
  const [elapsed,  setElapsed]  = useState(0)

  // Live elapsed timer — small detail that makes the wait feel measured.
  useEffect(() => {
    const start = Date.now()
    const t = setInterval(() => setElapsed((Date.now() - start) / 1000), 100)
    return () => clearInterval(t)
  }, [])

  // Run the real streaming audit. Drives every checkmark off backend events.
  // AbortController cancels StrictMode's first (duplicate) mount; the surviving
  // mount's request runs to completion.
  useEffect(() => {
    const controller = new AbortController()

    const onEvent = (event) => {
      if (event.type === 'init' && Array.isArray(event.stages)) {
        setStages(event.stages)
      } else if (event.type === 'stage') {
        setStatuses(prev => ({ ...prev, [event.id]: event.status }))
      }
    }

    runAuditStream(url, { onEvent, signal: controller.signal })
      .then(setResult)
      .catch(async (err) => {
        if (err.name === 'AbortError') return
        // Streaming failed — fall back to the plain audit so a scan still completes.
        try {
          const r = await runAudit(url, controller.signal)
          setStatuses(Object.fromEntries(FALLBACK_STAGES.map(s => [s.id, 'done'])))
          setResult(r)
        } catch (e) {
          if (e.name !== 'AbortError') setError(e.message)
        }
      })

    return () => controller.abort()
  }, [url])

  // Navigate once the result lands.
  useEffect(() => {
    if (result) {
      if (!isLoggedIn) saveGuestAudit(result, url)
      const duration = elapsed
      const t = setTimeout(() => navigate('/results', { state: { result, url, duration } }), 700)
      return () => clearTimeout(t)
    }
    if (error) navigate('/', { state: { error } })
  }, [result, error]) // eslint-disable-line react-hooks/exhaustive-deps

  const doneCount = stages.filter(s => statuses[s.id] === 'done').length
  const progress  = result ? 100 : Math.round((doneCount / stages.length) * 100)
  const done      = Boolean(result)

  return (
    <div className="relative min-h-screen bg-void text-ink font-sans flex flex-col items-center justify-center px-6 overflow-x-hidden">

      <Backdrop />

      {/* Scanline sweep — terminal flavor */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent animate-scanline" />

      <div className="relative z-10 w-full max-w-md text-center">

        <div className="font-display text-lg font-bold tracking-tight text-ink-bright mb-14">
          SAT<span className="text-accent">sec</span>
        </div>

        {/* Radar dial */}
        <div className="relative mx-auto mb-10 flex h-28 w-28 items-center justify-center">
          {/* concentric rings */}
          <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
          <div className="absolute inset-3 rounded-full border border-white/[0.05]" />
          {/* sweeping arm (stops when done) */}
          {!done && (
            <div
              className="absolute inset-0 rounded-full animate-radar"
              style={{ background: 'conic-gradient(from 0deg, rgb(var(--c-accent) / 0.35), transparent 50%)' }}
            />
          )}
          {/* core */}
          <div className={`relative flex h-20 w-20 items-center justify-center rounded-full border-2 transition-colors ${
            done ? 'border-live/50 bg-live/10' : 'border-accent/50 bg-accent/10'
          }`}>
            {done
              ? <span className="text-3xl text-live">✓</span>
              : <span className="font-mono text-xl font-bold tabular-nums text-accent">{progress}%</span>}
          </div>
        </div>

        {/* Target + elapsed */}
        <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-surface/60 pl-3 pr-3.5 py-1.5 font-mono text-sm">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${done ? 'bg-live' : 'bg-accent animate-pulse-live'}`} />
          <span className="truncate text-ink-bright max-w-[200px]">{url.replace(/^https?:\/\//, '')}</span>
          <span className="text-ink-faint tabular-nums">{elapsed.toFixed(1)}s</span>
        </div>

        {/* Progress bar */}
        <div className="mb-7 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-live' : 'bg-accent'}`}
            style={{ width: `${progress}%`, boxShadow: `0 0 8px ${done ? 'rgb(var(--c-live) / 0.5)' : 'rgb(var(--c-accent) / 0.4)'}` }}
          />
        </div>

        {/* Stage checklist — driven by real backend events */}
        <div className="space-y-1.5 text-left">
          {stages.map(stage => {
            const status = statuses[stage.id]
            const isDone    = status === 'done' || done
            const isRunning = status === 'running' && !done
            return (
              <div
                key={stage.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 font-mono text-sm transition-all duration-300 ${
                  isRunning ? 'bg-accent/[0.06] text-ink-bright'
                  : isDone   ? 'text-ink-dim'
                  :            'text-ink-ghost'
                }`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {isDone ? (
                    <span className="text-live">✓</span>
                  ) : isRunning ? (
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
                  ) : (
                    <span className="h-1 w-1 rounded-full bg-current" />
                  )}
                </span>
                {stage.label}
              </div>
            )
          })}
        </div>

        <p className={`mt-7 font-mono text-sm transition-colors ${done ? 'text-live' : 'text-ink-faint'}`}>
          {done ? 'audit complete — loading results…' : 'scanning live — reading your site'}
        </p>
      </div>
    </div>
  )
}
