import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { verifyOtp, resendOtp } from '../api'
import { useAuth } from '../contexts/AuthContext'

export default function VerifyOtp() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { login } = useAuth()

  const { userId, email, redirectTo } = location.state || {}

  const [digits,   setDigits]   = useState(['', '', '', '', '', ''])
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [resent,   setResent]   = useState(false)
  const [resending, setResending] = useState(false)
  const inputs = useRef([])

  if (!userId || !email) {
    navigate('/register')
    return null
  }

  const code = digits.join('')

  const handleDigit = (i, val) => {
    const v = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = v
    setDigits(next)
    if (v && i < 5) inputs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setDigits(pasted.split(''))
      inputs.current[5]?.focus()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (code.length < 6) { setError('Enter all 6 digits'); return }
    setError(null)
    setLoading(true)
    try {
      const { token, user } = await verifyOtp(userId, code)
      login(token, user)
      navigate(redirectTo || '/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setError(null)
    try {
      await resendOtp(userId)
      setResent(true)
      setTimeout(() => setResent(false), 4000)
    } catch (err) {
      setError(err.message)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-[#e8edf5] font-sans flex flex-col items-center justify-center px-6">
      <div className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(99,179,237,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,179,237,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="font-mono text-xl font-bold text-center mb-10 cursor-pointer" onClick={() => navigate('/')}>
          SAT<span className="text-blue-500">sec</span>
        </div>

        <div className="bg-white/[0.025] border border-white/[0.07] rounded-2xl p-8">
          <h2 className="text-lg font-medium text-[#f0f4fa] mb-1">Verify your email</h2>
          <p className="text-xs text-[#4a6070] font-mono mb-1">code sent to</p>
          <p className="text-sm text-blue-400 font-mono mb-6">{email}</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-xs text-[#7a9ab8] font-mono block mb-3">6-digit verification code</label>
              <div className="flex gap-2 justify-between" onPaste={handlePaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => inputs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handleDigit(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    autoFocus={i === 0}
                    className="w-11 h-12 text-center bg-white/[0.04] border border-white/[0.08] rounded-xl text-lg font-mono text-[#e8edf5] outline-none focus:border-blue-500/50 transition-colors"
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
              disabled={loading || code.length < 6}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-3 rounded-xl transition-colors"
            >
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
          </form>
        </div>

        <div className="text-center mt-4 space-y-2">
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-xs text-[#4a6070] hover:text-blue-400 font-mono transition-colors disabled:opacity-50"
          >
            {resending ? 'Sending...' : "Didn't receive it? Resend code"}
          </button>
        </div>
      </div>
    </div>
  )
}
