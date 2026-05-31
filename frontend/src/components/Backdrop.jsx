/**
 * Backdrop — the shared Night-Vision Terminal atmosphere.
 *
 * Layers (back to front), all fixed and pointer-events-none:
 *   1. surveillance grid (+ cursor-reactive overlay)
 *   2. amber/edge vignette
 *   3. film grain
 *   4. a single scanline sweeping top→bottom
 *
 * Drop once near the root of every page; content sits above via z-index.
 */
import InteractiveGrid from './InteractiveGrid'

export default function Backdrop() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 bg-grid" />
      <InteractiveGrid />
      <div className="absolute inset-0 bg-vignette" />
      <div className="absolute inset-0 bg-grain opacity-[0.035]" />
      {/* travelling scanline */}
      <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent animate-scanline" />
    </div>
  )
}
