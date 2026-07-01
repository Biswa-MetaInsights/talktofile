from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from core.db import get_db
from core.ratelimit import limiter
from models.schemas import (
    RegisterRequest,
    LoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserInfo,
    PersonaGenerateRequest,
    PersonaUpdateRequest,
    PersonaResponse,
)
from core.auth import (
    create_user,
    create_guest,
    authenticate_user,
    create_access_token,
    create_password_reset,
    reset_password_with_token,
    get_current_user,
    set_persona_for,
    update_profile,
)
from core.config import get_settings
from core.email import send_password_reset_email
from models.schemas import UserProfile
from agents.persona_agent import generate_persona

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_response(user: dict) -> TokenResponse:
    token = create_access_token({"sub": user["username"]})
    return TokenResponse(
        access_token=token,
        username=user["username"],
        plan=user.get("plan", "free"),
        is_guest=user.get("is_guest", False),
    )


@router.post("/guest", response_model=TokenResponse)
@limiter.limit("30/minute")
async def guest(request: Request):
    """Issue an ephemeral free-tier guest account so the home page works immediately."""
    return _token_response(create_guest())


@router.post("/register", response_model=TokenResponse)
@limiter.limit("10/minute")
async def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    """Sign up (= subscribe). Creates a persisted pro account and logs in."""
    user = create_user(db, body.username, body.password, body.profile.model_dump())
    return _token_response(user)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return _token_response(user)


@router.post("/forgot-password")
@limiter.limit("5/hour")
async def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Email a password-reset link if an account exists for this address.

    Always returns the same generic response regardless of whether the email is
    registered — this prevents attackers from probing which emails have accounts.
    """
    settings = get_settings()
    generic = {"message": "If an account exists for that email, we've sent a reset link."}
    result = create_password_reset(db, body.email)
    if not result:
        return generic
    user_email, raw_token = result
    link = f"{settings.public_base_url}/reset-password?token={raw_token}"
    sent = send_password_reset_email(user_email, link, settings.reset_token_ttl_minutes)
    # Dev convenience: when there's no email provider AND we're in development,
    # hand the link back so the flow is testable without a mailbox. Strictly
    # gated so a misconfigured production deploy never leaks reset links.
    if not sent and settings.environment == "development":
        return {**generic, "dev_reset_link": link}
    return generic


@router.post("/reset-password", response_model=TokenResponse)
@limiter.limit("10/hour")
async def reset_password(request: Request, body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Set a new password using a valid reset token, then sign the user in."""
    user = reset_password_with_token(db, body.token, body.new_password)
    if not user:
        raise HTTPException(
            status_code=400,
            detail="This reset link is invalid or has expired. Please request a new one.",
        )
    return _token_response(user)


@router.get("/me", response_model=UserInfo)
async def me(current_user: dict = Depends(get_current_user)):
    return UserInfo(
        username=current_user["username"],
        plan=current_user.get("plan", "free"),
        is_guest=current_user.get("is_guest", False),
        persona=current_user.get("persona"),
        profile=current_user.get("profile", {}),
    )


@router.put("/profile", response_model=UserInfo)
async def update_my_profile(
    profile: UserProfile,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save personal/company details (used right after Supabase signup)."""
    updated = update_profile(db, current_user, profile.model_dump())
    return UserInfo(
        username=updated["username"],
        plan=updated.get("plan", "free"),
        is_guest=updated.get("is_guest", False),
        persona=updated.get("persona"),
        profile=updated.get("profile", {}),
    )


@router.get("/persona", response_model=PersonaResponse)
async def get_my_persona(current_user: dict = Depends(get_current_user)):
    return PersonaResponse(persona=current_user.get("persona"))


@router.post("/persona/generate", response_model=PersonaResponse)
async def generate_my_persona(
    body: PersonaGenerateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not (body.role or body.specialty or body.address_as):
        raise HTTPException(status_code=400, detail="Provide at least one detail")
    persona = await generate_persona(body.role, body.specialty, body.address_as)
    set_persona_for(db, current_user, persona)
    return PersonaResponse(persona=persona)


@router.put("/persona", response_model=PersonaResponse)
async def update_my_persona(
    body: PersonaUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    set_persona_for(db, current_user, body.persona)
    return PersonaResponse(persona=body.persona)
