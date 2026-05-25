# Changelog

All notable changes to Metis are documented here. The MedEd suite spans multiple repositories — per-service changes live in their own changelogs. This file tracks the **suite hub**: portal, orchestration, shared models, and cross-service contracts.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- `scripts/e2e-smoke.sh` — end-to-end smoke test exercising the critical cross-service path (Athena → Oread → Mneme → Syrinx → Echo → Metis proxy). Read-mostly, jq-based, ~14 checks, exits non-zero on any failure. (W7.3 in BETA-WORKLIST.)
- Public GitHub release of Metis at `dochobbs/metis`
- Suite-level documentation set: README rewrite, `docs/INTEGRATION.md`, `docs/PLATFORM-DESIGN.md`, `docs/SERVICES.md`, `docs/ARCHITECTURE.md`, `docs/CURRICULUM.md`, `docs/ROADMAP.md`, `docs/MODEL-SYNC.md`, `docs/QUICKSTART.md`, `docs/GLOSSARY.md`, `docs/DEPLOYMENT.md`
- `LICENSE` (MIT), `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`
- Expanded `.gitignore` (Python, env, macOS noise)

### Removed
- Tracked `.DS_Store` files (now gitignored)

---

## [0.5.0] — 2026-04

### Added
- **Dynamic Athena stats** in Dashboard (live counts of conditions, frameworks)
- **Learner level selector** (students, residents, NPs) in Dashboard
- **Specialty selector** (Peds / IM / FP) wired into Athena queries
- **Athena service** added to status bar (port 9105)

### Changed
- Redesigned Dashboard as a "command center" with denser layout and clinical typography
- Plan 5 polish: Echo framework loader now queries Athena first, falls back to local YAML

---

## [0.4.0] — 2026-04

### Changed
- **Port migration:** all services moved from 8001-8004 → 9100-9105
  - Metis: 3000 → 9100
  - Echo: 8001 → 9101
  - Mneme backend: 8002 → 9102
  - Syrinx: 8003 → 9103
  - Oread: 8004 → 9104
  - Athena: new at 9105
- Vite proxy updated for new ports; Athena route added
- Startup scripts (`start-all.sh`, `status.sh`, `stop-all.sh`) updated

### Added
- Athena service wiring (proxy + startup)

---

## [0.3.0] — 2026-02

### Added
- Cross-service integration via real API calls (replaced `window.open()`):
  - "Open in Mneme" — fetches patient from Oread → imports to Mneme
  - "Send to Syrinx" — fetches patient → imports to Syrinx (in-memory)
  - Echo chat — fetches `PatientContext` → posts to Echo `/question`
- `docs/INTEGRATION.md` (cross-service architecture guide)

---

## [0.2.0] — 2025-12

### Added
- **Model sync tool** (`shared/sync.py`) — generates Pydantic models from JSON Schema across all projects
- Shared schemas: `clinical.schema.json`, `context.schema.json`
- `METIS_MODE` env var (standalone vs ecosystem behavior)

---

## [0.1.0] — 2025-11

### Added
- Initial portal scaffold (React 18 + Vite + Tailwind)
- Supabase auth integration
- Dashboard with tool cards for the four original services
- Orchestration scripts (`start-all.sh`, `stop-all.sh`, `status.sh`)

---

[Unreleased]: https://github.com/dochobbs/metis/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/dochobbs/metis/releases/tag/v0.5.0
[0.4.0]: https://github.com/dochobbs/metis/releases/tag/v0.4.0
[0.3.0]: https://github.com/dochobbs/metis/releases/tag/v0.3.0
[0.2.0]: https://github.com/dochobbs/metis/releases/tag/v0.2.0
[0.1.0]: https://github.com/dochobbs/metis/releases/tag/v0.1.0
