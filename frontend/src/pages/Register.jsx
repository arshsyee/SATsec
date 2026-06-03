import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signup } from '../api'

export default function Register() {
  const navigate  = useNavigate()
  const [username,  setUsername]  = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [error,     setError]     = useState(null)
  const [loading,   setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { user_id, email: confirmedEmail } = await signup(username, email, password)
      navigate('/verify-otp', { state: { userId: user_id, email: confirmedEmail } })
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
          <h2 className="text-lg font-medium text-[#f0f4fa] mb-1">Create account</h2>
          <p className="text-xs text-[#4a6070] font-mono mb-6">free — no credit card required</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-[#7a9ab8] font-mono block mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="yourname"
                required
                minLength={3}
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
          </form>
        </div>

        <p className="text-center text-xs text-[#3a5068] font-mono mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-accent-bright hover:text-accent-bright transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
