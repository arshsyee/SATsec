import { useState } from 'react'
import { importAudits } from '../api'
import { clearGuestAudits, removeGuestAudit } from '../utils/guestStorage'

/**
 * Top-right sticky modal that appears after sign-in when the user has guest audits.
 * Only dismissible via the X button.
 */
export default function ImportAuditsModal({ audits, onDone }) {
  const [selected,  setSelected]  = useState(() => new Set(audits.map(a => a.id)))
  const [view,      setView]      = useState('ask')   // 'ask' | 'select' | 'loading' | 'done'
  const [imported,  setImported]  = useState(0)
  const [error,     setError]     = useState(null)

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const doImport = async (toImport) => {
    setView('loading')
    setError(null)
    try {
      const payload = toImport.map(a => ({
        url: a.url,
        scores: a.scores,
        issues_flat: a.issues_flat || [],
        ai_summary: a.ai_summary || null,
        created_at: a.created_at || null,
      }))
      const result = await importAudits(payload)
      // Remove imported audits from localStorage
      toImport.forEach(a => removeGuestAudit(a.id))
      setImported(result.imported)
      setView('done')
    } catch (err) {
      setError(err.message)
      setView('select')
    }
  }

  const handleImportAll = () => doImport(audits)

  const handleImportSelected = () => {
    const toImport = audits.filter(a => selected.has(a.id))
    if (toImport.length === 0) { handleDiscard(); return }
    doImport(toImport)
  }

  const handleDiscard = () => {
    clearGuestAudits()
    onDone()
  }

  const handleDone = () => {
    // Clear any remaining guest audits that weren't imported
    clearGuestAudits()
    onDone()
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-80 bg-[#0d1520] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-sm font-medium text-[#e8edf5]">Guest Audits Found</span>
        </div>
        <button
          onClick={handleDiscard}
          className="text-[#3a5068] hover:text-[#8899aa] text-xl leading-none transition-colors"
          title="Dismiss"
        >
          ×
        </button>
      </div>

      <div className="px-5 py-4">

        {/* Ask view */}
        {view === 'ask' && (
          <>
            <p className="text-xs text-[#8899aa] font-mono mb-4">
              {audits.length} audit{audits.length !== 1 ? 's' : ''} from your guest session
            </p>
            <p className="text-sm text-[#c8d8e8] mb-5 leading-relaxed">
              Would you like to import your guest audits into your account?
            </p>
            <div className="space-y-2">
              <button
                onClick={handleImportAll}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                Import all ({audits.length})
              </button>
              <button
                onClick={() => setView('select')}
                className="w-full bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-[#c8d8e8] text-sm py-2.5 rounded-xl transition-colors"
              >
                Select audits
              </button>
              <button
                onClick={handleDiscard}
                className="w-full text-[#4a6070] hover:text-[#8899aa] text-sm py-2 font-mono transition-colors"
              >
                Discard all
              </button>
            </div>
          </>
        )}

        {/* Select view */}
        {view === 'select' && (
          <>
            <p className="text-xs text-[#8899aa] font-mono mb-3">select audits to import</p>
            <div className="space-y-2 max-h-48 overflow-y-auto mb-4 pr-1">
              {audits.map(a => (
                <label
                  key={a.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-white/[0.04] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={() => toggle(a.id)}
                    className="accent-blue-500 w-4 h-4 flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-[#c8d8e8] font-mono truncate">{a.url.replace(/^https?:\/\//, '')}</p>
                    <p className="text-xs text-[#4a6070]">Score: {a.scores?.overall ?? '—'}</p>
                  </div>
                </label>
              ))}
            </div>

            {error && (
              <p className="text-xs text-red-400 font-mono mb-3">{error}</p>
            )}

            <div className="space-y-2">
              <button
                onClick={handleImportSelected}
                disabled={selected.size === 0}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                Import selected ({selected.size})
              </button>
              <button
                onClick={handleDiscard}
                className="w-full text-[#4a6070] hover:text-[#8899aa] text-sm py-2 font-mono transition-colors"
              >
                Discard all
              </button>
            </div>
          </>
        )}

        {/* Loading view */}
        {view === 'loading' && (
          <div className="py-4 text-center">
            <p className="text-sm text-[#7a9ab8] font-mono animate-pulse">importing audits...</p>
          </div>
        )}

        {/* Done view */}
        {view === 'done' && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-green-400 text-lg">✓</span>
              <p className="text-sm text-[#c8d8e8]">{imported} audit{imported !== 1 ? 's' : ''} imported</p>
            </div>
            <p className="text-xs text-[#4a6070] font-mono mb-4">added to your account history</p>
            <button
              onClick={handleDone}
              className="w-full bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-[#c8d8e8] text-sm py-2.5 rounded-xl transition-colors"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  )
}
