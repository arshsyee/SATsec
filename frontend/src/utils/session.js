export function getOrCreateSessionId() {
  let id = localStorage.getItem('satsec_session_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('satsec_session_id', id)
  }
  return id
}
