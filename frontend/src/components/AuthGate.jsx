import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import AuthModal from './AuthModal'

/**
 * Wraps content that requires a logged-in user.
 * If the user is a guest, the content is hidden and AuthModal is shown.
 */
export default function AuthGate({ children }) {
  const { isLoggedIn, ready } = useAuth()
  const [dismissed, setDismissed] = useState(false)

  if (!ready) return null
  if (isLoggedIn) return children

  if (dismissed) {
    // After dismissal, show a minimal placeholder so the page isn't blank
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#4a6070] font-mono text-sm mb-4">sign in to access this feature</p>
        </div>
        <AuthModal onClose={() => {}} onSuccess={() => setDismissed(false)} />
      </div>
    )
  }

  return (
    <AuthModal onClose={() => setDismissed(true)} onSuccess={() => {}} />
  )
}
