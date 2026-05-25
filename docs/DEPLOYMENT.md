# Deployment

**Honest status: the MedEd suite is currently dev-only.** There is no production deployment, no CI/CD, no hosting. All documentation up to this point assumes `localhost` on a developer machine.

This page outlines what production deployment would look like and what's still missing.

---

## Current state

- Services run locally via `metis/scripts/start-all.sh`
- All ports are `localhost`-bound (9100-9105, plus Mneme frontend at 5173)
- Supabase is hosted (managed Postgres), but each developer uses their own project
- Anthropic, ElevenLabs, Deepgram API keys live in each developer's `~/.zshrc`
- No reverse proxy, TLS termination, secrets management, or observability stack
- No container images, no Helm charts, no Terraform

If you want to demo MedEd to someone, **screen-share** is the path today.

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

None of the services have Dockerfiles yet. A first pass:

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

The Vite dev proxy that fans `/api/{service}/...` out to backends only exists in dev. Production needs a real reverse proxy:

- **Caddy** — easiest TLS, simple config, good fit
- **nginx** — more familiar, more config
- **Cloudflare Workers + per-service routes** — if backends are on different hosts

Sketch (Caddy):

```caddy
meded.example.com {
  reverse_proxy /api/echo/*   echo-svc:9101
  reverse_proxy /api/mneme/*  mneme-svc:9102
  reverse_proxy /api/syrinx/* syrinx-svc:9103
  reverse_proxy /api/oread/*  oread-svc:9104
  reverse_proxy /api/athena/* athena-svc:9105
  reverse_proxy /*             portal-svc:9100
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
- Forward Supabase JWT to backends; backends verify (currently they trust the proxy)
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

1. **Dockerfiles** per service (~1 day)
2. **`docker-compose.yml`** for the suite (~half day)
3. **Reverse-proxy config** + TLS (~half day)
4. **Secrets management** decision and rollout (~1 day)
5. **CI** for lint/test on each repo (~1 day per repo, parallelizable)
6. **Auth hardening** — JWT validation in backends, RLS in Supabase (~2-3 days)
7. **Tenant isolation** — per-program scoping for multi-school use (multi-week, not blocking single-tenant deploy)

For a single-tenant demo, items 1-4 are enough. Multi-tenant production needs all of them.
