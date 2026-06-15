# Deploying TalkToFile

Single‑VM deployment with Docker Compose: a FastAPI backend + Caddy (automatic
HTTPS, serves the SPA, reverse‑proxies `/api` including WebSockets). Postgres is
external (Supabase). See `SUPABASE_SETUP.md` for the Supabase side.

## Why a single backend instance
Document sessions, FAISS indexes and guest accounts live in **process memory**.
The backend therefore runs **one Uvicorn worker** and you scale **vertically**
(bigger box), not horizontally. Hundreds of concurrent users on a modest VPS is
fine for an MVP; true multi‑instance needs a shared session store (future work).

## Prerequisites
- A VM (e.g. Hetzner CX22) with Docker + Docker Compose.
- A domain's DNS **A record** pointing at the VM, ports **80 and 443** open
  (Caddy needs them for Let's Encrypt).

## 1. Configure secrets
`backend/.env` (never committed):
```
OPENAI_API_KEY=sk-...
SECRET_KEY=<random; only used if Supabase is off>
ENVIRONMENT=production
ALLOWED_ORIGINS=https://talktofile.example.com
DATABASE_URL=postgresql+psycopg2://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_JWT_SECRET=<supabase jwt secret>
# Optional daily cost caps (defaults shown)
FREE_DAILY_QUESTIONS=20
PRO_DAILY_QUESTIONS=300
FREE_DAILY_UPLOADS=5
PRO_DAILY_UPLOADS=50
```
`.env` (compose‑level, next to docker-compose.yml):
```
DOMAIN=talktofile.example.com
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

## 2. Build & run
```
docker compose build
docker compose up -d
docker compose logs -f
```
Caddy obtains a TLS cert automatically on first request. Visit
`https://talktofile.example.com`.

## 3. Database migrations
Run automatically on backend startup (`alembic upgrade head`). To run manually:
```
docker compose exec backend alembic upgrade head
```

## 4. Updating
```
git pull
docker compose build
docker compose up -d
```

## Local test of the prod stack
Set `DOMAIN=localhost` in `.env` and `docker compose up`. Caddy serves on
https://localhost with its internal CA (browser will warn — expected locally).

## Operational notes
- A backend restart wipes in‑memory guest/document sessions (by design). Registered
  users + feedback + usage live in Supabase Postgres and persist.
- Set an **OpenAI budget alert** in the OpenAI dashboard as a backstop in addition
  to the in‑app daily caps.
- Recommended next: Sentry (error tracking), uptime monitor on `/api/health`.
