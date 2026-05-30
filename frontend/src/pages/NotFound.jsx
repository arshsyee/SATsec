import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#080c14] text-[#e8edf5] font-sans flex flex-col items-center justify-center px-6">

      {/* Grid bg */}
      <div className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(99,179,237,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,179,237,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />

      <div className="relative z-10 text-center max-w-md">

        {/* Logo */}
        <div className="font-mono text-lg font-bold mb-16 cursor-pointer" onClick={() => navigate('/')}>
          SAT<span className="text-blue-500">sec</span>
        </div>

        {/* 404 */}
        <div className="font-mono text-8xl font-bold text-white/[0.05] mb-4 select-none">404</div>
        <h1 className="text-xl font-medium text-[#f0f4fa] mb-3">Page not found</h1>
        <p className="text-sm text-[#4a6070] font-mono mb-10">
          the page you're looking for doesn't exist or was moved
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="border border-white/10 hover:border-white/25 text-[#8899aa] hover:text-[#e8edf5] text-sm px-5 py-2.5 rounded-lg transition-all"
          >
            ← Go Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}