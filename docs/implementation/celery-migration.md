# Implementation — APScheduler → Celery + Redis Migration

**Status:** Planned
**Why this matters:** required before [Live Monitoring](../feature-plans/live-monitoring.md) and any real production load.

---

## Why migrate

The current scheduler (`scheduler.py`) runs `APScheduler.BackgroundScheduler` **in-process** with the FastAPI/uvicorn app:

- Default thread pool ~10 jobs. A full audit takes 10–80s of wall time (network-bound, see `audit.py:fetch_page`). At ~100 concurrent scheduled audits the pool saturates and jobs fall behind schedule.
- Audit execution shares the web process — a slow audit competes with serving HTTP requests.
- SQLite (`database.py` default) has write contention under concurrent writers.
- No retries, no dead-letter handling, no horizontal scaling.

This is fine for a hackathon, not for a real product. (See [project stage note] — SATsec is past hackathon stage.)

## Architecture after migration

| Process | Command | Role |
|---|---|---|
| Web | `uvicorn main:app` | HTTP API only — no scheduler |
| Worker | `celery -A celery_app worker` | runs audit + uptime tasks |
| Beat | `celery -A celery_app beat -S redbeat.RedBeatScheduler` | fires scheduled jobs |
| Redis | managed service | broker + result backend + RedBeat store |
| Postgres | RDS | data (replaces SQLite in prod — already supported in `database.py`) |

RedBeat (Redis-backed beat scheduler) is used instead of the default file-based beat so schedules survive restarts and multiple beat replicas coordinate through Redis.

---

## New files

**`celery_app.py`**
```python
import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery("satsec", broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.update(
    task_track_started=True,
    task_time_limit=120,          # hard-kill an audit after 120s
    task_soft_time_limit=90,
    worker_prefetch_multiplier=1, # long I/O tasks → don't hoard
    redbeat_redis_url=REDIS_URL,
)
```

**`tasks.py`** — wrap existing logic, don't rewrite it:
```python
from celery_app import celery_app
from audit import run_audit
from uptime import check_uptime
# ... persist results using existing database.py session pattern

@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def run_audit_task(self, url, schedule_id=None):
    # reuse main.run_scheduled_audit body
    ...

@celery_app.task
def ping_uptime_task(schedule_id):
    # reuse uptime.check_uptime + persist UptimeCheck
    ...
```

## Modified files

- **`scheduler.py`** — replace APScheduler add/remove with RedBeat entry create/delete (`redbeat.RedBeatSchedulerEntry`). Keep the same public function names (`add_scheduled_audit`, `remove_scheduled_audit`) so `main.py` call sites barely change.
- **`main.py`** —
  - `POST /audit`: enqueue `run_audit_task.delay(url)`, return `202 {task_id}` instead of blocking. (Guests can keep the synchronous path if simpler — decide per UX.)
  - New `GET /audit/status/{task_id}`: return Celery `AsyncResult` state + result when ready.
  - Remove `@app.on_event("startup") start_scheduler()` and the in-process restore loop — Beat owns scheduling now.
- **`requirements.txt`** — add `celery[redis]>=5.3`, `redis>=5.0`, `celery-redbeat>=2.2`; remove `APScheduler==3.11.2`, `tzlocal==5.3.1`.
- **`.env.example`** — add `REDIS_URL=redis://localhost:6379/0`.

## Frontend changes

Current `Scanning.jsx` calls `runAudit(url)` and waits for the full result inline. Move to polling:

- `api.js`: keep `runAudit` (now returns `{task_id}`), add `pollAuditStatus(taskId)`.
- `Scanning.jsx`: on mount, kick off audit → get `task_id` → poll `/audit/status/{task_id}` every ~2s until `SUCCESS`/`FAILURE`. The existing progress animation already decouples UI from the real call, so this is a small change to the `useEffect` that currently sets `apiResult`.

---

## Migration order (safe, incremental)

1. Stand up Redis locally. Add `celery_app.py` + `tasks.py`. Run a worker — verify `run_audit_task.delay()` works end-to-end while the old APScheduler path still runs.
2. Switch `POST /audit` to enqueue + add status endpoint. Update frontend to poll.
3. Move scheduling to RedBeat + Beat process. Remove APScheduler.
4. Flip prod `DATABASE_URL` to RDS Postgres (code already supports it — `database.py:8`).

## Docker / deploy

Production now needs **three** containers from the same image (web / worker / beat) plus a Redis service. Update [deployment.md](deployment.md):
- web: existing `CMD ["uvicorn", "main:app", ...]`
- worker: `CMD ["celery", "-A", "celery_app", "worker", "--concurrency=8"]`
- beat: `CMD ["celery", "-A", "celery_app", "beat", "-S", "redbeat.RedBeatScheduler"]`
- Scale workers horizontally as queue depth grows; web and beat stay at 1+ (beat must be singleton or use RedBeat locking).

---

## Verification

- Local: enqueue an audit, confirm worker logs pick it up, status endpoint returns the result.
- Schedule a 1-min RedBeat entry, confirm Beat fires it and a row lands in `audit_results`.
- Kill the worker mid-task → confirm retry fires (max_retries=2).
- Load test: enqueue 200 audits, confirm web process stays responsive (the whole point of the migration).
