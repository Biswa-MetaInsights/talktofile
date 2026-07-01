# Supabase setup (Auth + Postgres)

Talktofile uses Supabase for **Postgres** and **Auth** when the env vars below are
set. With them unset, the app falls back to its built-in auth + SQLite (local dev).
Both modes use the same code — flipping is purely configuration.

## 1. Create the project
1. Create a project at https://supabase.com (note the **region** and **DB password**).
2. **Project Settings → API**, copy:
   - **Project URL** → `https://<ref>.supabase.co`
   - **anon public** key
   - **JWT Secret** (under *JWT Settings*)

## 2. Enable the auth methods
**Authentication → Providers / Settings:**
- **Email**: enabled. For a frictionless MVP you can turn **"Confirm email" OFF**
  (users sign in immediately). Leave it ON for production — the app shows a
  "check your email" message in that case.
- **Anonymous sign-ins**: **enable** (Authentication → Settings → "Allow anonymous
  sign-ins"). This powers the free **guest** experience.
- (Optional) Add **Google** etc. later — supabase-js handles OAuth.

**Authentication → URL Configuration:** set **Site URL** to your frontend domain.

## 3. Get the database connection string
**Project Settings → Database → Connection string → "SQLAlchemy"/URI.**
- For a single long-running backend, use the **direct connection (port 5432)**.
- If you later go serverless/multi-instance, use the **pooler (port 6543)** and set
  the SQLAlchemy engine to `NullPool`.
- Always keep `?sslmode=require`.

## 4. Backend env (`backend/.env`)
```
SECRET_KEY=<random — only used if Supabase is off>
ENVIRONMENT=production
ALLOWED_ORIGINS=https://your-frontend-domain
DATABASE_URL=postgresql+psycopg2://postgres.<ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_JWT_SECRET=<JWT secret from step 1>
OPENAI_API_KEY=sk-...
```
Install the Postgres driver and run migrations against Supabase:
```
pip install -r requirements.txt        # includes psycopg2-binary
alembic upgrade head                   # also runs automatically on startup
```

## 5. Frontend env (`frontend/.env`)
```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```
Rebuild the frontend (`npm run build`) so the values are baked in.

## How it maps
- **Anonymous Supabase user** → our `users` row with `plan=free`, `is_guest=true`.
- **Email signup** → `plan=free` (registered account; Pro is granted only via a real
  payment/subscription event, not implemented yet). Personal/company details are
  saved via `PUT /api/auth/profile`.
- The backend **verifies the Supabase JWT** (HS256, audience `authenticated`) and
  lazily provisions the local `users` row keyed by `supabase_user_id`.
- The frontend sends the Supabase access token as the `Authorization` header (REST)
  and via the `["bearer", token]` WebSocket subprotocol.

## Security notes
- Never expose the **service_role** key or **JWT secret** to the frontend — only the
  **anon** key belongs in `VITE_*`.
- Supabase now owns passwords, email verification, and password reset — the legacy
  password rules no longer apply when Supabase is enabled.
