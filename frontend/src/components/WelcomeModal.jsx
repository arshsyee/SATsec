import { useState } from 'react'

const STEPS = [
  {
    icon: '⚡',
    title: 'Run an audit',
    body: 'Paste any URL to get Performance, SEO, Accessibility, and Security scores in seconds — 61 checks across 4 dimensions.',
  },
  {
    icon: '🕐',
    title: 'Schedule monitoring',
    body: 'Let SATsec re-audit your sites every 6 hours, daily, or weekly — automatically, without anyone touching it.',
  },
  {
    icon: '🔔',
    title: 'Set alerts',
    body: 'Get emailed the moment a score drops below your threshold, with a plain-English explanation of what changed.',
  },
  {
    icon: '📈',
    title: 'Track trends',
    body: 'Every result is stored with a timestamp. The dashboard shows score history so you can pinpoint when a deploy broke your site.',
  },
]

/**
 * First-run onboarding tutorial. Shown once per browser (gated by a localStorage
 * flag set on completion/skip). `onClose` is called when the user finishes or skips.
 */
export default function WelcomeModal({ username, onClose }) {
  const [step, setStep] = useState(0)
  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-md bg-[#0d1520] border border-white/10 rounded-2xl p-8 shadow-2xl">

        {/* Skip */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#3a5068] hover:text-[#8899aa] text-sm transition-colors"
        >
          Skip
        </button>

        {/* Header */}
        <p className="text-xs font-mono text-blue-400 uppercase tracking-widest mb-2">
          Welcome{username ? `, ${username}` : ''}
        </p>
        <h2 className="text-xl font-medium text-[#f0f4fa] mb-6">
          Here's how SATsec works
        </h2>

        {/* Step */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-6 mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-2xl mb-4">
            {current.icon}
          </div>
          <h3 className="text-base font-medium text-[#c8d8e8] mb-2">{current.title}</h3>
          <p className="text-sm text-[#5a7080] leading-relaxed">{current.body}</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-blue-500' : 'w-1.5 bg-white/15'
              }`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="text-sm text-[#8899aa] hover:text-[#e8edf5] disabled:opacity-0 disabled:cursor-default transition-all px-2"
          >
            ← Back
          </button>
          <button
            onClick={() => (isLast ? onClose() : setStep(s => s + 1))}
            className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            {isLast ? 'Get started →' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
