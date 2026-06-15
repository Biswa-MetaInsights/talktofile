import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session
from core.config import get_settings
from core.db import get_db, SessionLocal

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()

# Guests are ephemeral and live only in memory (never persisted).
# Registered/Pro users live in the database.
_guests: dict[str, dict] = {}

# Bound the in-memory guest store so repeated /auth/guest calls can't exhaust RAM.
_GUEST_TTL_SECONDS = 3 * 60 * 60   # expire guests after 3h (token lives 1h)
_MAX_GUESTS = 5000


def _evict_guests() -> None:
    now = time.time()
    for name in [n for n, g in _guests.items() if now - g.get("created_at", now) > _GUEST_TTL_SECONDS]:
        _guests.pop(name, None)
    if len(_guests) > _MAX_GUESTS:
        for name, _ in sorted(_guests.items(), key=lambda kv: kv[1].get("created_at", 0))[
            : len(_guests) - _MAX_GUESTS
        ]:
            _guests.pop(name, None)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_guest() -> dict:
    _evict_guests()
    username = f"guest_{uuid.uuid4().hex[:12]}"
    _guests[username] = {
        "username": username,
        "hashed_password": None,
        "plan": "free",
        "is_guest": True,
        "persona": None,
        "profile": {},
        "created_at": time.time(),
    }
    return _guests[username]


