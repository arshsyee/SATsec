import { useNavigate } from 'react-router-dom'

// Shared layout for static legal documents (/privacy, /terms).
// `sections` is an array of { heading, body } where body is a string or JSX.
export default function LegalPage({ title, lastUpdated, sections }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#080c14] text-[#e8edf5] font-sans px-6 py-16">

      {/* Grid bg */}
      <div className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />

      <div className="relative z-10 max-w-2xl mx-auto">

        {/* Logo */}
        <div className="font-mono text-lg font-bold mb-12 cursor-pointer inline-block" onClick={() => navigate('/')}>
          SAT<span className="text-accent">sec</span>
        </div>

        <h1 className="text-2xl font-medium text-[#f0f4fa] mb-2">{title}</h1>
        <p className="text-xs text-[#4a6070] font-mono mb-10">Last updated: {lastUpdated}</p>

        <div className="space-y-8">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-sm font-semibold text-[#f0f4fa] mb-2">{s.heading}</h2>
              <div className="text-sm text-[#8899aa] leading-relaxed">{s.body}</div>
            </section>
          ))}
        </div>

        <button
          onClick={() => navigate('/')}
          className="mt-14 border border-white/10 hover:border-white/25 text-[#8899aa] hover:text-[#e8edf5] text-sm px-5 py-2.5 rounded-lg transition-all"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  )
}
