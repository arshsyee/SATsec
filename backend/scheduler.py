from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import datetime

scheduler = BackgroundScheduler()


def start_scheduler():
    if not scheduler.running:
        scheduler.start()
        print("[SATsec] Scheduler started")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        print("[SATsec] Scheduler stopped")


def add_scheduled_audit(audit_id: int, url: str, interval_hours: int, run_audit_fn):
    """
    Adds a recurring audit job to the scheduler.
    audit_id is used as the job ID so we can remove it later.
    """
    job_id = f"audit_{audit_id}"

    # Remove existing job if it exists (prevents duplicates on server restart)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)

    scheduler.add_job(
        run_audit_fn,
        trigger=IntervalTrigger(hours=interval_hours),
        args=[url],
        id=job_id,
        name=f"SATsec audit: {url}",
        next_run_time=datetime.datetime.now() + datetime.timedelta(hours=interval_hours)
    )

    print(f"[SATsec] Scheduled audit #{audit_id} for {url} every {interval_hours}h")


def remove_scheduled_audit(audit_id: int):
    job_id = f"audit_{audit_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        print(f"[SATsec] Removed scheduled audit #{audit_id}")


def list_scheduled_jobs():
    return [
        {
            "job_id": job.id,
            "name": job.name,
            "next_run": str(job.next_run_time)
        }
        for job in scheduler.get_jobs()
    ]
