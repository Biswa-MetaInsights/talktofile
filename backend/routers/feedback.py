from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from core.db import get_db
from core.ratelimit import limiter
from core.auth import get_current_user, _db_user
from models.schemas import FeedbackRequest, MessageFeedbackRequest
from models.db_models import Feedback, MessageFeedback

router = APIRouter(prefix="/feedback", tags=["feedback"])


def _user_id(db: Session, current_user: dict):
    if current_user.get("is_guest"):
        return None
    u = _db_user(db, current_user["username"])
    return u.id if u else None


@router.post("")
@limiter.limit("20/minute")
async def submit_feedback(
    request: Request,
    body: FeedbackRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Store user feedback. Works for both guests and registered users."""
    fb = Feedback(
        user_id=_user_id(db, current_user),
        username=current_user["username"],
        rating=body.rating,
        category=body.category,
        message=body.message,
        context=body.context,
    )
    db.add(fb)
    db.commit()
    return {"message": "Thanks for your feedback!"}


@router.post("/message")
@limiter.limit("60/minute")
async def submit_message_feedback(
    request: Request,
    body: MessageFeedbackRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record a thumbs up/down on a single Sage answer."""
    db.add(MessageFeedback(
        user_id=_user_id(db, current_user),
        username=current_user["username"],
        session_id=body.session_id,
        vote=body.vote,
        question=body.question,
        answer_excerpt=body.answer_excerpt,
    ))
    db.commit()
    return {"message": "Recorded"}
