import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { forgotPassword } from '../api'

export default function ForgotPassword() {
  const navigate    = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [sent,       setSent]       = useState(false)
  const [error,      setError]      = useState(null)
  const [loading,    setLoading]    = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await forgotPassword(identifier)
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-[#e8edf5] font-sans flex flex-col items-center justify-center px-6">
      <div className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="font-mono text-xl font-bold text-center mb-10 cursor-pointer" onClick={() => navigate('/')}>
          SAT<span className="text-accent">sec</span>
        </div>

        <div className="bg-white/[0.025] border border-white/[0.07] rounded-2xl p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-green-400 text-xl">✓</span>
              </div>
              <h2 className="text-lg font-medium text-[#f0f4fa] mb-2">Check your email</h2>
              <p className="text-xs text-[#4a6070] font-mono leading-relaxed">
                If that account exists, a reset link has been sent. Check your inbox (and spam folder).
              </p>
              <Link to="/login" className="block mt-6 text-xs text-accent-bright hover:text-accent-bright font-mono transition-colors">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-medium text-[#f0f4fa] mb-1">Reset password</h2>
              <p className="text-xs text-[#4a6070] font-mono mb-6">enter your username or email</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-[#7a9ab8] font-mono block mb-1">Username or Email</label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="you@example.com"
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
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <Link to="/login" className="text-xs text-[#4a6070] hover:text-accent-bright font-mono transition-colors">
                  ← Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
