const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Reads auth state from localStorage to build the right identity header.
// If a JWT token exists → Authorization: Bearer. Otherwise → X-Session-ID.
function authHeaders() {
  const token = localStorage.getItem('vigil_token')
  if (token) return { Authorization: `Bearer ${token}` }
  const sessionId = localStorage.getItem('vigil_session_id')
  if (sessionId) return { 'X-Session-ID': sessionId }
  return {}
}

export async function runAudit(url, signal) {
  const res = await fetch(`${BASE}/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ url }),
    signal,
  })
  if (res.status === 429) {
    const retry = res.headers.get('Retry-After')
    throw new Error(
      retry
        ? `Too many requests — please wait ${retry}s and try again.`
        : 'Too many requests — please slow down and try again shortly.'
    )
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Audit failed')
  }
  return res.json()
}

// Streaming audit — emits one event per real backend stage via Server-Sent Events.
// onEvent receives: {type:'init',stages}, {type:'stage',id,status}, {type:'result',result}.
// Returns the final result. Falls back caller-side to runAudit() if unsupported.
export async function runAuditStream(url, { onEvent, signal } = {}) {
  const res = await fetch(`${BASE}/audit/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ url }),
    signal,
  })
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Audit failed')
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE frames are separated by a blank line; keep the trailing partial.
    const frames = buffer.split('\n\n')
    buffer = frames.pop()
    for (const frame of frames) {
      const dataLine = frame.split('\n').find(l => l.startsWith('data:'))
      if (!dataLine) continue
      const event = JSON.parse(dataLine.slice(5).trim())
      if (event.type === 'error') throw new Error(event.message)
      if (event.type === 'result') result = event.result
      onEvent?.(event)
    }
  }

  if (!result) throw new Error('Audit ended without a result')
  return result
}

// Server-rendered screenshot URL for the in-app preview — works where iframes
// don't (bypasses X-Frame-Options / CSP). Safe to use directly as an <img src>.
export function screenshotUrl(url) {
  return `${BASE}/screenshot?url=${encodeURIComponent(url)}`
}

export async function getHistory(url, limit = 20) {
  const res = await fetch(
    `${BASE}/history?url=${encodeURIComponent(url)}&limit=${limit}`,
    { headers: authHeaders() }
  )
  if (!res.ok) throw new Error('No history found')
  return res.json()
}

export async function getRecentAudits(limit = 30) {
  const res = await fetch(`${BASE}/audits/recent?limit=${limit}`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Could not load recent audits')
  return res.json()
}

export async function createSchedule({ url, interval_hours, alert_email, alert_threshold }) {
  const res = await fetch(`${BASE}/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ url, interval_hours, alert_email, alert_threshold }),
  })
  if (!res.ok) throw new Error('Failed to save schedule')
  return res.json()
}

export async function listSchedules() {
  const res = await fetch(`${BASE}/schedules`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Could not load monitors')
  return res.json()
}

export async function deleteSchedule(scheduleId) {
  const res = await fetch(`${BASE}/schedule/${scheduleId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to remove monitor')
  return res.json()
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signup(username, email, password) {
  const res = await fetch(`${BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Signup failed')
  return data  // { user_id, email, message }
}

export async function verifyOtp(userId, code) {
  const res = await fetch(`${BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, code }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Verification failed')
  return data  // { token, user }
}

export async function resendOtp(userId) {
  const res = await fetch(`${BASE}/auth/resend-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Failed to resend code')
  return data
}

export async function importAudits(audits) {
  const res = await fetch(`${BASE}/audit/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ audits }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Import failed')
  return data
}

export async function loginApi(identifier, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  })
  const data = await res.json()
  if (!res.ok) {
    // Special sentinel: backend tells us to go to OTP verification
    if (res.status === 403 && typeof data.detail === 'string' && data.detail.startsWith('EMAIL_NOT_VERIFIED:')) {
      const [, userId, email] = data.detail.split(':')
      const err = new Error('Email not verified')
      err.unverified = { userId: parseInt(userId), email }
      throw err
    }
    throw new Error(data.detail || 'Login failed')
  }
  return data
}

export async function forgotPassword(identifier) {
  const res = await fetch(`${BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Request failed')
  return data
}

export async function resetPassword(token, new_password) {
  const res = await fetch(`${BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Reset failed')
  return data
}
