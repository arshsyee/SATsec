import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function isValidDomain(input) {
  const cleaned = input.trim().replace(/^https?:\/\//i, '').split('/')[0]
  // Must contain a dot, no spaces, valid domain chars, TLD at least 2 chars
  return /^[a-zA-Z0-9][a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}$/.test(cleaned)
}

function colorFor(score) {
  if (score >= 80) return 'text-green-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-red-400'
}

function AnimatedScore({ label, initial }) {
  const [score, setScore] = useState(initial)
  const [target, setTarget] = useState(initial)

  // Pick a new target every 3s
  useEffect(() => {
    const pickNext = () => setTarget(Math.floor(Math.random() * 80) + 20)
    const id = setInterval(pickNext, 3000)
    return () => clearInterval(id)
  }, [])

  // Animate current toward target
  useEffect(() => {
    if (score === target) return
    const step = score < target ? 1 : -1
    const id = setTimeout(() => setScore(s => s + step), 80)
    return () => clearTimeout(id)
  }, [score, target])

  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-6 py-5 w-40 text-center hover:-translate-y-1 transition-transform">
      <div className={`text-3xl font-mono font-bold mb-1 transition-colors ${colorFor(score)}`}>{score}</div>
      <div className="text-[11px] font-medium text-[#c8d8e8] uppercase tracking-widest">{label}</div>
    </div>
  )
}

function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="fixed top-5 right-5 z-50 flex items-start gap-3 bg-[#0d1520] border border-red-500/30 rounded-xl px-4 py-3 shadow-xl max-w-sm animate-in">
      <span className="text-red-400 mt-0.5 flex-shrink-0 font-mono text-sm">[!]</span>
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
        <div className="hidden md:flex gap-8 font-mono">
          <span onClick={() => navigate('/features')} className="text-sm text-[#8899aa] hover:text-[#e8edf5] transition-colors cursor-pointer">Features</span>
          <span onClick={() => navigate('/dashboard')} className="text-sm text-[#8899aa] hover:text-[#e8edf5] transition-colors cursor-pointer">Dashboard</span>
          <span className="text-sm text-[#8899aa] hover:text-[#e8edf5] transition-colors cursor-pointer">Pricing</span>
          <span className="text-sm text-[#8899aa] hover:text-[#e8edf5] transition-colors cursor-pointer">Docs</span>
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
        <h1 className="font-mono text-5xl md:text-6xl font-semibold leading-tight tracking-tighter text-[#f0f4fa] mb-5 mt-4">
          Your website,<br />
          <span className="text-blue-500">under surveillance.</span>
        </h1>
        <p className="text-lg text-[#7a8fa8] font-light leading-relaxed max-w-xl mx-auto mb-12">
          Performance, SEO, accessibility, and security audits. Running 24/7.
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
            className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-mono font-medium px-7 transition-colors whitespace-nowrap"
          >
            Run Audit
          </button>
        </div>
        <p className="text-xs text-[#3a5068] font-mono">no signup required</p>
      </section>

      {/* Score Preview */}
      <div className="relative z-10 flex justify-center gap-3 px-6 pt-12 flex-wrap">
        {[
          { label: 'Performance',   initial: 94 },
          { label: 'SEO',           initial: 88 },
          { label: 'Accessibility', initial: 61 },
          { label: 'Security',      initial: 43 },
        ].map(({ label, initial }) => (
          <AnimatedScore key={label} label={label} initial={initial} />
        ))}
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-20 border-t border-white/[0.05] px-12 py-6 flex justify-between">
        <p className="text-xs text-[#2e4050] font-mono">SATsec</p>
        <p className="text-xs text-[#2e4050] font-mono">v0.1</p>
      </div>
    </div>
  )
}
