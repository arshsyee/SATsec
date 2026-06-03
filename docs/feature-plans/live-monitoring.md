# Feature Plan — Live Monitoring (Hybrid Uptime + Full Audit)

**Status:** Planned
**Depends on:** [Celery migration](../implementation/celery-migration.md) (for scalable scheduled execution)
**Business case:** [Live Monitoring Positioning](../business/live-monitoring-positioning.md)

---

## Problem

The current product only runs full audits every 6/12/24h (`scheduler.py`, `ScheduledAudit` model). That's too slow to answer the question buyers care about most in real time: **"Is my site down right now?"**

But making full audits more frequent is the wrong fix — a full audit is ~20 HTTP requests and 10–80s of wall time. Running that every minute is expensive and pointless: SEO tags and accessibility markup don't change minute-to-minute.

## Solution — hybrid model

Two independent loops at different cadences:

1. **Uptime pinger** — one `HEAD` (fallback `GET`) request every 1–5 min. <1s. Records status + latency. Alerts on downtime.
2. **Full audit** — keep the existing 6/12/24h schedule for deep four-dimensional regression detection.

The pinger is cheap and real-time; the audit is rich and periodic. Buyers get both "is it up?" and "did it regress?"

---

## Data model

New table (`database.py`):

```python
class UptimeCheck(Base):
    __tablename__ = "uptime_checks"
    id           = Column(Integer, primary_key=True, index=True)
    schedule_id  = Column(Integer, ForeignKey("scheduled_audits.id"), index=True)
    url          = Column(String, index=True)
    status_code  = Column(Integer, nullable=True)   # null = request failed/timeout
    response_ms  = Column(Integer, nullable=True)
    is_up        = Column(Integer, default=0)        # 1 = 2xx/3xx, 0 = down
    checked_at   = Column(DateTime, default=datetime.datetime.utcnow, index=True)
```

Add to `ScheduledAudit`: `uptime_enabled` (Integer, default 1), `uptime_interval_min` (Integer, default 5).

**Retention:** uptime rows accumulate fast (1-min interval = 1,440 rows/site/day). Add a daily cleanup task that deletes rows older than the user's tier retention window, or roll up to hourly aggregates after 7 days.

---

## Backend

- New module `uptime.py`: `check_uptime(url) -> dict` — single HEAD/GET, returns `{status_code, response_ms, is_up}`. Reuse the `User-Agent` header pattern from `audit.py:fetch_page`.
- New Celery task `ping_uptime(schedule_id)` in `tasks.py` (see Celery migration doc). Scheduled via RedBeat at each schedule's `uptime_interval_min`.
- New endpoint `GET /uptime/{schedule_id}` — returns last N checks + uptime % over window. Reuse `require_auth` and the ownership check pattern from `delete_schedule` in `main.py`.

## Alert rules

Reuse the existing alert pipeline (`alerts.py:send_alert`, `should_alert`).

- Alert on **2 consecutive failed checks**, not 1 — avoids flapping false positives from a single transient blip.
- Send a **recovery** notification when a site comes back up, so the alert thread closes cleanly.
- Respect the existing `alert_email` / `alert_threshold` fields on `ScheduledAudit`.

## Frontend

- `api.js`: add `getUptime(scheduleId)`.
- Dashboard: live status dot per monitored site (green up / red down) + uptime % (last 24h / 7d) + latency sparkline.

---

## Cost model

Uptime pinging at 1-min intervals, including Redis + Postgres + bandwidth:

| Scale | Pings/hr | Extra monthly cost |
|---|---|---|
| 100 users × 1 site | 6,000 | ~$5–10 |
| 1K users × 1 site | 60,000 | ~$30–50 |
| 10K users × 3 sites | 1.8M | ~$80–150 |

Compare to making *full audits* hourly at 10K users × 3 sites: ~$800–2,000/mo. The hybrid is ~10× cheaper for the real-time signal buyers actually want.

---

## What NOT to build

- **Don't** increase full-audit frequency below 6h. Wasteful and expensive; the real-time need is served by the pinger.
- **Don't** ping faster than 1 min on lower tiers — gate sub-5-min intervals to Business tier (see [pricing-tiers.md](pricing-tiers.md)).
- **Don't** store every ping forever — apply retention/rollup from day one.
