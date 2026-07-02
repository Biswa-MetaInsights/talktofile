import asyncio
import logging
import re
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect, Request
from pydantic import BaseModel
from core.auth import get_current_user, resolve_ws_user
from core.session_store import session_store
from core.config import get_settings
from core.ratelimit import limiter
from models.schemas import SessionInfo, DocumentInfo
from agents.orchestrator import run_pipeline, PipelineStage

logger = logging.getLogger("talktofile.document")

router = APIRouter(prefix="/document", tags=["document"])

ALLOWED_EXTENSIONS = {
    "pdf", "docx", "txt", "xlsx", "csv", "md", "pptx", "html", "htm", "json",
    # Source-code / plain-text formats — accepted and read as text, not advertised in the UI.
    "py", "c", "h", "cpp", "cc", "cxx", "hpp", "java", "js", "ts", "tsx", "jsx",
    "go", "rs", "rb", "php", "cs", "swift", "kt", "kts", "sql", "sh", "bash",
    "yaml", "yml", "xml", "toml", "ini", "cfg", "css", "scss", "less", "r",
    "pl", "lua", "dart", "scala", "groovy", "bat", "ps1", "tex", "rst", "log",
}
_READ_CHUNK = 1024 * 1024  # 1 MB


async def _read_capped(f: UploadFile, max_bytes: int) -> bytes | None:
    """Read an upload in chunks, returning None if it exceeds max_bytes.

    Avoids loading an unbounded file fully into memory before the size check.
    """
    buf = bytearray()
    while True:
        chunk = await f.read(_READ_CHUNK)
        if not chunk:
            break
        buf.extend(chunk)
        if len(buf) > max_bytes:
            return None
    return bytes(buf)


