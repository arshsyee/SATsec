import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { getRecentAudits, getHistory } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { getGuestAudits } from '../utils/guestStorage'

// ─── helpers ────────────────────────────────────────────────────────────────

const SCORE_DEFS = [
  { key: 'performance',   label: 'Performance',   color: '#22c55e' },
  { key: 'seo',           label: 'SEO',           color: '#3b82f6' },
  { key: 'accessibility', label: 'Accessibility', color: '#f59e0b' },
  { key: 'security',      label: 'Security',      color: '#ef4444' },
]

function scoreColor(v) {
  if (v >= 80) return 'text-green-400'
  if (v >= 60) return 'text-amber-400'
  return 'text-red-400'
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDateShort(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0d1520] border border-white/10 rounded-xl p-4 text-xs font-mono">
      <p className="text-[#7a9ab8] mb-2">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="mb-1">
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

// ─── component ──────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { isLoggedIn, user, logout } = useAuth()

  const [recentAudits, setRecentAudits] = useState([])
  const [history,      setHistory]      = useState([])
  const [selectedUrl,  setSelectedUrl]  = useState(location.state?.url || null)
  const [activeLine,   setActiveLine]   = useState('all')
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

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
      if (!selectedUrl && guestAudits.length > 0) setSelectedUrl(guestAudits[0].url)
      setLoading(false)
      return
    }
    getRecentAudits(30)
      .then(records => {
        setRecentAudits(records)
        if (!selectedUrl && records.length > 0) setSelectedUrl(records[0].url)
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#080c14] text-[#e8edf5] font-sans">

      {/* Grid bg */}
      <div className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(99,179,237,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,179,237,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-12 py-4 border-b border-white/[0.06]">
        <div className="font-mono text-lg font-bold cursor-pointer" onClick={() => navigate('/')}>
          SAT<span className="text-blue-500">sec</span>
        </div>
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2 font-mono text-xs text-[#7a9ab8]">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          {selectedUrl || 'no site selected'}
        </div>
        <div className="flex gap-3">
          <button onClick={openSettings}
            className="border border-white/10 hover:border-white/25 text-[#8899aa] hover:text-[#e8edf5] text-sm px-4 py-2 rounded-lg transition-all">
            Settings
          </button>
          {isLoggedIn ? (
            <button onClick={logout}
              className="border border-white/10 hover:border-white/25 text-[#8899aa] hover:text-[#e8edf5] text-sm px-4 py-2 rounded-lg transition-all">
              Sign out ({user.username})
            </button>
          ) : (
            <button onClick={() => navigate('/login')}
              className="border border-white/10 hover:border-white/25 text-[#8899aa] hover:text-[#e8edf5] text-sm px-4 py-2 rounded-lg transition-all">
              Sign in
            </button>
          )}
          <button onClick={() => navigate('/')}
            className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + New Audit
          </button>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-xl font-medium text-[#f0f4fa] mb-1">Performance Dashboard</h2>
            <p className="text-sm text-[#4a6070] font-mono">
              {recentAudits.length} audit{recentAudits.length !== 1 ? 's' : ''} across {auditedUrls.length} site{auditedUrls.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {loading && (
          <div className="text-center py-20 text-[#4a6070] font-mono text-sm animate-pulse">loading audits...</div>
        )}

        {error && (
          <div className="bg-red-500/[0.06] border border-red-500/20 rounded-xl px-5 py-4 text-sm text-red-400 font-mono mb-6">
            {error}
          </div>
        )}

        {!loading && !error && recentAudits.length === 0 && (
          <div className="text-center py-24">
            <p className="text-[#4a6070] font-mono text-sm mb-4">no audits yet</p>
            <button onClick={() => navigate('/')}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors">
              Run your first audit →
            </button>
          </div>
        )}

        {!loading && recentAudits.length > 0 && (
          <>
            {/* Site Selector */}
            {auditedUrls.length > 1 && (
              <div className="flex gap-2 flex-wrap mb-6">
                {auditedUrls.map(u => (
                  <button
                    key={u}
                    onClick={() => { setSelectedUrl(u); setActiveLine('all') }}
                    className={`text-xs px-3 py-1.5 rounded-lg font-mono transition-all border ${
                      selectedUrl === u
                        ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                        : 'bg-white/[0.03] border-white/[0.08] text-[#4a6070] hover:text-[#8899aa]'
                    }`}
                  >
                    {u.replace(/^https?:\/\//, '')}
                  </button>
                ))}
              </div>
            )}

            {/* Score Cards — latest scores for selected URL */}
            {latest && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {SCORE_DEFS.map(({ key, label, color }) => {
                  const value = latest[key]
                  const diff  = prev ? value - prev[key] : null
                  return (
                    <div
                      key={key}
                      onClick={() => setActiveLine(activeLine === key ? 'all' : key)}
                      className={`bg-white/[0.03] border rounded-2xl p-5 cursor-pointer transition-all ${
                        activeLine === key ? 'border-white/20 bg-white/[0.06]' : 'border-white/[0.07] hover:border-white/15'
                      }`}
                    >
                      <div className="text-3xl font-mono font-bold mb-1" style={{ color }}>{value}</div>
                      <div className="text-xs text-[#8899aa] mb-2">{label}</div>
                      {diff !== null && (
                        <div className={`text-xs font-mono ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {diff >= 0 ? '▲' : '▼'} {Math.abs(diff)} from last
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Trend Chart */}
            {history.length >= 2 && (
              <div className="bg-white/[0.025] border border-white/[0.06] rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between mb-6">
                  <p className="text-xs font-mono text-[#8899aa] uppercase tracking-widest">Score History</p>
                  <div className="flex gap-2">
                    {['all', ...SCORE_DEFS.map(s => s.key)].map(k => (
                      <button key={k} onClick={() => setActiveLine(k)}
                        className={`text-xs px-3 py-1 rounded-full transition-all font-mono ${
                          activeLine === k ? 'bg-white/10 text-white' : 'text-[#4a6070] hover:text-[#8899aa]'
                        }`}>
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: '#4a6070', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#4a6070', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    {SCORE_DEFS.map(({ key, color }) =>
                      visibleLines.includes(key) && (
                        <Line key={key} type="monotone" dataKey={key} stroke={color}
                          strokeWidth={2} dot={{ fill: color, r: 3 }} activeDot={{ r: 5 }} />
                      )
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {history.length === 1 && (
              <div className="bg-white/[0.025] border border-white/[0.06] rounded-2xl p-6 mb-6 text-center">
                <p className="text-[#4a6070] font-mono text-xs">run at least 2 audits on this site to see trend chart</p>
              </div>
            )}

            {/* Recent Audits Table */}
            <div className="bg-white/[0.025] border border-white/[0.06] rounded-2xl p-6">
              <p className="text-xs font-mono text-[#8899aa] uppercase tracking-widest mb-4">Recent Audits</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-[#3a5068] border-b border-white/[0.04]">
                      <th className="text-left pb-3 font-normal">Site</th>
                      <th className="text-left pb-3 font-normal">Scanned</th>
                      <th className="text-center pb-3 font-normal text-green-400">Perf</th>
                      <th className="text-center pb-3 font-normal text-blue-400">SEO</th>
                      <th className="text-center pb-3 font-normal text-amber-400">Access</th>
                      <th className="text-center pb-3 font-normal text-red-400">Sec</th>
                      <th className="text-center pb-3 font-normal">Overall</th>
                      <th className="pb-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {recentAudits.slice(0, 15).map(r => (
                      <tr key={r.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 text-[#7a9ab8] max-w-[160px] truncate">
                          {r.url.replace(/^https?:\/\//, '')}
                        </td>
                        <td className="py-3 text-[#3a5068]">{fmtDate(r.created_at)}</td>
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
                            className="text-[#3a5068] hover:text-blue-400 transition-colors px-2"
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
          </>
        )}
      </div>

    </div>
  )
}
