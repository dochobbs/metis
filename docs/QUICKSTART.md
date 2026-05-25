# Quickstart

End-to-end setup for the MedEd suite on a fresh macOS machine. Aim: portal at http://localhost:9100 with all six services healthy in ~15 minutes.

For one-service-only dev (e.g., just hacking on Echo), each service repo has its own README.

---

## 1. Prerequisites

```bash
# macOS
brew install python@3.11 node git
```

Versions needed:

- Python 3.11 or newer
- Node 20 or newer
- Git with SSH keys configured for GitHub

---

## 2. Clone the suite

```bash
mkdir -p ~/Code/MedEd && cd ~/Code/MedEd

git clone git@github.com:dochobbs/metis.git
git clone git@github.com:dochobbs/echo.git
git clone git@github.com:dochobbs/mneme.git    synchart
git clone git@github.com:dochobbs/oread.git    synpat
git clone git@github.com:dochobbs/syrinx.git   synvoice
# athena is internal — request access
```

Note the directory remaps: GitHub names are mythological, on-disk names are descriptive.

```
MedEd/
├── metis/
├── echo/
├── synchart/   # → Mneme
├── synpat/     # → Oread
├── synvoice/   # → Syrinx
└── athena/     # internal
```

---

## 3. Environment variables

Put these in `~/.zshrc` (or `~/.bashrc`):

```bash
# Required for all LLM features (Echo, Syrinx, Oread)
export ANTHROPIC_API_KEY=sk-ant-...

# Required for voice features (Syrinx, Echo)
export ELEVEN_LABS_API_KEY=...
export ELEVEN_API_KEY=...       # Syrinx uses this name

# Required for database features (Oread panels, Mneme)
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_ANON_KEY=eyJ...

# Optional for Echo voice input
export DEEPGRAM_API_KEY=...
```

Reload: `source ~/.zshrc`.

### Portal-specific env

The Metis portal reads Supabase from `portal/.env`:

```bash
cd metis/portal
cp .env.example .env
$EDITOR .env
# Fill in:
#   VITE_SUPABASE_URL=https://your-project.supabase.co
#   VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 4. Supabase project

Mneme and Oread need a Supabase project. You can use the same instance for both.

1. Create a project at https://supabase.com
2. Copy the URL and anon key into your `~/.zshrc` and `metis/portal/.env`
3. Run the Mneme migrations: see `synchart/backend/migrations/README.md` for the latest steps
4. Run the Oread panel migrations: see `synpat/migrations/README.md`

If you don't need persistence, you can run Oread and Mneme without Supabase — they'll degrade gracefully (Mneme imports will silently fail; Oread panel storage will be disabled).

---

## 5. Install per-service deps

Each Python service uses its own venv. Bootstrap them in one go:

```bash
cd ~/Code/MedEd

for svc in athena echo synpat synvoice synchart/backend; do
  (cd "$svc" && python3.11 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt)
done

# Mneme and Metis frontends
cd synchart/frontend && npm install
cd ../../metis/portal && npm install
```

---

## 6. Start everything

```bash
cd ~/Code/MedEd/metis/scripts
./start-all.sh
./status.sh
```

`status.sh` should show six green services. If any are red, see [Troubleshooting](#troubleshooting).

Open the portal: **http://localhost:9100**

---

## 7. Smoke test

In the portal:

1. Toggle **specialty** (Peds / IM / FP) — counts in the status bar update from Athena
2. Click **Generate** — a new patient appears
3. Click **Open in Mneme** — the patient should land in the EMR
4. Click **Send to Syrinx** — Syrinx opens with the patient context
5. In the Echo chat panel, ask "What should I consider for this patient?" — should get a Socratic response

If all five work, the suite is healthy.

CLI smoke test:

```bash
# Athena health + content counts
curl -s http://localhost:9105/api/health | python3 -m json.tool
curl -s "http://localhost:9105/api/conditions?specialty=pediatrics" | python3 -c "import json,sys; print(len(json.load(sys.stdin)), 'peds conditions')"

# Oread generate
curl -s -X POST http://localhost:9104/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"age_months": 24}' | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])"

# Echo health
curl -s http://localhost:9101/health
```

---

## Troubleshooting

### `status.sh` shows a service as down

```bash
cd metis/scripts
./stop-all.sh && ./start-all.sh
```

If still down, start the service manually in its own terminal so you can see the startup log. The exact command for each service is in its README.

### "Generation failed" in the portal

Oread is offline or `/api/generate` changed. Direct test:

```bash
curl -s -X POST http://localhost:9104/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"age_months": 24}'
```

### Mneme import returns 500

Supabase isn't configured. Check `synchart/backend/.env` has valid `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

### Echo chat fails

Echo offline or proxy misconfigured. Echo's routes have **no** `/api/` prefix — the Vite proxy must rewrite to `''`, not `'/api'`. Check `metis/portal/vite.config.ts`.

### Port conflict

Something else is using 9100-9105 or 5173. Find the squatter:

```bash
lsof -iTCP -sTCP:LISTEN -P -n | grep ":91"
```

### Athena returns 0 conditions

Knowledge directory empty or wrong path. Check Athena's startup log for "Loaded: X conditions" — if X is 0, the YAML path is misconfigured.

---

## Next steps

- Browse [SERVICES.md](SERVICES.md) for what each service does
- Read [ARCHITECTURE.md](ARCHITECTURE.md) for the request flow and dependency graph
- See [INTEGRATION.md](INTEGRATION.md) for exact cross-service request shapes
- Check [GLOSSARY.md](GLOSSARY.md) for medical-coding terms (SNOMED, CVX, LOINC, etc.)
