# Roadmap

The MedEd v2 platform work was decomposed into 5 sequential plans, **all complete** as of April 2026. This page summarizes what was done, what's next for MVP polish, and the post-MVP backlog.

For the full architectural spec, see [PLATFORM-DESIGN.md](PLATFORM-DESIGN.md).

---

## v2 Plans (Complete)

| Plan | Name | Depends on | Status |
|------|------|------------|--------|
| **1** | Athena Service (Foundation) | — | ✅ Complete — 62 tests, 12 endpoints |
| **2** | Knowledge Migration | Plan 1 | ✅ Complete — 46 conditions, 170 frameworks migrated |
| **3** | Service Wiring (Ports + AthenaClient) | Plan 2 | ✅ Complete — ports 9100-9105 in production |
| **4** | IM Content Authoring | Plan 1 (schema only) | ✅ Complete — 167 conditions + 167 frameworks |
| **5** | Integration & MVP Polish | Plans 1-4 | ✅ Complete — specialty selector, Echo→Athena, E2E tested |

### What each plan delivered

**Plan 1 — Athena Service** Build Athena from scratch: FastAPI server, Pydantic models, YAML loader, specialty resolver, all API endpoints, AthenaClient library. Validated with 3-5 test fixture conditions before content migration.

**Plan 2 — Knowledge Migration** Move existing peds knowledge from Oread (conditions, disease arcs, immunizations, growth) and Echo (frameworks) into Athena's directory structure. Add specialty metadata to existing conditions. Validate migrated data loads correctly.

**Plan 3 — Service Wiring** Update all services to new ports (9100-9105). Integrate `AthenaClient` into Oread and Echo. Add `specialty` parameter to key API endpoints. Update Metis proxy and startup scripts.

**Plan 4 — IM Content Authoring** Create ~175 IM condition YAMLs and matching teaching frameworks following the established schema. Tag shared conditions with specialty variants. Ran in parallel with Plan 3.

**Plan 5 — Integration & MVP Polish** End-to-end testing across all 6 services. Fix Oread validation bugs. Metis dashboard specialty selector. Graceful degradation testing. Final MVP quality pass.

---

## Near-term (next release)

- **Oread engine reads Athena at runtime.** AthenaClient is distributed but Oread still reads local `conditions.yaml`. Wire it into the generation engine.
- **Mneme JSON-import contract hardening.** Currently silent-fails when Supabase isn't configured; should surface a clear error.
- **Syrinx persistent patient store.** Current in-memory store loses patients on restart.
- **Oread R69 ICD-10 fallback** for edge-case conditions (pre-existing, non-blocking).

---

## Post-MVP backlog

Roughly prioritized:

### Content
- **IM disease arcs** — Athena has 6 peds disease arcs; needs IM equivalents (e.g., diabetic complications progression, HTN end-organ damage)
- **Adult immunization schedule** in Athena
- **Wellness-visit frameworks** for both Peds and IM

### Capabilities
- **Vaccine engine** — catch-up schedule logic for missed immunizations
- **Documentation practice** — learners write notes; AI gives feedback on completeness, clinical reasoning, billing-relevance
- **Billing / coding practice** — ICD-10 + CPT selection drills tied to encounters
- **Spaced repetition** — surface learners back to weak conditions/frameworks over time
- **Analytics** — per-learner mastery dashboards

### Platform
- **ACGME competency mapping** — tag frameworks against ACGME milestones
- **Multi-tenant** — currently single Supabase project; need program-level isolation
- **Production deployment story** — see [DEPLOYMENT.md](DEPLOYMENT.md) for current state (dev-only)

---

## How decisions get made

- **Suite-level changes** (new service, port move, cross-service contract change) — discussed in this repo, documented in [PLATFORM-DESIGN.md](PLATFORM-DESIGN.md)
- **Per-service changes** — owned by each service repo
- **Curriculum content** — owned by Athena, but tagged by specialty so contributors can target Peds vs IM vs shared
