# Metis — MedEd Platform

**Unified portal and front door for the MedEd medical education suite.**

Metis (named after the Greek titaness of wisdom and counsel) is the hub of a six-service platform for primary care medical education across **Pediatrics**, **Internal Medicine**, and **Family Practice**.

---

## The Suite

Each service is named after a figure from Greek mythology and runs as an independent microservice. Metis is the portal you open; the others power what happens inside it.

| Service | Role | Port | Repository |
|---------|------|------|------------|
| **Metis** | Unified portal, routing, shared models | 9100 | this repo |
| **Echo** | AI Attending tutor (Socratic) | 9101 | [dochobbs/echo](https://github.com/dochobbs/echo) |
| **Mneme** | Minimal EMR interface | 9102 | [dochobbs/mneme](https://github.com/dochobbs/mneme) |
| **Syrinx** | Voice encounter scripts + audio | 9103 | [dochobbs/syrinx](https://github.com/dochobbs/syrinx) |
| **Oread** | Synthetic patient generation | 9104 | [dochobbs/oread](https://github.com/dochobbs/oread) |
| **Athena** | Curriculum & knowledge service | 9105 | _internal_ |

> **Status (April 2026):** Athena, Oread, and Syrinx are in production. Echo is production-ready. Mneme is ~95% complete. Metis is a working portal under active iteration.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    METIS (9100)                          │
│         Unified dashboard + service routing              │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────────┐
         │               │                   │
         ▼               ▼                   ▼
   ┌──────────┐   ┌──────────┐        ┌──────────┐
   │  OREAD   │   │  SYRINX  │        │   ECHO   │
   │  9104    │   │  9103    │        │  9101    │
   │ Patients │   │  Voice   │        │  Tutor   │
   └────┬─────┘   └────┬─────┘        └────┬─────┘
        │               │                   │
        └───────┬───────┴───────────────────┘
                │          ▲
                ▼          │
          ┌──────────┐     │
          │  MNEME   │─────┘
          │  9102    │
          │   EMR    │
          └──────────┘

    All services query ─────► ┌──────────┐
                              │  ATHENA  │
                              │  9105    │
                              │ Curric.  │
                              │ & Know.  │
                              └──────────┘
```

- **Metis** is the top of the request flow (learner → portal → backends).
- **Athena** is the bottom of the dependency flow (every service depends on it; it depends on no one).

---

## Specialty Model

| Specialty | Age range | Knowledge pools |
|-----------|-----------|----------------|
| **Pediatrics** | 0–18 years | `peds/` + `shared/` |
| **Internal Medicine** | 18+ years | `im/` + `shared/` |
| **Family Practice** | All ages | `peds/` + `im/` + `shared/` (union) |

FP is not a separate knowledge base — Athena's resolver unions both pools.

**Current content:** 213 conditions, 332 frameworks, 3 specialties, 15 learner tracks.

---

## Quick Start

### Run everything

```bash
cd metis/scripts
./start-all.sh
./status.sh
# Portal at http://localhost:9100
```

### Stop everything

```bash
./stop-all.sh
```

### Run a single service

Each service is independently runnable from its own repo. See per-service READMEs, or [docs/INTEGRATION.md](docs/INTEGRATION.md#how-to-test) for the canonical startup order (Athena first).

---

## Dashboard Data Flow

The portal makes real API calls to move patients between services:

```
Generate          → Oread  POST /api/generate
"Open in Mneme"   → GET patient from Oread → POST to Mneme /api/import/oread/json
"Send to Syrinx"  → GET patient from Oread → POST to Syrinx /api/patients/import
Echo chat         → GET /context from Oread → POST to Echo /question
Knowledge         → Athena GET /api/conditions?specialty=...
```

Full reference: [docs/INTEGRATION.md](docs/INTEGRATION.md).

---

## Vite Proxy

All Dashboard API calls go through Vite's dev proxy on port 9100:

| Dashboard calls | Proxy rewrites to | Backend |
|-----------------|-------------------|---------|
| `/api/oread/...` | `localhost:9104/api/...` | Oread |
| `/api/syrinx/...` | `localhost:9103/api/...` | Syrinx |
| `/api/mneme/...` | `localhost:9102/api/...` | Mneme |
| `/api/echo/...` | `localhost:9101/...` | Echo |
| `/api/athena/...` | `localhost:9105/api/...` | Athena |

**Gotcha:** Echo routes have **no** `/api/` prefix. The Echo proxy rewrites to `''` (empty string), not `'/api'`. All other services rewrite to `'/api'`.

---

## Repository Layout

```
metis/
├── portal/           # React + Vite + Tailwind dashboard
├── shared/           # Shared model definitions + sync tool
├── scripts/          # Orchestration (start/stop/status)
├── docs/             # Suite documentation
│   ├── INTEGRATION.md
│   └── PLATFORM-DESIGN.md
└── README.md
```

---

## Standalone vs Ecosystem

Each service can run independently:

```bash
cd ../synpat && python server.py    # Just Oread
```

Or as part of the suite:

```bash
cd metis/scripts && ./start-all.sh  # Everything
```

The `METIS_MODE` environment variable controls service behavior:

- `standalone` (default): permissive CORS, optional auth
- `ecosystem`: restricted CORS, required auth, progress tracking

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.11+, FastAPI, Pydantic v2 |
| Database | Supabase (PostgreSQL) |
| Frontend | React 18, TypeScript, Tailwind |
| LLM | Anthropic Claude API |
| TTS | ElevenLabs |
| STT | Deepgram, Whisper (local) |
| Knowledge | YAML (conditions, frameworks), JSON Schema (shared models) |
| Medical standards | SNOMED CT, ICD-10, RxNorm, LOINC, CVX, FHIR R4, C-CDA 2.1 |

---

## Documentation

- [Integration Guide](docs/INTEGRATION.md) — cross-service data flow, proxy map, test recipes
- [Platform Design (v2)](docs/PLATFORM-DESIGN.md) — architectural spec
- [CLAUDE.md](CLAUDE.md) — context for AI assistants working in this repo

---

## License

TBD.
