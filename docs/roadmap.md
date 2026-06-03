# SATsec 2.0 — Company Launch Roadmap
**Target: July 31, 2026**
**Start: May 25, 2026**
**Duration: 10 weeks**

---

## Current State
The core product is fully functional: audit engine (61 checks across Performance, SEO, Accessibility, Security), user auth with OTP, scheduled monitoring, email alerts, trend dashboard, and guest mode. The gap is business infrastructure.

---

## Phase 1 — Foundation (May 25 – Jun 7) `Weeks 1-2`

Goal: Make the product production-worthy before adding business features.

- [ ] Wire AI summaries — implement `generate_ai_summary()` in `backend/main.py:142` using Anthropic SDK
- [ ] Add boto3 to `backend/requirements.txt` (currently missing, causes startup crash)
- [x] Add rate limiting — per-IP throttle on `POST /audit` to prevent abuse
- [ ] Set up AWS SES — verify sending domain, test OTP + alert emails end-to-end
- [ ] UI polish — fix mobile responsiveness, improve loading/error states
- [x] Fix navigation stubs — `/features` page needs real content

**Deliverable:** Stable, self-contained product that runs cleanly in production.

---

## Phase 2 — Business Features (Jun 8 – Jun 21) `Weeks 3-4`

Goal: Turn the free tool into a paid SaaS product.

- [ ] Build `/pricing` page — Free / Pro / Business tier breakdown
- [ ] Stripe integration — checkout session, webhook listener, subscription status
- [ ] Add `plan` field to User model — gate features by tier
- [x] User onboarding — welcome email on signup, first-run tutorial modal
- [ ] Audit export — PDF/CSV download of results
- [ ] Loading-screen ads — monetize free tier; ad on loading screen after 1 free scan, ad-free for paid (see `feature-plans/loading-screen-ads.md`)

**Deliverable:** Users can sign up, enter credit card, and subscribe to a paid plan.

---

## Phase 3 — Growth Features (Jun 22 – Jul 5) `Weeks 5-6`

Goal: Add features that drive B2B adoption and reduce churn.

- [ ] API keys — users generate tokens for programmatic `POST /audit` access
- [ ] Data API & Data plan — sell aggregated audit corpus (batch/query/benchmark) to companies; usage-metered tier (see `feature-plans/data-api.md`)
- [ ] Teams/workspaces — invite teammates, shared audit history
- [ ] Webhooks — POST score-drop alerts to Slack or custom URL
- [ ] `/docs` page — public API reference with example requests

**Deliverable:** Developers can integrate SATsec into their CI/CD pipeline.

---

## Phase 4 — Launch Prep (Jul 6 – Jul 19) `Weeks 7-8`

Goal: Bullet-proof the product before going public.

- [ ] Legal pages — `/privacy` and `/terms`
- [ ] Error monitoring — Sentry integration (backend + frontend)
- [ ] Uptime monitoring — set up external ping monitoring
- [ ] Load test — verify backend handles 50+ concurrent audits
- [ ] Beta program — recruit 10-20 testers, fix top reported issues
- [ ] Production deploy — AWS App Runner + RDS PostgreSQL + CloudFront

**Deliverable:** Production environment running, beta feedback incorporated.

---

## Phase 5 — Launch (Jul 20 – Jul 31) `Weeks 9-10`

Goal: Public launch and first paying customers.

- [ ] Product Hunt launch (schedule for a Tuesday/Wednesday)
- [ ] Hacker News "Show HN" post
- [ ] Email beta users with launch announcement
- [ ] Monitor: error rates, conversion funnel, first revenue

**Deliverable:** Live product, first paying customers, public presence.

---

## Tier Structure (Proposed)

| Feature | Free | Pro ($29/mo) | Business ($99/mo) |
|---|---|---|---|
| One-time audits | 5/day | Unlimited | Unlimited |
| Scheduled monitors | 0 | 5 URLs | 25 URLs |
| Alert emails | — | Yes | Yes |
| AI summaries | — | Yes | Yes |
| Export PDF/CSV | — | Yes | Yes |
| API access | — | — | Yes |
| Team members | 1 | 1 | 5 |
| Audit history | 7 days | 90 days | 1 year |

---

## Key Risks

| Risk | Mitigation |
|---|---|
| Audit engine too slow for high traffic | Add async audit queue (Celery/Redis) |
| AWS SES in sandbox mode | Apply for production SES access early (1-2 day approval) |
| Stripe complexity | Use Stripe Billing (hosted checkout) to minimize custom code |
| No paying customers by July | Start beta outreach in Week 5, not Week 9 |
