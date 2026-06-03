# SATsec – Known Security Weaknesses

Ranked by severity. All references are to the backend unless noted.

---

## Critical

### 1. No Rate Limiting on Auth Endpoints
**File:** `backend/main.py` — all `/auth/*` routes  
**Risk:** Brute-force attacks on login, OTP verification, and forgot-password are completely unrestricted.  
A 6-digit OTP has only 1,000,000 combinations — trivially exhausted with no throttle in place.  
**Fix:** Add a rate-limiting middleware (e.g. `slowapi`) capping requests per IP per minute.

---

### 2. IDOR on `/results/{audit_id}`
**File:** `backend/main.py:514`  
**Risk:** Any authenticated (or unauthenticated) caller can fetch any user's audit result by guessing an integer ID. No ownership check is performed.  
**Fix:** Filter the query by `user_id` from the resolved identity before returning the record.

---

### 3. Cryptographically Weak OTP Generation
**File:** `backend/main.py:151`  
```python
# current — NOT cryptographically secure
return f"{random.randint(0, 999999):06d}"
```
**Risk:** Python's `random` module is not suitable for security-sensitive values. OTPs can be predicted if the PRNG state is known.  
**Fix:** Replace with `secrets.randbelow(1_000_000)`.

---

## High

### 4. Hardcoded Fallback JWT Secret
**File:** `backend/auth.py:7`  
```python
SECRET_KEY = os.getenv("JWT_SECRET", "vigil-dev-secret-change-in-production")
```
**Risk:** If deployed without setting `JWT_SECRET`, all JWTs are signed with a publicly known key — any attacker can forge valid tokens.  
**Fix:** Remove the fallback; raise a startup error if the env var is missing.

---

### 5. No JWT Revocation After Password Reset
**File:** `backend/auth.py`, `backend/main.py:335`  
**Risk:** Resetting a password does not invalidate existing JWT sessions. An attacker who obtained a token retains access for up to 7 days after the victim resets their password.  
**Fix:** Introduce a `token_version` column on `User`; increment it on password reset and validate it inside `decode_access_token`.

---

### 6. Server-Side Request Forgery (SSRF) via `/audit`
**File:** `backend/main.py:372–377`  
**Risk:** The audit endpoint will fetch any URL the caller provides, including `http://169.254.169.254` (AWS instance metadata), `http://localhost`, or other internal services. No IP/hostname blocklist exists.  
**Fix:** Resolve the hostname before fetching and reject private/loopback IP ranges (RFC 1918, 127.0.0.0/8, 169.254.0.0/16).

---

### 7. Unauthenticated Scheduler Jobs Endpoint
**File:** `backend/main.py:612`  
**Risk:** `GET /scheduler/jobs` returns all active scheduled jobs — including URLs being monitored — to any caller without authentication.  
**Fix:** Add `identity: dict = Depends(require_auth)` to the route.

---

## Medium

### 8. User Enumeration via 403 Response Body
**File:** `backend/main.py:278–281`  
```python
raise HTTPException(
    status_code=403,
    detail=f"EMAIL_NOT_VERIFIED:{user.id}:{user.email}"
)
```
**Risk:** The forgot-password endpoint deliberately avoids user enumeration, but the login endpoint leaks the user's numeric ID and email address in the response body for unverified accounts.  
**Fix:** Return a generic message and send the user ID only to the frontend via a dedicated field, not embedded in the error detail string.

---

### 9. Scheduled Audit Results Not Linked to Any User
**File:** `backend/main.py:631–641`  
**Risk:** `run_scheduled_audit` saves `AuditResult` rows with no `user_id`, so the results are invisible in any user's history dashboard and cannot be cleaned up per-user.  
**Fix:** Look up the owning user from the `ScheduledAudit` record and populate `user_id` when saving the result.

---

### 10. Client-Supplied Scores Trusted on Import
**File:** `backend/main.py:409–444`  
**Risk:** `POST /audit/import` stores whatever scores the client sends without re-running the audit. A user can import fabricated 100/100 scores as if they were real.  
**Fix:** Either re-run the audit server-side on import, or clearly mark imported records as `source: "guest_import"` so they can be distinguished from live audits.

---

### 11. Weak Email Validation
**File:** `backend/main.py:179`  
```python
if "@" not in email:
    raise HTTPException(...)
```
**Risk:** Accepts strings like `a@`, `@b`, or `@@` as valid email addresses, potentially causing downstream delivery failures or unexpected behaviour.  
**Fix:** Use `email-validator` (`pip install email-validator`) or a stricter regex.

---

## Summary

| # | Weakness | Location | Severity |
|---|----------|----------|----------|
| 1 | No rate limiting on auth routes | `main.py` – `/auth/*` | Critical |
| 2 | IDOR on audit results | `main.py:514` | Critical |
| 3 | Weak OTP RNG (`random` vs `secrets`) | `main.py:151` | Critical |
| 4 | Hardcoded fallback JWT secret | `auth.py:7` | High |
| 5 | No JWT revocation on password reset | `auth.py`, `main.py:335` | High |
| 6 | SSRF via `/audit` endpoint | `main.py:372` | High |
| 7 | Unauthenticated `/scheduler/jobs` | `main.py:612` | High |
| 8 | User enumeration in 403 body | `main.py:281` | Medium |
| 9 | Scheduled audit results lose user ownership | `main.py:638` | Medium |
| 10 | Imported scores not validated | `main.py:414` | Medium |
| 11 | Weak email validation | `main.py:179` | Medium |
