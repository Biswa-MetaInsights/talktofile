"""
Tools Router — document transformation endpoints.
Flashcards, translation, podcast script, slide generation, and URL ingestion.
"""

import re
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from core.auth import get_current_user
from core.session_store import session_store
from core.config import get_settings
from core.usage import log_usage, count_today

router = APIRouter(prefix="/tools", tags=["tools"])


def _get_ready_session(session_id: str, username: str):
    session = session_store.get(session_id)
    if not session or session.username != username:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.ready:
        raise HTTPException(status_code=400, detail="Session is not ready yet")
    return session


# ── Flashcards ──────────────────────────────────────────────────────────────

@router.post("/flashcards/{session_id}")
async def get_flashcards(session_id: str, current_user: dict = Depends(get_current_user)):
    username = current_user["username"]
    plan = current_user.get("plan", "free")
    session = _get_ready_session(session_id, username)

    # Daily cost cap (shared with question limit)
    settings = get_settings()
    limit = settings.daily_question_limit(plan)
    if count_today(username, "question") >= limit:
        raise HTTPException(status_code=429, detail="Daily limit reached. Please try again tomorrow.")
    log_usage(username, "question", "tool=flashcards")

    from agents.flashcard_agent import generate_flashcards
    cards = await generate_flashcards(session.documents)
    return {"flashcards": cards}


# ── Translation ──────────────────────────────────────────────────────────────

class TranslateRequest(BaseModel):
    target_language: str


@router.post("/translate/{session_id}")
async def translate_document(
    session_id: str,
    body: TranslateRequest,
    current_user: dict = Depends(get_current_user),
):
    username = current_user["username"]
    plan = current_user.get("plan", "free")
    session = _get_ready_session(session_id, username)

    if not body.target_language.strip():
        raise HTTPException(status_code=400, detail="target_language is required")

    settings = get_settings()
    limit = settings.daily_question_limit(plan)
    if count_today(username, "question") >= limit:
        raise HTTPException(status_code=429, detail="Daily limit reached. Please try again tomorrow.")
    log_usage(username, "question", f"tool=translate lang={body.target_language}")

    from agents.translate_agent import translate_document as _translate
    result = await _translate(session.documents, body.target_language)
    return result


# ── Podcast ──────────────────────────────────────────────────────────────────

class ExtendPodcastRequest(BaseModel):
    script: list[dict]
    request: str


@router.post("/podcast/{session_id}/extend")
async def extend_podcast(
    session_id: str,
    body: ExtendPodcastRequest,
    current_user: dict = Depends(get_current_user),
):
    username = current_user["username"]
    plan = current_user.get("plan", "free")
    session = _get_ready_session(session_id, username)

    if not body.request.strip():
        raise HTTPException(status_code=400, detail="request is required")

    settings = get_settings()
    limit = settings.daily_question_limit(plan)
    if count_today(username, "question") >= limit:
        raise HTTPException(status_code=429, detail="Daily limit reached. Please try again tomorrow.")
    log_usage(username, "question", "tool=podcast_extend")

    from agents.podcast_agent import extend_podcast as _extend
    new_lines = await _extend(session.documents, body.script, body.request)
    return {"new_lines": new_lines}


@router.post("/podcast/{session_id}")
async def generate_podcast(session_id: str, current_user: dict = Depends(get_current_user)):
    username = current_user["username"]
    plan = current_user.get("plan", "free")
    session = _get_ready_session(session_id, username)

    settings = get_settings()
    limit = settings.daily_question_limit(plan)
    if count_today(username, "question") >= limit:
        raise HTTPException(status_code=429, detail="Daily limit reached. Please try again tomorrow.")
    log_usage(username, "question", "tool=podcast")

    from agents.podcast_agent import generate_podcast as _podcast
    script = await _podcast(session.documents)
    return {"script": script}


# ── Charts ───────────────────────────────────────────────────────────────────

class ChartRequest(BaseModel):
    chart_type: str


@router.post("/chart/{session_id}")
async def generate_chart(
    session_id: str,
    body: ChartRequest,
    current_user: dict = Depends(get_current_user),
):
    username = current_user["username"]
    plan = current_user.get("plan", "free")
    session = _get_ready_session(session_id, username)

    settings = get_settings()
    limit = settings.daily_question_limit(plan)
    if count_today(username, "question") >= limit:
        raise HTTPException(status_code=429, detail="Daily limit reached. Please try again tomorrow.")
    log_usage(username, "question", f"tool=chart type={body.chart_type}")

    from agents.chart_agent import generate_chart as _chart, CHART_TYPES
    if body.chart_type not in CHART_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid chart type. Choose from: {', '.join(CHART_TYPES)}")

    tabular = [d for d in session.documents if d.is_tabular]
    if not tabular:
        raise HTTPException(
            status_code=422,
            detail="Charts require an Excel (.xlsx) or CSV file with numerical data. No tabular file found in this session.",
        )

    try:
        chart_data = await _chart(session.documents, body.chart_type)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return chart_data


# ── Slides ───────────────────────────────────────────────────────────────────

@router.post("/slides/{session_id}")
async def generate_slides(session_id: str, current_user: dict = Depends(get_current_user)):
    username = current_user["username"]
    plan = current_user.get("plan", "free")

    if plan != "pro":
        raise HTTPException(
            status_code=402,
            detail="Slide generation is a Pro feature. Upgrade to create and download slide decks.",
        )

    session = _get_ready_session(session_id, username)

    settings = get_settings()
    limit = settings.daily_question_limit(plan)
    if count_today(username, "question") >= limit:
        raise HTTPException(status_code=429, detail="Daily limit reached. Please try again tomorrow.")
    log_usage(username, "question", "tool=slides")

    from agents.slide_agent import generate_presentation
    pptx_bytes = await generate_presentation(session.documents)

    filename = session.documents[0].filename.rsplit(".", 1)[0] if session.documents else "presentation"
    safe_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", filename)

    return Response(
        content=pptx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.pptx"'},
    )
