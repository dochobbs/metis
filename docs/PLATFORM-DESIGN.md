# MedEd Platform v2 — Design Specification

**Date:** 2026-04-03
**Status:** Draft
**Author:** Doc Hobbs + Claude

## 1. Overview

MedEd is a pediatric medical education ecosystem evolving into a **primary care education platform** covering Pediatrics, Internal Medicine, and Family Practice. The platform consists of six microservices, each named after figures from Greek mythology, designed to function both independently and as an integrated suite.

### Goals

1. Expand specialty coverage from peds-only to full primary care (Peds + IM + FP)
2. Centralize all medical knowledge into a single curriculum service (Athena)
3. Tightly integrate all services while preserving independent operation
4. Reach MVP readiness for medical learners at all levels

### Target Users

Medical learners across levels:
- Medical students (MS3/MS4 clerkship rotations)
- Residents (PGY-1 through PGY-3+ in peds, IM, FM)
- NP/PA students (primary care focused)

---

## 2. Service Architecture

### Service Roster

| Service | Directory | Port | Prefix | Role | Namesake |
|---------|-----------|------|--------|------|----------|
| **Metis** | `metis/` | 9100 | — | Unified portal, service routing, shared models | Titan of wisdom/counsel |
| **Echo** | `echo/` | 9101 | `/api/` | AI Attending tutor (Socratic feedback, debriefs) | Nymph who repeated speech |
| **Mneme** | `synchart/` | 9102 | `/api/` | Minimal EMR interface | Muse of memory |
| **Syrinx** | `synvoice/` | 9103 | `/api/` | Voice encounter scripts + TTS audio | Pan pipes (voice/sound) |
| **Oread** | `synpat/` | 9104 | `/api/` | Synthetic patient generation | Mountain nymphs |
| **Athena** | `athena/` | 9105 | `/api/` | Curriculum, knowledge registry, specialty resolver | Goddess of wisdom |

### Architecture Diagram

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

### Independence Principle

Each service runs standalone with graceful degradation:
- If Athena is down → services fall back to embedded local knowledge cache
- If Echo is down → Mneme still works as an EMR
- If Oread is down → Mneme can import patients from file
- Metis is the only service that requires others to be useful

### Data Flow

```
Learner opens Metis (9100)
  → selects specialty (peds/IM/FP) and learner level
  → Metis queries Athena (9105) for available conditions/frameworks
  → Learner picks a case type
  → Metis tells Oread (9104) to generate patient
    → Oread asks Athena for condition details + age-appropriate params
  → Patient flows to Mneme (9102) for EMR review
  → Syrinx (9103) generates voice encounter from patient
  → Echo (9101) tutors using Athena's teaching framework
  → Echo debriefs with specialty-appropriate learning objectives
```

---

## 3. Specialty Model

### Three Specialties at Launch

| Specialty | Age Range | Knowledge Pool |
|-----------|-----------|----------------|
| **Pediatrics** | 0-18 years | `peds/` + `shared/` |
| **Internal Medicine** | 18+ years | `im/` + `shared/` |
| **Family Practice** | All ages | `peds/` + `im/` + `shared/` (union) |

FP is not a separate knowledge base — it is a resolver mode that queries both peds and IM pools.

### Three Axes of Specialty Differentiation

1. **Condition-level**: Some conditions are specialty-specific (croup is peds-only, COPD is IM-only)
2. **Patient-level**: Same condition presents differently by age (UTI in a 6-month-old vs a 70-year-old)
3. **Curriculum-level**: Teaching goals and assessment criteria differ by learner track

All three axes are represented in Athena's knowledge schema.

---

## 4. Athena — Curriculum & Knowledge Service

### Responsibility Boundary

| Athena Owns | Services Own |
|-------------|--------------|
| Condition registry (what conditions exist, specialty tags, age ranges) | How to generate a patient with that condition (Oread) |
| Teaching frameworks (learning objectives per condition per specialty) | How to deliver Socratic feedback (Echo) |
| Specialty definitions (peds, IM, FP = peds+IM) | How to build encounter scripts (Syrinx) |
| Learner track definitions (what a PGY-1 peds resident should know vs MS3 on IM rotation) | How to render the EMR view (Mneme) |
| Knowledge resolver (specialty + age + level → filtered knowledge) | All UI, voice, generation, tutoring logic |

### Directory Structure

