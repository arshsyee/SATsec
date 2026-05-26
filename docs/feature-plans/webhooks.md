# Feature Plan: Webhooks

**Effort:** 2 days
**Phase:** 3 (Growth Features)
**Dependencies:** Scheduled monitoring (already built)

---

## Problem
Email alerts work but are not developer-friendly. Teams want score-drop notifications
in Slack, PagerDuty, or their own systems — without polling the API.

---

## How It Works
When a scheduled audit finishes and a score drops below threshold:
1. SATsec POSTs a JSON payload to the user's configured webhook URL
2. Slack incoming webhooks accept this format natively
3. Custom endpoints can react however they want (page on-call, open a ticket, etc.)

---

## Payload Format
```json
{
  "event": "score_drop",
  "url": "https://example.com",
  "timestamp": "2026-06-15T14:32:00Z",
  "scores": {
    "overall": 58,
    "performance": 100,
    "seo": 62,
    "accessibility": 72,
    "security": 10
  },
  "threshold": 70,
  "top_issues": [
    "Missing Content-Security-Policy header (XSS risk)",
    "SSL certificate expires in 8 days — renew immediately"
  ],
  "audit_url": "https://app.satsec.io/results/1234"
}
```

---

## Backend Changes

### DB: add `webhook_url` to `scheduled_audits`
```python
webhook_url = Column(String, nullable=True)
```

### `backend/alerts.py` — new function
```python
def send_webhook(webhook_url: str, payload: dict):
    try:
        requests.post(webhook_url, json=payload, timeout=10)
    except Exception as e:
        print(f"[Vigil] Webhook delivery failed: {e}")
```

### `ScheduleRequest` model — add optional field
```python
webhook_url: Optional[str] = None
```

### Trigger in `run_scheduled_audit()` alongside existing email alert

---

## Frontend Changes
- Settings page: "Webhook URL" field in schedule creation form
- Placeholder: `https://hooks.slack.com/services/...`
- "Test webhook" button that sends a sample payload

---

## Slack Integration (no extra code needed)
Users paste a Slack Incoming Webhook URL — the payload format is compatible.
Add a "Connect Slack" guide in the docs page.
