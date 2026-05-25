# Services

The MedEd suite is six independently-deployable microservices, each named after a figure from Greek mythology. This page is a one-screen overview per service. For deep architecture see [PLATFORM-DESIGN.md](PLATFORM-DESIGN.md); for cross-service data flow see [INTEGRATION.md](INTEGRATION.md).

| Service | Mythology | Role | Status |
|---|---|---|---|
| [Metis](#metis) | Titaness of wisdom | Portal & routing | Working |
| [Echo](#echo) | Nymph who repeated speech | AI Attending tutor | Production-ready |
| [Mneme](#mneme) | Muse of memory | Minimal EMR | ~95% complete |
| [Syrinx](#syrinx) | Pan pipes | Voice encounters | Production |
| [Oread](#oread) | Mountain nymphs | Synthetic patient generation | Production |
| [Athena](#athena) | Goddess of wisdom | Curriculum & knowledge | Production |

---

## Metis

**Port:** 9100 · **Repo:** this one · **Stack:** React 18 + Vite + Tailwind + Supabase

The unified portal. Single entry point learners open in the browser. Provides:

- Dashboard with specialty selector (Peds / IM / FP) and learner level toggle
- Vite dev proxy that fans `/api/{service}/...` out to backends
- Shared Supabase authentication
- Shared model definitions + sync tool (`shared/`)
- Orchestration scripts (`scripts/start-all.sh`, etc.)

**Key files:**
- `portal/src/pages/Dashboard.tsx` — command center UI
- `portal/vite.config.ts` — proxy configuration
- `shared/sync.py` — model code generator
- `scripts/start-all.sh` — boots the whole suite

---

## Echo

**Port:** 9101 · **Repo:** [dochobbs/echo](https://github.com/dochobbs/echo) · **Stack:** FastAPI + Anthropic + Deepgram

AI Attending tutor. A Socratic teaching layer that asks learners diagnostic questions, reasons through differentials, and gives feedback grounded in 174 teaching frameworks. Supports voice I/O (Whisper STT, optional Deepgram).

**Key endpoints** (note: Echo has **no** `/api/` prefix):
- `POST /question` — ad-hoc tutor question with patient context
- `POST /cases/start/dynamic` — start a full case with framework selection
- `POST /feedback`, `POST /debrief` — session review
- `GET /health`

**Queries:** Athena (`/api/frameworks/for-condition/{id}`) — falls back to local YAML if Athena is down.

---

## Mneme

**Port:** 9102 (backend) · **Frontend:** 5173 · **Repo:** [dochobbs/mneme](https://github.com/dochobbs/mneme) · **Stack:** FastAPI + Supabase + React

Minimal EMR interface. 14 database tables modeling problem lists, medications, allergies, vitals, immunizations, encounters, and notes. Three importers (Oread JSON, CSV, manual). Tracks learning sessions tied to charts.

**Key endpoints:**
- `POST /api/import/oread/json` — accept a generated patient and persist
- `GET /api/patients/{id}` — full patient record
- `POST /api/learning-sessions` — start a chart-review session

**Requires:** Supabase (no local-only mode for persistence). See [QUICKSTART.md](QUICKSTART.md) for Supabase setup.

---

## Syrinx

**Port:** 9103 · **Repo:** [dochobbs/syrinx](https://github.com/dochobbs/syrinx) · **Stack:** FastAPI + Anthropic + ElevenLabs

Voice encounter scripts. Generates parent/patient dialogue scripts from a clinical scenario, injects controlled errors (omissions, contradictions, vague answers) for learners to catch, and synthesizes audio via ElevenLabs with emotion modulation.

**Key endpoints:**
- `POST /api/patients/import` — accept Oread patient (in-memory, ephemeral)
- `POST /api/scripts/generate` — produce a multi-turn encounter script
- `POST /api/audio/render` — TTS to MP3
- `POST /api/errors/inject` — add specific error types

**Known limitation:** patient import is in-memory only — server restart clears them.

---

## Oread

**Port:** 9104 · **Repo:** [dochobbs/oread](https://github.com/dochobbs/oread) · **Stack:** FastAPI + Supabase + Anthropic

Synthetic patient generator. Produces realistic peds and adult patients with histories, problem lists, medication regimens, immunization records, growth trajectories, and HPIs. **Time Travel** lets you advance a patient's timeline to see how a condition evolves.

**Key endpoints:**
- `POST /api/generate` — generate a patient with constraints
- `GET /api/patients/{id}` — full record
- `GET /api/patients/{id}?format=json|cda|fhir|hl7v2` — multi-format export
- `GET /api/patients/{id}/context` — flat `PatientContext` for Echo

**Recently added:** AdultEngine wired into `/api/generate` (IM/FP support).

**Queries:** Athena for condition lookups (AthenaClient distributed but not yet fully wired into the engine — currently reads local `conditions.yaml`).

---

## Athena

**Port:** 9105 · **Repo:** [dochobbs/athena](https://github.com/dochobbs/athena) · **Stack:** FastAPI + YAML + Pydantic v2

The knowledge backbone. Centralizes all medical content: conditions, teaching frameworks, disease arcs, specialty resolvers, learner tracks. Every other service queries Athena (with graceful fallback if it's down).

**Current content:**
- 46 peds conditions, 167 IM conditions, 14 shared (total: 213 across specialties via resolver)
- 162 peds frameworks, 167 IM frameworks, 8 shared (total: 332)
- 6 disease arcs (peds only)
- 15 learner tracks, 3 specialties

**Key endpoints:**
- `GET /api/conditions?specialty=...&age_months=...` — resolved condition list
- `GET /api/frameworks/for-condition/{id}?specialty=...` — relevant teaching frameworks
- `GET /api/specialties` — peds / IM / FP metadata
- `GET /api/learner-tracks?level=resident` — track definitions

**Resolver:**
- `pediatrics` → `peds/` + `shared/` = 46 conditions
- `internal_medicine` → `im/` + `shared/` = 181 conditions
- `family_practice` → `peds/` + `im/` + `shared/` = 213 conditions

**Status:** Production. 117 tests passing (up from 62 after May 2026 hardening work), 12 endpoints.

---

## Cross-service relationships

```
Metis → (proxies to) → all backends
Oread → generates patient → consumed by Mneme, Syrinx, Echo
Echo  → tutors with patient context, queries Athena for frameworks
Mneme → persists patient, runs learning sessions
Syrinx → adds voice/audio dimension
Athena → queried by all services (with graceful fallback)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for visual diagrams and [INTEGRATION.md](INTEGRATION.md) for exact request/response shapes.
