# Feature Plan: Data API & Data Plan (Companies Consuming Our Audit Data)

**Effort:** 6-8 days
**Phase:** 3 (Growth Features)
**Dependencies:** API keys (`api-keys.md`), pricing tiers (`pricing-tiers.md`), a meaningful audit corpus (need volume before the data is worth selling)

---

## Problem
We are accumulating a corpus of website audit data — every scan writes an
`audit_results` row: URL, four category scores (performance, SEO, accessibility,
security), overall score, full issue list, and a timestamp. That dataset has value
**to other companies**, separate from running their own audits:

- **Agencies / consultancies** — find sites with low security or SEO scores → sales leads.
- **VC / market research** — benchmark a sector's web health, track trends over time.
- **Security vendors** — enrich their own data with our header/SSL/issue findings.
- **Platforms** — embed "your site scores X vs. industry average" into their product.

`api-keys.md` covers companies running **their own** audits (a tool). This covers
companies **buying our aggregated data** (a feed). Different product, different plan.

---

## What We Sell

Three data products, increasing in value:

### 1. Bulk / batch audit API
Submit many URLs, get scored results back. Built on the existing audit engine but
priced per-URL for high volume.
```bash
POST https://api.satsec.io/v1/data/batch
X-API-Key: sk_live_...
{ "urls": ["https://a.com", "https://b.com", ...] }   # up to 1000/request
```

### 2. Dataset / query API
Query our existing corpus — no new scan, just read what we already have.
```bash
# Sites in a score band (lead-gen for an agency)
GET /v1/data/query?security_lt=40&seo_lt=50&limit=500

# A single domain's history (benchmarking)
GET /v1/data/domain/example.com/history
```

### 3. Benchmark / aggregate API
Anonymized, aggregated statistics — no per-site PII concern, highest margin.
```bash
GET /v1/data/benchmarks?category=security
# → { "p50": 62, "p90": 88, "sample_size": 41032, "trend_30d": "+3.1" }
```

---

## Data Shape (already in the DB)

`audit_results` (`backend/database.py:44`) is the source table:

| Column | Use in data product |
|---|---|
| `url` | domain key; aggregate by domain/TLD/sector |
| `performance_score` `seo_score` `accessibility_score` `security_score` | the sellable signal |
| `overall_score` | headline metric |
| `issues` (Text/JSON) | granular findings — missing CSP, expired SSL, etc. |
| `created_at` | time series, trend analysis |

No schema change needed to *start* — the query/benchmark APIs read existing rows.
The batch API reuses `run_audit()` from `backend/audit.py`.

---

## Backend Changes

### 1. New endpoints (`backend/main.py`)
- `POST /v1/data/batch` — accept URL list, enqueue audits, return job id; poll/webhook for results
- `GET  /v1/data/query` — filter corpus by score bands, date, limit; paginated
- `GET  /v1/data/domain/{domain}/history` — one domain's score series
- `GET  /v1/data/benchmarks` — aggregated percentiles per category

All gated to **Data plan** API keys (extend the `api-keys.md` auth check with a plan tier).

### 2. Usage metering (new table)
Data plans bill by volume, so meter every call.
```python
class ApiUsage(Base):
    __tablename__ = "api_usage"
    id          = Column(Integer, primary_key=True)
    api_key_id  = Column(Integer, ForeignKey("api_keys.id"))
    endpoint    = Column(String)        # "batch" | "query" | "benchmarks"
    units       = Column(Integer)       # URLs scanned or rows returned
    created_at  = Column(DateTime, default=datetime.utcnow)
```
Aggregate monthly → enforce quota → report to Stripe metered billing.

### 3. Batch job runner
Batch of 1000 URLs can't run inline. Reuse the planned Celery/Redis queue
(`implementation/celery-migration.md`) — enqueue, audit async, store results,
notify via webhook (`webhooks.md`) or poll endpoint.

