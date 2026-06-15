"""SQLAlchemy ORM models — persisted application data.

Note: uploaded documents and chat content are intentionally NOT stored here.
Sessions remain memory-only by design (privacy).
"""

from datetime import datetime, timezone
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Link to Supabase auth user (uuid). Null for legacy custom-auth accounts.
    supabase_user_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    username: Mapped[str | None] = mapped_column(String(60), unique=True, index=True, nullable=True)
    # Null when Supabase owns the credentials.
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    plan: Mapped[str] = mapped_column(String(20), default="free", nullable=False)
    persona: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Personal details
    full_name: Mapped[str] = mapped_column(String(200), default="")
    email: Mapped[str] = mapped_column(String(200), default="", index=True)
    phone: Mapped[str] = mapped_column(String(50), default="")

    # Company details (optional)
    company_name: Mapped[str] = mapped_column(String(200), default="")
    company_role: Mapped[str] = mapped_column(String(200), default="")
    company_size: Mapped[str] = mapped_column(String(50), default="")
    industry: Mapped[str] = mapped_column(String(200), default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    subscriptions: Mapped[list["Subscription"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    feedback: Mapped[list["Feedback"]] = relationship(back_populates="user")

    def to_auth_dict(self) -> dict:
        """Shape used throughout auth/routers (mirrors the guest dict)."""
        return {
            "username": self.username,
            "hashed_password": self.hashed_password,
            "plan": self.plan,
            "is_guest": False,
            "persona": self.persona,
            "profile": {
                "full_name": self.full_name,
                "email": self.email,
                "phone": self.phone,
                "company_name": self.company_name,
                "company_role": self.company_role,
                "company_size": self.company_size,
                "industry": self.industry,
            },
        }


class Subscription(Base):
    """Plan lifecycle — ready for real billing later. One active row per user expected."""
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(20), default="pro", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)  # active|cancelled|expired
    provider: Mapped[str] = mapped_column(String(40), default="manual")  # stripe|manual|...
    provider_ref: Mapped[str] = mapped_column(String(120), default="")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship(back_populates="subscriptions")


class UsageEvent(Base):
    """Lightweight analytics — one row per upload / question. No document content stored."""
    __tablename__ = "usage_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    username: Mapped[str] = mapped_column(String(60), default="", index=True)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)  # upload|question
    detail: Mapped[str] = mapped_column(String(255), default="")  # e.g. "compare, 2 files" / "q_len=42"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, index=True)


class MessageFeedback(Base):
    """Thumbs up/down on an individual Sage answer."""
    __tablename__ = "message_feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    username: Mapped[str] = mapped_column(String(60), default="", index=True)
    session_id: Mapped[str] = mapped_column(String(64), default="", index=True)
    vote: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 = up, -1 = down
    question: Mapped[str] = mapped_column(Text, default="")
    answer_excerpt: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Nullable: guests may also leave feedback (we store the username string too).
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    username: Mapped[str] = mapped_column(String(60), default="", index=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-5
    category: Mapped[str] = mapped_column(String(30), default="general")  # general|bug|feature|praise
    message: Mapped[str] = mapped_column(Text, nullable=False)
    context: Mapped[str] = mapped_column(String(255), default="")  # e.g. "compare mode, 2 files"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    user: Mapped["User | None"] = relationship(back_populates="feedback")
