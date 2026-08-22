# MedEd Platform Integration Guide

**Date:** April 2026 (updated from February 2026)
**Scope:** Cross-service patient data flow across all 6 MedEd services via Metis

---

## Service Map

| Service | Port | Prefix | Role |
|---------|------|--------|------|
| Metis | 9100 | — | Portal, proxy routing |
| Echo | 9101 | NONE | AI tutor (no `/api/` prefix) |
| Mneme | 9102 | `/api/` | EMR interface |
| Syrinx | 9103 | `/api/` | Voice encounters |
| Oread | 9104 | `/api/` | Patient generation |
| Athena | 9105 | `/api/` | Curriculum & knowledge |

---

## Architecture

```
Metis (localhost:9100)
  |
  |-- Generate --> Oread POST /api/generate
  |                  |
  |                  v
  |              patients_store[id] = Patient
  |
  |-- "Open in Mneme" -->
  |     1. GET  /api/oread/patients/{id}?format=json   (full record)
  |     2. POST /api/mneme/import/oread/json            (import to Supabase)
  |     3. window.open(Mneme patient detail page)
  |
  |-- "Send to Syrinx" -->
  |     1. GET  /api/oread/patients/{id}?format=json   (full record)
  |     2. POST /api/syrinx/patients/import             (in-memory store)
  |     3. window.open(Syrinx UI)
  |
  |-- Echo chat -->
  |     1. GET  /api/oread/patients/{id}/context        (flat PatientContext)
  |     2. POST /api/echo/question                      (with patient field)
  |
  |-- Knowledge queries -->
  |     GET  /api/athena/conditions?specialty=pediatrics
  |     GET  /api/athena/frameworks/for-condition/{id}?specialty=...
```

### Vite Proxy Map

All Dashboard API calls go through Vite's dev proxy on port 9100:

| Dashboard calls | Proxy rewrites to | Lands at |
|-----------------|-------------------|----------|
| `/api/oread/generate` | `localhost:9104/api/generate` | Oread |
| `/api/oread/patients/{id}` | `localhost:9104/api/patients/{id}` | Oread |
| `/api/oread/patients/{id}/context` | `localhost:9104/api/patients/{id}/context` | Oread |
| `/api/mneme/import/oread/json` | `localhost:9102/api/import/oread/json` | Mneme |
| `/api/syrinx/patients/import` | `localhost:9103/api/patients/import` | Syrinx |
| `/api/echo/question` | `localhost:9101/question` | Echo |
| `/api/athena/conditions` | `localhost:9105/api/conditions` | Athena |
| `/apps/oread/*` | `localhost:9104/*` | Oread UI |
| `/apps/syrinx/*` | `localhost:9103/*` | Syrinx UI |
| `/apps/mneme/*` | `localhost:5173/*` | Mneme frontend |
| `/apps/echo/*` | `localhost:9101/*` | Echo UI |

**Note:** Echo API proxy strips to `''` because Echo routes have no `/api/` prefix. All other API services rewrite to `/api`. Browser code uses these same-origin routes instead of hardcoded `localhost` URLs.

---

## Athena Integration (New — April 2026)

Athena is the centralized knowledge service. Other services query it for conditions, frameworks, and specialty metadata.

### AthenaClient

Each service has `src/athena_client.py` — a shared HTTP client:

```python
from athena_client import AthenaClient

client = AthenaClient(base_url="http://localhost:9105")
conditions = await client.get_conditions(specialty="pediatrics", age_months=24)
framework = await client.get_framework_for_condition("asthma", specialty="pediatrics")
```

**Graceful degradation:** If Athena is down, the client returns empty lists / None. Services continue to function with local knowledge.

### Specialty Model

Athena resolves knowledge by specialty:
- `pediatrics` → pools: `peds/` + `shared/`
- `internal_medicine` → pools: `im/` + `shared/`
- `family_practice` → pools: `peds/` + `im/` + `shared/`

---

## How to Test

> **TL;DR — canonical recipe:** after `./start-all.sh`, run `./scripts/e2e-smoke.sh`. It exercises the full critical path (Athena knowledge → Oread generate → Mneme import → Syrinx import → Echo Q&A → Metis proxy) and prints a pass/fail summary. The manual `curl` recipes below are kept for debugging individual hops.

### Prerequisites

Start all services:

```bash
cd /Users/dochobbs/Downloads/Consult/MedEd/metis/scripts
./start-all.sh
./status.sh

# Once all green, run the suite smoke test:
./e2e-smoke.sh
```

Or start individually:

