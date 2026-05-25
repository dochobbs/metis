# Architecture

Visual deep-dive on how the MedEd suite fits together. For text-and-table descriptions see [PLATFORM-DESIGN.md](PLATFORM-DESIGN.md). For exact request/response shapes see [INTEGRATION.md](INTEGRATION.md). For per-service overviews see [SERVICES.md](SERVICES.md).

---

## Service topology

```mermaid
graph TB
  Learner([Learner])
  Metis[Metis Portal<br/>:9100]
  Echo[Echo<br/>AI Tutor<br/>:9101]
  Mneme[Mneme<br/>EMR<br/>:9102]
  Syrinx[Syrinx<br/>Voice<br/>:9103]
  Oread[Oread<br/>Patients<br/>:9104]
  Athena[(Athena<br/>Knowledge<br/>:9105)]
  Supabase[(Supabase<br/>Postgres)]

  Learner -->|browser| Metis
  Metis -->|proxy /api/echo/*| Echo
  Metis -->|proxy /api/mneme/*| Mneme
  Metis -->|proxy /api/syrinx/*| Syrinx
  Metis -->|proxy /api/oread/*| Oread
  Metis -->|proxy /api/athena/*| Athena

  Echo -.->|frameworks for condition| Athena
  Oread -.->|condition lookup| Athena
  Mneme -.->|condition lookup| Athena
  Syrinx -.->|condition lookup| Athena

  Mneme --> Supabase
  Oread --> Supabase

  classDef hub fill:#1f2937,stroke:#9ca3af,color:#fff
  classDef knowledge fill:#0e7490,stroke:#67e8f9,color:#fff
  classDef store fill:#4b5563,stroke:#9ca3af,color:#fff
  class Metis hub
  class Athena knowledge
  class Supabase store
```

- **Solid arrows** = request flow (learner → portal → backends)
- **Dashed arrows** = knowledge queries (backends → Athena) with graceful fallback

---

## Request flow: generate a patient and tutor on it

```mermaid
sequenceDiagram
  participant L as Learner
  participant M as Metis :9100
  participant O as Oread :9104
  participant A as Athena :9105
  participant E as Echo :9101

  L->>M: Click "Generate" (specialty=peds, age=24mo)
  M->>O: POST /api/generate
  O->>A: GET /api/conditions?specialty=peds&age_months=24
  A-->>O: condition pool
  O-->>M: { id, problem_list, medication_list, ... }
  M-->>L: Patient card rendered

  L->>M: Ask Echo "Why is this kid coughing?"
  M->>O: GET /api/patients/{id}/context
  O-->>M: PatientContext (flat)
  M->>E: POST /question { question, patient }
  E->>A: GET /api/frameworks/for-condition/asthma?specialty=peds
  A-->>E: framework
  E-->>M: Socratic response
  M-->>L: Echo answer rendered
```

---

## Send a generated patient to the EMR

```mermaid
sequenceDiagram
  participant L as Learner
  participant M as Metis :9100
  participant O as Oread :9104
  participant Mn as Mneme :9102
  participant S as Supabase

  L->>M: Click "Open in Mneme"
  M->>O: GET /api/patients/{id}?format=json
  O-->>M: Full patient record
  M->>Mn: POST /api/import/oread/json { patient }
  Mn->>S: INSERT INTO patients, problems, meds, allergies, ...
  S-->>Mn: rows inserted
  Mn-->>M: { mneme_patient_id }
  M-->>L: window.open(Mneme patient page)
```

---

## Dependency graph

Who depends on whom. Athena is the foundation (depends on nothing); Metis is the apex (depends on everyone).

```mermaid
graph BT
  Athena[Athena] --> Supabase[(Supabase)]
  Oread[Oread] --> Athena
  Oread --> Supabase
  Mneme[Mneme] --> Athena
  Mneme --> Supabase
  Syrinx[Syrinx] --> Athena
  Echo[Echo] --> Athena
  Metis[Metis] --> Oread
  Metis --> Mneme
  Metis --> Syrinx
  Metis --> Echo
  Metis --> Athena
```

Reading top-down: Metis sits at the top because it depends on everything. Athena and Supabase are foundational — nothing they need exists higher in the stack.

**Implication for startup order:** `start-all.sh` boots Athena first, then the patient-data services (Oread, Mneme), then the consumers (Echo, Syrinx), then Metis last.

---

## Specialty resolver

How Athena combines knowledge pools per specialty:

```mermaid
graph LR
  subgraph Pools
    PedsP[peds/]
    SharedP[shared/]
    IMP[im/]
  end
  subgraph Specialties
    Peds[pediatrics]
    IM[internal_medicine]
    FP[family_practice]
  end

  PedsP --> Peds
  SharedP --> Peds
  IMP --> IM
  SharedP --> IM
  PedsP --> FP
  IMP --> FP
  SharedP --> FP
```

FP is not a separate knowledge base — it's the union of peds + IM + shared.

---

## Vite proxy map (dev only)

The dev portal at `:9100` proxies API calls so the browser only sees one origin. All routes have `/api/{service}` prefix from the browser's side:

```mermaid
graph LR
  Browser -->|/api/echo/question| Vite
  Vite -->|rewrite to ''| EchoSvc[Echo :9101<br/>POST /question]
  Browser -->|/api/mneme/import/oread/json| Vite
  Vite -->|rewrite to /api| MnemeSvc[Mneme :9102<br/>POST /api/import/oread/json]
  Browser -->|/api/oread/generate| Vite
  Vite -->|rewrite to /api| OreadSvc[Oread :9104<br/>POST /api/generate]
  Browser -->|/api/athena/conditions| Vite
  Vite -->|rewrite to /api| AthenaSvc[Athena :9105<br/>GET /api/conditions]
```

**Gotcha:** Echo paths get stripped to empty (`''`), not rewritten to `/api`, because Echo's routes don't carry the `/api/` prefix. All others rewrite to `/api`.

In production this proxy becomes a real reverse proxy (Caddy/nginx) — see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Graceful degradation

Every service that depends on Athena uses an `AthenaClient` with a fallback path:

```mermaid
graph TB
  Service[Echo / Oread / Mneme / Syrinx]
  AthenaClient[AthenaClient]
  Athena[(Athena :9105)]
  Local[(Local YAML<br/>cache)]
  Empty[Empty result]

  Service --> AthenaClient
  AthenaClient -->|primary| Athena
  AthenaClient -.->|on timeout/5xx, Echo only| Local
  AthenaClient -.->|on timeout/5xx, others| Empty
```

- **Echo** has a full local YAML mirror — frameworks resolve even if Athena is down
- **Oread / Mneme / Syrinx** return empty knowledge results and continue serving; UI degrades gracefully

This means a single bad Athena deploy doesn't take the whole suite offline.

---

## Data model relationships

```mermaid
erDiagram
  Patient ||--o{ Condition : "has"
  Patient ||--o{ Medication : "takes"
  Patient ||--o{ Allergy : "has"
  Patient ||--o{ Immunization : "received"
  Patient ||--|| PatientContext : "exports as"
  Condition }|--|| CodeableConcept : "coded by"
  Medication }|--|| CodeableConcept : "coded by"
  Encounter ||--o{ ScriptLine : "has"
  Encounter ||--o{ InjectedError : "has"
  Encounter ||--|| EncounterContext : "exports as"
  Encounter }o--|| Patient : "for"
```

Shared models live in `metis/shared/models/` as JSON Schema and are code-generated into each service. See [MODEL-SYNC.md](MODEL-SYNC.md).
