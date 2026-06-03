# TODO

Derived from `docs/feature-plans/` + `docs/roadmap.md`. Each item links its spec.
`[x]` done · `[ ]` open. Phases match the roadmap (launch target Jul 31, 2026).

---

## Phase 1 — Foundation

- [ ] **AI audit summaries** (1-2d) — `generate_ai_summary()` in `backend/main.py:142`
  returns hardcoded string. Wire Anthropic SDK (Haiku), cache on `AuditResult`,
  gate to Pro/Business. Spec: `feature-plans/ai-summaries.md`.
- [ ] Add `boto3` to `backend/requirements.txt` (missing → startup crash).
- [x] Rate limiting — per-IP throttle on `POST /audit`.
- [ ] AWS SES — verify domain, test OTP + alert emails end-to-end.
- [ ] UI polish — mobile responsiveness, loading/error states.
- [x] Fix nav stubs — `/features` real content.

### Performance audit
- [ ] **Link loading-page checkers to measured load time.**
  Lazy-load (`loading="lazy"`) + font-preload checks in
  `backend/audit.py::audit_performance` are static/heuristic — flag missing hints
  regardless of real perf. Tie to `load_time` from `fetch_page`:
  - Only escalate lazy-load / font-preload findings when `load_time` is slow, so a
    fast page isn't penalised for hints it doesn't need.
  - Surface them stronger when load time is poor and they're plausible causes
    (LCP / render-blocking impact).

---

## Phase 2 — Business Features

- [ ] **Pricing tiers + Stripe** (5-7d) — add `plan`/`stripe_*` to User model,
  `/billing/create-checkout` + `/billing/webhook` + `/billing/portal`, enforce
  tier in `/audit` + `/schedule`. Build `/pricing` page. Spec: `feature-plans/pricing-tiers.md`.
- [ ] **Export reports** (2-3d) — PDF (`GET /results/{id}/export/pdf`, weasyprint)
  + CSV (`GET /audits/export/csv`). Gate Pro/Business. Spec: `feature-plans/export-reports.md`.
- [ ] **Loading-screen ads** (3-4d) — free-tier monetization. New `adGate.js` +
  `AdSlot.jsx`, wire into `Scanning.jsx`, first scan ad-free, paid never see ads.
  Backend: expose `plan` + `audit_count` on `/auth/me`. Needs ad network + GDPR
  consent banner. Spec: `feature-plans/loading-screen-ads.md`.
- [x] User onboarding — welcome email + first-run tutorial modal.

---

## Phase 3 — Growth Features

- [ ] **API keys** (2-3d) — `api_keys` table (bcrypt hash), `POST/GET/DELETE /api-keys`,
  extend `get_identity()` for `X-API-Key`. Business gate. Spec: `feature-plans/api-keys.md`.
- [ ] **Data API & Data plan** (6-8d) — sell aggregated corpus. `/v1/data/batch|query|
  domain/{d}/history|benchmarks`, `api_usage` metering table, Stripe metered billing,
  `/pricing#data`. Depends on API keys + Celery + legal sign-off. Spec: `feature-plans/data-api.md`.
- [ ] **Webhooks** (2d) — add `webhook_url` to `scheduled_audits`, `send_webhook()` in
  `alerts.py`, trigger in `run_scheduled_audit()` on score drop. Slack-compatible
  payload. Spec: `feature-plans/webhooks.md`.
- [ ] **Teams / workspaces** (5-7d) — `Workspace` + `WorkspaceMember` tables, invite
  flow, workspace switcher, scope audits/schedules by `workspace_id`. Business plan
  (5 members). Ship without roles first. Spec: `feature-plans/teams-workspaces.md`.
- [ ] `/docs` page — public API reference with examples.

### Live monitoring (cross-phase, depends on Celery migration)
- [ ] **Uptime pinger + hybrid model** — `UptimeCheck` table, `uptime.py:check_uptime()`,
  Celery `ping_uptime()`, `GET /uptime/{schedule_id}`, alert on 2 consecutive fails +
  recovery notif, dashboard status dot/uptime%/latency. Retention/rollup from day 1.
  Specs: `feature-plans/live-monitoring.md`, `business/live-monitoring-positioning.md`,
  `implementation/celery-migration.md`.

---

## Phase 4 — Launch Prep

- [ ] Legal pages — `/privacy` + `/terms` (Data API requires ToS data-rights grant).
- [ ] Error monitoring — Sentry (backend + frontend).
- [ ] Uptime monitoring — external ping (interim until live-monitoring ships).
- [ ] Load test — 50+ concurrent audits.
- [ ] Beta program — 10-20 testers, fix top issues.
- [ ] Production deploy — AWS App Runner + RDS PostgreSQL + CloudFront.

---

## Phase 5 — Launch

- [ ] Product Hunt launch (Tue/Wed).
- [ ] Hacker News "Show HN".
- [ ] Email beta users with announcement.
- [ ] Monitor error rates, conversion funnel, first revenue.