def _check_extension(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"File type '.{ext}' not supported. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    return ext


@router.post("/upload")
@limiter.limit("30/minute")
async def upload_documents(
    request: Request,
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
):
    settings = get_settings()
    plan = current_user.get("plan", "free")
    max_files, max_mb = settings.limits_for_plan(plan)

    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    # Daily upload cap (cost control)
    from core.usage import count_today
    upload_limit = settings.daily_upload_limit(plan)
    if count_today(current_user["username"], "upload") >= upload_limit:
        raise HTTPException(
            status_code=429,
            detail=(
                f"You've reached today's limit of {upload_limit} uploads on the "
                f"{'Pro' if plan == 'pro' else 'free'} plan. "
                + ("Please try again tomorrow." if plan == "pro"
                   else "Subscribe to Pro for more daily uploads.")
            ),
        )

    if len(files) > max_files:
        if plan == "free":
            raise HTTPException(
                status_code=402,
                detail=(
                    f"Your free plan allows {max_files} file at a time. "
                    "Subscribe to upload up to 5 files and compare them."
                ),
            )
        raise HTTPException(status_code=413, detail=f"Too many files. Max is {max_files}.")

    max_bytes = max_mb * 1024 * 1024
    filenames: list[str] = []
    for f in files:
        _check_extension(f.filename)
        content = await _read_capped(f, max_bytes)
        if content is None:
            if plan == "free":
                raise HTTPException(
                    status_code=402,
                    detail=(
                        f"'{f.filename}' exceeds the free plan limit of {max_mb}MB per file. "
                        "Subscribe to upload files up to 8MB."
                    ),
                )
            raise HTTPException(
                status_code=413,
                detail=f"'{f.filename}' is too large. Max size is {max_mb}MB per file.",
            )
        filenames.append(f.filename)

    session = session_store.create(current_user["username"])
    # Stash the accepted filenames so the process WS knows what to expect.
    session._pending_filenames = filenames  # type: ignore[attr-defined]

    from core.usage import log_usage
    log_usage(current_user["username"], "upload", f"{len(filenames)} file(s), plan={plan}")

    return {"session_id": session.session_id, "filenames": filenames, "status": "processing"}


@router.websocket("/process/{session_id}")
async def process_document_ws(websocket: WebSocket, session_id: str):
    """
    WebSocket pipeline. For file uploads the client sends each file's bytes as binary
    messages. For URL sessions (created via /url) no binary data is expected — the
    content is already stored in the session.
    """
    from core.auth import get_ws_token, ws_subprotocol, ws_origin_allowed

    if not ws_origin_allowed(websocket):
        await websocket.close(code=4403)
        return

    token = get_ws_token(websocket)
    user = resolve_ws_user(token) if token else None
    if not user:
        await websocket.close(code=4001)
        return
    username = user["username"]

    session = session_store.get(session_id)
    if not session or session.username != username:
        await websocket.close(code=4004)
        return

    # URL sessions have pre-loaded content; file sessions need binary data sent.
    url_data: list[tuple[str, bytes]] | None = getattr(session, "_pending_url_data", None)
    expected = getattr(session, "_pending_filenames", None) or []
    if not url_data and not expected:
        await websocket.close(code=4000)
        return

    await websocket.accept(subprotocol=ws_subprotocol(websocket))

    if url_data:
        # URL session — content already extracted, skip binary receive.
        files = url_data
    else:
        # File upload session — receive each file's bytes in order.
        settings = get_settings()
        _, max_mb = settings.limits_for_plan(user.get("plan", "free"))
        max_bytes = max_mb * 1024 * 1024
        files: list[tuple[str, bytes]] = []
        try:
            for name in expected:
                data = await asyncio.wait_for(websocket.receive_bytes(), timeout=60)
                if len(data) > max_bytes:
                    await websocket.send_json({"stage": "error", "message": f"'{name}' exceeds the {max_mb}MB limit."})
                    await websocket.close()
                    session_store.delete(session_id)
                    return
                files.append((name, data))
        except asyncio.TimeoutError:
            await websocket.send_json({"stage": "error", "message": "Timeout waiting for file upload"})
            await websocket.close()
            return
        except WebSocketDisconnect:
            return

    async def on_progress(stage: PipelineStage, message: str):
        await websocket.send_json({"stage": stage.value, "message": message})

    try:
        await run_pipeline(session, files, on_progress)
        await websocket.send_json({
            "stage": "ready",
            "mode": session.mode,
            "suggested_questions": session.suggested_questions,
            "documents": [
                {
                    "filename": d.filename,
                    "original_language": d.original_language,
                    "summary": d.summary,
                }
                for d in session.documents
            ],
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Pipeline already emitted an 'error' stage; ensure session is cleaned up.
        session_store.delete(session_id)
    finally:
        await websocket.close()


@router.get("/{session_id}", response_model=SessionInfo)
async def get_session_info(session_id: str, current_user: dict = Depends(get_current_user)):
    session = session_store.get(session_id)
    if not session or session.username != current_user["username"]:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionInfo(
        session_id=session.session_id,
        documents=[
            DocumentInfo(filename=d.filename, original_language=d.original_language, summary=d.summary)
            for d in session.documents
        ],
        mode=session.mode,
        suggested_questions=session.suggested_questions,
        ready=session.ready,
    )


@router.delete("/{session_id}")
async def delete_session(session_id: str, current_user: dict = Depends(get_current_user)):
    session = session_store.get(session_id)
    if not session or session.username != current_user["username"]:
        raise HTTPException(status_code=404, detail="Session not found")
    session_store.delete(session_id)
    return {"message": "Session cleared"}


class RemoveFileRequest(BaseModel):
    filename: str


@router.post("/{session_id}/remove-file", response_model=SessionInfo)
async def remove_file(
    session_id: str,
    body: RemoveFileRequest,
    current_user: dict = Depends(get_current_user),
):
    """Drop a single document from a ready multi-file session.

    The surviving documents keep their already-built FAISS indexes — nothing is
    re-extracted or re-embedded. Only the suggested questions are refreshed for the
    new document set (the session mode is derived from the document count, so it
    updates on its own). To clear the last document, use DELETE /document/{id}.
    """
    session = session_store.get(session_id)
    if not session or session.username != current_user["username"]:
        raise HTTPException(status_code=404, detail="Session not found")

    idx = next((i for i, d in enumerate(session.documents) if d.filename == body.filename), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"'{body.filename}' is not part of this session.")
    if len(session.documents) <= 1:
        raise HTTPException(
            status_code=400,
            detail="Can't remove the only document — clear the session instead.",
        )

    session.documents.pop(idx)

    # Refresh suggested questions for the new set. Best-effort: a failure here must
    # not undo the removal, so we keep the (now slightly stale) old suggestions.
    try:
        from openai import AsyncOpenAI
        from agents.analyst_agent import (
            generate_suggested_questions,
            generate_multi_doc_questions,
            summary_to_text,
        )
        client = AsyncOpenAI(api_key=get_settings().openai_api_key)
        if len(session.documents) == 1:
            session.suggested_questions = await generate_suggested_questions(
                session.documents[0].raw_text, client
            )
        else:
            summaries = [(d.filename, summary_to_text(d.summary)) for d in session.documents]
            session.suggested_questions = await generate_multi_doc_questions(
                summaries, session.mode, client
            )
    except Exception:
        import traceback
        traceback.print_exc()

    return SessionInfo(
        session_id=session.session_id,
        documents=[
            DocumentInfo(filename=d.filename, original_language=d.original_language, summary=d.summary)
            for d in session.documents
        ],
        mode=session.mode,
        suggested_questions=session.suggested_questions,
        ready=session.ready,
    )


# ── URL ingestion ─────────────────────────────────────────────────────────────

class URLIngestRequest(BaseModel):
    url: str


_YOUTUBE_RE = re.compile(
    r"(?:youtube\.com/watch\?.*v=|youtu\.be/)([\w\-]{11})", re.IGNORECASE
)


def _extract_video_id(url: str) -> str | None:
    m = _YOUTUBE_RE.search(url)
    return m.group(1) if m else None


def _build_youtube_api():
    """Construct a YouTubeTranscriptApi, routed through YOUTUBE_PROXY when set.

    YouTube blocks transcript requests from datacenter IPs, so production deploys
    need a proxy (see settings.youtube_proxy). Locally the var is unset and we go
    direct. Kept small and import-local so the proxy dep only loads when needed.
    """
    from youtube_transcript_api import YouTubeTranscriptApi

    settings = get_settings()
    if settings.youtube_proxy_enabled:
        from youtube_transcript_api.proxies import GenericProxyConfig

        proxy = settings.youtube_proxy.strip()
        # Route both schemes through the one proxy URL (the common single-proxy case).
        return YouTubeTranscriptApi(proxy_config=GenericProxyConfig(http_url=proxy, https_url=proxy))
    return YouTubeTranscriptApi()


async def _fetch_youtube_transcript(video_id: str) -> tuple[str, str]:
    # youtube-transcript-api 1.x: instance-based API (the old static
    # YouTubeTranscriptApi.get_transcript was removed, and 0.6.x is broken
    # against current YouTube — it returns an empty body / ParseError).
    from youtube_transcript_api import NoTranscriptFound, TranscriptsDisabled
    try:
        fetched = _build_youtube_api().fetch(video_id)
        text = " ".join(entry["text"] for entry in fetched.to_raw_data())
        return text, f"youtube_{video_id}.txt"
    except (NoTranscriptFound, TranscriptsDisabled):
        raise HTTPException(
            status_code=422,
            detail="This YouTube video has no available transcript or captions. "
                   "Only videos with captions enabled can be processed.",
        )
    except Exception as exc:
        # Log the full technical detail server-side; never leak it to the client.
        logger.warning("YouTube transcript fetch failed for %s: %s", video_id, exc, exc_info=True)
        # YouTube blocks transcript requests from many server IPs (esp. cloud hosts).
        # Detect that specific case so we can give a slightly clearer (still generic)
        # message; everything else is a plain "something went wrong".
        blocked = any(k in type(exc).__name__ for k in ("IpBlocked", "RequestBlocked"))
        if blocked:
            raise HTTPException(
                status_code=502,
                detail="Could not fetch this YouTube video's transcript right now. "
                       "Please try again later, or upload the file directly.",
            )
        raise HTTPException(
            status_code=502,
            detail="An unexpected error occurred while processing this YouTube video. "
                   "Please try again, or upload the file directly.",
        )


async def _fetch_webpage_text(url: str) -> tuple[str, str]:
    import httpx
    from bs4 import BeautifulSoup
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
            resp = await client.get(url, headers={"User-Agent": "Talktofile/1.0 (+https://talktofile.com)"})
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            if "text/html" not in content_type and "text/plain" not in content_type:
                raise HTTPException(
                    status_code=422,
                    detail="Only HTML web pages can be fetched. PDFs and other file types must be uploaded directly.",
                )
            html = resp.text
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=422, detail=f"Could not fetch URL (HTTP {exc.response.status_code}).")
    except httpx.RequestError:
        raise HTTPException(status_code=422, detail="Could not reach that URL. Check the address and try again.")

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "nav", "footer", "header", "aside"]):
        tag.decompose()

    # Prefer <article> or <main> for focused content
    main = soup.find("article") or soup.find("main") or soup.find("body") or soup
    text = main.get_text(separator="\n").strip()

    # Derive a human-readable name from the page title or URL
    title_tag = soup.find("title")
    if title_tag and title_tag.string:
        name = re.sub(r"[^a-zA-Z0-9 _\-]", "", title_tag.string.strip())[:60] or "webpage"
    else:
        name = re.sub(r"[^a-zA-Z0-9_\-]", "_", url.split("/")[-1] or "webpage")[:40]

    return text, f"{name}.txt"


