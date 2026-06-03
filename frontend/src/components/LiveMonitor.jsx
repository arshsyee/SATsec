import { useState, useEffect } from 'react'

/**
 * LiveMonitor — the surveillance console: radar scope + score cards + bar
 * readouts, all driven by one `scores` array. Shared by the Landing hero
 * (demo, drifting values) and the /live page (real values when available).
 *
 * scores: [{ key, label, angle, value }]  — angle is the radar bearing in deg.
 */

/* Category layout — order, radar bearing, short card tag, and demo seed. */
export const CATS = [
  { key: 'perf', label: 'PERFORMANCE',   short: 'PERF', angle: 215, seed: 94 },
  { key: 'seo',  label: 'SEO',           short: 'SEO',  angle: 320, seed: 88 },
  { key: 'a11y', label: 'ACCESSIBILITY', short: 'A11Y', angle: 125, seed: 61 },
  { key: 'sec',  label: 'SECURITY',      short: 'SEC',  angle: 40,  seed: 43 },
]

/* Maps a backend scores object to the radar/card array. */
export function scoresFromAudit(s) {
  const byCat = {
    perf: s.performance, seo: s.seo, a11y: s.accessibility, sec: s.security,
  }
  return CATS.map(c => ({ ...c, value: byCat[c.key] ?? 0 }))
}

/* ── Status mapping ───────────────────────────────────────────── */
export function statusFor(v) {
  if (v >= 80) return { tone: 'live', label: 'HEALTHY' }
  if (v >= 60) return { tone: 'warn', label: 'AT RISK' }
  return { tone: 'crit', label: 'CRITICAL' }
}
const TONE = {
  live: { text: 'text-live', bar: 'bg-live', glow: 'rgb(var(--c-live) / 0.5)', blip: 'rgb(var(--c-live))' },
  warn: { text: 'text-warn', bar: 'bg-warn', glow: 'rgb(var(--c-warn) / 0.5)', blip: 'rgb(var(--c-warn))' },
  crit: { text: 'text-crit', bar: 'bg-crit', glow: 'rgb(var(--c-crit) / 0.5)', blip: 'rgb(var(--c-crit))' },
}

/* Live-drifting demo scores (used when no real data). */
export function useDriftingScores() {
  const [state, setState] = useState(
    CATS.map(c => ({ ...c, value: c.seed, target: c.seed }))
  )

  // Re-target every few seconds
  useEffect(() => {
    const id = setInterval(() => {
      setState(prev => prev.map(s => ({ ...s, target: Math.floor(Math.random() * 74) + 22 })))
    }, 3400)
    return () => clearInterval(id)
  }, [])

  // Ease current toward target
  useEffect(() => {
    const id = setInterval(() => {
      setState(prev => prev.map(s => {
        if (s.value === s.target) return s
        return { ...s, value: s.value + (s.value < s.target ? 1 : -1) }
      }))
    }, 90)
    return () => clearInterval(id)
  }, [])

  return state
}

/* ── Radar scope with live blips ──────────────────────────────── */
function RadarScope({ scores, size = 248 }) {
  const reach = size / 2 - 16
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {[1, 0.66, 0.33].map((r, i) => (
        <div key={i}
          className="absolute rounded-full border border-accent/15"
          style={{ inset: `${(1 - r) * (size / 2)}px` }}
        />
      ))}
      <div className="absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2 bg-accent/10" />
      <div className="absolute top-1/2 left-2 right-2 h-px -translate-y-1/2 bg-accent/10" />
      <div className="absolute inset-0 rounded-full animate-radar"
        style={{ background: 'conic-gradient(from 0deg, rgb(var(--c-accent) / 0.32), rgb(var(--c-accent) / 0.04) 40%, transparent 60%)' }}
      />
      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-glow-accent" />
      {scores.map(s => {
        const tone = TONE[statusFor(s.value).tone]
        const dist = (1 - s.value / 100) * 0.82 + 0.16
        const rad = (s.angle * Math.PI) / 180
        const x = Math.cos(rad) * reach * dist
        const y = Math.sin(rad) * reach * dist
        return (
          <div key={s.key}
            className="absolute h-2 w-2 rounded-full animate-pulse-live"
            style={{
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              transform: 'translate(-50%, -50%)',
              background: tone.blip,
              boxShadow: `0 0 10px 1px ${tone.glow}`,
            }}
          />
        )
      })}
    </div>
  )
}

/* ── Score card (big ticking number) ──────────────────────────── */
function ScoreCard({ label, value }) {
  const t = TONE[statusFor(value).tone]
  return (
    <div className="panel px-4 py-4 text-center hover:-translate-y-0.5 transition-transform">
      <div className={`font-mono text-3xl font-bold tabular-nums transition-colors ${t.text}`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-ink-dim">{label}</div>
    </div>
  )
}

/* ── Single bar readout ───────────────────────────────────────── */
function Readout({ label, value }) {
  const { tone, label: status } = statusFor(value)
  const t = TONE[tone]
  return (
    <div className="flex items-center gap-3 font-mono text-xs">
      <span className="w-28 shrink-0 text-ink-dim tracking-wide">{label}</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${t.bar} transition-[width] duration-200 ease-out`}
          style={{ width: `${value}%`, boxShadow: `0 0 8px ${t.glow}` }}
        />
      </div>
      <span className={`w-7 text-right tabular-nums font-bold ${t.text}`}>{value}</span>
      <span className={`hidden sm:block w-20 text-right text-[10px] tracking-widest ${t.text}`}>{status}</span>
    </div>
  )
}

/* ── Console panel ────────────────────────────────────────────── */
export default function LiveMonitor({
  scores,
  live = true,
  targetUrl = 'demo://example.com',
  sampledLabel = 'sampled just now',
  onGoLive,
}) {
  return (
    <div className="panel shadow-panel overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
        <span className="eyebrow">Live Monitor</span>
        <div className="flex items-center gap-4">
          {onGoLive && (
            <button
              onClick={onGoLive}
              className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 font-mono text-[11px] font-bold tracking-wide text-white transition-all hover:bg-accent/20 hover:-translate-y-px"
            >
              Go Live with your site →
            </button>
          )}
          <span className={`flex items-center gap-2 font-mono text-[10px] tracking-widest ${live ? 'text-live' : 'text-ink-faint'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-live animate-pulse-live' : 'bg-ink-faint'}`} />
            {live ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-8 p-6 md:flex-row md:items-center">
        <RadarScope scores={scores} />
        <div className="flex w-full flex-1 flex-col gap-5">
          {/* ticking number cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {scores.map(s => (
              <ScoreCard key={s.key} label={s.short || s.label} value={s.value} />
            ))}
          </div>
          {/* bar readouts */}
          <div className="flex flex-col gap-4">
            {scores.map(s => (
              <Readout key={s.key} label={s.label} value={s.value} />
            ))}
          </div>
          <p className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-ink-faint">
            <span className="shrink-0 text-ink-dim">target:</span>
            <span className="truncate">{targetUrl}</span>
            <span className="shrink-0 text-ink-ghost">·</span>
            <span className="shrink-0">{sampledLabel}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
