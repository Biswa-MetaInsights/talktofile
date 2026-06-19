import asyncio
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect, Request
from core.auth import get_current_user, resolve_ws_user
from core.session_store import session_store
from core.config import get_settings
from core.ratelimit import limiter
from models.schemas import SessionInfo, DocumentInfo
from agents.orchestrator import run_pipeline, PipelineStage

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
    WebSocket pipeline. Client connects after upload, then sends each file's bytes
    (in the order returned by /upload) as binary messages. Server streams progress.
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

    expected = getattr(session, "_pending_filenames", None) or []
    if not expected:
        await websocket.close(code=4000)
        return

    await websocket.accept(subprotocol=ws_subprotocol(websocket))

    # Receive each file's bytes in order, enforcing the per-file size cap so a
    # malicious client can't stream an unbounded payload over the socket.
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
