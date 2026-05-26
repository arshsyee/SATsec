# Feature Plan: API Keys (Programmatic Access)

**Effort:** 2-3 days
**Phase:** 3 (Growth Features)
**Dependencies:** Pricing tiers (Business plan gate)

---

## Problem
Developers want to trigger audits from CI/CD pipelines (e.g., after every deploy) without
going through the browser UI. Without API keys, they'd have to use JWT tokens tied to a session.

## Use Case
```bash
# Run after every GitHub Actions deploy
curl -X POST https://api.satsec.io/audit \
  -H "X-API-Key: sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"url": "https://mysite.com"}'
```

---

## Backend Changes

### New DB table: `api_keys`
```python
class ApiKey(Base):
    __tablename__ = "api_keys"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    key_hash = Column(String, unique=True)     # bcrypt hash — never store plaintext
    name = Column(String)                      # user-given label ("CI deploy", "staging")
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    is_active = Column(Integer, default=1)
```

### New endpoints
- `POST /api-keys` — generate new key (Business plan only), returns plaintext once
- `GET /api-keys` — list user's keys (name, created_at, last_used — never plaintext)
- `DELETE /api-keys/{id}` — revoke key

### Auth middleware change (`backend/main.py`)
Extend `get_identity()` to check `X-API-Key` header before checking Bearer JWT:
```python
api_key_header = request.headers.get("X-API-Key")
if api_key_header:
    # look up by hash, return user_id
```

---

## Frontend Changes
- Settings page: "API Keys" section — generate, name, list, revoke
- Show generated key once with copy button and "save it now" warning
- Usage docs: code snippets for curl, Python, Node

---

## Security Notes
- Store only the bcrypt hash, never the raw key
- Return raw key exactly once at creation — not retrievable again
- Rate limit API key requests the same as JWT requests
- Revoked keys rejected immediately (no caching)