```
athena/
├── src/
│   ├── main.py                    # FastAPI server (port 9105)
│   ├── config.py                  # Settings, env vars
│   ├── resolver.py                # Core: specialty + age + level → filtered knowledge
│   ├── models.py                  # Pydantic schemas
│   └── routers/
│       ├── conditions.py          # GET /api/conditions?specialty=peds&age_months=6
│       ├── frameworks.py          # GET /api/frameworks?condition=asthma&specialty=peds&level=pgy1
│       ├── specialties.py         # GET /api/specialties
│       ├── learners.py            # GET /api/learner-tracks
│       ├── immunizations.py       # GET /api/immunizations?age_months=12
│       └── health.py              # GET /api/health
├── knowledge/
│   ├── specialties/
│   │   ├── pediatrics.yaml
│   │   ├── internal_medicine.yaml
│   │   └── family_practice.yaml   # References peds + IM
│   ├── conditions/
│   │   ├── shared/                # Conditions spanning specialties
│   │   ├── peds/                  # Peds-only conditions (~200 migrated from Oread)
│   │   └── im/                    # IM-only conditions (~175 new)
│   ├── frameworks/
│   │   ├── shared/
│   │   ├── peds/                  # Migrated from Echo (174 existing)
│   │   └── im/                    # New IM frameworks (~175)
│   ├── disease_arcs/
│   │   ├── peds/                  # Migrated from Oread (6 existing)
│   │   └── im/                    # New IM arcs
│   ├── immunizations/
│   │   ├── peds_aap.yaml          # Migrated from Oread
│   │   └── adult_acip.yaml        # New
│   └── growth/
│       ├── peds_cdc_2000/         # Migrated from Oread
│       └── adult_bmi/             # New
├── tests/
├── requirements.txt
└── CLAUDE.md
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/conditions` | List conditions with filters (specialty, age, level, system) |
| `GET` | `/api/conditions/{id}` | Full condition definition |
| `GET` | `/api/frameworks` | List frameworks with filters |
| `GET` | `/api/frameworks/{id}` | Full teaching framework |
| `GET` | `/api/specialties` | List specialty definitions |
| `GET` | `/api/specialties/{name}` | Specialty detail |
| `GET` | `/api/learner-tracks` | List learner track definitions |
| `GET` | `/api/immunizations` | Immunization schedule (filtered by age) |
| `GET` | `/api/disease-arcs` | Disease arc definitions |
| `GET` | `/api/health` | Health check |

### Resolver Logic

The core of Athena — given a query context, return the right knowledge:

```python
def resolve_conditions(
    specialty: str,
    age_months: int | None = None,
    level: str | None = None,
    system: str | None = None,
) -> list[Condition]:
    # FP → ["peds", "im"], peds → ["peds"], im → ["im"]
    pools = specialty_map[specialty]
    # Load from shared/ + each specialty-specific dir
    conditions = load_from_pools(pools)
    if age_months:
        conditions = filter_by_age(conditions, age_months)
    if level:
        conditions = filter_by_complexity(conditions, level)
    if system:
        conditions = filter_by_organ_system(conditions, system)
    return conditions
```

### Condition Schema

Extends the existing Oread YAML schema with specialty metadata:

```yaml
asthma:
  # Identity
  display_name: "Asthma"
  snomed: "195967001"
  icd10: "J45.909"
  rxnorm_primary: "435"  # albuterol

  # Specialty metadata (NEW)
  specialties: [peds, im]
  age_range:
    min_months: 12
    max_months: null
  organ_system: pulmonary
  acuity: [chronic, acute_exacerbation]
  complexity:
    student: moderate
    resident: straightforward
    attending: straightforward

  # Specialty variants (NEW)
  specialty_variants:
    peds:
      typical_age: "5-12 years"
      common_triggers: [viral_uri, exercise, allergens]
      teaching_emphasis: "action plan compliance, spacer technique, exercise-induced"
      key_differentials: [bronchiolitis, foreign_body, croup]
    im:
      typical_age: "25-65 years"
      common_triggers: [occupational, GERD, obesity, aspirin]
      teaching_emphasis: "step therapy, biologic eligibility, COPD overlap"
      key_differentials: [COPD, CHF, PE, vocal_cord_dysfunction]

  # Clinical data (existing schema, preserved)
  vitals_impact:
    respiratory_rate: {modifier: "elevated", range: [22, 40]}
    spo2: {modifier: "decreased", range: [88, 95]}
  symptoms: [...]
  physical_exam: [...]
  labs: [...]
  medications: [...]
```

### AthenaClient (Shared)

Lightweight client distributed to each service:

