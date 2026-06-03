import boto3
import os
import requests
from botocore.exceptions import ClientError

FROM_EMAIL = os.getenv("VIGIL_FROM_EMAIL", "")
SES_REGION = "us-east-2"


def _send(to_email: str, subject: str, body: str):
    """Send a plain-text email via AWS SES. Auth is handled by the IAM role."""
    if not FROM_EMAIL:
        print("[Vigil] VIGIL_FROM_EMAIL not set — skipping email")
        return
    try:
        client = boto3.client("ses", region_name=SES_REGION)
        client.send_email(
            Source=FROM_EMAIL,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body":    {"Text": {"Data": body,    "Charset": "UTF-8"}},
            },
        )
        print(f"[Vigil] Email sent to {to_email} — {subject}")
    except ClientError as e:
        print(f"[Vigil] SES send failed: {e.response['Error']['Message']}")
    except Exception as e:
        print(f"[Vigil] SES send failed: {e}")


def send_alert(to_email: str, url: str, scores: dict, issues: list):
    """Sends an email alert when a score drops below the threshold."""
    subject = f"Vigil Alert: Score drop detected on {url}"

    score_lines = "\n".join([
        f"  • Performance:   {scores['performance']}/100",
        f"  • SEO:           {scores['seo']}/100",
        f"  • Accessibility: {scores['accessibility']}/100",
        f"  • Security:      {scores['security']}/100",
        f"  • Overall:       {scores['overall']}/100",
    ])

    issue_lines = "\n".join([f"  - {issue}" for issue in issues[:10]])
    if len(issues) > 10:
        issue_lines += f"\n  ... and {len(issues) - 10} more issues"

    body = f"""Vigil has detected issues on a monitored site.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Site: {url}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current Scores:
{score_lines}

Issues Found:
{issue_lines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This alert was sent automatically by Vigil.
Always watching. Always reporting."""

    _send(to_email, subject, body)


def send_reset_email(to_email: str, username: str, reset_url: str):
    """Sends a password reset link to the user."""
    subject = "Vigil — Password Reset Request"
    body = f"""Hi {username},

You requested a password reset for your Vigil account.

Click the link below to reset your password (expires in 1 hour):
{reset_url}

If you didn't request this, you can safely ignore this email.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Vigil — Always watching. Always reporting."""

    _send(to_email, subject, body)


def send_otp_email(to_email: str, username: str, otp_code: str):
    """Sends an OTP verification code to the user's email."""
    subject = "Vigil — Verify your email"
    body = f"""Hi {username},

Your Vigil verification code is:

    {otp_code}

This code expires in 10 minutes. Enter it on the verification page to activate your account.

If you didn't create a Vigil account, you can safely ignore this email.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Vigil — Always watching. Always reporting."""

    _send(to_email, subject, body)


def send_welcome_email(to_email: str, username: str):
    """Sends a welcome email once a user's account is verified and active."""
    subject = "Welcome to SATsec — your site is now under surveillance"
    body = f"""Hi {username},

Welcome to SATsec! Your account is verified and ready to go.

Here's how to get the most out of it:

  1. Run an audit — paste any URL to get Performance, SEO, Accessibility,
     and Security scores in seconds.
  2. Schedule monitoring — let SATsec re-audit your sites every 6 hours,
     daily, or weekly, automatically.
  3. Set alerts — get emailed the moment a score drops below your threshold,
     with a plain-English explanation of what changed.
  4. Track trends — the dashboard shows score history so you can pinpoint
     exactly when a deploy broke your site.

Run your first audit: {os.getenv("FRONTEND_URL", "https://satsec.app")}

Always watching. Always reporting.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The SATsec Team"""

    _send(to_email, subject, body)


def send_webhook(webhook_url: str, payload: dict):
    """POST a score-drop event to a user-configured webhook (Slack-compatible
    JSON). Best-effort: never raises, so a bad URL can't break the scheduler."""
    try:
        requests.post(webhook_url, json=payload, timeout=10)
    except Exception as e:
        print(f"[Vigil] Webhook delivery failed: {e}")


def should_alert(scores: dict, threshold: float) -> bool:
    """Returns True if any individual score is below the threshold."""
    return any(
        v < threshold
        for k, v in scores.items()
        if k != "overall"
    )
