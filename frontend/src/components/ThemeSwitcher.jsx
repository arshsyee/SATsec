import { useEffect, useRef, useState } from 'react'
import { THEMES, getTheme, applyTheme } from '../theme'

/**
 * Floating theme switcher (bottom-right, all pages). Swaps the app palette
 * at runtime via [data-theme] and persists the choice.
 */
export default function ThemeSwitcher() {
  const [open, setOpen]   = useState(false)
  const [theme, setTheme] = useState(getTheme)
  const ref = useRef(null)

  // Ensure the stored theme is applied on mount.
  useEffect(() => { applyTheme(theme) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey  = e => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  const pick = (id) => { applyTheme(id); setTheme(id); setOpen(false) }

  return (
    <div ref={ref} className="fixed bottom-5 right-5 z-[90]">
      {open && (
        <div className="mb-2 w-44 rounded-xl border border-white/10 bg-surface/95 p-1.5 shadow-panel backdrop-blur-sm">
          <p className="px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">Theme</p>
          {THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => pick(t.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 font-sans text-[13px] transition-colors ${
                theme === t.id ? 'bg-white/[0.06] text-ink-bright' : 'text-ink-dim hover:bg-white/[0.04] hover:text-ink-bright'
              }`}
            >
              <span className="h-3.5 w-3.5 rounded-full ring-1 ring-white/20" style={{ background: t.swatch }} />
              {t.label}
              {theme === t.id && <span className="ml-auto text-ink-faint">✓</span>}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Change theme"
        title="Change theme"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.12] bg-surface/90 text-ink-dim shadow-panel backdrop-blur-sm transition-colors hover:border-white/25 hover:text-ink-bright"
      >
        {/* contrast / theme glyph */}
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
          <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" />
        </svg>
      </button>
    </div>
  )
}
