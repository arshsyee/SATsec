import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { loginApi } from '../api'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const navigate    = useNavigate()
  const { login }   = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password,   setPassword]   = useState('')
  const [error,      setError]      = useState(null)
  const [loading,    setLoading]    = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { token, user } = await loginApi(identifier, password)
      login(token, user)
      navigate('/dashboard')
    } catch (err) {
      if (err.unverified) {
        // Email not yet verified — backend sent a fresh OTP; go to verify page
        navigate('/verify-otp', {
          state: { userId: err.unverified.userId, email: err.unverified.email, redirectTo: '/dashboard' }
        })
        return
      }
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
          <h2 className="text-lg font-medium text-[#f0f4fa] mb-1">Sign in</h2>
          <p className="text-xs text-[#4a6070] font-mono mb-6">use username or email</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-[#7a9ab8] font-mono block mb-1">Username or Email</label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#e8edf5] placeholder-[#3a4f63] outline-none focus:border-blue-500/50 transition-colors font-mono"
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
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link to="/forgot-password" className="text-xs text-[#4a6070] hover:text-blue-400 font-mono transition-colors">
              Forgot password?
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-[#3a5068] font-mono mt-5">
          No account?{' '}
          <Link to="/register" className="text-blue-400 hover:text-blue-300 transition-colors">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  )
}