```python
class AthenaClient:
    def __init__(self, base_url: str = "http://localhost:9105"):
        self.base_url = base_url
        self._cache: dict = {}
        self._fallback_path: Path | None = None

    async def get_conditions(
        self,
        specialty: str,
        age_months: int | None = None,
        level: str | None = None,
    ) -> list[dict]: ...

    async def get_framework(
        self,
        condition: str,
        specialty: str,
        level: str | None = None,
    ) -> dict: ...

    async def get_condition(self, condition_id: str) -> dict: ...
    async def get_immunizations(self, age_months: int) -> list[dict]: ...
    async def get_specialty(self, name: str) -> dict: ...
    async def health_check(self) -> bool: ...
```

If Athena is unreachable, client falls back to local cache. Services never break due to Athena being down.

---

## 5. Service Refactoring

### Knowledge Migration

| Asset | From | To |
|-------|------|----|
| 200+ condition YAMLs | Oread `knowledge/conditions/` | Athena `knowledge/conditions/peds/` |
| 6 disease arcs | Oread `knowledge/conditions/disease_arcs.yaml` | Athena `knowledge/disease_arcs/peds/` |
| 174 teaching frameworks | Echo `knowledge/frameworks/` | Athena `knowledge/frameworks/peds/` |
| 11 condition knowledge files | Echo `knowledge/conditions/` | Athena `knowledge/conditions/peds/` |
| Immunization schedules | Oread `knowledge/immunizations/` | Athena `knowledge/immunizations/` |
| CDC growth data | Oread `knowledge/growth/` | Athena `knowledge/growth/` |

### Oread (9104) Changes

**Removes:**
- `knowledge/conditions/conditions.yaml` → Athena
- `knowledge/conditions/disease_arcs.yaml` → Athena
- `knowledge/immunizations/` → Athena
- `knowledge/growth/` → Athena

**Adds:**
- `AthenaClient` for knowledge queries
- `specialty` parameter on `/api/generate`
- Local fallback cache (snapshot of Athena data for offline mode)

**Keeps:**
- Generation engine (`src/engines/engine.py`)
- All exporters (JSON, FHIR, C-CDA, Markdown, Context)
- Web UI, CLI, Supabase integration
- LLM narrative generation

**Fixes:**
- Validation auto-fix for age-impossible conditions
- Validation auto-fix for missing required medications
- R69 garbage code replacement

### Echo (9101) Changes

**Removes:**
- `knowledge/frameworks/` (174 files) → Athena
- `knowledge/conditions/` (11 files) → Athena
- Framework loader (`src/frameworks/loader.py`) → replaced by AthenaClient calls

**Adds:**
- `AthenaClient` for framework + condition queries
- `specialty` and `learner_level` on case start endpoints

**Keeps:**
- Socratic tutor engine (`src/core/tutor.py`)
- Case generation logic (dynamic, well-child)
- Voice I/O (ElevenLabs, Deepgram)
- Auth, admin dashboard
- React SPA + embeddable widget
- All prompt files (`src/prompts/`)

### Syrinx (9103) Changes

**Removes:** Nothing major

**Adds:**
- `AthenaClient` (optional, for encounter type validation)
- `specialty` parameter on `/api/generate`

**Keeps:** All existing functionality

### Mneme (9102) Changes

**Removes:** Nothing

**Adds:**
- Specialty context passed through from Metis to learning sessions

**Keeps:** All existing functionality (importers, DB, learning engine, React UI)

### Metis (9100) Changes

- Vite proxy config updated to new ports (9101-9105)
- Add Athena proxy: `/api/athena/*` → `localhost:9105/api/*`
- Dashboard adds specialty selector
- `start-all.sh` updated with new ports + Athena service
- Model sync (`sync.py`) updated to include Athena schemas

---

## 6. Internal Medicine Content

### Condition Inventory (~175 conditions)

**Cardiology (20-25):**
Hypertension, Hypertensive Emergency, CHF (HFrEF), CHF (HFpEF), Atrial Fibrillation, Atrial Flutter, SVT, ACS/STEMI, ACS/NSTEMI, Unstable Angina, Stable Angina, Aortic Stenosis, Mitral Regurgitation, Pericarditis, Myocarditis, Endocarditis, Peripheral Arterial Disease, Aortic Dissection, Bradycardia, Syncope

**Pulmonary (15-18):**
COPD Exacerbation, COPD Stable, Community-Acquired Pneumonia, Hospital-Acquired Pneumonia, Pulmonary Embolism, Asthma (adult variant), Pleural Effusion, Pneumothorax, Lung Cancer, Interstitial Lung Disease, OSA, Sarcoidosis, Hemoptysis, Acute Respiratory Failure, TB

