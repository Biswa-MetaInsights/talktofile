"""Usage analytics helper — records lightweight events (uploads, questions).

Safe to call from WebSocket handlers (opens its own short-lived session) and
never raises into the caller: analytics must not break the product.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy import select, func
from core.db import SessionLocal


def count_today(username: str, event_type: str) -> int:
    """How many of this event the user has logged in the last 24h (rolling)."""
    from models.db_models import UsageEvent
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    db = SessionLocal()
    try:
        return db.scalar(
            select(func.count(UsageEvent.id)).where(
                UsageEvent.username == username,
                UsageEvent.event_type == event_type,
                UsageEvent.created_at >= since,
            )
        ) or 0
    finally:
        db.close()


def log_usage(username: str, event_type: str, detail: str = "", user_id: Optional[int] = None) -> None:
    from models.db_models import UsageEvent
    db = SessionLocal()
    try:
        db.add(UsageEvent(
            username=username or "",
            event_type=event_type,
            detail=(detail or "")[:255],
            user_id=user_id,
        ))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
