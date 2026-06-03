import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * Global sign-out confirmation. Rendered once near the app root so every
 * "Sign out" button shares the same centered modal + delayed transition.
 * Triggered via requestSignOut() from AuthContext.
 */
export default function SignOutModal() {
  const navigate = useNavigate()
  const { signOutOpen, cancelSignOut, logout } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  if (!signOutOpen) return null

  const close = () => {
    if (signingOut) return
    cancelSignOut()
  }

  const confirm = () => {
    setSigningOut(true)
    // Brief delay so the action reads as deliberate rather than instantaneous.
    setTimeout(() => {
      setSigningOut(false)
      cancelSignOut()
      logout()
      navigate('/')
    }, 900)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-6 bg-void/80 backdrop-blur-sm animate-in"
      onClick={close}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-surface shadow-panel p-6"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signout-title"
      >
        <h2 id="signout-title" className="font-display text-base font-bold text-ink-bright mb-1.5">
          Sign out?
        </h2>
        <p className="font-mono text-[13px] leading-relaxed text-ink-dim mb-6">
          You'll need to sign back in to access your dashboard and monitors.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button onClick={close} disabled={signingOut} className="btn-ghost disabled:opacity-40">
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={signingOut}
            className="flex items-center gap-2 rounded-lg bg-crit px-4 py-2 font-mono text-[13px] font-medium text-void transition-opacity hover:opacity-90 disabled:cursor-wait"
          >
            {signingOut && (
              <span className="h-3.5 w-3.5 rounded-full border-2 border-void/30 border-t-void animate-spin" />
            )}
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
