import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Backdrop from '../components/Backdrop'
import SiteChip from '../components/SiteChip'

const scoreStyle = (score) => {
  if (score >= 80) return { color: 'text-live', ring: 'border-live/30 bg-live/10', tag: 'Healthy',  tagColor: 'bg-live/10 text-live' }
  if (score >= 60) return { color: 'text-warn', ring: 'border-warn/30 bg-warn/10', tag: 'At Risk',  tagColor: 'bg-warn/10 text-warn' }
  return             { color: 'text-crit',   ring: 'border-crit/30 bg-crit/10',     tag: 'Critical', tagColor: 'bg-crit/10 text-crit' }
}

const issueDot = (text) => {
  const t = text.toLowerCase()
  if (t.includes('critical') || t.includes('expired') || t.includes('xss') || t.includes('clickjacking')) return 'bg-crit'
  return 'bg-warn'
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
  const { result, url, duration } = location.state || {}

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
    <div className="relative min-h-screen bg-void text-ink font-sans overflow-x-hidden">

      <Backdrop />

      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between gap-4 px-6 md:px-12 py-4 border-b border-white/[0.06] backdrop-blur-sm">
        <button onClick={() => navigate('/')} className="font-display text-lg font-bold tracking-tight text-ink-bright">SAT<span className="text-accent">sec</span></button>
        <SiteChip url={displayUrl} />
        <div className="flex gap-3">
          <button onClick={() => navigate('/')} className="btn-ghost">
            ← New Audit
          </button>
          <button onClick={() => navigate('/dashboard', { state: { url: displayUrl } })} className="btn-ghost">
            Dashboard
          </button>
          <button onClick={goToSchedule} className="btn-accent">
            Schedule Monitoring
          </button>
        </div>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <h2 className="font-display text-xl font-bold text-ink-bright mb-1 break-all">Audit Results — {displayUrl}</h2>
          <p className="text-sm text-ink-dim font-mono">
            overall score: <span className="text-ink-bright font-medium">{scores.overall}</span>
            {' · '}<span className="text-ink-bright font-medium">{issueEntries.reduce((n, [, v]) => n + v.length, 0)}</span> issues found
            {typeof duration === 'number' && <> · scanned in <span className="text-ink-bright font-medium">{duration.toFixed(1)}s</span></>}
          </p>
        </div>

        {/* Score Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {scoreDefs.map(({ key, label }) => {
            const score = scores[key]
            const { color, ring, tag, tagColor } = scoreStyle(score)
            return (
              <div key={key} className="panel p-5 text-center hover:-translate-y-1 transition-transform">
                <div className={`w-16 h-16 rounded-full border-2 ${ring} flex items-center justify-center mx-auto mb-3`}>
                  <span className={`font-mono text-2xl font-bold tabular-nums ${color}`}>{score}</span>
                </div>
                <div className="text-sm font-medium text-ink mb-2">{label}</div>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${tagColor}`}>{tag}</span>
              </div>
            )
          })}
        </div>

    

        {/* Issues — grouped by category */}
        {issueEntries.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {issueEntries.map(([category, items]) => (
              <div key={category} className="panel p-6">
                <p className="eyebrow mb-4">
                  {CATEGORY_LABELS[category] || category}
                </p>
                {items.map((text, i) => (
                  <div key={i} className="flex gap-3 py-3 border-b border-white/[0.04] last:border-0">
                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${issueDot(text)}`} />
                    <p className="text-sm text-ink leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="rounded-2xl border border-accent/20 bg-accent/[0.06] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-medium text-ink-bright mb-1">Monitor this site automatically</h3>
            <p className="text-sm text-ink-faint">Set up scheduled monitoring and get alerted the moment a score drops.</p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button onClick={() => navigate('/dashboard', { state: { url: displayUrl } })} className="btn-ghost">View Trends</button>
            <button onClick={goToSchedule} className="btn-accent">Schedule → Every 6hrs</button>
          </div>
        </div>

        <p className="text-center text-xs text-ink-ghost font-mono mt-8">SATsec audit engine v1.0</p>
      </div>
    </div>
  )
}
