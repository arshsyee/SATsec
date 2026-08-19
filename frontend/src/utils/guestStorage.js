const KEY = 'satsec_guest_audits'

export function getGuestAudits() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function saveGuestAudit(result, url) {
  const audits = getGuestAudits()
  const entry = {
    id: `guest_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    url: url || result.url,
    scores: result.scores,
    issues: result.issues,
    issues_flat: result.issues_flat || [],
    ai_summary: result.ai_summary,
    created_at: new Date().toISOString(),
  }
  audits.unshift(entry)
  localStorage.setItem(KEY, JSON.stringify(audits))
  return entry
}

export function removeGuestAudit(id) {
  const audits = getGuestAudits().filter(a => a.id !== id)
  localStorage.setItem(KEY, JSON.stringify(audits))
}

export function clearGuestAudits() {
  localStorage.removeItem(KEY)
}
