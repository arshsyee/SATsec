import { useEffect, useRef } from 'react'

/**
 * InteractiveGrid — cursor-reactive overlay for the surveillance grid.
 *
 * The static lines live in <Backdrop> (.bg-grid). This canvas sits on top and
 * only renders the handful of grid nodes within RADIUS of the cursor: each node
 * is pulled toward the pointer (magnet warp) and glows accent-blue by proximity.
 * Idle = nothing drawn, so cost stays near zero until the mouse moves.
 */
const GAP = 48        // must match .bg-grid background-size
const RADIUS = 140    // px of influence around cursor
const PULL = 14       // max node displacement toward cursor

export default function InteractiveGrid() {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf = 0
    let dpr = 1
    const mouse = { x: -9999, y: -9999, active: false }
    let settleFrames = 0   // keep drawing briefly after mouse stops/leaves

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const onMove = (e) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.active = true
      settleFrames = 30
      if (!raf) raf = requestAnimationFrame(draw)
    }
    const onLeave = () => { mouse.active = false }

    function nodeAt(ox, oy) {
      const dx = ox - mouse.x
      const dy = oy - mouse.y
      const d = Math.hypot(dx, dy) || 0.0001
      if (d >= RADIUS) return null
      const f = 1 - d / RADIUS          // 0..1, strongest at cursor
      const ease = f * f                // sharper falloff
      const push = PULL * ease
      return {
        x: ox - (dx / d) * push,        // pull toward cursor
        y: oy - (dy / d) * push,
        glow: ease,
      }
    }

    function draw() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

      const active = mouse.active || settleFrames > 0
      if (active) {
        const W = window.innerWidth
        const H = window.innerHeight
        const i0 = Math.max(0, Math.floor((mouse.x - RADIUS) / GAP))
        const i1 = Math.min(Math.ceil(W / GAP), Math.ceil((mouse.x + RADIUS) / GAP))
        const j0 = Math.max(0, Math.floor((mouse.y - RADIUS) / GAP))
        const j1 = Math.min(Math.ceil(H / GAP), Math.ceil((mouse.y + RADIUS) / GAP))

        // connecting segments (right + down neighbour) — warped grid lines
        for (let i = i0; i <= i1; i++) {
          for (let j = j0; j <= j1; j++) {
            const a = nodeAt(i * GAP, j * GAP)
            if (!a) continue
            const right = nodeAt((i + 1) * GAP, j * GAP)
            const down = nodeAt(i * GAP, (j + 1) * GAP)
            ctx.lineWidth = 1
            if (right) {
              ctx.strokeStyle = `rgba(59,130,246,${Math.min(a.glow, right.glow) * 0.35})`
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(right.x, right.y); ctx.stroke()
            }
            if (down) {
              ctx.strokeStyle = `rgba(59,130,246,${Math.min(a.glow, down.glow) * 0.35})`
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(down.x, down.y); ctx.stroke()
            }
          }
        }

        // glowing nodes
        for (let i = i0; i <= i1; i++) {
          for (let j = j0; j <= j1; j++) {
            const n = nodeAt(i * GAP, j * GAP)
            if (!n || n.glow < 0.04) continue
            ctx.beginPath()
            ctx.arc(n.x, n.y, 1 + n.glow * 2.2, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(96,165,250,${0.15 + n.glow * 0.7})`
            ctx.shadowBlur = n.glow * 10
            ctx.shadowColor = 'rgba(59,130,246,0.8)'
            ctx.fill()
          }
        }
        ctx.shadowBlur = 0
      }

      if (!mouse.active && settleFrames > 0) settleFrames--
      if (mouse.active || settleFrames > 0) {
        raf = requestAnimationFrame(draw)
      } else {
        raf = 0
      }
    }

    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseout', onLeave)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseout', onLeave)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0" aria-hidden="true" />
}
