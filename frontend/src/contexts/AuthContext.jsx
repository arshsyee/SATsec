import { createContext, useContext, useState, useEffect } from 'react'
import { getOrCreateSessionId } from '../utils/session'
import { getGuestAudits } from '../utils/guestStorage'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,              setUser]              = useState(null)
  const [token,             setToken]             = useState(() => localStorage.getItem('vigil_token'))
  const [ready,             setReady]             = useState(false)
  const [showImportModal,   setShowImportModal]   = useState(false)
  const [pendingImportAudits, setPendingImportAudits] = useState([])
  const [signOutOpen,       setSignOutOpen]       = useState(false)

  // Ensure session ID exists immediately on mount
  getOrCreateSessionId()

  // Validate stored token on mount
  useEffect(() => {
    if (!token) {
      setReady(true)
      return
    }
    fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setUser(data)
        } else {
          localStorage.removeItem('vigil_token')
          setToken(null)
        }
      })
      .catch(() => {
        localStorage.removeItem('vigil_token')
        setToken(null)
      })
      .finally(() => setReady(true))
  }, [])

  function login(tokenValue, userData) {
    localStorage.setItem('vigil_token', tokenValue)
    setToken(tokenValue)
    setUser(userData)

    // Check for guest audits to import
    const guestAudits = getGuestAudits()
    if (guestAudits.length > 0) {
      setPendingImportAudits(guestAudits)
      setShowImportModal(true)
    }
  }

  function logout() {
    localStorage.removeItem('vigil_token')
    setToken(null)
    setUser(null)
  }

  // Opens the global sign-out confirmation modal (rendered once in App).
  function requestSignOut() {
    setSignOutOpen(true)
  }

  function cancelSignOut() {
    setSignOutOpen(false)
  }

  function dismissImportModal() {
    setShowImportModal(false)
    setPendingImportAudits([])
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      sessionId: getOrCreateSessionId(),
      login,
      logout,
      signOutOpen,
      requestSignOut,
      cancelSignOut,
      isLoggedIn: !!user,
      ready,
      showImportModal,
      pendingImportAudits,
      dismissImportModal,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
