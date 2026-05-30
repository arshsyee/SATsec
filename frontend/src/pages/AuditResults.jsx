import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const scoreStyle = (score) => {
  if (score >= 80) return { color: 'text-green-400', ring: 'border-green-500/30 bg-green-500/10', tag: 'Healthy',  tagColor: 'bg-green-500/10 text-green-400' }
  if (score >= 60) return { color: 'text-amber-400', ring: 'border-amber-500/30 bg-amber-500/10', tag: 'At Risk',  tagColor: 'bg-amber-500/10 text-amber-400' }
  return             { color: 'text-red-400',   ring: 'border-red-500/30 bg-red-500/10',     tag: 'Critical', tagColor: 'bg-red-500/10 text-red-400' }
}

const issueDot = (text) => {
  const t = text.toLowerCase()
  if (t.includes('critical') || t.includes('expired') || t.includes('xss') || t.includes('clickjacking')) return 'bg-red-500'
  return 'bg-amber-400'
}

const CATEGORY_LABELS = {
  performance:   'Performance Issues',
  seo:           'SEO Issues',
  accessibility: 'Accessibility Issues',
  security:      'Security Issues',
}

export default function AuditResults() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn } = useAuth()
  const { result, url } = location.state || {}

  // Guard — if landed here directly with no data, send back home
  if (!result) {
    navigate('/')
    return null
  }

  const { scores, issues, ai_summary } = result
  const displayUrl = url || result.url

  const goToSchedule = () => {
    navigate('/settings', { state: { url: displayUrl } })
  }

  const scoreDefs = [
    { key: 'performance',   label: 'Performance' },
    { key: 'seo',           label: 'SEO' },
    { key: 'accessibility', label: 'Accessibility' },
    { key: 'security',      label: 'Security' },
  ]

  // issues is a grouped dict: { performance: [...], seo: [...], ... }
  const issueEntries = Object.entries(issues || {}).filter(([, items]) => items.length > 0)

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
        <div className="font-mono text-lg font-bold cursor-pointer" onClick={() => navigate('/')}>SAT<span className="text-blue-500">sec</span></div>
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2 font-mono text-xs text-[#7a9ab8]">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          {displayUrl}
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate('/')} className="border border-white/10 hover:border-white/25 text-[#8899aa] hover:text-[#e8edf5] text-sm px-4 py-2 rounded-lg transition-all">
            ← New Audit
          </button>
          <button onClick={() => navigate('/dashboard', { state: { url: displayUrl } })} className="border border-white/10 hover:border-white/25 text-[#8899aa] hover:text-[#e8edf5] text-sm px-4 py-2 rounded-lg transition-all">
            Dashboard
          </button>
          <button onClick={goToSchedule} className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Schedule Monitoring
          </button>
        </div>
      </nav>

<div className="relative z-10 max-w-4xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <h2 className="text-xl font-medium text-[#f0f4fa] mb-1">Audit Results — {displayUrl}</h2>
          <p className="text-sm text-[#4a6070] font-mono">overall score: {scores.overall} · {issueEntries.reduce((n, [, v]) => n + v.length, 0)} issues found</p>
        </div>

        {/* Score Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {scoreDefs.map(({ key, label }) => {
            const score = scores[key]
            const { color, ring, tag, tagColor } = scoreStyle(score)
            return (
              <div key={key} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 text-center hover:-translate-y-1 transition-transform">
                <div className={`w-16 h-16 rounded-full border-2 ${ring} flex items-center justify-center mx-auto mb-3`}>
                  <span className={`font-mono text-2xl font-bold ${color}`}>{score}</span>
                </div>
                <div className="text-sm font-medium text-[#c8d8e8] mb-2">{label}</div>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${tagColor}`}>{tag}</span>
              </div>
            )
          })}
        </div>

    

        {/* Issues — grouped by category */}
        {issueEntries.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {issueEntries.map(([category, items]) => (
              <div key={category} className="bg-white/[0.025] border border-white/[0.06] rounded-2xl p-6">
                <p className="text-xs font-mono text-[#8899aa] uppercase tracking-widest mb-4">
                  {CATEGORY_LABELS[category] || category}
                </p>
                {items.map((text, i) => (
                  <div key={i} className="flex gap-3 py-3 border-b border-white/[0.04] last:border-0">
                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${issueDot(text)}`} />
                    <p className="text-sm text-[#c8d8e8] leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="bg-blue-500/[0.06] border border-blue-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-medium text-[#e8edf5] mb-1">Keep watching this site automatically</h3>
            <p className="text-sm text-[#4a6070]">Set up scheduled monitoring and get alerted the moment a score drops.</p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button onClick={() => navigate('/dashboard', { state: { url: displayUrl } })} className="border border-white/10 hover:border-white/25 text-[#8899aa] text-sm px-4 py-2 rounded-lg transition-all">View Trends</button>
            <button onClick={goToSchedule} className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">Schedule → Every 6hrs</button>
          </div>
        </div>

        <p className="text-center text-xs text-[#2e4050] font-mono mt-8">SATsec audit engine v1.0</p>
      </div>
    </div>
  )
}
