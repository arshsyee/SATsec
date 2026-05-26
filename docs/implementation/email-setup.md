# Implementation: AWS SES Email Setup

**Effort:** 1 day
**Phase:** 1 (Foundation)
**Blocks:** OTP verification emails, alert emails, password reset emails

---

## Current State
`backend/alerts.py` uses `boto3` to call AWS SES. It silently skips if `VIGIL_FROM_EMAIL`
is not set. The backend crashes on startup if `boto3` is not installed (missing from requirements.txt).

## Fix #1 — Add boto3 to requirements.txt
```
boto3
```

---

## SES Production Setup Steps

### 1. Request production access (do this first — takes 24-48h)
AWS SES starts in sandbox mode (can only email verified addresses).
- Go to AWS Console → SES → Account dashboard → "Request production access"
- Use case: transactional emails (OTP, alerts)
- Estimated volume: <1,000/day initially

### 2. Verify your sending domain
- AWS Console → SES → Verified identities → "Create identity" → Domain
- Add the TXT and CNAME records SES gives you to your DNS provider
- Verification takes ~30 minutes

### 3. Set environment variables
```
VIGIL_FROM_EMAIL=noreply@yourdomain.com
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-2
```
Or use an IAM role attached to the EC2/App Runner instance (preferred — no keys in env).

### 4. Test email delivery locally
```python
# Run from backend/
python -c "from alerts import send_otp_email; send_otp_email('you@example.com', 'TestUser', '123456')"
```

---

## IAM Policy for SES (least privilege)
```json
{
  "Effect": "Allow",
  "Action": ["ses:SendEmail", "ses:SendRawEmail"],
  "Resource": "arn:aws:ses:us-east-2:ACCOUNT_ID:identity/yourdomain.com"
}
```

---

## Email Types Sent
| Trigger | Function | Subject |
|---|---|---|
| Signup | `send_otp_email()` | Your SATsec verification code |
| Score drop | `send_alert()` | SATsec Alert: score dropped for X |
| Password reset | `send_reset_email()` | Reset your SATsec password |
