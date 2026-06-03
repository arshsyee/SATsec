import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { loginApi, signup, verifyOtp, resendOtp } from '../api'

/**
 * Full-screen modal for sign-in / sign-up.
 * - Backdrop click or Esc key closes it.
 * - onSuccess() is called after a successful auth.
 * - Signup goes through OTP verification inline.
 */
export default function AuthModal({ onClose, onSuccess, defaultTab = 'login' }) {
  const { login }   = useAuth()
  const [tab, setTab]               = useState(defaultTab)
  const [identifier, setIdentifier] = useState('')
  const [username,   setUsername]   = useState('')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [error,      setError]      = useState(null)
  const [loading,    setLoading]    = useState(false)
  // OTP step: { userId, email }
  const [otpStep,    setOtpStep]    = useState(null)
  const [otpDigits,  setOtpDigits]  = useState(['', '', '', '', '', ''])
  const [resent,     setResent]     = useState(false)
  const [resending,  setResending]  = useState(false)
  const otpRefs = useRef([])
  const cardRef = useRef(null)

  // Close on Esc
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const switchTab = (t) => { setTab(t); setError(null); setOtpStep(null) }

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { token, user } = await loginApi(identifier, password)
      login(token, user)
      onSuccess?.()
      onClose()
    } catch (err) {
      if (err.unverified) {
        // Backend already sent a new OTP — show OTP step inline
        setOtpStep({ userId: err.unverified.userId, email: err.unverified.email })
        setOtpDigits(['', '', '', '', '', ''])
        setError(null)
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Signup ─────────────────────────────────────────────────────────────────
  const handleSignup = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { user_id, email: confirmedEmail } = await signup(username, email, password)
      setOtpStep({ userId: user_id, email: confirmedEmail })
      setOtpDigits(['', '', '', '', '', ''])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── OTP helpers ────────────────────────────────────────────────────────────
  const otpCode = otpDigits.join('')

  const handleOtpDigit = (i, val) => {
    const v = val.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]
    next[i] = v
    setOtpDigits(next)
    if (v && i < 5) otpRefs.current[i + 1]?.focus()
  }

  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otpDigits[i] && i > 0) otpRefs.current[i - 1]?.focus()
  }

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(''))
      otpRefs.current[5]?.focus()
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (otpCode.length < 6) { setError('Enter all 6 digits'); return }
    setError(null)
    setLoading(true)
    try {
      const { token, user } = await verifyOtp(otpStep.userId, otpCode)
      login(token, user)
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    setResending(true)
    setError(null)
    try {
      await resendOtp(otpStep.userId)
      setResent(true)
      setTimeout(() => setResent(false), 4000)
    } catch (err) {
      setError(err.message)
    } finally {
      setResending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(8,12,20,0.75)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={cardRef}
        className="bg-[#0d1520] border border-white/[0.1] rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          {!otpStep ? (
            <div className="flex gap-1 bg-white/[0.04] rounded-xl p-1">
              <button
                onClick={() => switchTab('login')}
                className={`text-xs px-4 py-1.5 rounded-lg font-mono transition-all ${
                  tab === 'login' ? 'bg-accent text-white' : 'text-[#4a6070] hover:text-[#8899aa]'
                }`}
              >
                Sign in
              </button>
              <button
                onClick={() => switchTab('signup')}
                className={`text-xs px-4 py-1.5 rounded-lg font-mono transition-all ${
                  tab === 'signup' ? 'bg-accent text-white' : 'text-[#4a6070] hover:text-[#8899aa]'
                }`}
              >
                Sign up
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent-bright animate-pulse" />
              <span className="text-sm font-medium text-[#e8edf5]">Verify your email</span>
            </div>
          )}
          <button
            onClick={onClose}
            className="text-[#3a5068] hover:text-[#8899aa] text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* OTP Step */}
        {otpStep && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <p className="text-xs text-[#4a6070] font-mono mb-1">code sent to</p>
              <p className="text-sm text-accent-bright font-mono mb-4">{otpStep.email}</p>
              <label className="text-xs text-[#7a9ab8] font-mono block mb-3">6-digit verification code</label>
              <div className="flex gap-2 justify-between" onPaste={handleOtpPaste}>
                {otpDigits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => otpRefs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handleOtpDigit(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    autoFocus={i === 0}
                    className="w-10 h-11 text-center bg-white/[0.04] border border-white/[0.08] rounded-xl text-lg font-mono text-[#e8edf5] outline-none focus:border-accent/50 transition-colors"
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-500/[0.06] border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400 font-mono">
                {error}
              </div>
            )}

            {resent && (
              <div className="bg-green-500/[0.06] border border-green-500/20 rounded-xl px-4 py-3 text-xs text-green-400 font-mono">
                New code sent — check your inbox
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              className="w-full bg-accent hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-3 rounded-xl transition-colors"
            >
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>

            <p className="text-center text-xs font-mono">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resending}
                className="text-[#4a6070] hover:text-accent-bright transition-colors disabled:opacity-50"
              >
                {resending ? 'Sending...' : "Didn't receive it? Resend code"}
              </button>
            </p>
          </form>
        )}

        {/* Sign In Form */}
        {!otpStep && tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-[#7a9ab8] font-mono block mb-1">Username or Email</label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#e8edf5] placeholder-[#3a4f63] outline-none focus:border-accent/50 transition-colors font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-[#7a9ab8] font-mono block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#e8edf5] placeholder-[#3a4f63] outline-none focus:border-accent/50 transition-colors font-mono"
              />
            </div>

            {error && (
              <div className="bg-red-500/[0.06] border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400 font-mono">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-3 rounded-xl transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <p className="text-center text-xs text-[#3a5068] font-mono">
              <button
                type="button"
                onClick={() => switchTab('signup')}
                className="text-accent-bright hover:text-accent-bright transition-colors"
              >
                No account? Sign up free →
              </button>
            </p>
          </form>
        )}

        {/* Sign Up Form */}
        {!otpStep && tab === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="text-xs text-[#7a9ab8] font-mono block mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="yourname"
                required
                minLength={3}
                autoFocus
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#e8edf5] placeholder-[#3a4f63] outline-none focus:border-accent/50 transition-colors font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-[#7a9ab8] font-mono block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#e8edf5] placeholder-[#3a4f63] outline-none focus:border-accent/50 transition-colors font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-[#7a9ab8] font-mono block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="min. 8 characters"
                required
                minLength={8}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#e8edf5] placeholder-[#3a4f63] outline-none focus:border-accent/50 transition-colors font-mono"
              />
            </div>

            {error && (
              <div className="bg-red-500/[0.06] border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400 font-mono">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-3 rounded-xl transition-colors"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>

            <p className="text-center text-xs text-[#3a5068] font-mono">
              <button
                type="button"
                onClick={() => switchTab('login')}
                className="text-accent-bright hover:text-accent-bright transition-colors"
              >
                Already have an account? Sign in →
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
