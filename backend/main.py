from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from core.config import get_settings
from core.db import init_db
from core.ratelimit import limiter
from routers import auth, document, chat, feedback, tools


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Talktofile backend starting...")
    get_settings().validate_for_runtime()  # refuse insecure defaults in prod
    init_db()
    print("Database ready")
    yield
    print("Talktofile backend shutting down")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Talktofile API",
        description="Agentic document Q&A backend",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/api/docs" if settings.environment == "development" else None,
        redoc_url=None,
    )

    # Rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Hard cap on request body size (defends the edge before multipart spooling).
    # Worst legitimate case = pro: max_files * max_file_size + small overhead.
    max_request_bytes = (settings.pro_max_files * settings.pro_max_file_size_mb + 8) * 1024 * 1024

    @app.middleware("http")
    async def limit_body_size(request: Request, call_next):
        cl = request.headers.get("content-length")
        if cl and cl.isdigit() and int(cl) > max_request_bytes:
            return JSONResponse(status_code=413, content={"detail": "Request body too large"})
        return await call_next(request)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router, prefix="/api")
    app.include_router(document.router, prefix="/api")
    app.include_router(chat.router, prefix="/api")
    app.include_router(feedback.router, prefix="/api")
    app.include_router(tools.router, prefix="/api")

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "service": "Talktofile"}

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=9099, reload=True)
