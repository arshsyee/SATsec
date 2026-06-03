import { useState } from 'react'
import LinkOpenModal from './LinkOpenModal'

/**
 * The "currently selected site" status chip shown in the Dashboard / Settings /
 * Results nav. Reads as a live monitoring target: pulsing radar dot + globe +
 * domain. When a site is set it's clickable — opens a confirm/preview modal.
 * Falls back to a dim, inert state when no site is selected.
 */
export default function SiteChip({ url }) {
  const active = Boolean(url)
  const label  = url || 'no site selected'
  const [open, setOpen] = useState(false)

  const inner = (
    <>
      {/* Status dot — radar ping when a site is live, faint when idle */}
      {active ? (
        <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
          <span className="absolute inline-flex h-full w-full rounded-full bg-live/50 animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live shadow-glow-live" />
        </span>
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-ghost" />
      )}

      {/* Globe glyph */}
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
      </svg>

      <span className={`truncate font-mono text-[13px] tracking-tight ${active ? 'text-ink-bright' : 'text-ink-faint'}`}>
        {label}
      </span>
    </>
  )

  if (!active) {
    return (
      <div className="hidden sm:flex items-center gap-2.5 rounded-full border border-white/[0.05] bg-white/[0.02] pl-2.5 pr-3.5 py-1.5 max-w-[280px] backdrop-blur-sm">
        {inner}
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`Open ${url}`}
        className="hidden sm:flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-surface/60 pl-2.5 pr-3.5 py-1.5 max-w-[280px]
          backdrop-blur-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-all
          hover:border-accent/40 hover:bg-surface/80 hover:-translate-y-px
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
      >
        {inner}
      </button>
      {open && <LinkOpenModal url={url} onClose={() => setOpen(false)} />}
    </>
  )
}
