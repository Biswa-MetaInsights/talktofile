import time
import uuid
from dataclasses import dataclass, field
from typing import Optional, Any
import numpy as np

# In-memory documents/embeddings can be large; bound them so a flood of uploads
# can't exhaust RAM.
SESSION_TTL_SECONDS = 2 * 60 * 60   # evict sessions idle > 2 hours
MAX_SESSIONS = 500                  # hard cap; oldest evicted beyond this


@dataclass
class DocumentData:
    """A single analysed document within a session."""
    filename: str
    original_language: str = "en"
    chunks: list[str] = field(default_factory=list)
    embeddings: Optional[np.ndarray] = None
    index: Any = None  # faiss.IndexFlatIP
    summary: str = ""
    # Raw extracted text kept for table/numeric questions (e.g. Excel calculations).
    raw_text: str = ""
    is_tabular: bool = False


@dataclass
class DocumentSession:
    session_id: str
    username: str
    documents: list[DocumentData] = field(default_factory=list)
    suggested_questions: list[str] = field(default_factory=list)
    chat_history: list[dict] = field(default_factory=list)
    ready: bool = False
    stopped: bool = False
    created_at: float = field(default_factory=time.time)
    last_active: float = field(default_factory=time.time)

    @property
    def mode(self) -> str:
        n = len(self.documents)
        if n <= 1:
            return "single"
        if n == 2:
            return "compare"
        return "multi"

    @property
    def filenames(self) -> list[str]:
        return [d.filename for d in self.documents]


class SessionStore:
    def __init__(self):
        self._sessions: dict[str, DocumentSession] = {}

    def _evict(self) -> None:
        """Drop idle sessions, then enforce the hard cap (oldest-first)."""
        now = time.time()
        for sid in [s for s, sess in self._sessions.items()
                    if now - sess.last_active > SESSION_TTL_SECONDS]:
            self._sessions.pop(sid, None)
        if len(self._sessions) > MAX_SESSIONS:
            for sid, _ in sorted(self._sessions.items(), key=lambda kv: kv[1].last_active)[
                : len(self._sessions) - MAX_SESSIONS
            ]:
                self._sessions.pop(sid, None)

    def create(self, username: str) -> DocumentSession:
        self._evict()
        session_id = str(uuid.uuid4())
        session = DocumentSession(session_id=session_id, username=username)
        self._sessions[session_id] = session
        return session

    def get(self, session_id: str) -> Optional[DocumentSession]:
        session = self._sessions.get(session_id)
        if session:
            session.last_active = time.time()
        return session

    def delete(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)

    def get_by_user(self, username: str) -> list[DocumentSession]:
        return [s for s in self._sessions.values() if s.username == username]


session_store = SessionStore()