def create_user(db: Session, username: str, password: str, profile: Optional[dict] = None) -> dict:
    """Create a persisted account with profile.

    New registrations are on the FREE plan. Pro is granted only through a real
    payment/subscription event (not implemented yet) — never automatically on
    signup, so an open registration endpoint can't hand out uncapped usage.
    """
    from models.db_models import User

    if db.scalar(select(User).where(User.username == username)) is not None:
        raise HTTPException(status_code=409, detail="Username already taken")

    p = profile or {}
    user = User(
        username=username,
        hashed_password=hash_password(password),
        plan="free",
        full_name=p.get("full_name", ""),
        email=p.get("email", ""),
        phone=p.get("phone", ""),
        company_name=p.get("company_name", ""),
        company_role=p.get("company_role", ""),
        company_size=p.get("company_size", ""),
        industry=p.get("industry", ""),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user.to_auth_dict()


def _db_user(db: Session, username: str):
    from models.db_models import User
    return db.scalar(select(User).where(User.username == username))


def get_or_create_supabase_user(db: Session, claims) -> dict:
    """Map a verified Supabase token to our users row, creating it on first sight.

    All users — anonymous guests and email-backed accounts alike — start on the
    FREE plan. Pro is granted only via a real payment/subscription event, never
    automatically on signup. Profile/company data live here.
    """
    from models.db_models import User

    user = db.scalar(select(User).where(User.supabase_user_id == claims.user_id))
    if user is None:
        user = User(
            supabase_user_id=claims.user_id,
            username=None,
            hashed_password=None,
            plan="free",
            email=claims.email or "",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Keep the email in sync once an anonymous user signs up with one.
        if not claims.is_anonymous and claims.email and not user.email:
            user.email = claims.email
            db.commit()
            db.refresh(user)

    d = user.to_auth_dict()
    d["is_guest"] = claims.is_anonymous
    d["username"] = user.username or claims.email or f"user_{claims.user_id[:8]}"
    d["supabase_user_id"] = claims.user_id
    return d


def update_profile(db: Session, current_user: dict, profile: dict) -> dict:
    """Persist personal/company details for the current (Supabase or legacy) user."""
    from models.db_models import User
    sid = current_user.get("supabase_user_id")
    if sid:
        user = db.scalar(select(User).where(User.supabase_user_id == sid))
    else:
        user = _db_user(db, current_user.get("username"))
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    for field in ("full_name", "email", "phone", "company_name", "company_role", "company_size", "industry"):
        if field in profile and profile[field] is not None:
            setattr(user, field, profile[field])
    db.commit()
    db.refresh(user)
    out = user.to_auth_dict()
    out["is_guest"] = current_user.get("is_guest", False)
    out["username"] = current_user.get("username")
    return out


def get_user(db: Session, username: str) -> Optional[dict]:
    """Resolve a username to an auth dict — guest (memory) or registered (DB)."""
    if username in _guests:
        return _guests[username]
    u = _db_user(db, username)
    return u.to_auth_dict() if u else None


def set_persona(db: Session, username: str, persona: Optional[str]) -> None:
    if username in _guests:
        _guests[username]["persona"] = persona
        return
    u = _db_user(db, username)
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")
    u.persona = persona
    db.commit()


def set_persona_for(db: Session, current_user: dict, persona: Optional[str]) -> None:
    """Persona setter that works for Supabase users (looked up by supabase id)."""
    from models.db_models import User
    sid = current_user.get("supabase_user_id")
    if sid:
        u = db.scalar(select(User).where(User.supabase_user_id == sid))
        if u is None:
            raise HTTPException(status_code=404, detail="User not found")
        u.persona = persona
        db.commit()
        return
    set_persona(db, current_user["username"], persona)


def authenticate_user(db: Session, username: str, password: str) -> Optional[dict]:
    u = _db_user(db, username)
    if not u or not u.hashed_password or not verify_password(password, u.hashed_password):
        return None
    return u.to_auth_dict()


def create_access_token(data: dict) -> str:
    settings = get_settings()
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token_username(token: str) -> Optional[str]:
    """Decode a JWT and return the 'sub' username, or None if invalid."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload.get("sub")
    except JWTError:
        return None


def resolve_ws_user(token: str) -> Optional[dict]:
    """For WebSocket endpoints (no Depends): decode token and load the user.

    Opens its own short-lived DB session since WS handlers aren't in the
    request/dependency lifecycle. Supports Supabase or legacy tokens.
    """
    if get_settings().supabase_enabled:
        from core.supabase_auth import verify_supabase_jwt
        claims = verify_supabase_jwt(token)
        if not claims:
            return None
        db = SessionLocal()
        try:
            return get_or_create_supabase_user(db, claims)
        finally:
            db.close()

    username = decode_token_username(token)
    if not username:
        return None
    if username in _guests:
        return _guests[username]
    db = SessionLocal()
    try:
        u = _db_user(db, username)
        return u.to_auth_dict() if u else None
    finally:
        db.close()


def get_ws_token(websocket) -> Optional[str]:
    """Extract the auth token for a WebSocket.

    Prefers the `Sec-WebSocket-Protocol` header (so the token never lands in the
    URL / access logs). Format offered by the client: ["bearer", "<jwt>"].
    Falls back to a ?token= query param for non-browser clients.
    """
    proto = websocket.headers.get("sec-websocket-protocol")
    if proto:
        parts = [p.strip() for p in proto.split(",")]
        if len(parts) >= 2 and parts[0] == "bearer":
            return parts[1]
    return websocket.query_params.get("token")


def ws_subprotocol(websocket) -> Optional[str]:
    """The subprotocol to echo on accept() — required if the client offered one."""
    proto = websocket.headers.get("sec-websocket-protocol")
    if proto and "bearer" in [p.strip() for p in proto.split(",")]:
        return "bearer"
    return None


def ws_origin_allowed(websocket) -> bool:
    """Reject cross-site WebSocket connections (CORS does not cover WS)."""
    origin = websocket.headers.get("origin")
    if not origin:
        return True  # non-browser client (e.g. server-to-server, tests)
    return origin in get_settings().origins


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> dict:
    if get_settings().supabase_enabled:
        from core.supabase_auth import verify_supabase_jwt
        claims = verify_supabase_jwt(credentials.credentials)
        if not claims:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return get_or_create_supabase_user(db, claims)

    username = decode_token_username(credentials.credentials)
    user = get_user(db, username) if username else None
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    return user