### 4. Async-friendly corpus index
`url` and `created_at` are already indexed. Add a composite index for score-band
queries:
```python
Index("ix_scores", AuditResult.security_score, AuditResult.seo_score)
```

---

## Data Plan (Pricing)

A separate track from the Free / Pro / Business consumer tiers — sold to companies,
usage-metered, contract or self-serve.

| | Data Starter | Data Growth | Data Enterprise |
|---|---|---|---|
| **Price** | $199/mo | $799/mo | Custom |
| Batch audits | 10k URLs/mo | 100k URLs/mo | Unlimited |
| Corpus queries | 50k rows/mo | 500k rows/mo | Unlimited |
| Benchmark API | Yes | Yes | Yes |
| Domain history | Yes | Yes | Yes |
| Overage | $0.02 / URL | $0.015 / URL | negotiated |
| Webhook delivery | — | Yes | Yes |
| SLA / support | Community | Email | Dedicated + SLA |
| Data export (raw dump) | — | — | Yes (licensed) |

Billing: Stripe **metered** subscriptions (report `units` from `api_usage`). Base
fee + overage. Enterprise = sales contract, raw-dump license, custom limits.

> Add this as a fourth column track in `pricing-tiers.md`, kept visually separate
> from consumer plans (different buyer, different page section: `/pricing#data`).

---

## Frontend Changes
- `/pricing#data` section — the Data plan table + "Talk to sales" CTA for Enterprise
- Settings → API Keys: show Data-plan keys + a live usage meter (units used / quota)
- `/docs` data-API reference — batch, query, benchmark, history endpoints with examples
- Dashboard widget for Data customers: monthly usage, overage forecast

---

## Setup Steps
1. Confirm corpus volume is sellable (don't sell a thin dataset — gate launch on N rows).
2. Add `api_usage` table + score composite index; migrate.
3. Build the four `/v1/data/*` endpoints behind Data-plan key auth.
4. Wire batch to the Celery queue (`celery-migration.md`).
5. Create Stripe metered products: Data Starter, Data Growth.
6. Add `/pricing#data` + `/docs` data section.
7. Test metering accuracy end-to-end (units logged == units billed).

---

## Legal & Privacy (do not skip)

| Concern | Handling |
|---|---|
| Selling data about third-party sites | Audit only public, externally observable signals (headers, SSL, HTML) — no auth/scraping behind logins |
| User-submitted URLs in the corpus | Terms must grant us rights to retain + aggregate scan results; add to `/terms` |
| GDPR — domains can tie to people | Benchmark API is anonymized/aggregated; raw query/export gated to Enterprise license with DPA |
| Robots / ToS of scanned sites | Respect `robots.txt`, rate-limit per target, honor takedown requests |
| Reselling restrictions | License terms forbid customers re-selling raw dumps without agreement |

**Block launch on legal sign-off.** This converts a private audit log into a sold
dataset — the Terms of Service and Privacy Policy must explicitly permit it.

---

## Risk

| Risk | Mitigation |
|---|---|
| Corpus too small to be valuable | Gate launch on volume; seed with a one-time crawl of top domains if needed |
| Legal exposure selling third-party data | Public signals only; legal review; clear ToS grant; honor takedowns |
| Batch load crushes audit engine | Async Celery queue + per-account concurrency cap |
| Metering errors → wrong bills | Log units atomically with the response; reconcile job before Stripe report |
| Customers scrape full corpus via query API | Hard pagination caps, per-key rate limits, raw dumps Enterprise-only |
| Cannibalizes Business plan | Position separately — Business = run your audits; Data = consume our dataset |

---

## Open Questions
- Self-serve Data Starter, or sales-gated from day one? Self-serve scales but risks abuse.
- Sell issue-level detail (specific findings per site) or only scores + aggregates?
  Issue detail is higher value but higher legal/ToS risk.
- Real-time corpus or daily snapshot? Snapshots are cheaper to serve and easier to license.
