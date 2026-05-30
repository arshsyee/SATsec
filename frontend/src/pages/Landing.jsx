import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function isValidDomain(input) {
  const cleaned = input.trim().replace(/^https?:\/\//i, '').split('/')[0]
  // Must contain a dot, no spaces, valid domain chars, TLD at least 2 chars
  return /^[a-zA-Z0-9][a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}$/.test(cleaned)
}

function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="fixed top-5 right-5 z-50 flex items-start gap-3 bg-[#0d1520] border border-red-500/30 rounded-xl px-4 py-3 shadow-xl max-w-sm animate-in">
      <span className="text-red-400 mt-0.5 flex-shrink-0">⚠</span>
      <div>
        <p className="text-sm font-medium text-[#e8edf5] mb-0.5">Audit failed</p>
        <p className="text-xs text-[#7a9ab8] font-mono leading-relaxed">{message}</p>
      </div>
      <button onClick={onClose} className="text-[#3a5068] hover:text-[#8899aa] ml-2 flex-shrink-0 text-lg leading-none">×</button>
    </div>
  )
}

export default function Landing() {
  const [url, setUrl] = useState('')
  const [toast, setToast] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn, user, logout } = useAuth()

  // Show error toast if Scanning redirected back with an error
  useEffect(() => {
    if (location.state?.error) {
      setToast(location.state.error)
      window.history.replaceState({}, '')  // clear the state so it doesn't re-show on refresh
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

  return (
    <div className="min-h-screen bg-[#080c14] text-[#e8edf5] font-sans overflow-x-hidden">

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Grid background */}
      <div className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(99,179,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,179,237,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-12 py-5 border-b border-white/5">
        <div className="font-mono text-xl font-bold">SAT<span className="text-blue-500">sec</span></div>
        <div className="hidden md:flex gap-8">
          <span onClick={() => navigate('/features')} className="text-sm text-[#8899aa] hover:text-[#e8edf5] transition-colors cursor-pointer">Features</span>
          <span onClick={() => navigate('/dashboard')} className="text-sm text-[#8899aa] hover:text-[#e8edf5] transition-colors cursor-pointer">Dashboard</span>
          <span className="text-sm text-[#3a4f63] cursor-default flex items-center gap-1.5" title="Coming soon">
            Pricing
            <span className="text-[9px] font-mono uppercase tracking-wider bg-white/[0.05] border border-white/10 text-[#5a7080] px-1.5 py-0.5 rounded">soon</span>
          </span>
          <span className="text-sm text-[#3a4f63] cursor-default flex items-center gap-1.5" title="Coming soon">
            Docs
            <span className="text-[9px] font-mono uppercase tracking-wider bg-white/[0.05] border border-white/10 text-[#5a7080] px-1.5 py-0.5 rounded">soon</span>
          </span>
        </div>
        {isLoggedIn ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#7a9ab8] font-mono hidden md:block">{user.username}</span>
            <button onClick={() => navigate('/dashboard')}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
              Dashboard
            </button>
            <button onClick={logout}
              className="border border-white/10 hover:border-white/25 text-[#8899aa] hover:text-[#e8edf5] text-sm px-4 py-2 rounded-lg transition-all">
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/login')}
              className="border border-white/10 hover:border-white/25 text-[#8899aa] hover:text-[#e8edf5] text-sm px-4 py-2 rounded-lg transition-all">
              Sign in
            </button>
            <button onClick={() => navigate('/register')}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
              Get Started
            </button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative z-10 text-center max-w-3xl mx-auto px-6 pt-24 pb-16">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-full px-4 py-1.5 text-xs text-blue-300 font-mono mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          Always watching. Always reporting.
        </div>
        <h1 className="text-5xl md:text-6xl font-semibold leading-tight tracking-tighter text-[#f0f4fa] mb-5">
          Your website,<br />
          <span className="text-blue-500">under surveillance.</span>
        </h1>
        <p className="text-lg text-[#7a8fa8] font-light leading-relaxed max-w-xl mx-auto mb-12">
          Automated performance, SEO, accessibility, and security audits — running 24/7, alerting you before clients notice.
        </p>

        {/* URL Input */}
        <div className="flex max-w-xl mx-auto mb-4 border border-white/10 rounded-xl overflow-hidden bg-white/[0.04] focus-within:border-blue-500/50 transition-colors">
          <span className="flex items-center px-4 font-mono text-xs text-[#4a6070] border-r border-white/[0.07] whitespace-nowrap">
            https://
          </span>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleScan()}
            placeholder="yoursite.com"
            className="flex-1 bg-transparent outline-none text-[#e8edf5] text-sm px-4 py-4 placeholder-[#3a4f63]"
          />
          <button
            onClick={handleScan}
            className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-7 transition-colors whitespace-nowrap"
          >
            Run Audit
          </button>
        </div>
        <p className="text-xs text-[#3a5068] font-mono">// no signup required — instant results</p>
      </section>

      {/* Score Preview */}
      <div className="relative z-10 flex justify-center gap-3 px-6 pt-12 flex-wrap">
        {[
          { score: 94, label: 'Performance', color: 'text-green-400' },
          { score: 88, label: 'SEO', color: 'text-green-400' },
          { score: 61, label: 'Accessibility', color: 'text-amber-400' },
          { score: 43, label: 'Security', color: 'text-red-400' },
        ].map(({ score, label, color }) => (
          <div key={label} className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-6 py-5 w-40 text-center hover:-translate-y-1 transition-transform">
            <div className={`text-3xl font-mono font-bold mb-1 ${color}`}>{score}</div>
            <div className="text-[11px] text-[#556070] uppercase tracking-widest">{label}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 mt-20 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: '⚡', title: 'Instant Audits', desc: 'Paste any URL and get a full 4-dimension report in seconds.' },
          { icon: '🕐', title: 'Scheduled Monitoring', desc: 'Run audits every 6 hours, daily, or weekly — automatically.' },
          { icon: '🔔', title: 'Smart Alerts', desc: 'Get emailed the moment a score drops below your threshold.' },
          { icon: '📈', title: 'Trend Dashboard', desc: 'Track score history over time. Spot when a deploy broke your site.' },
          { icon: '⚖️', title: 'ADA Compliance', desc: 'WCAG AA checks via axe-core — know your legal risk upfront.' },
          { icon: '🤖', title: 'AI Summaries', desc: 'Plain-English reports written for clients, not developers.' },
        ].map(({ icon, title, desc }) => (
          <div key={title} className="bg-white/[0.025] border border-white/[0.06] rounded-xl p-6 hover:border-blue-500/20 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-base mb-4">{icon}</div>
            <div className="text-sm font-medium text-[#c8d8e8] mb-2">{title}</div>
            <div className="text-xs text-[#5a7080] leading-relaxed">{desc}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-20 border-t border-white/[0.05] px-12 py-6 flex justify-between">
        <p className="text-xs text-[#2e4050] font-mono">// SATsec — web monitoring platform</p>
        <p className="text-xs text-[#2e4050] font-mono">// built for agencies. loved by devs.</p>
      </div>
    </div>
  )
}
