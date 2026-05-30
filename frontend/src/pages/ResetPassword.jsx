import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { resetPassword } from '../api'

export default function ResetPassword() {
  const navigate        = useNavigate()
  const [searchParams]  = useSearchParams()
  const token           = searchParams.get('token') || ''

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [done,      setDone]      = useState(false)
  const [error,     setError]     = useState(null)
  const [loading,   setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await resetPassword(token, password)
      setDone(true)
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
          backgroundImage: 'linear-gradient(rgba(99,179,237,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,179,237,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="font-mono text-xl font-bold text-center mb-10 cursor-pointer" onClick={() => navigate('/')}>
          SAT<span className="text-blue-500">sec</span>
        </div>

        <div className="bg-white/[0.025] border border-white/[0.07] rounded-2xl p-8">
          {!token ? (
            <div className="text-center">
              <p className="text-sm text-red-400 font-mono mb-4">invalid reset link</p>
              <Link to="/forgot-password" className="text-xs text-blue-400 hover:text-blue-300 font-mono">
                Request a new one →
              </Link>
            </div>
          ) : done ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-green-400 text-xl">✓</span>
              </div>
              <h2 className="text-lg font-medium text-[#f0f4fa] mb-2">Password updated</h2>
              <p className="text-xs text-[#4a6070] font-mono mb-6">You can now sign in with your new password.</p>
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-3 rounded-xl transition-colors"
              >
                Sign in
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-medium text-[#f0f4fa] mb-1">New password</h2>
              <p className="text-xs text-[#4a6070] font-mono mb-6">min. 8 characters</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-[#7a9ab8] font-mono block mb-1">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#e8edf5] placeholder-[#3a4f63] outline-none focus:border-blue-500/50 transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#7a9ab8] font-mono block mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#e8edf5] placeholder-[#3a4f63] outline-none focus:border-blue-500/50 transition-colors font-mono"
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
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-3 rounded-xl transition-colors"
                >
                  {loading ? 'Updating...' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
