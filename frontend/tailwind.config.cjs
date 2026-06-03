/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // ── Themeable palette ──────────────────────────────────────
      // Tokens resolve to CSS variables (RGB channels) so the whole theme
      // can be swapped at runtime via [data-theme] on <html>. Defined in
      // index.css. Never hand-type hex in components — use these tokens.
      colors: {
        void:     'rgb(var(--c-void) / <alpha-value>)',     // page base
        surface:  'rgb(var(--c-surface) / <alpha-value>)',  // cards / panels
        elevated: 'rgb(var(--c-elevated) / <alpha-value>)', // raised panels, inputs
        ink: {
          bright: 'rgb(var(--c-ink-bright) / <alpha-value>)',
          DEFAULT:'rgb(var(--c-ink) / <alpha-value>)',
          dim:    'rgb(var(--c-ink-dim) / <alpha-value>)',
          faint:  'rgb(var(--c-ink-faint) / <alpha-value>)',
          ghost:  'rgb(var(--c-ink-ghost) / <alpha-value>)',
        },
        accent: {
          DEFAULT:'rgb(var(--c-accent) / <alpha-value>)',
          bright: 'rgb(var(--c-accent-bright) / <alpha-value>)',
          dim:    'rgb(var(--c-accent-dim) / <alpha-value>)',
        },
        live: 'rgb(var(--c-live) / <alpha-value>)',  // healthy
        warn: 'rgb(var(--c-warn) / <alpha-value>)',  // at-risk
        crit: 'rgb(var(--c-crit) / <alpha-value>)',  // critical
      },
      fontFamily: {
        // Three-tier system: characterful display, neutral sans for reading,
        // mono reserved for data (scores, URLs, labels, code).
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans:    ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'glow-accent': '0 0 0 1px rgb(var(--c-accent) / 0.25)',
        'glow-live':   '0 0 10px -3px rgb(var(--c-live) / 0.5)',
        'panel':       '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -30px rgba(0,0,0,0.9)',
      },
      keyframes: {
        'slide-in': {
          '0%':   { opacity: '0', transform: 'translateX(1rem)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'radar-sweep': {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'scanline': {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '92%':      { opacity: '1' },
          '93%':      { opacity: '0.78' },
          '94%':      { opacity: '1' },
          '97%':      { opacity: '0.85' },
          '98%':      { opacity: '1' },
        },
        'pulse-live': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(44,232,160,0.55)' },
          '50%':      { opacity: '0.6', boxShadow: '0 0 0 5px rgba(44,232,160,0)' },
        },
        'blink': {
          '0%, 49%':   { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        'rise': {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'grow-bar': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
      },
      animation: {
        'in':         'slide-in 0.2s ease-out',
        'radar':      'radar-sweep 4s linear infinite',
        'scanline':   'scanline 7s linear infinite',
        'flicker':    'flicker 6s linear infinite',
        'pulse-live': 'pulse-live 2s ease-in-out infinite',
        'blink':      'blink 1.1s step-end infinite',
        'rise':       'rise 0.6s cubic-bezier(0.16,1,0.3,1) both',
        'grow-bar':   'grow-bar 1s cubic-bezier(0.16,1,0.3,1) both',
      },
    },
  },
  plugins: [],
}
