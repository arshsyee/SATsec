# Feature Plan: AI Audit Summaries

**Effort:** 1-2 days
**Phase:** 1 (Foundation)
**Dependencies:** `ANTHROPIC_API_KEY` in `.env`

---

## Problem
`generate_ai_summary()` in `backend/main.py:142` returns a hardcoded string.
Users get scores and a list of issues but no plain-English explanation of what to fix first.

## Approach
Call Claude via the Anthropic SDK to generate a 3-5 sentence plain-English summary
from the scores and issues list. Cache on the `AuditResult` record so it's only generated once.

## Implementation

```python
# backend/main.py:142
import anthropic

def generate_ai_summary(url: str, scores: dict, issues: list) -> str:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key or not issues:
        return "AI summary unavailable."

    client = anthropic.Anthropic(api_key=api_key)
    issues_text = "\n".join(f"- {i}" for i in issues[:15])
    prompt = (
        f"Website audit for {url}:\n"
        f"Scores — Performance: {scores['performance']}, SEO: {scores['seo']}, "
        f"Accessibility: {scores['accessibility']}, Security: {scores['security']}\n\n"
        f"Issues found:\n{issues_text}\n\n"
        f"Write a 3-5 sentence plain-English summary for a non-technical website owner. "
        f"Focus on the most critical issues and what to fix first. Be direct and actionable."
    )
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text
```

## Why Haiku
- Fastest and cheapest model — summaries are short, don't need reasoning
- ~$0.001 per audit summary at current pricing
- At 10,000 audits/month: ~$10/month in AI costs

## Gating by Tier
- Free tier: no AI summary (show upgrade prompt)
- Pro/Business: full summary on every audit

## Risk
- API key not set → graceful fallback to "unavailable" message (already handled)
- Anthropic rate limits → wrap in try/except, fall back to None