@router.post("/url")
@limiter.limit("10/minute")
async def ingest_url(
    request: Request,
    body: URLIngestRequest,
    current_user: dict = Depends(get_current_user),
):
    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    plan = current_user.get("plan", "free")
    settings = get_settings()
    from core.usage import count_today, log_usage
    upload_limit = settings.daily_upload_limit(plan)
    if count_today(current_user["username"], "upload") >= upload_limit:
        raise HTTPException(status_code=429, detail="Daily upload limit reached.")

    video_id = _extract_video_id(url)
    if video_id:
        text, filename = await _fetch_youtube_transcript(video_id)
    else:
        text, filename = await _fetch_webpage_text(url)

    if len(text.strip()) < 100:
        raise HTTPException(
            status_code=422,
            detail="Not enough readable text was found at that URL. Try a different page.",
        )

    session = session_store.create(current_user["username"])
    # Store the pre-extracted text so the process WS skips binary receive.
    session._pending_url_data = [(filename, text.encode("utf-8"))]  # type: ignore[attr-defined]
    session._pending_filenames = [filename]  # type: ignore[attr-defined]

    log_usage(current_user["username"], "upload", f"url={url[:80]}, plan={plan}")
    return {"session_id": session.session_id, "filenames": [filename], "status": "processing"}
