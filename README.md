# Metis

**Unified Medical Education Platform**

Named after Metis, the Greek goddess of wisdom and counsel, this project unifies the MedEd platform tools into a cohesive learning ecosystem.

## Overview

Metis provides:
- **Unified Portal**: Single entry point for all MedEd tools
- **Shared Authentication**: Login once, access everything
- **Model Sync**: Keep shared data models consistent across projects
- **Easy Orchestration**: Shell scripts to run the full platform

## Quick Start

### Run Everything
```bash
cd metis/scripts
./start-all.sh
# Portal at http://localhost:3000
```

### Check Status
```bash
./status.sh
```

### Stop Everything
```bash
./stop-all.sh
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Metis Portal                          │
│                  (localhost:3000)                        │
│         React + Vite + Tailwind + Supabase Auth          │
└──────┬──────────┬──────────┬──────────┬────────────────┘
       │          │          │          │
       ▼          ▼          ▼          ▼
   ┌───────┐  ┌────────┐  ┌───────┐  ┌──────┐
   │ Oread │  │ Syrinx │  │ Mneme │  │ Echo │
   │ :8004 │  │ :8003  │  │ :8002 │  │ :8001│
   └───────┘  └────────┘  └───────┘  └──────┘
   Patient    Encounter    EMR        AI
   Generator  Scripts      Viewer     Tutor
```

### Dashboard Data Flow (February 2026)

The Dashboard makes real API calls to move patient data between services:

```
Generate → Oread POST /api/generate
    │
    ├── "Open in Mneme"  → GET patient from Oread → POST to Mneme /api/import/oread/json
    ├── "Send to Syrinx" → GET patient from Oread → POST to Syrinx /api/patients/import
    └── Echo chat        → GET /context from Oread → POST to Echo /question
```

## Directory Structure

```
metis/
├── portal/          # React dashboard
│   └── src/
├── shared/          # Model definitions & sync tool
│   ├── models/      # JSON schemas
│   └── sync.py      # Code generator
├── scripts/         # Orchestration scripts
└── README.md
```

## Tools

| Tool | Greek Name | Purpose | Port |
|------|------------|---------|------|
| synpat | **Oread** | Synthetic patient generator | 8004 |
| synvoice | **Syrinx** | Voice encounter scripts | 8003 |
| synchart | **Mneme** | Minimal EMR viewer | 8002 |
| echo | **Echo** | AI attending tutor | 8001 |

## Model Sync

Keep shared Pydantic models in sync across projects:

```bash
cd metis/shared
python sync.py --project all      # Regenerate all
python sync.py --validate         # Check sync status
```

## Vite Proxy Configuration

All Dashboard API calls go through Vite's dev proxy on port 3000:

| Dashboard calls | Proxy rewrites to | Backend |
|-----------------|-------------------|---------|
| `/api/oread/...` | `localhost:8004/api/...` | Oread |
| `/api/syrinx/...` | `localhost:8003/api/...` | Syrinx |
| `/api/mneme/...` | `localhost:8002/api/...` | Mneme |
| `/api/echo/...` | `localhost:8001/...` | Echo |

**Gotcha:** Echo routes have no `/api/` prefix. The Echo proxy rewrites to `''` (empty string), not `'/api'`. All other services rewrite to `'/api'`.

## Standalone vs Ecosystem

Each tool can run independently:
```bash
cd synpat && python server.py  # Just Oread
```

Or as part of Metis:
```bash
cd metis/scripts && ./start-all.sh  # Everything
```

Environment variable `METIS_MODE` controls behavior:
- `standalone` (default): Permissive CORS, optional auth
- `ecosystem`: Restricted CORS, required auth, progress tracking

## Documentation

| Doc | Location |
|-----|----------|
| Platform README | [MedEd/README.md](../README.md) |
| Integration Guide | [docs/INTEGRATION.md](../docs/INTEGRATION.md) |
| Parent CLAUDE.md | [MedEd/CLAUDE.md](../CLAUDE.md) |
