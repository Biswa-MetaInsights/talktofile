"""Supabase Auth integration — verify Supabase-issued JWTs.

Supabase signs user access tokens with the project's JWT secret (HS256) and an
audience of "authenticated". We verify the signature + audience and extract the
stable user id (sub), email, and whether the user is anonymous (guest).
"""

from typing import Optional
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


def verify_supabase_jwt(token: str) -> Optional[SupabaseClaims]:
    """Return claims if the token is a valid Supabase access token, else None."""
    settings = get_settings()
    if not settings.supabase_jwt_secret:
        return None
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError:
        return None
    claims = SupabaseClaims(payload)
    return claims if claims.valid else None
