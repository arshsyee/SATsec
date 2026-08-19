from sqlalchemy import create_engine, Integer, Column, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import declarative_base, Session
from sqlalchemy import text
import datetime
import os

# Use DATABASE_URL from environment (RDS on prod, SQLite for local dev)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./satsec.db")

# connect_args is SQLite-specific — not valid for PostgreSQL
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id             = Column(Integer, primary_key=True, index=True)
    username       = Column(String, unique=True, index=True, nullable=False)
    email          = Column(String, unique=True, index=True, nullable=False)
    password_hash  = Column(String, nullable=False)
    email_verified = Column(Integer, default=0)
    created_at     = Column(DateTime, default=datetime.datetime.utcnow)


class OtpCode(Base):
    __tablename__ = "otp_codes"
    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    code       = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used       = Column(Integer, default=0)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    token      = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used       = Column(Integer, default=0)


class AuditResult(Base):
    __tablename__ = "audit_results"
    id                  = Column(Integer, primary_key=True, index=True)
    url                 = Column(String, index=True)
    performance_score   = Column(Float)
    seo_score           = Column(Float)
    accessibility_score = Column(Float)
    security_score      = Column(Float)
    overall_score       = Column(Float)
    issues              = Column(Text)
    ai_summary          = Column(Text)
    created_at          = Column(DateTime, default=datetime.datetime.utcnow)
    user_id             = Column(Integer, ForeignKey("users.id"), nullable=True)
    session_id          = Column(String, nullable=True)


class ScheduledAudit(Base):
    __tablename__ = "scheduled_audits"
    id              = Column(Integer, primary_key=True, index=True)
    url             = Column(String, index=True)
    interval_hours  = Column(Integer, default=6)
    alert_email     = Column(String, nullable=True)
    alert_threshold = Column(Float, default=70.0)
    webhook_url     = Column(String, nullable=True)
    is_active       = Column(Integer, default=1)
    created_at      = Column(DateTime, default=datetime.datetime.utcnow)
    last_run_at     = Column(DateTime, nullable=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=True)


# Create new tables (skips existing ones)
Base.metadata.create_all(engine)


# Migrate existing tables — safely adds new columns if they don't exist yet
def _migrate():
    migrations = [
        "ALTER TABLE audit_results ADD COLUMN user_id INTEGER NULL",
        "ALTER TABLE audit_results ADD COLUMN session_id TEXT NULL",
        "ALTER TABLE scheduled_audits ADD COLUMN user_id INTEGER NULL",
        "ALTER TABLE scheduled_audits ADD COLUMN webhook_url TEXT NULL",
        "ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # column already exists — skip silently

_migrate()


def get_session():
    return Session(engine)
