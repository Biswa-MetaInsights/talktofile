from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from core.db import get_db
from core.ratelimit import limiter
from models.schemas import (
    RegisterRequest,
    LoginRequest,
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
    get_current_user,
    set_persona_for,
    update_profile,
)
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


@router.post("/refresh", response_model=TokenResponse)
async def refresh(current_user: dict = Depends(get_current_user)):
    """Mint a fresh access token for the current (still-valid) session.

    The frontend calls this periodically while a session is active so a long-lived
    tab slides its expiry forward and never expires mid-use. Requires a valid token
    (an already-expired token can't be refreshed — the user signs in again).
    """
    return _token_response(current_user)


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
):
    if not (body.role or body.specialty or body.address_as):
        raise HTTPException(status_code=400, detail="Provide at least one detail")
    # Only draft the persona — do NOT persist it here. The user reviews/edits the
    # draft on the "Edit prompt" tab and explicitly saves via PUT /persona.
    persona = await generate_persona(body.role, body.specialty, body.address_as)
    return PersonaResponse(persona=persona)


@router.put("/persona", response_model=PersonaResponse)
async def update_my_persona(
    body: PersonaUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    set_persona_for(db, current_user, body.persona)
    return PersonaResponse(persona=body.persona)
