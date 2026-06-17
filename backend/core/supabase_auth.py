"""Supabase Auth integration — verify Supabase-issued JWTs.

Supports both signing schemes Supabase uses:
- **Legacy HS256** — symmetric, signed with the project's shared JWT secret.
- **Asymmetric (ES256 / RS256)** — the current default for new projects, signed with
  rotating signing keys whose public halves are published at the project's JWKS
  endpoint (`/auth/v1/.well-known/jwks.json`).

We read the token header to pick the right path, and verify the audience
("authenticated") and signature in both cases.
"""

import time
from typing import Optional

import httpx
from jose import JWTError, jwt

from core.config import get_settings


class SupabaseClaims:
    def __init__(self, payload: dict):
        self.user_id: str = payload.get("sub", "")
        self.email: str = payload.get("email", "") or ""
        # Supabase marks anonymous sign-ins with is_anonymous=True.
        self.is_anonymous: bool = bool(payload.get("is_anonymous", False))
        self.payload = payload

    @property
    def valid(self) -> bool:
        return bool(self.user_id)


# --- Public signing keys (JWKS) cache, for asymmetric tokens ---
_JWKS_TTL = 600.0  # refresh public keys at most every 10 minutes
_jwks: dict = {"keys": [], "fetched_at": 0.0}


def _jwks_url() -> str:
    return f"{get_settings().supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"


def _load_jwks(force: bool = False) -> list[dict]:
    """Return the project's JWKS, cached with a TTL. Refresh on demand (e.g. an
    unknown key id, which happens after Supabase rotates signing keys)."""
    now = time.time()
    if not force and _jwks["keys"] and (now - _jwks["fetched_at"]) < _JWKS_TTL:
        return _jwks["keys"]
    try:
        resp = httpx.get(_jwks_url(), timeout=5.0)
        resp.raise_for_status()
        keys = resp.json().get("keys", [])
        if keys:
            _jwks["keys"] = keys
            _jwks["fetched_at"] = now
    except Exception:
        # Keep any previously-cached keys on a transient fetch failure.
        pass
    return _jwks["keys"]


def _signing_key(kid: str) -> Optional[dict]:
    for k in _load_jwks():
        if k.get("kid") == kid:
            return k
    # Unknown kid — keys may have rotated; force a refresh once.
    for k in _load_jwks(force=True):
        if k.get("kid") == kid:
            return k
    return None


def verify_supabase_jwt(token: str) -> Optional[SupabaseClaims]:
    """Return claims if the token is a valid Supabase access token, else None."""
    settings = get_settings()

    try:
        header = jwt.get_unverified_header(token)
    except JWTError:
        return None
    alg = header.get("alg", "")

    try:
        if alg == "HS256":
            # Legacy symmetric tokens.
            if not settings.supabase_jwt_secret:
                return None
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        else:
            # Asymmetric tokens (ES256 / RS256) verified via the project's JWKS.
            key = _signing_key(header.get("kid", ""))
            if not key:
                return None
            payload = jwt.decode(
                token,
                key,
                algorithms=[alg],
                audience="authenticated",
            )
    except JWTError:
        return None

    claims = SupabaseClaims(payload)
    return claims if claims.valid else None
