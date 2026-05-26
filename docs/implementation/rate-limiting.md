# Implementation: Rate Limiting

**Effort:** 1 day
**Phase:** 1 (Foundation)
**Priority:** High — without this, a single user can hammer the audit engine

---

## What to Limit

| Endpoint | Limit | Reason |
|---|---|---|
| `POST /audit` | 5/min per IP (guests), 30/min per user | Audits are expensive — fetch + parse + SSL check |
| `POST /auth/signup` | 3/hour per IP | Prevent account spam |
| `POST /auth/login` | 10/min per IP | Brute force protection |
| `POST /auth/forgot-password` | 3/hour per IP | Prevent email flooding |

---

## Implementation with `slowapi`

### Install
```bash
pip install slowapi
```
Add to `requirements.txt`.

### Setup in `backend/main.py`
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

### Apply to endpoints
```python
@app.post("/audit")
@limiter.limit("5/minute")
def trigger_audit(request: Request, ...):
    ...
```

---

## Per-User Limits (Authenticated)
For authenticated users, key on user ID instead of IP:
```python
def get_user_or_ip(request: Request):
    # Extract user_id from JWT if present, else fall back to IP
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        payload = auth_utils.decode_access_token(auth[7:])
        if payload:
            return f"user:{payload['sub']}"
    return get_remote_address(request)

limiter = Limiter(key_func=get_user_or_ip)
```

---

## 429 Response
slowapi automatically returns HTTP 429 with a `Retry-After` header.
The frontend should handle this and show a "Too many requests — wait X seconds" message.
