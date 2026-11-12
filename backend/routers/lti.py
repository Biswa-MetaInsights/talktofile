"""Optional LTI 1.3 OIDC launch endpoints.

Platforms must be explicitly registered in LTI_PLATFORM_CONFIG. No LMS is trusted
by issuer discovery alone. This implements core resource-link launches; it does
not request grades or roster data.
"""
import hashlib
import json
import secrets
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Form, HTTPException, Request
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import get_settings
from core.db import SessionLocal
from models.db_models import User

router = APIRouter(prefix="/lti", tags=["lti"])

ISSUER = "iss"
LTI_MESSAGE = "https://purl.imsglobal.org/spec/lti/claim/message_type"
LTI_VERSION = "https://purl.imsglobal.org/spec/lti/claim/version"
LTI_DEPLOYMENT = "https://purl.imsglobal.org/spec/lti/claim/deployment_id"
LTI_TARGET = "https://purl.imsglobal.org/spec/lti/claim/target_link_uri"
LTI_CONTEXT = "https://purl.imsglobal.org/spec/lti/claim/context"
LTI_ROLES = "https://purl.imsglobal.org/spec/lti/claim/roles"
RESOURCE_LINK = "https://purl.imsglobal.org/spec/lti/claim/resource_link"
STATE_COOKIE = "ttf_lti_txn"


def _platforms() -> list[dict]:
    raw = get_settings().lti_platform_config.strip()
    if not raw:
        return []
    try:
        entries = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(503, "LTI_PLATFORM_CONFIG is invalid JSON") from exc
    if not isinstance(entries, list):
        raise HTTPException(503, "LTI_PLATFORM_CONFIG must be a JSON array")
    return [p for p in entries if isinstance(p, dict)]


def _find_platform(issuer: str, client_id: str) -> dict:
    for platform in _platforms():
        if platform.get("issuer") == issuer and platform.get("client_id") == client_id:
            return platform
    raise HTTPException(401, "This learning platform is not registered")


def _transaction_token(state: str, nonce: str) -> str:
    settings = get_settings()
    return jwt.encode(
        {"state": state, "nonce": nonce, "exp": datetime.now(timezone.utc) + timedelta(minutes=10)},
        settings.secret_key,
        algorithm=settings.algorithm,
    )


def _validate_transaction(state: str, cookie: str | None) -> str:
    if not state or not cookie:
        raise HTTPException(400, "Missing LTI login state")
    settings = get_settings()
    try:
        saved = jwt.decode(cookie, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise HTTPException(400, "LTI login state expired; relaunch from your LMS") from exc
    if not secrets.compare_digest(str(saved.get("state", "")), state):
        raise HTTPException(400, "LTI login state did not match")
    return str(saved.get("nonce", ""))


async def _jwks(platform: dict) -> dict:
    uri = platform.get("jwks_url")
    if not uri or not str(uri).startswith("https://"):
        raise HTTPException(503, "Registered LMS has no valid HTTPS JWKS URL")
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=False) as client:
            response = await client.get(uri)
            response.raise_for_status()
            result = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, "Could not retrieve LMS signing keys") from exc
    if not isinstance(result, dict) or not isinstance(result.get("keys"), list):
        raise HTTPException(502, "LMS JWKS response is invalid")
    return result


@router.get("/login")
async def initiate_login(
    request: Request,
    iss: str,
    login_hint: str,
    target_link_uri: str,
    client_id: str,
    lti_message_hint: str | None = None,
    lti_deployment_id: str | None = None,
):
    """OIDC third-party initiated login endpoint used by LTI 1.3 platforms."""
    platform = _find_platform(iss, client_id)
    if target_link_uri not in platform.get("target_link_uris", []):
        raise HTTPException(400, "Target link URI is not registered")
    auth_url = platform.get("authorization_url", "")
    if not auth_url.startswith("https://"):
        raise HTTPException(503, "Registered LMS has no valid HTTPS authorization URL")

    state, nonce = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    redirect_uri = get_settings().lti_redirect_uri.rstrip("/")
    params = {
        "scope": "openid",
        "response_type": "id_token",
        "response_mode": "form_post",
        "prompt": "none",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "login_hint": login_hint,
        "state": state,
        "nonce": nonce,
    }
    if lti_message_hint:
        params["lti_message_hint"] = lti_message_hint
    if lti_deployment_id:
        allowed = platform.get("deployment_ids", [])
        if allowed and lti_deployment_id not in allowed:
            raise HTTPException(401, "LTI deployment is not registered")
        params["lti_deployment_id"] = lti_deployment_id

    response = RedirectResponse(f"{auth_url}?{urlencode(params)}", status_code=302)
    response.set_cookie(
        STATE_COOKIE, _transaction_token(state, nonce), max_age=600, httponly=True,
        secure=True, samesite="none", path="/api/lti",
    )
    return response


