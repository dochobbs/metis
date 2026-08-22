# Deployment

**Honest status: Metis now has deployment scaffolding, but the full MedEd suite is not hosted yet.** The portal can be built as a static container and `deploy/Caddyfile` defines the suite gateway paths. The remaining work is wiring the sibling service containers, secrets, backend JWT verification, observability, and CI/CD in the deployment target.

This page outlines what production deployment would look like and what's still missing.

---

## Current state

- Services run locally via `metis/scripts/start-all.sh`
- Local development still uses ports 9100-9105, plus Mneme frontend at 5173
- Browser-facing Metis code now uses same-origin gateway paths:
  - `/api/{service}/...` for service APIs
  - `/apps/{service}/...` for embedded tool UIs
- `portal/Dockerfile` builds the Metis React app into an nginx container
- `deploy/Caddyfile` defines the production gateway route shape for APIs and app embeds
- Supabase is hosted (managed Postgres), but each developer uses their own project
- Anthropic, ElevenLabs, Deepgram API keys live in each developer's `~/.zshrc`
- No live hosted deployment, central secrets management, observability stack, Helm charts, or Terraform
- Per-service backend Dockerfiles are still needed outside this repo

If you want to demo MedEd to someone today, **screen-share or a single-host deployment using the provided Caddy route shape** is the practical path.

---

## What a production deployment would need

### Hosting

The suite is six FastAPI services + one React SPA + one Postgres. Reasonable targets:

| Component | Options |
|---|---|
| Backends (5 FastAPI services) | Fly.io, Railway, Render, Cloud Run, ECS |
| Portal SPA | Vercel, Netlify, Cloudflare Pages, or static-hosted alongside backends |
| Postgres | Supabase (current), Neon, AWS RDS |
| Object storage (audio files) | Supabase Storage, S3, Cloudflare R2 |

Smallest viable footprint: everything on one platform (Fly or Railway) sharing a single Supabase project.

### Containerization

Metis has a portal Dockerfile at `portal/Dockerfile`. The sibling services still need Dockerfiles. A first pass for a FastAPI service:

```dockerfile
# Example: athena/Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "9105"]
```

Per-service Dockerfiles + a top-level `docker-compose.yml` would let one command boot the whole suite. Worth doing.

### Reverse proxy

The Vite dev proxy and `deploy/Caddyfile` expose the same public path contract. Production should preserve this route shape so the browser never calls service-local ports directly:

- **Caddy** — easiest TLS, simple config, good fit
- **nginx** — more familiar, more config
- **Cloudflare Workers + per-service routes** — if backends are on different hosts

Route shape:

```text
meded.example.com {
  # See deploy/Caddyfile for the full rewrite rules.
  /api/echo/*    -> echo:9101/*
  /api/mneme/*   -> mneme:9102/api/*
  /api/syrinx/*  -> syrinx:9103/api/*
  /api/oread/*   -> oread:9104/api/*
  /api/athena/*  -> athena:9105/api/*
  /apps/mneme/*  -> mneme-frontend:5173/*
  /apps/{tool}/* -> tool UI root
}
```

**Gotcha to remember:** Echo paths get rewritten to strip `/api/echo/`, not to `/api/`. All others go to `/api/`.

### Secrets management

API keys are currently in `~/.zshrc`. Production options:

- Platform secrets (Fly secrets, Railway env vars, Vercel env)
- HashiCorp Vault
- AWS Secrets Manager / GCP Secret Manager
- Doppler / 1Password Secrets Automation

Whatever you pick, the contract per service is the same env vars listed in [QUICKSTART.md](QUICKSTART.md#3-environment-variables).

### Auth

The portal uses Supabase Auth today. For production:

- Configure Supabase RLS policies for `progress_records` and Mneme tables
- Set up email/OAuth providers in Supabase
- Metis forwards Supabase JWTs to proxied backend API calls as `Authorization: Bearer <jwt>`
- Backends must verify JWTs and enforce per-user/per-program authorization before multi-user deployment
- Add per-program tenant isolation (not yet built)

### Observability

Nothing in place. Suggested minimum:

- **Logs**: structured JSON to stdout, aggregated by hosting platform
- **Metrics**: per-service `/metrics` endpoint (Prometheus format) — not yet implemented
- **Traces**: OpenTelemetry would be nice given the cross-service flow; not yet implemented
- **Errors**: Sentry per service

### CI/CD

No CI yet. First steps:

- GitHub Actions per repo: lint + test on PR
- `python sync.py --validate` check in this repo to catch shared-model drift
- Image build + push on merge to main
- Deploy on tag (or merge-to-main with a confirm gate)

---

## Single-host deployment (smallest viable)

If you want to put the suite on one VPS for a demo:

```
┌──────────────────────────────────────────┐
│  Caddy (TLS, reverse proxy)              │
│  meded.example.com                        │
└──────────────┬───────────────────────────┘
               │
   ┌───────────┼──────────┬─────────┬─────────┬─────────┐
   │           │          │         │         │         │
   ▼           ▼          ▼         ▼         ▼         ▼
 Metis      Echo        Mneme    Syrinx    Oread    Athena
 (portal)  (9101)      (9102)   (9103)    (9104)   (9105)
                          │
                          ▼
                       Supabase
                       (hosted)
```

A 4 GB VPS handles this easily for a few dozen concurrent learners. Cost: ~$20/month + Supabase free tier + LLM API spend.

---

## What's blocking production today

In rough order:

1. **Dockerfiles** for sibling services (~1 day)
2. **`docker-compose.yml`** for the suite (~half day)
3. **TLS + DNS around `deploy/Caddyfile`** (~half day)
4. **Secrets management** decision and rollout (~1 day)
5. **CI** for lint/test/audit on each repo (~1 day per repo, parallelizable)
6. **Backend auth hardening** — JWT validation in backends, RLS in Supabase (~2-3 days)
7. **Tenant isolation** — per-program scoping for multi-school use (multi-week, not blocking single-tenant deploy)

For a single-tenant demo, items 1-4 are enough. Multi-tenant production needs all of them.
