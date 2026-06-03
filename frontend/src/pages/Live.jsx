import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getRecentAudits } from '../api'
import { getGuestAudits } from '../utils/guestStorage'
import Backdrop from '../components/Backdrop'
import Nav from '../components/Nav'
import LiveMonitor, { useDriftingScores, scoresFromAudit } from '../components/LiveMonitor'

function fmtWhen(iso) {
  if (!iso) return 'just now'
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'moments ago'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  return `${Math.round(hrs / 24)} d ago`
}

const stripProto = u => (u || '').replace(/^https?:\/\//, '')

// Reduce a list of audits to the most recent one per unique URL.
function uniqueSites(records) {
  const seen = new Set()
  const sites = []
  for (const r of records) {
    if (r?.url && !seen.has(r.url)) { seen.add(r.url); sites.push(r) }
  }
  return sites
}

export default function Live() {
  const navigate = useNavigate()
  const { isLoggedIn } = useAuth()
  const demoScores = useDriftingScores()   // hook must run unconditionally

  const [sites,       setSites]       = useState([])
  const [selectedUrl, setSelectedUrl] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [switching,   setSwitching]   = useState(false)

  // Pull recent audits (real data) when available.
  useEffect(() => {
    let alive = true
    const apply = (records) => {
      if (!alive) return
      const list = uniqueSites(records)
      setSites(list)
      setSelectedUrl(list[0]?.url || null)
      setLoading(false)
    }
    if (!isLoggedIn) { apply(getGuestAudits()); return () => { alive = false } }

    getRecentAudits(30)
      .then(apply)
      .catch(() => { if (alive) { setSites([]); setSelectedUrl(null); setLoading(false) } })
    return () => { alive = false }
  }, [isLoggedIn])

  // Switch tracked site with a short loading beat so the swap reads as "re-locking".
  const handleSelect = (url) => {
    if (url === selectedUrl || switching) return
    setSwitching(true)
    setTimeout(() => {
      setSelectedUrl(url)
      setSwitching(false)
    }, 650)
  }

  const latest  = sites.find(s => s.url === selectedUrl) || null
  const hasReal = !!latest?.scores
  const scores  = hasReal ? scoresFromAudit(latest.scores) : demoScores

  return (
    <div className="relative min-h-screen bg-void text-ink font-sans overflow-x-hidden">
      <Backdrop />
      <Nav active="live" />

      <section className="relative z-10 mx-auto max-w-3xl px-6 pt-16 pb-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-ink-bright">Live View</h1>
            <p className="mt-1 truncate font-mono text-xs text-ink-faint">
              {loading
                ? 'connecting…'
                : hasReal
                  ? `tracking ${stripProto(latest.url)}`
                  : isLoggedIn
                    ? 'no audits yet — showing a demo feed'
                    : 'demo feed — sign in to track your own site'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {/* Site switcher — only when more than one audited site exists */}
            {sites.length > 1 && (
              <div className="relative">
                <select
                  value={selectedUrl || ''}
                  onChange={e => handleSelect(e.target.value)}
                  disabled={switching}
                  className="cursor-pointer appearance-none truncate rounded-lg border border-white/[0.08] bg-elevated/70 py-2 pl-3 pr-9 font-mono text-xs text-ink-bright outline-none transition-colors hover:border-accent/40 focus:border-accent/50 disabled:opacity-50 max-w-[200px]"
                >
                  {sites.map(s => (
                    <option key={s.url} value={s.url} className="bg-elevated text-ink">{stripProto(s.url)}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">▾</span>
              </div>
            )}
            <button onClick={() => navigate('/')} className="btn-ghost">+ New Audit</button>
          </div>
        </div>

        {/* Monitor with a short re-lock overlay while switching sites */}
        <div className="relative">
          <LiveMonitor
            scores={scores}
            live={!loading && !switching}
            targetUrl={hasReal ? latest.url : 'demo://example.com'}
            sampledLabel={hasReal ? fmtWhen(latest.created_at) : 'sampled just now'}
          />
          {switching && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-void/70 backdrop-blur-sm">
              <span className="h-7 w-7 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
              <span className="font-mono text-xs tracking-widest text-accent">RE-LOCKING TARGET…</span>
            </div>
          )}
        </div>

        {hasReal && (
          <div className="mt-6 flex justify-center">
            <button onClick={() => navigate('/dashboard', { state: { url: latest.url } })} className="btn-accent">
              Open full dashboard →
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
