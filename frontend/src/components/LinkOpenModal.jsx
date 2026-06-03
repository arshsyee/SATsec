import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { screenshotUrl } from '../api'

const withProto = u => (/^https?:\/\//.test(u) ? u : `https://${u}`)
const strip     = u => (u || '').replace(/^https?:\/\//, '')

/**
 * Confirmation + viewer for opening an audited site's link.
 * Two paths: open in a new tab (always works) or an in-app sandboxed iframe
 * preview that degrades to a "blocked — open in tab" fallback when the site
 * refuses framing (X-Frame-Options / CSP).
 */
export default function LinkOpenModal({ url, onClose }) {
  const target = withProto(url)
  const [mode, setMode] = useState('newtab')   // 'newtab' | 'preview'
  const [view, setView] = useState('choose')   // 'choose' | 'opening' | 'preview'
  const [shotLoaded, setShotLoaded] = useState(false)
  const [shotError,  setShotError]  = useState(false)

  const openNewTab = () => window.open(target, '_blank', 'noopener,noreferrer')

  const handleOpen = () => {
    if (mode === 'newtab') {
      setView('opening')
      setTimeout(() => { openNewTab(); onClose() }, 700)
    } else {
      setView('preview')
    }
  }

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-6 bg-void/80 backdrop-blur-sm animate-in"
      onClick={onClose}
    >
      {view === 'preview' ? (
        <div
          className="flex h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-surface shadow-panel"
          onClick={e => e.stopPropagation()}
        >
          {/* viewer header */}
          <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
            <span className="flex min-w-0 items-center gap-2 font-mono text-xs text-ink-dim">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-live animate-pulse-live" />
              <span className="truncate">{strip(target)}</span>
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={openNewTab} className="btn-ghost !px-3 !py-1.5 text-xs">Open in new tab ↗</button>
              <button onClick={onClose} className="btn-icon !h-8 !w-8" aria-label="Close preview">✕</button>
            </div>
          </div>

          {/* server-rendered screenshot — works on every site */}
          <div className="relative flex-1 overflow-auto bg-elevated">
            {!shotError && (
              <img
                src={screenshotUrl(target)}
                alt={`Screenshot of ${strip(target)}`}
                className={`w-full transition-opacity duration-300 ${shotLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setShotLoaded(true)}
                onError={() => setShotError(true)}
              />
            )}
            {!shotLoaded && !shotError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface">
                <span className="h-7 w-7 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
                <span className="font-mono text-xs tracking-widest text-accent">CAPTURING PAGE…</span>
              </div>
            )}
            {shotError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
                <p className="font-mono text-sm leading-relaxed text-ink-dim">
                  Couldn't capture this page.<br />The site may be slow or unreachable.
                </p>
                <button onClick={() => { openNewTab(); onClose() }} className="btn-accent">Open in new tab ↗</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-surface shadow-panel p-6"
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <h2 className="mb-1 font-display text-base font-bold text-ink-bright">Open {strip(target)}?</h2>
          <p className="mb-5 font-mono text-[13px] text-ink-dim">choose how to open this site</p>

          {view === 'opening' ? (
            <div className="flex items-center justify-center gap-3 py-6">
              <span className="h-5 w-5 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
              <span className="font-mono text-sm text-accent">opening…</span>
            </div>
          ) : (
            <>
              <div className="mb-6 space-y-2">
                {[
                  { id: 'newtab',  label: 'Open in new tab', desc: 'Launches the live site in a separate tab' },
                  { id: 'preview', label: 'Quick preview',   desc: 'Server-rendered snapshot, viewed in SATsec' },
                ].map(o => (
                  <button
                    key={o.id}
                    onClick={() => setMode(o.id)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                      mode === o.id ? 'border-accent/50 bg-accent/[0.08]' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/15'
                    }`}
                  >
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${mode === o.id ? 'border-accent' : 'border-white/20'}`}>
                      {mode === o.id && <span className="h-2 w-2 rounded-full bg-accent" />}
                    </span>
                    <span className="min-w-0">
                      <span className={`block font-mono text-sm ${mode === o.id ? 'text-ink-bright' : 'text-ink'}`}>{o.label}</span>
                      <span className="block font-mono text-[11px] text-ink-faint">{o.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-end gap-3">
                <button onClick={onClose} className="btn-ghost">Cancel</button>
                <button onClick={handleOpen} className="btn-accent">Open →</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>,
    document.body
  )
}
