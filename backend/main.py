from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import json
import os
import datetime
import random
from dotenv import load_dotenv

load_dotenv()

from database import get_session, AuditResult, ScheduledAudit, User, PasswordResetToken, OtpCode
from audit import run_audit
from alerts import send_alert, should_alert, send_reset_email, send_otp_email
from scheduler import start_scheduler, add_scheduled_audit, remove_scheduled_audit, list_scheduled_jobs
import auth as auth_utils

# ─────────────────────────────────────────
# APP SETUP
# ─────────────────────────────────────────

app = FastAPI(
    title="SATsec",
    description="Website performance, SEO, accessibility, and security audits.",
    version="1.0.0"
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Build allowed origins from FRONTEND_URL plus local dev origins.
# IMPORTANT: allow_origins must never be ["*"] when allow_credentials=True —
# browsers reject that combination and omit the CORS header entirely.
_allowed_origins = list({FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Catch-all handler so unhandled server errors are returned as a proper
    JSON response that travels through the CORS middleware's send wrapper.
    Without this, Starlette's ServerErrorMiddleware intercepts the exception
    before CORS headers are applied, causing browsers to report a CORS error
    instead of the actual 500.
    """
    print(f"[Vigil] Unhandled error on {request.method} {request.url.path}: "
          f"{type(exc).__name__}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ─────────────────────────────────────────
# REQUEST MODELS
# ─────────────────────────────────────────

class AuditRequest(BaseModel):
    url: str

class ScheduleRequest(BaseModel):
    url: str
    interval_hours: int = 6
    alert_email: Optional[str] = None
    alert_threshold: float = 70.0

class SignupRequest(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    identifier: str   # username OR email
    password: str

class ForgotPasswordRequest(BaseModel):
    identifier: str   # username OR email

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class VerifyOtpRequest(BaseModel):
    user_id: int
    code: str

class ResendOtpRequest(BaseModel):
    user_id: int

class ImportAuditItem(BaseModel):
    url: str
    scores: dict
    issues_flat: List[str] = []
    ai_summary: Optional[str] = None
    created_at: Optional[str] = None

class ImportAuditsRequest(BaseModel):
    audits: List[ImportAuditItem]


# ─────────────────────────────────────────
# IDENTITY RESOLUTION
# ─────────────────────────────────────────

def get_identity(request: Request) -> dict:
    """
    Resolves caller identity from request headers.
    Returns {"user_id": int|None, "session_id": str|None}
    Priority: Bearer JWT > X-Session-ID header
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        payload = auth_utils.decode_access_token(token)
        if payload:
            return {"user_id": int(payload["sub"]), "session_id": None}

    session_id = request.headers.get("X-Session-ID")
    return {"user_id": None, "session_id": session_id}


def require_auth(identity: dict = Depends(get_identity)) -> dict:
    """Raises 401 if caller is not logged in."""
    if not identity["user_id"]:
        raise HTTPException(status_code=401, detail="Login required")
    return identity


# ─────────────────────────────────────────
# AI SUMMARY GENERATOR
# ─────────────────────────────────────────

def generate_ai_summary(url: str, scores: dict, issues: list) -> str:
    return "AI summary coming soon."


# ─────────────────────────────────────────
# AUTH ROUTES
# ─────────────────────────────────────────

def _generate_otp() -> str:
    return f"{random.randint(0, 999999):06d}"


def _create_otp(session, user_id: int) -> str:
    """Invalidate old OTPs, generate a new one, persist it, return the code."""
    session.query(OtpCode).filter(OtpCode.user_id == user_id, OtpCode.used == 0).update({"used": 1})
    code = _generate_otp()
    otp = OtpCode(
        user_id=user_id,
        code=code,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=10),
    )
    session.add(otp)
    session.commit()
    return code


@app.post("/auth/signup")
def signup(body: SignupRequest):
    username = body.username.strip()
    email    = body.email.strip().lower()
    password = body.password

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    with get_session() as session:
        existing_by_username = session.query(User).filter(User.username == username).first()
        if existing_by_username:
            if existing_by_username.email_verified:
                raise HTTPException(status_code=409, detail="Username already taken")
            # Unverified stale registration — clean it up and allow re-registration.
            # Must delete child rows first to avoid FK constraint errors on PostgreSQL.
            session.query(AuditResult).filter(AuditResult.user_id == existing_by_username.id).delete()
            session.query(OtpCode).filter(OtpCode.user_id == existing_by_username.id).delete()
            session.delete(existing_by_username)
            session.flush()

        existing_by_email = session.query(User).filter(User.email == email).first()
        if existing_by_email:
            if existing_by_email.email_verified:
                raise HTTPException(status_code=409, detail="Email already registered")
            # Unverified stale registration — clean it up and allow re-registration.
            session.query(AuditResult).filter(AuditResult.user_id == existing_by_email.id).delete()
            session.query(OtpCode).filter(OtpCode.user_id == existing_by_email.id).delete()
            session.delete(existing_by_email)
            session.flush()

        user = User(
            username=username,
            email=email,
            password_hash=auth_utils.hash_password(password),
            email_verified=0,
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        code = _create_otp(session, user.id)

    send_otp_email(to_email=email, username=username, otp_code=code)
    return {"user_id": user.id, "email": email, "message": "Verification code sent to your email"}


@app.post("/auth/verify-otp")
def verify_otp(body: VerifyOtpRequest):
    with get_session() as session:
        otp = session.query(OtpCode).filter(
            OtpCode.user_id == body.user_id,
            OtpCode.used == 0,
        ).order_by(OtpCode.id.desc()).first()

        if not otp:
            raise HTTPException(status_code=400, detail="No active verification code found")
        if otp.expires_at < datetime.datetime.utcnow():
            raise HTTPException(status_code=400, detail="Verification code has expired")
        if otp.code != body.code.strip():
            raise HTTPException(status_code=400, detail="Incorrect verification code")

        otp.used = 1
        user = session.query(User).filter(User.id == body.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.email_verified = 1
        session.commit()

        token = auth_utils.create_access_token(user.id, user.username)
        return {"token": token, "user": {"id": user.id, "username": user.username, "email": user.email}}


@app.post("/auth/resend-otp")
def resend_otp(body: ResendOtpRequest):
    with get_session() as session:
        user = session.query(User).filter(User.id == body.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if user.email_verified:
            raise HTTPException(status_code=400, detail="Email already verified")

        code = _create_otp(session, user.id)

    send_otp_email(to_email=user.email, username=user.username, otp_code=code)
    return {"message": "New verification code sent"}


@app.post("/auth/login")
def login(body: LoginRequest):
    identifier = body.identifier.strip()
    password   = body.password

    with get_session() as session:
        # Look up by username or email
        user = (
            session.query(User).filter(User.username == identifier).first()
            or session.query(User).filter(User.email == identifier.lower()).first()
        )
        if not user or not auth_utils.verify_password(password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid username/email or password")

        if not user.email_verified:
            # Resend OTP and tell frontend to redirect to verify page
            code = _create_otp(session, user.id)
            send_otp_email(to_email=user.email, username=user.username, otp_code=code)
            raise HTTPException(
                status_code=403,
                detail=f"EMAIL_NOT_VERIFIED:{user.id}:{user.email}"
            )

        token = auth_utils.create_access_token(user.id, user.username)
        return {"token": token, "user": {"id": user.id, "username": user.username, "email": user.email}}


@app.get("/auth/me")
def me(identity: dict = Depends(require_auth)):
    with get_session() as session:
        user = session.query(User).filter(User.id == identity["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {"id": user.id, "username": user.username, "email": user.email}


@app.post("/auth/forgot-password")
def forgot_password(body: ForgotPasswordRequest):
    identifier = body.identifier.strip()

    with get_session() as session:
        user = (
            session.query(User).filter(User.username == identifier).first()
            or session.query(User).filter(User.email == identifier.lower()).first()
        )

        # Always return success to avoid user enumeration
        if not user:
            return {"message": "If that account exists, a reset link has been sent"}

        # Invalidate old tokens
        old_tokens = session.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == 0
        ).all()
        for t in old_tokens:
            t.used = 1

        reset_token = auth_utils.generate_reset_token()
        expires_at  = datetime.datetime.utcnow() + datetime.timedelta(hours=1)

        db_token = PasswordResetToken(
            user_id=user.id,
            token=reset_token,
            expires_at=expires_at
        )
        session.add(db_token)
        session.commit()

        reset_url = f"{FRONTEND_URL}/reset-password?token={reset_token}"
        send_reset_email(to_email=user.email, username=user.username, reset_url=reset_url)

    return {"message": "If that account exists, a reset link has been sent"}


@app.post("/auth/reset-password")
def reset_password(body: ResetPasswordRequest):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    with get_session() as session:
        db_token = session.query(PasswordResetToken).filter(
            PasswordResetToken.token == body.token,
            PasswordResetToken.used == 0
        ).first()

        if not db_token:
            raise HTTPException(status_code=400, detail="Invalid or already-used reset token")
        if db_token.expires_at < datetime.datetime.utcnow():
            raise HTTPException(status_code=400, detail="Reset token has expired")

        user = session.query(User).filter(User.id == db_token.user_id).first()
        if not user:
            raise HTTPException(status_code=400, detail="User not found")

        user.password_hash = auth_utils.hash_password(body.new_password)
        db_token.used = 1
        session.commit()

    return {"message": "Password updated successfully"}


# ─────────────────────────────────────────
# AUDIT ROUTES
# ─────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Vigil is running", "version": "1.0.0"}


@app.post("/audit")
def trigger_audit(request: AuditRequest, identity: dict = Depends(get_identity)):
    url = request.url.strip()
    if not url.startswith("http"):
        url = "https://" + url

    result = run_audit(url)

    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])

    result["ai_summary"] = generate_ai_summary(url, result["scores"], result["issues_flat"])

    # Only persist to DB for authenticated users — guests store results in their browser
    if identity["user_id"]:
        with get_session() as session:
            audit_record = AuditResult(
                url=url,
                performance_score=result["scores"]["performance"],
                seo_score=result["scores"]["seo"],
                accessibility_score=result["scores"]["accessibility"],
                security_score=result["scores"]["security"],
                overall_score=result["scores"]["overall"],
                issues=json.dumps(result["issues_flat"]),
                ai_summary=result["ai_summary"],
                user_id=identity["user_id"],
                session_id=None,
            )
            session.add(audit_record)
            session.commit()
            session.refresh(audit_record)
            result["id"] = audit_record.id
    else:
        result["id"] = None

    return result


@app.post("/audit/import")
def import_audits(request: ImportAuditsRequest, identity: dict = Depends(require_auth)):
    """Import guest audits (stored in browser) into the authenticated user's account."""
    imported = 0
    with get_session() as session:
        for item in request.audits:
            url = item.url.strip()
            if not url.startswith("http"):
                url = "https://" + url

            created_at = datetime.datetime.utcnow()
            if item.created_at:
                try:
                    created_at = datetime.datetime.fromisoformat(item.created_at.replace("Z", "+00:00")).replace(tzinfo=None)
                except Exception:
                    pass

            audit_record = AuditResult(
                url=url,
                performance_score=item.scores.get("performance", 0),
                seo_score=item.scores.get("seo", 0),
                accessibility_score=item.scores.get("accessibility", 0),
                security_score=item.scores.get("security", 0),
                overall_score=item.scores.get("overall", 0),
                issues=json.dumps(item.issues_flat),
                ai_summary=item.ai_summary,
                user_id=identity["user_id"],
                session_id=None,
                created_at=created_at,
            )
            session.add(audit_record)
            imported += 1

        session.commit()

    return {"imported": imported}


@app.get("/history")
def get_history(url: str, limit: int = 20, identity: dict = Depends(get_identity)):
    with get_session() as session:
        query = session.query(AuditResult).filter(AuditResult.url == url)

        if identity["user_id"]:
            query = query.filter(AuditResult.user_id == identity["user_id"])
        elif identity["session_id"]:
            query = query.filter(AuditResult.session_id == identity["session_id"])
        else:
            raise HTTPException(status_code=404, detail=f"No audit history found for {url}")

        records = query.order_by(AuditResult.created_at.desc()).limit(limit).all()

        if not records:
            raise HTTPException(status_code=404, detail=f"No audit history found for {url}")

        return [
            {
                "id": r.id,
                "url": r.url,
                "scores": {
                    "performance": r.performance_score,
                    "seo": r.seo_score,
                    "accessibility": r.accessibility_score,
                    "security": r.security_score,
                    "overall": r.overall_score
                },
                "issues": json.loads(r.issues) if r.issues else [],
                "ai_summary": r.ai_summary,
                "created_at": r.created_at.isoformat()
            }
            for r in records
        ]


@app.get("/audits/recent")
def get_recent_audits(limit: int = 30, identity: dict = Depends(get_identity)):
    with get_session() as session:
        query = session.query(AuditResult)

        if identity["user_id"]:
            query = query.filter(AuditResult.user_id == identity["user_id"])
        elif identity["session_id"]:
            query = query.filter(AuditResult.session_id == identity["session_id"])
        else:
            return []

        records = query.order_by(AuditResult.created_at.desc()).limit(limit).all()
        return [
            {
                "id": r.id,
                "url": r.url,
                "scores": {
                    "performance": r.performance_score,
                    "seo": r.seo_score,
                    "accessibility": r.accessibility_score,
                    "security": r.security_score,
                    "overall": r.overall_score
                },
                "ai_summary": r.ai_summary,
                "created_at": r.created_at.isoformat()
            }
            for r in records
        ]


@app.get("/results/{audit_id}")
def get_result(audit_id: int):
    with get_session() as session:
        record = session.query(AuditResult).filter(AuditResult.id == audit_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="Audit result not found")

        return {
            "id": record.id,
            "url": record.url,
            "scores": {
                "performance": record.performance_score,
                "seo": record.seo_score,
                "accessibility": record.accessibility_score,
                "security": record.security_score,
                "overall": record.overall_score
            },
            "issues": json.loads(record.issues) if record.issues else [],
            "ai_summary": record.ai_summary,
            "created_at": record.created_at.isoformat()
        }


# ─────────────────────────────────────────
# SCHEDULE ROUTES (require login)
# ─────────────────────────────────────────

@app.post("/schedule")
def create_schedule(request: ScheduleRequest, identity: dict = Depends(require_auth)):
    url = request.url.strip()
    if not url.startswith("http"):
        url = "https://" + url

    with get_session() as session:
        scheduled = ScheduledAudit(
            url=url,
            interval_hours=request.interval_hours,
            alert_email=request.alert_email,
            alert_threshold=request.alert_threshold,
            user_id=identity["user_id"],
        )
        session.add(scheduled)
        session.commit()
        session.refresh(scheduled)
        audit_id = scheduled.id

    add_scheduled_audit(
        audit_id=audit_id,
        url=url,
        interval_hours=request.interval_hours,
        run_audit_fn=run_scheduled_audit
    )

    return {
        "message": f"Scheduled audit every {request.interval_hours} hours for {url}",
        "schedule_id": audit_id,
        "next_run_in_hours": request.interval_hours
    }


@app.delete("/schedule/{schedule_id}")
def delete_schedule(schedule_id: int, identity: dict = Depends(require_auth)):
    with get_session() as session:
        scheduled = session.query(ScheduledAudit).filter(
            ScheduledAudit.id == schedule_id,
            ScheduledAudit.user_id == identity["user_id"]
        ).first()
        if not scheduled:
            raise HTTPException(status_code=404, detail="Schedule not found")
        scheduled.is_active = 0
        session.commit()

    remove_scheduled_audit(schedule_id)
    return {"message": f"Schedule #{schedule_id} cancelled"}


@app.get("/schedules")
def list_schedules(identity: dict = Depends(require_auth)):
    with get_session() as session:
        schedules = (
            session.query(ScheduledAudit)
            .filter(ScheduledAudit.is_active == 1, ScheduledAudit.user_id == identity["user_id"])
            .all()
        )
        return [
            {
                "id": s.id,
                "url": s.url,
                "interval_hours": s.interval_hours,
                "alert_email": s.alert_email,
                "alert_threshold": s.alert_threshold,
                "created_at": s.created_at.isoformat(),
                "last_run_at": s.last_run_at.isoformat() if s.last_run_at else None
            }
            for s in schedules
        ]


@app.get("/scheduler/jobs")
def get_scheduler_jobs():
    return list_scheduled_jobs()


# ─────────────────────────────────────────
# SCHEDULED AUDIT RUNNER
# ─────────────────────────────────────────

def run_scheduled_audit(url: str):
    print(f"[Vigil] Running scheduled audit for {url}")

    result = run_audit(url)
    if result.get("error"):
        print(f"[Vigil] Scheduled audit failed for {url}: {result['error']}")
        return

    result["ai_summary"] = generate_ai_summary(url, result["scores"], result["issues_flat"])

    with get_session() as session:
        audit_record = AuditResult(
            url=url,
            performance_score=result["scores"]["performance"],
            seo_score=result["scores"]["seo"],
            accessibility_score=result["scores"]["accessibility"],
            security_score=result["scores"]["security"],
            overall_score=result["scores"]["overall"],
            issues=json.dumps(result["issues_flat"]),
            ai_summary=result["ai_summary"]
        )
        session.add(audit_record)

        schedule = session.query(ScheduledAudit).filter(ScheduledAudit.url == url).first()
        if schedule:
            schedule.last_run_at = datetime.datetime.utcnow()

        session.commit()

    with get_session() as session:
        schedule = session.query(ScheduledAudit).filter(ScheduledAudit.url == url).first()
        if schedule and schedule.alert_email:
            if should_alert(result["scores"], schedule.alert_threshold):
                send_alert(
                    to_email=schedule.alert_email,
                    url=url,
                    scores=result["scores"],
                    issues=result["issues_flat"]
                )


# ─────────────────────────────────────────
# STARTUP / SHUTDOWN
# ─────────────────────────────────────────

@app.on_event("startup")
def startup():
    # Log CORS origins so they can be verified in App Runner logs
    print(f"[Vigil] Allowed CORS origins: {_allowed_origins}")

    if os.getenv("ANTHROPIC_API_KEY"):
        print("[Vigil] ANTHROPIC_API_KEY is set — AI summaries enabled")
    else:
        print("[Vigil] WARNING: ANTHROPIC_API_KEY is not set — AI summaries will be disabled")

    start_scheduler()

    with get_session() as session:
        active_schedules = session.query(ScheduledAudit).filter(ScheduledAudit.is_active == 1).all()
        for s in active_schedules:
            add_scheduled_audit(
                audit_id=s.id,
                url=s.url,
                interval_hours=s.interval_hours,
                run_audit_fn=run_scheduled_audit
            )
        print(f"[Vigil] Restored {len(active_schedules)} scheduled audit(s) from database")


@app.on_event("shutdown")
def shutdown():
    from scheduler import stop_scheduler
    stop_scheduler()