@router.post("/launch")
async def launch(
    request: Request,
    id_token: str = Form(...),
    state: str = Form(...),
):
    """Validate the platform's signed LTI resource-link launch and start app session."""
    nonce = _validate_transaction(state, request.cookies.get(STATE_COOKIE))
    try:
        header = jwt.get_unverified_header(id_token)
        untrusted = jwt.get_unverified_claims(id_token)
    except JWTError as exc:
        raise HTTPException(400, "Malformed LTI launch token") from exc

    issuer = untrusted.get(ISSUER)
    client_id = untrusted.get("aud")
    if isinstance(client_id, list):
        client_id = untrusted.get("azp") if len(client_id) > 1 else client_id[0]
    if not isinstance(issuer, str) or not isinstance(client_id, str):
        raise HTTPException(401, "LTI launch is missing issuer or audience")
    platform = _find_platform(issuer, client_id)

    kid = header.get("kid")
    if not kid or header.get("alg") not in ("RS256", "RS384", "RS512"):
        raise HTTPException(401, "Unsupported LMS signing key")
    jwks = await _jwks(platform)
    key = next((item for item in jwks["keys"] if item.get("kid") == kid and item.get("kty") == "RSA"), None)
    if not key:
        raise HTTPException(401, "LMS signing key was not found")

    try:
        claims = jwt.decode(
            id_token,
            key,
            algorithms=[header["alg"]],
            audience=client_id,
            issuer=issuer,
            options={"verify_at_hash": False},
        )
    except JWTError as exc:
        raise HTTPException(401, "LTI launch signature or claims are invalid") from exc

    if not secrets.compare_digest(str(claims.get("nonce", "")), nonce):
        raise HTTPException(401, "LTI launch nonce did not match")
    if claims.get(LTI_MESSAGE) != "LtiResourceLinkRequest" or claims.get(LTI_VERSION) != "1.3.0":
        raise HTTPException(400, "Only LTI 1.3 resource-link launches are supported")
    if claims.get(LTI_TARGET) not in platform.get("target_link_uris", []):
        raise HTTPException(401, "LTI target link URI is not registered")
    deployment = claims.get(LTI_DEPLOYMENT)
    configured_deployments = platform.get("deployment_ids", [])
    if not isinstance(deployment, str) or (configured_deployments and deployment not in configured_deployments):
        raise HTTPException(401, "LTI deployment is not registered")

    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise HTTPException(400, "Anonymous LTI launches are not supported")
    tenant_key = hashlib.sha256(f"{issuer}|{deployment}|{subject}".encode()).hexdigest()[:32]
    username = f"lti_{tenant_key}"
    email = str(claims.get("email") or "")[:200]
    display_name = str(claims.get("name") or claims.get("given_name") or "")[:200]

    db: Session = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            user = User(username=username, hashed_password=None, plan="pro", email=email, full_name=display_name)
            db.add(user)
            db.commit()
        elif email and not user.email:
            user.email = email
            db.commit()
    finally:
        db.close()

    settings = get_settings()
    token = jwt.encode(
        {
            "sub": username,
            "lti": True,
            "iss": issuer,
            "deployment_id": deployment,
            "context_id": (claims.get(LTI_CONTEXT) or {}).get("id", ""),
            "roles": claims.get(LTI_ROLES, []),
            "exp": int(time.time()) + 8 * 60 * 60,
        },
        settings.secret_key,
        algorithm=settings.algorithm,
    )
    frontend_url = get_settings().lti_frontend_url.rstrip("/")
    response = RedirectResponse(f"{frontend_url}/#lti_token={token}", status_code=303)
    response.delete_cookie(STATE_COOKIE, path="/api/lti")
    return response


@router.get("/config")
async def lti_configuration():
    """Machine-readable setup values for LMS administrators; never exposes secrets."""
    base = get_settings().lti_redirect_uri.rstrip("/")
    return {
        "version": "1.3.0",
        "initiate_login_uri": f"{base.rsplit('/api/lti/launch', 1)[0]}/api/lti/login",
        "target_link_uri": base,
        "redirect_uris": [base],
        "message_types": ["LtiResourceLinkRequest"],
        "note": "This endpoint shows tool URLs only. Register the LMS in LTI_PLATFORM_CONFIG before launch.",
    }
