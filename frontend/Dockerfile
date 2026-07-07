# This image builds BOTH the React SPA and the Astro SEO blog, then serves them
# from one Caddy container. Because the blog lives in ../blog (outside this
# folder), the docker-compose `web` service sets the build context to the REPO
# ROOT and points here via `dockerfile: frontend/Dockerfile`. That's why every
# COPY below is prefixed with frontend/ or blog/.

# --- build the SPA ---
FROM node:20-alpine AS builder

WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .

# Vite bakes these at build time, so they must be passed as build args.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY
ENV VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST
RUN npm run build

# --- build the SEO blog (static Astro site, served at /blog) ---
FROM node:20-alpine AS blog-builder

WORKDIR /blog
COPY blog/package*.json ./
RUN npm install
COPY blog/ .
RUN npm run build

# --- serve via Caddy (automatic HTTPS + reverse proxy + WebSocket) ---
FROM caddy:2-alpine
COPY --from=builder /app/dist /srv
COPY --from=blog-builder /blog/dist /srv/blog
COPY frontend/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
