/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // ── Night-Vision Terminal palette ──────────────────────────
      // Single source of truth. Never hand-type hex in components.
      colors: {
        void:     '#05080d',   // page base
        surface:  '#0a0f17',   // cards / panels
        elevated: '#0e141e',   // raised panels, inputs
        ink: {
          bright: '#e9f1f8',   // headings
          DEFAULT:'#aebccb',   // body
          dim:    '#6f8497',   // muted / labels
          faint:  '#3f5163',   // captions, footers
          ghost:  '#22303f',   // hairline text, watermarks
        },
        accent: {              // signal blue — brand / interactive
          DEFAULT:'#3b82f6',
          bright: '#60a5fa',
          dim:    '#2563eb',
        },
        live: '#2ce8a0',       // phosphor green — "watching" / healthy
        warn: '#ffce4a',       // at-risk
        crit: '#ff5470',       // critical
      },
      fontFamily: {
        // Mono-forward terminal system. Display = characterful; mono = legible data.
        display: ['"Space Mono"', 'ui-monospace', 'monospace'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'glow-accent': '0 0 0 1px rgba(59,130,246,0.30), 0 0 24px -4px rgba(59,130,246,0.45)',
        'glow-live':   '0 0 16px -2px rgba(44,232,160,0.55)',
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
