import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Backdrop from '../components/Backdrop'
import Nav from '../components/Nav'
import LiveMonitor, { useDriftingScores } from '../components/LiveMonitor'

function isValidDomain(input) {
  const cleaned = input.trim().replace(/^https?:\/\//i, '').split('/')[0]
  return /^[a-zA-Z0-9][a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}$/.test(cleaned)
}

/* ── Error toast ──────────────────────────────────────────────── */
function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="fixed top-5 right-5 z-50 flex items-start gap-3 panel border-crit/30 px-4 py-3 shadow-xl max-w-sm animate-in">
      <span className="text-crit mt-0.5 shrink-0 font-mono text-sm">[!]</span>
      <div>
        <p className="text-sm font-medium text-ink-bright mb-0.5">Audit failed</p>
        <p className="text-xs text-ink-dim font-mono leading-relaxed">{message}</p>
      </div>
      <button onClick={onClose} className="text-ink-faint hover:text-ink ml-2 shrink-0 text-lg leading-none">×</button>
    </div>
  )
}

export default function Landing() {
  const [url, setUrl] = useState('')
  const [toast, setToast] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn } = useAuth()
  const scores = useDriftingScores()

  useEffect(() => {
    if (location.state?.error) {
      setToast(location.state.error)
      window.history.replaceState({}, '')
    }
  }, [])

  const handleScan = () => {
    const trimmed = url.trim()
    if (!trimmed) return
    if (!isValidDomain(trimmed)) {
      setToast(`"${trimmed}" doesn't look like a valid domain. Try something like example.com`)
      return
    }
    navigate('/scanning', { state: { url: trimmed } })
  }

  // Signed-in → live view; otherwise sign in first, then land on /live.
  const goLive = () => {
    if (isLoggedIn) navigate('/live')
    else navigate('/login', { state: { redirectTo: '/live' } })
  }

  return (
    <div className="relative min-h-screen bg-void text-ink font-sans overflow-x-hidden animate-flicker">
      <Backdrop />
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <Nav />

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-20 pb-12 text-center">
        <h1 className="animate-rise font-display text-5xl md:text-7xl font-bold leading-[0.98] tracking-tight text-ink-bright"
            style={{ animationDelay: '0.12s' }}>
          Your website,
          <br />
          <span className="text-accent" style={{ textShadow: '0 0 28px rgb(var(--c-accent) / 0.5)' }}>
            audited end to end.
          </span>
        </h1>

        <p className="animate-rise mx-auto mt-6 max-w-2xl text-base md:text-lg text-ink-dim leading-relaxed"
           style={{ animationDelay: '0.2s', textWrap: 'balance' }}>
          Performance, SEO, accessibility, and security in one scan.
          <br className="hidden md:block" />
          Re-run on a schedule and get alerted when a score drops.
        </p>

        {/* Terminal input */}
        <div className="animate-rise mx-auto mt-10 max-w-xl" style={{ animationDelay: '0.28s' }}>
          <div className="flex items-stretch overflow-hidden rounded-xl border border-white/10 bg-elevated/70 backdrop-blur-sm focus-within:border-accent/50 focus-within:shadow-glow-accent transition-all">
            <span className="hidden sm:flex items-center pl-4 pr-1 font-mono text-sm text-accent">audit</span>
            <span className="flex items-center px-3 font-mono text-xs text-ink-faint border-r border-white/[0.07] whitespace-nowrap">
              https://
            </span>
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleScan()}
              placeholder="yoursite.com"
              autoFocus
              className="min-w-0 flex-1 bg-transparent px-4 py-4 font-mono text-sm text-ink-bright outline-none placeholder-ink-ghost"
            />
            <button onClick={handleScan}
              className="bg-accent hover:bg-accent-bright text-white font-mono font-bold text-sm px-6 transition-colors whitespace-nowrap">
              RUN AUDIT →
            </button>
          </div>
          <p className="mt-3 font-mono text-xs text-ink-faint">no signup required · results in seconds</p>
        </div>
      </section>

      {/* ── Live surveillance console ─────────────────────────── */}
      <section className="animate-rise relative z-10 mx-auto max-w-3xl px-6 pb-20" style={{ animationDelay: '0.4s' }}>
        <LiveMonitor scores={scores} onGoLive={goLive} />
      </section>

      {/* ── Status-bar footer ─────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/[0.05] px-6 md:px-12 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between font-mono text-[11px] text-ink-faint">
          <span>SATsec</span>
          <span className="hidden sm:block tracking-widest text-ink-ghost">
            PERF · SEO · A11Y · SEC
          </span>
          <span>v0.1</span>
        </div>
      </footer>
    </div>
  )
}
