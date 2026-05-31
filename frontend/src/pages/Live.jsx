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

export default function Live() {
  const navigate = useNavigate()
  const { isLoggedIn } = useAuth()
  const demoScores = useDriftingScores()   // hook must run unconditionally

  const [latest, setLatest] = useState(null)
  const [loading, setLoading] = useState(true)

  // Pull the most recent audit (real data) when available.
  useEffect(() => {
    let alive = true
    const guest = () => {
      const a = getGuestAudits()[0] || null
      if (alive) { setLatest(a); setLoading(false) }
    }
    if (!isLoggedIn) { guest(); return () => { alive = false } }

    getRecentAudits(1)
      .then(records => { if (alive) { setLatest(records[0] || null); setLoading(false) } })
      .catch(() => { if (alive) { setLatest(null); setLoading(false) } })
    return () => { alive = false }
  }, [isLoggedIn])

  const hasReal = !!latest?.scores
  const scores = hasReal ? scoresFromAudit(latest.scores) : demoScores

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
                  ? `tracking ${latest.url.replace(/^https?:\/\//, '')}`
                  : isLoggedIn
                    ? 'no audits yet — showing a demo feed'
                    : 'demo feed — sign in to track your own site'}
            </p>
          </div>
          <button onClick={() => navigate('/')} className="btn-ghost shrink-0">+ New Audit</button>
        </div>

        <LiveMonitor
          scores={scores}
          live={!loading}
          targetUrl={hasReal ? latest.url : 'demo://example.com'}
          sampledLabel={hasReal ? fmtWhen(latest.created_at) : 'sampled just now'}
        />

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
