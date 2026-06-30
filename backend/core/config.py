from pydantic_settings import BaseSettings
from functools import lru_cache

DEFAULT_SECRET = "change-me-in-production-use-long-random-string"


class Settings(BaseSettings):
    openai_api_key: str
    secret_key: str = DEFAULT_SECRET
    algorithm: str = "HS256"
    # 7 days. Long-lived so routine, intermittent use (e.g. editing your profile
    # after leaving a tab open) doesn't expire mid-session and silently sign you
    # out. The frontend also proactively refreshes the token while a session is
    # active (POST /auth/refresh), so an active tab effectively never expires.
    access_token_expire_minutes: int = 60 * 24 * 7
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"
    environment: str = "development"

    # Tier limits
    free_max_file_size_mb: int = 5
    free_max_files: int = 1
    pro_max_file_size_mb: int = 8
    pro_max_files: int = 5

    # Daily usage caps (cost control against OpenAI bill shock)
    free_daily_questions: int = 20
    pro_daily_questions: int = 300
    free_daily_uploads: int = 5
    pro_daily_uploads: int = 50

    def daily_question_limit(self, plan: str) -> int:
        return self.pro_daily_questions if plan == "pro" else self.free_daily_questions

    def daily_upload_limit(self, plan: str) -> int:
        return self.pro_daily_uploads if plan == "pro" else self.free_daily_uploads

    # Supabase Auth (optional). When supabase_jwt_secret is set, the backend
    # verifies Supabase-issued JWTs instead of its own. Empty = legacy custom auth.
    supabase_url: str = ""
    supabase_jwt_secret: str = ""

    # Comma-separated emails that should be granted the Pro plan automatically
    # (e.g. test accounts / early users) until real billing exists.
    pro_emails: str = ""

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_jwt_secret)

    def is_pro_email(self, email: str) -> bool:
        if not email:
            return False
        allow = {e.strip().lower() for e in self.pro_emails.split(",") if e.strip()}
        return email.lower() in allow

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    def limits_for_plan(self, plan: str) -> tuple[int, int]:
        """Return (max_files, max_file_size_mb) for the given plan."""
        if plan == "pro":
            return self.pro_max_files, self.pro_max_file_size_mb
        return self.free_max_files, self.free_max_file_size_mb

    def validate_for_runtime(self) -> None:
        """Refuse to run with insecure defaults outside development."""
        if self.environment != "development" and self.secret_key == DEFAULT_SECRET:
            raise RuntimeError(
                "SECRET_KEY is still the built-in default. Set a strong random SECRET_KEY "
                "in the environment before running outside development "
                "(e.g. `python -c \"import secrets;print(secrets.token_urlsafe(48))\"`)."
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
