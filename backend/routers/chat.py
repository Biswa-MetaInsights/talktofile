import json
import time
import asyncio
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from core.auth import get_current_user
from core.session_store import session_store
from core.config import get_settings
from models.schemas import ChatMessage
from agents.guard_agent import guard_check
from agents.sage_agent import get_streaming_answer

router = APIRouter(prefix="/chat", tags=["chat"])


@router.websocket("/{session_id}")
async def chat_ws(websocket: WebSocket, session_id: str):
    """
    Streaming chat WebSocket.
    Protocol:
      Client → {"question": "..."}
      Server → {"type": "token", "content": "..."} (repeated)
      Server → {"type": "done"}
      Server → {"type": "guard_reject", "content": "..."}
      Server → {"type": "error", "content": "..."}
    """
    from core.auth import resolve_ws_user, get_ws_token, ws_subprotocol, ws_origin_allowed

    if not ws_origin_allowed(websocket):
        await websocket.close(code=4403)
        return

    token = get_ws_token(websocket)
    user = resolve_ws_user(token) if token else None
    if not user:
        await websocket.close(code=4001)
        return

    username = user["username"]
    persona = user.get("persona")
    plan = user.get("plan", "free")

    session = session_store.get(session_id)
    if not session or session.username != username:
        await websocket.close(code=4004)
        return

    if not session.ready:
        await websocket.close(code=4003)
        return

    await websocket.accept(subprotocol=ws_subprotocol(websocket))

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                question = data.get("question", "").strip()
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "content": "Invalid message format"})
                continue

            if not question:
                continue

            # Keep the session fresh so an actively-used chat is never evicted by
            # the idle TTL while the user is still talking to it.
            session.last_active = time.time()

            if len(question) > 4000:
                await websocket.send_json({"type": "error", "content": "Message too long"})
                continue

            # Daily cost cap — reject before spending an OpenAI call.
            from core.usage import log_usage, count_today
            limit = get_settings().daily_question_limit(plan)
            if count_today(username, "question") >= limit:
                await websocket.send_json({
                    "type": "limit",
                    "content": (
                        f"You've reached today's limit of {limit} questions on the "
                        f"{'Pro' if plan == 'pro' else 'free'} plan. "
                        + ("Please try again tomorrow." if plan == "pro"
                           else "Subscribe to Pro for a much higher daily limit.")
                    ),
                })
                continue

            log_usage(username, "question", f"q_len={len(question)}, docs={len(session.documents)}")

            # Guard check
            is_safe, rejection = await guard_check(question)
            if not is_safe:
                await websocket.send_json({"type": "guard_reject", "content": rejection})
                continue

            # Stream answer from Sage
            full_response = []
            try:
                async for token_text in get_streaming_answer(
                    question, session.documents, session.chat_history, persona
                ):
                    await websocket.send_json({"type": "token", "content": token_text})
                    full_response.append(token_text)

                complete_answer = "".join(full_response)
                session.chat_history.append({"role": "user", "content": question})
                session.chat_history.append({"role": "assistant", "content": complete_answer})

                # Keep history bounded
                if len(session.chat_history) > 40:
                    session.chat_history = session.chat_history[-40:]

                await websocket.send_json({"type": "done"})

                # Every 5 completed Q&A exchanges, ask for session feedback.
                q_count = len(session.chat_history) // 2
                if q_count > 0 and q_count % 5 == 0:
                    await websocket.send_json({"type": "feedback_prompt"})

            except Exception as e:
                await websocket.send_json({"type": "error", "content": "An error occurred generating the response"})

    except WebSocketDisconnect:
        pass
