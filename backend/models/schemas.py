from pydantic import BaseModel, field_validator
from typing import Optional
import re


class UserProfile(BaseModel):
    full_name: str = ""
    email: str = ""
    phone: str = ""
    # Company details (optional)
    company_name: str = ""
    company_role: str = ""
    company_size: str = ""
    industry: str = ""

    @field_validator("full_name", "email", "phone", "company_name", "company_role", "company_size", "industry")
    @classmethod
    def trim(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) > 200:
            raise ValueError("Field too long (max 200 chars)")
        return v


def validate_password_strength(v: str) -> str:
    """Shared password policy — used at registration and password reset."""
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters")
    # bcrypt silently truncates beyond 72 bytes — reject so users aren't misled.
    if len(v.encode("utf-8")) > 72:
        raise ValueError("Password must be 72 bytes or fewer")
    if len(set(v)) < 4:
        raise ValueError("Password is too repetitive — use a stronger one")
    if v.lower() in {"password", "12345678", "password1", "qwertyui", "11111111", "abcdefgh"}:
        raise ValueError("That password is too common — choose another")
    return v


class RegisterRequest(BaseModel):
    username: str
    password: str
    profile: UserProfile = UserProfile()

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 30:
            raise ValueError("Username must be 3–30 characters")
        if not re.match(r"^[a-zA-Z0-9_.+-]+$", v):
            raise ValueError("Username may only contain letters, numbers, underscores, dots, hyphens, or plus signs")
        return v

    @field_validator("password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        return validate_password_strength(v)


class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def email_present(cls, v: str) -> str:
        v = (v or "").strip()
        if not v or "@" not in v or len(v) > 200:
            raise ValueError("Enter a valid email address")
        return v


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("token")
    @classmethod
    def token_present(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Missing reset token")
        return v

    @field_validator("new_password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        return validate_password_strength(v)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    plan: str = "free"
    is_guest: bool = False


class UserInfo(BaseModel):
    username: str
    plan: str = "free"
    is_guest: bool = False
    persona: Optional[str] = None
    profile: dict = {}


class DocumentSummary(BaseModel):
    overview: str = ""
    doc_type: str = ""
    key_points: list[str] = []
    topics: list[str] = []


class DocumentInfo(BaseModel):
    filename: str
    original_language: str
    summary: DocumentSummary = DocumentSummary()


class SessionInfo(BaseModel):
    session_id: str
    documents: list[DocumentInfo]
    mode: str  # "single" | "compare" | "multi"
    suggested_questions: list[str]
    ready: bool


class PersonaGenerateRequest(BaseModel):
    role: str = ""
    specialty: str = ""
    address_as: str = ""

    @field_validator("role", "specialty", "address_as")
    @classmethod
    def trim(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) > 200:
            raise ValueError("Answer too long (max 200 chars)")
        return v


class PersonaUpdateRequest(BaseModel):
    persona: Optional[str] = None

    @field_validator("persona")
    @classmethod
    def persona_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if len(v) > 1200:
            raise ValueError("Persona too long (max 1200 chars)")
        return v


class PersonaResponse(BaseModel):
    persona: Optional[str] = None


class FeedbackRequest(BaseModel):
    message: str
    rating: Optional[int] = None
    category: str = "general"
    context: str = ""

    @field_validator("message")
    @classmethod
    def message_valid(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Feedback message cannot be empty")
        if len(v) > 4000:
            raise ValueError("Feedback too long (max 4000 chars)")
        return v

    @field_validator("rating")
    @classmethod
    def rating_valid(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None
        if v < 1 or v > 5:
            raise ValueError("Rating must be between 1 and 5")
        return v

    @field_validator("category")
    @classmethod
    def category_valid(cls, v: str) -> str:
        v = (v or "general").strip().lower()
        if v not in {"general", "bug", "feature", "praise"}:
            v = "general"
        return v

    @field_validator("context")
    @classmethod
    def context_trim(cls, v: str) -> str:
        return (v or "").strip()[:255]


class MessageFeedbackRequest(BaseModel):
    vote: int  # 1 = up, -1 = down
    session_id: str = ""
    question: str = ""
    answer_excerpt: str = ""

    @field_validator("vote")
    @classmethod
    def vote_valid(cls, v: int) -> int:
        if v not in (1, -1):
            raise ValueError("vote must be 1 or -1")
        return v

    @field_validator("question", "answer_excerpt")
    @classmethod
    def cap(cls, v: str) -> str:
        return (v or "")[:2000]


class ChatMessage(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty")
        if len(v) > 4000:
            raise ValueError("Message too long (max 4000 chars)")
        return v
