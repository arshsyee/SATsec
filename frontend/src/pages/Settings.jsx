import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { createSchedule, listSchedules, deleteSchedule, getRecentAudits } from '../api'
import { useAuth } from '../contexts/AuthContext'
import Backdrop from '../components/Backdrop'
import SiteChip from '../components/SiteChip'

const SCHEDULE_HOURS = { '6h': 6, 'daily': 24, 'weekly': 168 }

const stripProto = u => (u || '').replace(/^https?:\/\//, '')
const keyFromHours = h => (h === 24 ? 'daily' : h === 168 ? 'weekly' : '6h')
const intervalLabel = h => (h === 24 ? 'Daily' : h === 168 ? 'Weekly' : `Every ${h}h`)

function fmtRun(iso) {
  if (!iso) return 'not yet run'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Settings() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn } = useAuth()

  const [schedules, setSchedules]     = useState([])
  const [audited, setAudited]         = useState([])
  const [selectedUrl, setSelectedUrl] = useState(stripProto(location.state?.url || ''))
  const [loadingMon, setLoadingMon]   = useState(true)

  const [schedule, setSchedule]   = useState('6h')
  const [threshold, setThreshold] = useState(70)
  const [email, setEmail]         = useState('')
  const [webhook, setWebhook]     = useState('')
  const [saved, setSaved]         = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)

  // Existing monitor for the currently selected site (if any).
  const existing = schedules.find(s => stripProto(s.url) === stripProto(selectedUrl))

  // Sites available to configure: anything monitored or audited.
  const pickerUrls = [...new Set([
    ...(selectedUrl ? [selectedUrl] : []),
    ...schedules.map(s => stripProto(s.url)),
    ...audited.map(stripProto),
  ])]

  // ── Load monitors + audited sites ──────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) { setLoadingMon(false); return }
    Promise.all([listSchedules(), getRecentAudits(50)])
      .then(([sch, audits]) => {
        setSchedules(sch)
        setAudited([...new Set(audits.map(a => a.url))])
        setSelectedUrl(prev => prev || stripProto(sch[0]?.url || audits[0]?.url || ''))
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingMon(false))
  }, [isLoggedIn])

  // Prefill the form when the selected site already has a monitor.
  useEffect(() => {
    if (existing) {
      setSchedule(keyFromHours(existing.interval_hours))
      setThreshold(existing.alert_threshold)
      setEmail(existing.alert_email || '')
      setWebhook(existing.webhook_url || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id])

  const handleSave = async () => {
    if (!selectedUrl) return
    setSaving(true)
    setError(null)
    try {
      // Replace any existing monitor for this site instead of duplicating it.
      if (existing) await deleteSchedule(existing.id)
      await createSchedule({
        url: selectedUrl,
        interval_hours:  SCHEDULE_HOURS[schedule],
        alert_email:     email || null,
        alert_threshold: threshold,
        webhook_url:     webhook || null,
      })
      setSchedules(await listSchedules())
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id) => {
    setError(null)
    try {
      await deleteSchedule(id)
      setSchedules(s => s.filter(x => x.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  const thresholdTone = threshold >= 80 ? 'text-live' : threshold >= 60 ? 'text-warn' : 'text-crit'

  return (
    <div className="relative min-h-screen bg-void text-ink font-sans overflow-x-hidden">

      <Backdrop />

      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between gap-4 px-6 md:px-12 py-4 border-b border-white/[0.06] backdrop-blur-sm">
        <button onClick={() => navigate('/')} className="font-display text-lg font-bold tracking-tight text-ink-bright">
          SAT<span className="text-accent">sec</span>
        </button>
        <SiteChip url={selectedUrl} />
        <div className="flex gap-3">
          <button onClick={() => navigate('/dashboard', { state: { url: selectedUrl } })} className="btn-accent">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Dashboard
          </button>
        </div>
      </nav>

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <h2 className="font-display text-xl font-bold text-ink-bright mb-1">Monitoring Settings</h2>
          <p className="text-sm text-ink-faint font-mono">schedule automated audits and score-drop alerts</p>
        </div>

        {/* Active monitors */}
        {isLoggedIn && (
          <div className="panel p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <p className="eyebrow">Active Monitors</p>
              {!loadingMon && <span className="font-mono text-xs text-ink-faint">{schedules.length} running</span>}
            </div>

            {loadingMon ? (
              <p className="font-mono text-xs text-ink-faint animate-pulse">loading monitors…</p>
            ) : schedules.length === 0 ? (
              <p className="font-mono text-xs text-ink-faint">no monitors yet — configure one below</p>
            ) : (
              <div className="flex flex-col gap-2">
                {schedules.map(s => {
                  const active = stripProto(s.url) === stripProto(selectedUrl)
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                        active ? 'border-accent/40 bg-accent/[0.06]' : 'border-white/[0.06] bg-white/[0.02]'
                      }`}
                    >
                      <button
                        onClick={() => setSelectedUrl(stripProto(s.url))}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate font-mono text-sm text-ink-bright">{stripProto(s.url)}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                          {intervalLabel(s.interval_hours)} · alert &lt; {s.alert_threshold} · last run {fmtRun(s.last_run_at)}
                        </p>
                      </button>
                      <button
                        onClick={() => handleRemove(s.id)}
                        className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 font-mono text-xs text-ink-dim transition-colors hover:border-crit/40 hover:text-crit"
                      >
                        Remove
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Configure: site picker */}
        {isLoggedIn && pickerUrls.length > 0 && (
          <div className="panel p-6 mb-4">
            <p className="eyebrow mb-4">Site</p>
            <div className="relative">
              <select
                value={selectedUrl}
                onChange={e => setSelectedUrl(e.target.value)}
                className="w-full max-w-full cursor-pointer appearance-none truncate rounded-lg border border-white/[0.08] bg-elevated/70 py-2.5 pl-3 pr-9 font-mono text-sm text-ink-bright outline-none transition-colors focus:border-accent/50"
              >
                {pickerUrls.map(u => (
                  <option key={u} value={u} className="bg-elevated text-ink">{u}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">▾</span>
            </div>
            {existing && (
              <p className="mt-3 font-mono text-[11px] text-accent">editing existing monitor — saving will update it</p>
            )}
          </div>
        )}

        {/* Schedule */}
        <div className="panel p-6 mb-4">
          <p className="eyebrow mb-6">Scan Schedule</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { value: '6h',     label: 'Every 6 Hours', desc: 'Recommended for production sites' },
              { value: 'daily',  label: 'Daily',         desc: 'Morning report, lighter touch' },
              { value: 'weekly', label: 'Weekly',        desc: 'SEO-focused, slow-changing sites' },
            ].map(({ value, label, desc }) => (
              <div
                key={value}
                onClick={() => setSchedule(value)}
                className={`border rounded-xl p-4 cursor-pointer transition-all ${
                  schedule === value
                    ? 'border-accent/50 bg-accent/10'
                    : 'border-white/[0.07] hover:border-white/15 bg-white/[0.02]'
                }`}
              >
                <div className={`text-sm font-medium mb-1 ${schedule === value ? 'text-accent-bright' : 'text-ink'}`}>
                  {label}
                </div>
                <div className="text-xs text-ink-faint leading-relaxed">{desc}</div>
                {schedule === value && <div className="mt-2 text-xs text-accent font-mono">active</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Alert Threshold */}
        <div className="panel p-6 mb-4">
          <div className="flex items-center justify-between mb-6">
            <p className="eyebrow">Alert Threshold</p>
            <span className={`font-mono text-lg font-bold tabular-nums ${thresholdTone}`}>{threshold}</span>
          </div>
          <input
            type="range" min="0" max="100" value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="w-full accent-accent mb-4"
          />
          <div className="flex justify-between text-xs font-mono text-ink-faint">
            <span>0 — alert always</span>
            <span>100 — alert never</span>
          </div>
          <div className="mt-4 bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
            <p className="text-sm text-ink-dim">
              SATsec will email you if <span className="text-ink-bright font-medium">any score drops below {threshold}</span>.
              {threshold < 50 && <span className="text-crit"> This is a very sensitive threshold.</span>}
              {threshold >= 80 && <span className="text-live"> This is a healthy threshold.</span>}
            </p>
          </div>
        </div>

        {/* Email / Sign-up CTA */}
        {isLoggedIn ? (
          <div className="panel p-6 mb-6">
            <p className="eyebrow mb-6">Alert Email</p>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@agency.com"
              className="w-full bg-elevated/70 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-ink-bright placeholder-ink-ghost outline-none focus:border-accent/50 transition-colors font-mono"
            />
            <p className="text-xs text-ink-faint font-mono mt-3">alerts will be sent to this address when scores drop</p>

            <p className="eyebrow mt-6 mb-3">Webhook URL <span className="text-ink-ghost">(optional)</span></p>
            <input
              type="url"
              value={webhook}
              onChange={e => setWebhook(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full bg-elevated/70 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-ink-bright placeholder-ink-ghost outline-none focus:border-accent/50 transition-colors font-mono"
            />
            <p className="text-xs text-ink-faint font-mono mt-3">we POST a score-drop payload here — paste a Slack incoming webhook or your own endpoint</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-accent/20 bg-accent/[0.06] p-6 mb-6 text-center">
            <p className="text-sm text-ink mb-1">Sign up to activate monitoring</p>
            <p className="text-xs text-ink-faint font-mono mb-4">your schedule selection will be saved</p>
            <button
              onClick={() => navigate('/register', { state: { url: selectedUrl } })}
              className="btn-accent"
            >
              Sign Up
            </button>
            <button
              onClick={() => navigate('/login', { state: { url: selectedUrl, redirectTo: '/settings' } })}
              className="btn-ghost ml-3"
            >
              Log In
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-crit/20 bg-crit/[0.06] px-5 py-3 mb-4 text-sm text-crit font-mono">
            {error}
          </div>
        )}

        {/* Save — only for logged-in users */}
        {isLoggedIn && (
          <>
            <button
              onClick={handleSave}
              disabled={saving || !selectedUrl}
              className={`w-full py-4 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                saved
                  ? 'bg-live/20 border border-live/30 text-live'
                  : 'bg-accent hover:bg-accent-bright text-white'
              }`}
            >
              {saving
                ? 'Saving...'
                : saved
                  ? '✓ Settings Saved — Monitoring Active'
                  : existing ? 'Update Monitoring' : 'Save & Start Monitoring'}
            </button>

            {!selectedUrl && (
              <p className="text-center text-xs text-crit font-mono mt-3">no site selected — run an audit first</p>
            )}
          </>
        )}

        <p className="text-center text-xs text-ink-ghost font-mono mt-6">SATsec will run its first scan within the next scheduled window</p>
      </div>
    </div>
  )
}
