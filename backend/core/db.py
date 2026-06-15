"""
Database setup — SQLAlchemy 2.0.

Defaults to a local SQLite file but honours DATABASE_URL so the same code runs
against Postgres (Hetzner / Azure) by just setting the env var, e.g.
    DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/talktofile
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./talktofile.db")

# check_same_thread is a SQLite-only flag; skip it for other backends.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    """Bring the database schema up to date.

    Prefers Alembic migrations (the source of truth). Falls back to create_all
    only if Alembic isn't available, so the app still runs in minimal setups.
    """
    from models import db_models  # noqa: F401  (register models on Base)
    try:
        import os
        from alembic.config import Config
        from alembic import command

        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        cfg = Config(os.path.join(backend_dir, "alembic.ini"))
        cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
        command.upgrade(cfg, "head")
    except Exception as e:
        print(f"Alembic migration skipped ({e}); falling back to create_all")
        Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency yielding a session that is always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
