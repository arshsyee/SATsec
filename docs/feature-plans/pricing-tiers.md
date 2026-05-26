# Feature Plan: Pricing Tiers & Stripe Integration

**Effort:** 5-7 days
**Phase:** 2 (Business Features)
**Dependencies:** Stripe account, domain for webhooks

---

## Tiers

| | Free | Pro | Business |
|---|---|---|---|
| **Price** | $0 | $29/month | $99/month |
| One-time audits | 5/day | Unlimited | Unlimited |
| Scheduled monitors | 0 | 5 URLs | 25 URLs |
| Monitoring intervals | — | 6h / daily / weekly | 6h / daily / weekly |
| Alert emails | — | Yes | Yes |
| AI summaries | — | Yes | Yes |
| Export PDF/CSV | — | Yes | Yes |
| API access | — | — | Yes |
| Team members | 1 | 1 | 5 |
| Audit history | 7 days | 90 days | 1 year |

---

## Backend Changes

### 1. Add `plan` to User model (`backend/database.py`)
```python
plan = Column(String, default="free")           # "free" | "pro" | "business"
stripe_customer_id = Column(String, nullable=True)
stripe_subscription_id = Column(String, nullable=True)
plan_expires_at = Column(DateTime, nullable=True)
```

### 2. New endpoints (`backend/main.py`)
- `POST /billing/create-checkout` — create Stripe checkout session, redirect URL
- `POST /billing/webhook` — handle `customer.subscription.updated/deleted`
- `GET /billing/portal` — Stripe customer portal link (for managing subscription)

### 3. Plan enforcement
- Check `user.plan` in `/audit` endpoint — if Free and daily count > 5, return 429
- Check `user.plan` in `/schedule` endpoint — gate scheduled audits by tier
- AI summary: only call Anthropic if `user.plan != "free"`

---

## Frontend Changes

### New `/pricing` page
- Three-column card layout (Free / Pro / Business)
- "Get started free" / "Upgrade to Pro" / "Contact us" CTAs
- Feature comparison table
- FAQ section (cancel anytime, what counts as an audit, etc.)

### Upgrade prompts in-app
- Dashboard: show banner when approaching Free tier limit
- Scheduling: show modal if user tries to add a 6th monitor on Pro

---

## Stripe Setup Steps
1. Create Stripe account at stripe.com
2. Create two products: "SATsec Pro" and "SATsec Business"
3. Add monthly prices ($29, $99)
4. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in backend `.env`
5. Use Stripe CLI locally to forward webhook events: `stripe listen --forward-to localhost:8000/billing/webhook`
6. Test with Stripe test cards before going live

---

## Risk
- Webhook delivery failures → Stripe retries for 72 hours, but add idempotency checks
- Free tier audit counting → store daily count in Redis or a new DB column