**GI (18-20):**
GERD, PUD, GI Bleed Upper, GI Bleed Lower, Cirrhosis, Hepatitis B, Hepatitis C, Acute Pancreatitis, Chronic Pancreatitis, Cholecystitis, Choledocholithiasis, Diverticulitis, IBD-Crohn's, IBD-UC, C. diff Colitis, SBO, Celiac (adult), Colon Cancer Screening/Polyps, Alcoholic Hepatitis, Ascites/SBP

**Endocrine (12-15):**
Type 2 Diabetes, DKA, HHS, Hypothyroidism, Hyperthyroidism/Graves, Thyroid Nodule, Adrenal Insufficiency, Cushing Syndrome, Pheochromocytoma, Hypercalcemia, Hyponatremia, Hyperkalemia, Metabolic Syndrome, Osteoporosis

**Renal (12-15):**
AKI Pre-renal, AKI Intrinsic, AKI Post-renal, CKD Stages 3-5, Nephrotic Syndrome, Nephritic Syndrome, Nephrolithiasis, Rhabdomyolysis, Dialysis Complications, Renal Artery Stenosis, Polycystic Kidney Disease, Acid-Base Disorders

**Hematology/Oncology (15-18):**
Iron-Deficiency Anemia (adult), B12 Deficiency, Folate Deficiency, Anemia of Chronic Disease, Sickle Cell Crisis, TTP/HUS, DIC, DVT, PE (heme perspective), Leukemia (AML/CLL), Lymphoma, Multiple Myeloma, Pancytopenia, Thrombocytopenia, Anticoagulation Management

**Infectious Disease (18-20):**
Sepsis/SIRS, UTI (adult), Pyelonephritis, Cellulitis, Osteomyelitis, Endocarditis, Meningitis (adult), Encephalitis, HIV/AIDS, Opportunistic Infections, Influenza, COVID, C. diff, Necrotizing Fasciitis, Febrile Neutropenia, Bacteremia/Line Infections, Tick-Borne (Lyme), Fungal Infections

**Rheumatology (12-15):**
Rheumatoid Arthritis, SLE, Gout, Pseudogout, Polymyalgia Rheumatica, Giant Cell Arteritis, Ankylosing Spondylitis, Vasculitis (GPA/MPA), Scleroderma, Dermatomyositis/Polymyositis, Antiphospholipid Syndrome, Reactive Arthritis, Septic Arthritis

**Neurology (15-18):**
Ischemic Stroke, Hemorrhagic Stroke, TIA, Seizure/Epilepsy, Status Epilepticus, Migraine (adult), Meningitis (neuro), MS, Parkinson's, ALS, Myasthenia Gravis, Guillain-Barré, Peripheral Neuropathy, Delirium, Dementia/Alzheimer's, Normal Pressure Hydrocephalus

**Psychiatry (10-12):**
Major Depressive Disorder, Generalized Anxiety, Panic Disorder, Bipolar Disorder, Schizophrenia, Alcohol Use Disorder, Opioid Use Disorder, Delirium (psych overlap), PTSD, Suicidal Ideation Assessment, Serotonin Syndrome, NMS

**Dermatology (8-10):**
Cellulitis (derm perspective), Herpes Zoster, Psoriasis, Drug Eruptions, SJS/TEN, Melanoma Screening, Diabetic Skin Complications, Pressure Ulcers, Erythema Nodosum

**Geriatrics (8-10):**
Polypharmacy, Falls Assessment, Delirium vs Dementia, Failure to Thrive, Pressure Injuries, Palliative Care/Goals of Care, Elder Abuse Screening, UTI in Elderly (atypical presentation), Osteoporotic Fractures

### Shared Conditions (Peds + IM Variants)

These existing peds conditions gain `specialty_variants` with IM-specific presentations:

Asthma, Type 1 Diabetes, Type 2 Diabetes, UTI, Allergic Rhinitis, Obesity, Iron-Deficiency Anemia, Headache/Migraine, Depression/Anxiety, Eczema/Atopic Dermatitis, Seizures/Epilepsy, IBD, Celiac Disease, SLE, Meningitis

### Content Generation Strategy

Use the same approach as peds conditions:
1. Define YAML schema with SNOMED/ICD-10/RxNorm codes
2. Include vitals impact, symptoms, PE findings, labs, medications
3. Add age ranges, specialty tags, complexity ratings
4. Build teaching frameworks with learning objectives, differentials, management algorithms
5. Validate codes against standard terminologies

---

## 7. MVP Definition

### In Scope

