// Runtime theme switching. Each theme is a [data-theme] palette in index.css.
export const THEMES = [
  { id: 'charcoal', label: 'Charcoal', swatch: '#d6d9df' },
  { id: 'violet',   label: 'Violet',   swatch: '#7c5cff' },
  { id: 'blue',     label: 'Blue',     swatch: '#3b82f6' },
]

const KEY = 'satsec_theme'
const DEFAULT = 'charcoal'

export function getTheme() {
  const t = localStorage.getItem(KEY)
  return THEMES.some(x => x.id === t) ? t : DEFAULT
}

export function applyTheme(id) {
  document.documentElement.setAttribute('data-theme', id)
  localStorage.setItem(KEY, id)
}
