import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { getRecentAudits, getHistory } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { getGuestAudits } from '../utils/guestStorage'
import Backdrop from '../components/Backdrop'
import SiteChip from '../components/SiteChip'
import WelcomeModal from '../components/WelcomeModal'

const ONBOARDED_KEY = 'vigil_onboarded'

// ─── helpers ────────────────────────────────────────────────────────────────

const SCORE_DEFS = [
  { key: 'performance',   label: 'Performance' },
  { key: 'seo',           label: 'SEO' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'security',      label: 'Security' },
]

// Chart-only categorical palette — distinguishes the 4 lines WITHOUT
// implying quality (deliberately not green/amber/red). Health is shown by
// the score colors on the cards/bars/gauge instead.
const CHART_COLORS = {
  performance:   '#3b82f6', // blue
  seo:           '#14b8a6', // teal
  accessibility: '#8b5cf6', // violet
  security:      '#f97316', // orange
}

function scoreColor(v) {
  if (v >= 80) return 'text-live'
  if (v >= 60) return 'text-warn'
  return 'text-crit'
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDateShort(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const when = payload[0]?.payload?.datetime
  return (
    <div className="bg-elevated border border-white/10 rounded-xl p-4 text-xs font-mono">
      <p className="text-ink-dim mb-2">{when || label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="mb-1">
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

// Status band for a 0-100 score.
function statusTone(v) {
  if (v >= 80) return { label: 'Healthy',  text: 'text-live', stroke: '#45c08a', wrap: 'border-live/30' }
  if (v >= 60) return { label: 'At Risk',  text: 'text-warn', stroke: '#d9b25a', wrap: 'border-warn/30' }
  return            { label: 'Critical', text: 'text-crit', stroke: '#e06576', wrap: 'border-crit/30' }
}

// Circular gauge for the headline overall score.
function ScoreRing({ value, size = 116, stroke = 9 }) {
  const t = statusTone(value)
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const off = circ * (1 - value / 100)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.stroke} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.16,1,0.3,1)', filter: `drop-shadow(0 0 6px ${t.stroke}66)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-mono text-4xl font-bold tabular-nums ${t.text}`}>{value}</span>
        <span className="font-mono text-[9px] text-ink-faint">/ 100</span>
      </div>
    </div>
  )
}

// Minimal inline trend line for a metric's history.
function Sparkline({ values, color, height = 30 }) {
  if (!values || values.length < 2) return null
  const w = 100
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = height - 3 - ((v - min) / span) * (height - 6)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="mt-3 h-7 w-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// Small labelled metric used in the summary panel.
function Stat({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">{label}</p>
      <p className="mt-1 truncate font-mono text-sm text-ink-bright">{value}</p>
    </div>
  )
}

// ─── component ──────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { isLoggedIn, user, requestSignOut } = useAuth()

  const [recentAudits, setRecentAudits] = useState([])
  const [history,      setHistory]      = useState([])
  const [selectedUrl,  setSelectedUrl]  = useState(location.state?.url || null)
  const [activeLine,   setActiveLine]   = useState('all')
  const [activeTab,    setActiveTab]    = useState('overview')
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [showWelcome,  setShowWelcome]  = useState(false)

  // First-run tutorial: show once per browser for logged-in users.
  useEffect(() => {
    if (isLoggedIn && !localStorage.getItem(ONBOARDED_KEY)) {
      setShowWelcome(true)
    }
  }, [isLoggedIn])

  const dismissWelcome = () => {
    localStorage.setItem(ONBOARDED_KEY, '1')
    setShowWelcome(false)
  }

  const openSettings = () => {
    if (isLoggedIn) {
      navigate('/settings', { state: { url: selectedUrl } })
    } else {
      navigate('/login')
    }
  }

  // Unique audited URLs for the site selector
  const auditedUrls = [...new Set(recentAudits.map(r => r.url))]

  // ── Fetch all recent audits on mount ──────────────────────────────────────
  useEffect(() => {
    // Resolve the incoming url (which may lack a protocol, e.g. from Results /
    // Settings) to a record's canonical url so filtering + history match.
    const strip = u => (u || '').replace(/^https?:\/\//, '')
    const resolveSelected = (records) => {
      if (records.length === 0) return
      const match = records.find(r => strip(r.url) === strip(selectedUrl))
      setSelectedUrl(match ? match.url : records[0].url)
    }

    if (!isLoggedIn) {
      // Guests: read from localStorage
      const guestAudits = getGuestAudits().map(a => ({
        id:         a.id,
        url:        a.url,
        scores:     a.scores,
        ai_summary: a.ai_summary,
        created_at: a.created_at,
      }))
      setRecentAudits(guestAudits)
      resolveSelected(guestAudits)
      setLoading(false)
      return
    }
    getRecentAudits(30)
      .then(records => {
        setRecentAudits(records)
        resolveSelected(records)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [isLoggedIn])

  // ── Fetch trend history whenever selectedUrl changes ──────────────────────
  useEffect(() => {
    if (!selectedUrl) return

    if (!isLoggedIn) {
      // Guests: build history from localStorage audits for this URL
      const all = getGuestAudits().filter(a => a.url === selectedUrl)
      const chartData = all.slice().reverse().map(a => ({
        date:          fmtDateShort(a.created_at),
        datetime:      fmtDate(a.created_at),
        performance:   a.scores.performance,
        seo:           a.scores.seo,
        accessibility: a.scores.accessibility,
        security:      a.scores.security,
      }))
      setHistory(chartData)
      return
    }

    getHistory(selectedUrl, 20)
      .then(records => {
        const chartData = records.slice().reverse().map(r => ({
          date:          fmtDateShort(r.created_at),
          datetime:      fmtDate(r.created_at),
          performance:   r.scores.performance,
          seo:           r.scores.seo,
          accessibility: r.scores.accessibility,
          security:      r.scores.security,
        }))
        setHistory(chartData)
      })
      .catch(() => setHistory([]))
  }, [selectedUrl, isLoggedIn])

  const latest  = history[history.length - 1]
  const prev    = history[history.length - 2]
  const visibleLines = activeLine === 'all' ? SCORE_DEFS.map(s => s.key) : [activeLine]

  // Full audit records for the selected site (newest first) — carry overall + timestamp.
  const auditsForUrl = recentAudits.filter(r => r.url === selectedUrl)
  const latestAudit  = auditsForUrl[0]
  const prevAudit    = auditsForUrl[1]
  const avgOverall   = auditsForUrl.length
    ? Math.round(auditsForUrl.reduce((s, a) => s + a.scores.overall, 0) / auditsForUrl.length)
    : null
  const ranked = latestAudit
    ? SCORE_DEFS.map(d => ({ ...d, value: latestAudit.scores[d.key] })).sort((a, b) => b.value - a.value)
    : []
  const best  = ranked[0]
  const worst = ranked[ranked.length - 1]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-void text-ink font-sans overflow-x-hidden">

      <Backdrop />
      {showWelcome && <WelcomeModal username={user?.username} onClose={dismissWelcome} />}

      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between gap-4 px-6 md:px-12 py-4 border-b border-white/[0.06] backdrop-blur-sm">
        <button onClick={() => navigate('/')} className="font-display text-lg font-bold tracking-tight text-ink-bright">
          SAT<span className="text-accent">sec</span>
        </button>
        <SiteChip url={selectedUrl} />
        <div className="flex gap-3">
          <button onClick={openSettings} className="btn-icon" title="Settings" aria-label="Settings">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          {isLoggedIn ? (
            <button onClick={requestSignOut} className="btn-signout" title={`Sign out ${user.username}`}>
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          ) : (
            <button onClick={() => navigate('/login')} className="btn-ghost">
              Sign in
            </button>
          )}
          <button onClick={() => navigate('/')} className="btn-accent">
            + New Audit
          </button>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="font-display text-xl font-bold text-ink-bright mb-1">Performance Dashboard</h2>
            <p className="text-sm text-ink-faint font-mono">
              {recentAudits.length} audit{recentAudits.length !== 1 ? 's' : ''} across {auditedUrls.length} site{auditedUrls.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {loading && (
          <div className="text-center py-20 text-ink-faint font-mono text-sm animate-pulse">loading audits...</div>
        )}

        {error && (
          <div className="rounded-xl border border-crit/20 bg-crit/[0.06] px-5 py-4 text-sm text-crit font-mono mb-6">
            {error}
          </div>
        )}

        {!loading && !error && recentAudits.length === 0 && (
          <div className="text-center py-24">
            <p className="text-ink-faint font-mono text-sm mb-4">no audits yet</p>
            <button onClick={() => navigate('/')} className="btn-accent">
              Run your first audit →
            </button>
          </div>
        )}

        {!loading && recentAudits.length > 0 && (
          <>
            {/* Tabs */}
            <div className="mb-6 flex gap-1 border-b border-white/[0.06]">
              {[['overview', 'Overview'], ['recent', 'Recent Audits']].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setActiveTab(k)}
                  className={`-mb-px border-b-2 px-4 py-2 font-mono text-xs transition-colors ${
                    activeTab === k
                      ? 'border-accent text-accent'
                      : 'border-transparent text-ink-dim hover:text-ink-bright'
                  }`}
                >
                  {label}
                  {k === 'recent' && (
                    <span className="ml-1.5 text-ink-faint">{recentAudits.length}</span>
                  )}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
            <>
            {/* Site Selector — dropdown keeps it compact + long URLs contained */}
            {auditedUrls.length > 1 && (
              <div className="mb-6 flex items-center gap-3">
                <span className="shrink-0 font-mono text-xs text-ink-faint">Site</span>
                <div className="relative">
                  <select
                    value={selectedUrl || ''}
                    onChange={e => { setSelectedUrl(e.target.value); setActiveLine('all') }}
                    className="max-w-[280px] cursor-pointer appearance-none truncate rounded-lg border border-white/[0.08] bg-elevated/70 py-2 pl-3 pr-9 font-mono text-xs text-ink-bright outline-none transition-colors focus:border-accent/50"
                  >
                    {auditedUrls.map(u => (
                      <option key={u} value={u} className="bg-elevated text-ink">
                        {u.replace(/^https?:\/\//, '')}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">▾</span>
                </div>
              </div>
            )}

            {/* Headline overall score + summary */}
            {latestAudit && (
              <div className="mb-6 grid gap-4 md:grid-cols-3">
                <div className={`panel flex items-center gap-5 border p-6 ${statusTone(latestAudit.scores.overall).wrap}`}>
                  <ScoreRing value={latestAudit.scores.overall} />
                  <div className="min-w-0">
                    <p className="eyebrow">Overall Score</p>
                    <p className={`mt-1 font-mono text-lg font-bold ${statusTone(latestAudit.scores.overall).text}`}>
                      {statusTone(latestAudit.scores.overall).label}
                    </p>
                    {prevAudit && (() => {
                      const d = Math.round((latestAudit.scores.overall - prevAudit.scores.overall) * 10) / 10
                      return (
                        <p className={`mt-1 font-mono text-xs ${d >= 0 ? 'text-live' : 'text-crit'}`}>
                          {d >= 0 ? '▲' : '▼'} {Math.abs(d)} since last scan
                        </p>
                      )
                    })()}
                  </div>
                </div>

                <div className="panel grid grid-cols-2 gap-x-4 gap-y-5 p-6 md:col-span-2">
                  <Stat label="Last scanned" value={fmtDate(latestAudit.created_at)} />
                  <Stat label="Audits (this site)" value={auditsForUrl.length} />
                  <Stat label="Average overall" value={avgOverall} />
                  {best && worst && <Stat label="Strongest / weakest" value={`${best.label} · ${worst.label}`} />}
                </div>
              </div>
            )}

            {/* AI summary — renders only once the engine fills ai_summary */}
            {latestAudit?.ai_summary && (
              <div className="panel border-accent/20 p-6 mb-6">
                <p className="eyebrow mb-3 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  AI Summary
                </p>
                <p className="text-sm leading-relaxed text-ink">{latestAudit.ai_summary}</p>
              </div>
            )}

            {/* Since last scan — consolidated per-category deltas */}
            {prevAudit && (
              <div className="panel p-6 mb-6">
                <p className="eyebrow mb-4">Since Last Scan</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {SCORE_DEFS.map(({ key, label }) => {
                    const d = Math.round((latestAudit.scores[key] - prevAudit.scores[key]) * 10) / 10
                    const tone = d > 0 ? 'text-live' : d < 0 ? 'text-crit' : 'text-ink-faint'
                    return (
                      <div key={key} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 font-mono text-xs">
                        <span className="text-ink-dim">{label}</span>
                        <span className={`font-bold tabular-nums ${tone}`}>
                          {d > 0 ? '+' : ''}{d}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Category breakdown — bar view of the latest scores */}
            {latestAudit && (
              <div className="panel p-6 mb-6">
                <p className="eyebrow mb-4">Category Breakdown</p>
                <div className="flex flex-col gap-4">
                  {SCORE_DEFS.map(({ key, label }) => {
                    const v = latestAudit.scores[key]
                    const t = statusTone(v)
                    return (
                      <div key={key} className="flex items-center gap-3 font-mono text-xs">
                        <span className="w-28 shrink-0 text-ink-dim">{label}</span>
                        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                            style={{ width: `${v}%`, background: t.stroke, boxShadow: `0 0 8px ${t.stroke}66` }} />
                        </div>
                        <span className={`w-8 text-right font-bold tabular-nums ${t.text}`}>{v}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Score Cards — latest scores for selected URL */}
            {latest && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {SCORE_DEFS.map(({ key, label }) => {
                  const value = latest[key]
                  const trend = history.map(h => h[key])
                  const t = statusTone(value)
                  return (
                    <div
                      key={key}
                      onClick={() => setActiveLine(activeLine === key ? 'all' : key)}
                      className={`panel p-5 cursor-pointer transition-all ${
                        activeLine === key ? 'border-white/20 bg-white/[0.06]' : 'hover:border-white/15'
                      }`}
                    >
                      <div className={`text-3xl font-mono font-bold tabular-nums mb-1 ${t.text}`}>{value}</div>
                      <div className="text-xs text-ink-dim">{label}</div>
                      <Sparkline values={trend} color={t.stroke} />
                    </div>
                  )
                })}
              </div>
            )}

            {/* Trend Chart */}
            {history.length >= 2 && (
              <div className="panel p-6 mb-6">
                <div className="flex items-center justify-between mb-6">
                  <p className="eyebrow">Score History</p>
                  <div className="flex flex-wrap gap-2">
                    {['all', ...SCORE_DEFS.map(s => s.key)].map(k => (
                      <button key={k} onClick={() => setActiveLine(k)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full transition-all font-mono ${
                          activeLine === k ? 'bg-white/10 text-ink-bright' : 'text-ink-faint hover:text-ink-dim'
                        }`}>
                        {k !== 'all' && (
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: CHART_COLORS[k] }} />
                        )}
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: '#3f5163', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#3f5163', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    {SCORE_DEFS.map(({ key }) =>
                      visibleLines.includes(key) && (
                        <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[key]}
                          strokeWidth={2} dot={{ fill: CHART_COLORS[key], r: 3 }} activeDot={{ r: 5 }} />
                      )
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {history.length === 1 && (
              <div className="panel p-6 mb-6 text-center">
                <p className="text-ink-faint font-mono text-xs">run at least 2 audits on this site to see trend chart</p>
              </div>
            )}
            </>
            )}

            {/* Recent Audits Table — shown only on the Recent tab */}
            {activeTab === 'recent' && (
            <div className="panel p-6">
              <p className="eyebrow mb-4">Recent Audits</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-ink-faint border-b border-white/[0.04]">
                      <th className="text-left pb-3 font-normal">Site</th>
                      <th className="text-left pb-3 font-normal">Scanned</th>
                      <th className="text-center pb-3 font-normal">Perf</th>
                      <th className="text-center pb-3 font-normal">SEO</th>
                      <th className="text-center pb-3 font-normal">Access</th>
                      <th className="text-center pb-3 font-normal">Sec</th>
                      <th className="text-center pb-3 font-normal">Overall</th>
                      <th className="pb-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {recentAudits.slice(0, 15).map(r => (
                      <tr key={r.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 text-ink-dim max-w-[160px] truncate">
                          {r.url.replace(/^https?:\/\//, '')}
                        </td>
                        <td className="py-3 text-ink-faint">{fmtDate(r.created_at)}</td>
                        <td className={`py-3 text-center font-bold ${scoreColor(r.scores.performance)}`}>{r.scores.performance}</td>
                        <td className={`py-3 text-center font-bold ${scoreColor(r.scores.seo)}`}>{r.scores.seo}</td>
                        <td className={`py-3 text-center font-bold ${scoreColor(r.scores.accessibility)}`}>{r.scores.accessibility}</td>
                        <td className={`py-3 text-center font-bold ${scoreColor(r.scores.security)}`}>{r.scores.security}</td>
                        <td className={`py-3 text-center font-bold ${scoreColor(r.scores.overall)}`}>{r.scores.overall}</td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => navigate('/results', {
                              state: {
                                result: {
                                  url: r.url,
                                  scores: r.scores,
                                  issues: { performance: [], seo: [], accessibility: [], security: [] },
                                  ai_summary: r.ai_summary,
                                  error: null
                                },
                                url: r.url
                              }
                            })}
                            className="text-ink-faint hover:text-accent transition-colors px-2"
                          >
                            view →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </>
        )}
      </div>

    </div>
  )
}
