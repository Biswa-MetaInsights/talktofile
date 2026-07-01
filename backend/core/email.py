"""Transactional email.

Deliberately thin and provider-agnostic: a single ``send_email()`` entry point
backed by the Resend HTTP API in production. When no ``RESEND_API_KEY`` is set
(local dev / unconfigured) it does NOT fail — it logs the message (including any
link) so flows like password reset stay fully testable without sending real
mail. Swap in SMTP/SendGrid later behind the same signature.
"""

import logging

import httpx

from core.config import get_settings

logger = logging.getLogger("talktofile.email")


def send_email(to: str, subject: str, html: str, text: str = "") -> bool:
    """Send one email. Returns True if handed to the provider, False otherwise.

    A False return is not necessarily an error — in dev (no API key) we log the
    content and return False. Callers treat sending as best-effort.
    """
    settings = get_settings()
    key = settings.resend_api_key
    if not key:
        logger.warning(
            "EMAIL NOT SENT (no RESEND_API_KEY) -> to=%s subject=%s\n%s",
            to, subject, text or html,
        )
        return False
    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {key}"},
            json={
                "from": settings.email_from,
                "to": [to],
                "subject": subject,
                "html": html,
                "text": text or None,
            },
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except Exception as e:  # noqa: BLE001 — never let email failure break the request
        logger.error("Failed to send email to %s: %s", to, e)
        return False


def send_password_reset_email(to: str, reset_link: str, ttl_minutes: int) -> bool:
    """Send the password-reset email with the one-time link."""
    subject = "Reset your TalkToFile password"
    text = (
        "We received a request to reset your TalkToFile password.\n\n"
        f"Open this link to choose a new password (expires in {ttl_minutes} minutes):\n"
        f"{reset_link}\n\n"
        "If you didn't request this, you can safely ignore this email — your "
        "password won't change."
    )
    html = f"""\
<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
  <h2 style="color:#E2611B;margin-bottom:8px">Reset your password</h2>
  <p style="color:#475569;line-height:1.6">
    We received a request to reset your TalkToFile password. Click the button
    below to choose a new one. This link expires in {ttl_minutes} minutes.
  </p>
  <p style="margin:24px 0">
    <a href="{reset_link}"
       style="background:#E2611B;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600;display:inline-block">
      Set a new password
    </a>
  </p>
  <p style="color:#94a3b8;font-size:13px;line-height:1.6">
    If you didn't request this, you can safely ignore this email — your password
    won't change. If the button doesn't work, paste this link into your browser:<br>
    <span style="color:#E2611B;word-break:break-all">{reset_link}</span>
  </p>
</div>"""
    return send_email(to, subject, html, text)