```bash
# Terminal 1 - Athena (start first — knowledge source)
cd /Users/dochobbs/Downloads/Consult/MedEd
source athena/.venv/bin/activate
PYTHONPATH=. uvicorn athena.src.main:app --port 9105

# Terminal 2 - Oread
cd synpat && source .venv/bin/activate && python server.py

# Terminal 3 - Syrinx
cd synvoice && source venv/bin/activate && python server.py

# Terminal 4 - Mneme backend
cd synchart/backend && source .venv/bin/activate && python -m src.main

# Terminal 5 - Mneme frontend
cd synchart/frontend && npm run dev

# Terminal 6 - Echo
cd echo && source .venv/bin/activate && uvicorn src.main:app --port 9101

# Terminal 7 - Metis
cd metis/portal && npm run dev
```

### Test 1: Athena Knowledge

```bash
curl -s http://localhost:9105/api/health | python3 -m json.tool
curl -s "http://localhost:9105/api/conditions?specialty=pediatrics" | python3 -c "import json,sys; print(len(json.load(sys.stdin)), 'conditions')"
curl -s "http://localhost:9105/api/frameworks?specialty=pediatrics" | python3 -c "import json,sys; print(len(json.load(sys.stdin)), 'frameworks')"
```

**Expected:** 46 conditions, 170 frameworks for pediatrics.

### Test 2: Oread Context Endpoint

```bash
curl -s -X POST http://localhost:9104/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"age_months": 24}' | python3 -m json.tool

# Note the "id" field, then:
curl -s http://localhost:9104/api/patients/{PATIENT_ID}/context | python3 -m json.tool
```

**Expected:** Flat JSON with `patient_id`, `source: "oread"`, `name`, `age_years`, `age_months`, `sex`, `problem_list`, `medication_list`, `allergy_list`.

### Test 3: Echo Direct

```bash
curl -s -X POST http://localhost:9101/question \
  -H 'Content-Type: application/json' \
  -d '{
    "learner_question": "What should I consider for fever in a 2 year old?",
    "patient": {
      "patient_id": "test-123",
      "source": "oread",
      "name": "Test Patient",
      "age_years": 2,
      "age_months": 24,
      "sex": "female",
      "problem_list": [{"display_name": "Otitis Media", "is_active": true}]
    }
  }' | python3 -m json.tool
```

**Expected:** Socratic response referencing the patient data.

### Test 4: Full Metis Flow

1. Open http://localhost:9100
2. Set age, click **Generate**
3. Click **Open in Mneme** — should import and open patient detail
4. Click **Send to Syrinx** — should import and open Syrinx UI
5. Type a question in Echo chat — verify response references patient

---

## Errors to Watch For

### 1. "Generation failed" on Dashboard
**Cause:** Oread offline or `/api/generate` endpoint changed.
**Debug:** `curl -s -X POST http://localhost:9104/api/generate -H 'Content-Type: application/json' -d '{"age_months": 24}'`

### 2. Mneme import returns 500
**Cause:** Supabase not configured.
**Debug:** Check `synchart/backend/.env` has valid `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

### 3. Echo chat fails
**Cause:** Echo offline or proxy misconfigured.
**Debug:** `curl http://localhost:9101/health` — Echo proxy must rewrite to `''` (empty), not `'/api'`.

### 4. Athena returns 0 conditions
**Cause:** Knowledge directory empty or wrong path.
**Debug:** Check Athena startup log for "Loaded: X conditions" message.

---

## Known Limitations

1. **Syrinx import is in-memory only.** Restart clears imported patients.
2. **Mneme JSON import needs Supabase.** Without it, "Open in Mneme" fails silently.
3. **Backend auth verification is still per-service work.** Metis forwards Supabase JWTs when a user is signed in, but each backend must verify the token and enforce authorization.
4. **Echo case system is separate.** This integration uses `/question` for ad-hoc Q&A. Echo's full case system uses `/cases/start/dynamic`.
5. **Athena fallback not yet wired.** AthenaClient is distributed but services don't yet call it at runtime (Plan 5 work).

---

## File Quick Reference

| What you need | Where to find it |
|---------------|-----------------|
| Patient → PatientContext converter | `synpat/src/exporters/context_export.py` |
| Oread context endpoint | `synpat/server.py` search for `/context` |
| Syrinx import endpoints | `synvoice/server.py` search for `/api/patients` |
| Mneme JSON import | `synchart/backend/src/routers/import_.py` search for `oread/json` |
| Dashboard integration logic | `metis/portal/src/pages/Dashboard.tsx` |
| Vite proxy config | `metis/portal/vite.config.ts` |
| EchoClient (Mneme's) | `synchart/backend/src/services/echo_client.py` |
| AthenaClient (shared) | `athena/client/athena_client.py` (canonical), `{oread,echo}/src/athena_client.py` (copies) |
| Athena knowledge | `athena/knowledge/{conditions,frameworks,specialties}/` |
| Echo's actual routes | `echo/src/main.py` (router mounts) |
| Mneme auth middleware | `synchart/backend/src/middleware/auth.py` |
| v2 Platform Spec | `docs/specs/2026-04-03-meded-v2-platform-design.md` |
