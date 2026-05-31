import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/** Small radar dish that quietly sweeps — the brand mark. */
function RadarMark({ className = '' }) {
  return (
    <span className={`relative inline-flex h-5 w-5 items-center justify-center ${className}`}>
      <span className="absolute inset-0 rounded-full border border-accent/40" />
      <span className="absolute inset-[3px] rounded-full border border-accent/20" />
      <span className="h-1 w-1 rounded-full bg-accent shadow-glow-accent" />
      {/* sweeping arm */}
      <span
        className="absolute inset-0 rounded-full animate-radar"
        style={{ background: 'conic-gradient(from 0deg, rgba(59,130,246,0.45), transparent 55%)' }}
      />
    </span>
  )
}

const LINKS = [
  { label: 'Features',  to: '/features' },
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Pricing',   soon: true },
  { label: 'Docs',      soon: true },
]

/**
 * Shared top navigation. `active` highlights the current section.
 * Renders the wordmark, section links, and auth-aware actions.
 */
export default function Nav({ active }) {
  const navigate = useNavigate()
  const { isLoggedIn, user, logout } = useAuth()

  return (
    <nav className="relative z-20 flex items-center justify-between gap-4 px-6 md:px-12 py-4 border-b border-white/[0.06] backdrop-blur-sm">
      {/* Wordmark */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2.5 group"
      >
        <RadarMark />
        <span className="font-display text-lg font-bold tracking-tight text-ink-bright">
          SAT<span className="text-accent">sec</span>
        </span>
      </button>

      {/* Center links */}
      <div className="hidden md:flex items-center gap-7">
        {isLoggedIn && (
          <button
            onClick={() => navigate('/live')}
            className={`flex items-center gap-1.5 font-mono text-[13px] transition-colors ${
              active === 'live' ? 'text-accent' : 'text-ink-dim hover:text-ink-bright'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-live animate-pulse-live" />
            Live
          </button>
        )}
        {LINKS.map(({ label, to, soon }) => {
          if (soon) {
            return (
              <span
                key={label}
                title="Coming soon"
                className="group/soon relative flex items-center gap-1.5 font-mono text-[13px] text-ink-faint cursor-default"
              >
                {label}
                <span className="rounded-full border border-white/[0.08] bg-surface/60 px-1.5 py-px text-[9px] uppercase tracking-widest text-ink-dim">
                  soon
                </span>
              </span>
            )
          }
          const isActive = active === label.toLowerCase()
          return (
            <button
              key={label}
              onClick={() => navigate(to)}
              className={`font-mono text-[13px] transition-colors ${
                isActive
                  ? 'text-accent'
                  : 'text-ink-dim hover:text-ink-bright'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        {isLoggedIn ? (
          <>
            <span className="hidden md:block font-mono text-xs text-ink-dim">{user?.username}</span>
            <button onClick={() => navigate('/dashboard')} className="btn-accent">Dashboard</button>
            <button onClick={logout} className="btn-ghost">Sign out</button>
          </>
        ) : (
          <button onClick={() => navigate('/login')} className="btn-accent">Sign in</button>
        )}
      </div>
    </nav>
  )
}