- All 6 services running on new ports, wired through Metis
- Athena service built and operational
- Peds content migrated to Athena (existing ~200 conditions + 174 frameworks)
- IM content seeded in Athena (~175 conditions + matching frameworks)
- Shared conditions tagged with specialty variants
- FP resolver working (union of peds + IM)
- Specialty selector in Metis dashboard
- `specialty` parameter flowing through all service APIs
- Core learning loop: pick specialty → get case → review chart → get tutored → get debriefed
- Each service works independently if others are down
- Oread validation bugs fixed (age gates, missing meds, R69 codes)
- Core integration paths tested

### Out of Scope (Post-MVP)

- CME/credentialing infrastructure
- ACGME competency mapping
- Spaced repetition / analytics dashboard
- Billing/coding practice
- Documentation practice (note writing with AI feedback)
- Vaccine catch-up calculator
- Mobile responsiveness
- Docker/containerized deployment
- Instructor dashboards beyond what Echo already has

### Quality Bar

| Area | Requirement |
|------|-------------|
| **Tests** | Core paths tested: Athena resolver, Oread generation with Athena, Echo framework loading from Athena. Critical integration seams covered. |
| **Oread validation** | Fix 3 known bugs (age gates, missing meds, R69 codes). Generated patients clinically plausible. |
| **IM content** | ~175 conditions with full YAML definitions + matching teaching frameworks. |
| **Error handling** | Graceful degradation everywhere. Clear error messages. AthenaClient falls back to cache. |
| **Ports** | All services on 9100-9105. Metis proxy updated. start-all.sh works. |

---

## 8. Metis Proxy Configuration

Updated Vite proxy for new port scheme:

```typescript
// metis/portal/vite.config.ts
export default defineConfig({
  server: {
    port: 9100,
    proxy: {
      '/api/echo':   { target: 'http://localhost:9101', rewrite: p => p.replace(/^\/api\/echo/, '') },
      '/api/mneme':  { target: 'http://localhost:9102', rewrite: p => p.replace(/^\/api\/mneme/, '/api') },
      '/api/syrinx': { target: 'http://localhost:9103', rewrite: p => p.replace(/^\/api\/syrinx/, '/api') },
      '/api/oread':  { target: 'http://localhost:9104', rewrite: p => p.replace(/^\/api\/oread/, '/api') },
      '/api/athena': { target: 'http://localhost:9105', rewrite: p => p.replace(/^\/api\/athena/, '/api') },
    }
  }
})
```

Note: Echo proxy rewrites to `''` (empty) because Echo routes lack `/api/` prefix. All other services use `/api/` prefix.

---

## 9. Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Python 3.11+, FastAPI, Pydantic v2 |
| **Database** | Supabase (PostgreSQL) |
| **Frontend** | React 18, TypeScript, Tailwind (Mneme, Echo, Metis) |
| **LLM** | Anthropic Claude API |
| **TTS** | ElevenLabs |
| **STT** | Deepgram, Whisper (optional) |
| **Medical Standards** | SNOMED CT, ICD-10, RxNorm, LOINC, CVX, FHIR R4, C-CDA 2.1 |
| **Knowledge Format** | YAML (conditions, frameworks, arcs), JSON Schema (shared models) |

---

## 10. Open Questions

1. **Adult growth data**: What does Athena serve for adults instead of CDC growth charts? BMI tracking? Framingham risk scores? Or omit for MVP?
2. **Well-child → wellness visits**: Echo has well-child visit support (13 visit types). Should Athena add adult wellness/preventive care frameworks (annual physical, cancer screening ages)?
3. **Disease arcs for IM**: Peds has 6 disease arcs. What IM arcs make sense? (e.g., Metabolic Syndrome → T2DM → CKD, Alcohol Use → Cirrhosis → Decompensation)
4. **Shared model sync**: Does Athena get included in Metis's `sync.py` model generation, or does it define its own canonical models?
5. **Echo `/api/` prefix**: Echo currently lacks the `/api/` prefix that all other services use. The port migration is an opportunity to standardize this. Should we add `/api/` to Echo's routes?

---

## Appendix: File Reference

| File | Purpose |
|------|---------|
| `athena/src/main.py` | FastAPI server entry point |
| `athena/src/resolver.py` | Core specialty + age + level resolver |
| `athena/knowledge/conditions/` | All condition YAML files by specialty |
| `athena/knowledge/frameworks/` | All teaching frameworks by specialty |
| `athena/knowledge/specialties/` | Specialty definition files |
| `metis/portal/vite.config.ts` | Service proxy routing |
| `metis/scripts/start-all.sh` | Platform startup script |
| `metis/shared/models/` | Canonical JSON Schema definitions |
| `docs/specs/2026-04-03-meded-v2-platform-design.md` | This document |
