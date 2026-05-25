# Glossary

Quick definitions for MedEd-specific terms and the medical-coding standards the platform uses.

---

## Platform terms

**Athena** — The knowledge service. Single source of truth for conditions, teaching frameworks, specialties, and learner tracks. Every other service queries it.

**Condition** — A clinical entity (e.g., Asthma, Otitis Media). Tagged with codes (SNOMED, ICD-10) and specialty metadata. Lives in Athena's `knowledge/conditions/{peds,im,shared}/`.

**Disease arc** — A multi-encounter narrative for a single patient (e.g., "T1DM diagnosis → first DKA → adherence struggles → stable"). Lives in Athena. Currently peds-only.

**Echo** — The AI Attending tutor service. Uses teaching frameworks to ask Socratic questions.

**Ecosystem mode** — `METIS_MODE=ecosystem`. Services use restricted CORS, require auth, and track progress. Opposite of standalone mode.

**Framework** (aka "teaching framework") — A structured pedagogical scaffold for one condition (e.g., "Asthma: severity classification → step-up therapy → control assessment"). Used by Echo. Lives in Athena's `knowledge/frameworks/`.

**Learner level** — Where a learner is in training: medical student (MS3, MS4), resident (PGY1-3), NP. Affects question depth and framework complexity Echo selects.

**Learner track** — A persona-level grouping (e.g., "PGY-1 Family Medicine resident"). 15 currently defined in Athena.

**Mneme** — The minimal-EMR service.

**Metis** — The unified portal and routing layer. Top of the request flow.

**Oread** — The synthetic-patient generator.

**PatientContext** — A flat shape Echo expects: `name`, `age_years`, `age_months`, `sex`, `source`, `problem_list`, `medication_list`, `allergy_list`. Oread's `/api/patients/{id}/context` produces it.

**Specialty** — One of Pediatrics, Internal Medicine, Family Practice. Drives Athena's knowledge-pool resolver.

**Specialty resolver** — Athena's logic for unioning knowledge pools by specialty. Peds → `peds/` + `shared/`. IM → `im/` + `shared/`. FP → all three.

**Standalone mode** — `METIS_MODE=standalone` (default). Permissive CORS, optional auth. Each service runs by itself; no progress tracking.

**Syrinx** — The voice-encounter service. Generates dialogue scripts and audio.

**Time Travel** — Oread feature that advances a patient's clinical timeline (e.g., "show this patient 6 months from now") to simulate disease progression.

---

## Medical coding standards

**SNOMED CT** — Systematized Nomenclature of Medicine — Clinical Terms. Comprehensive clinical vocabulary used for diagnoses. OID `2.16.840.1.113883.6.96`. Example: Otitis Media = `65363002`. Browse: https://browser.ihtsdotools.org/

**ICD-10-CM** — International Classification of Diseases, 10th Revision, Clinical Modification. Billing diagnoses. OID `2.16.840.1.113883.6.90`. Example: Otitis Media = `H66.90`. Lookup: https://www.icd10data.com/

**RxNorm** — Standardized medication naming maintained by the NLM. OID `2.16.840.1.113883.6.88`. Example: Amoxicillin = `723`. Navigator: https://mor.nlm.nih.gov/RxNav/

**LOINC** — Logical Observation Identifiers Names and Codes. Lab tests, observations. OID `2.16.840.1.113883.6.1`. Example: Rapid Strep = `78012-2`. Search: https://loinc.org/search/

**CVX** — Vaccine codes maintained by CDC/IIS. Example: DTaP = `20`. List: https://www.cdc.gov/vaccines/programs/iis/cvx/

**CPT** — Current Procedural Terminology. AMA-maintained procedure/visit codes. Used for billing practice.

**FHIR R4** — Fast Healthcare Interoperability Resources, Release 4. HL7 standard for clinical data exchange. Oread can export patients as FHIR.

**C-CDA 2.1** — Consolidated Clinical Document Architecture. XML standard for clinical documents (discharge summaries, progress notes). Oread can export as C-CDA.

**HL7 v2** — Pipe-delimited message format used in legacy EHR-to-EHR communication. Oread can export as HL7 v2.

**OID** — Object Identifier. Unique numeric identifier used in C-CDA to specify which code system a value comes from.

---

## Pediatrics-specific terms

**HEEADSSS** — Adolescent psychosocial assessment framework (Home, Education, Eating, Activities, Drugs, Sexuality, Suicide, Safety). One of Athena's peds frameworks.

**Tanner staging** — Pubertal development scale (1-5). Used in adolescent assessment.

**Bright Futures** — AAP's primary care preventive services guideline. Source for well-child visit content.

**ASQ** — Ages and Stages Questionnaire. Developmental screening tool.

**M-CHAT-R** — Modified Checklist for Autism in Toddlers, Revised. Autism screening at 18 and 24 months.

---

## Internal-medicine-specific terms

**USPSTF** — US Preventive Services Task Force. Source for adult screening recommendations.

**ACC/AHA risk** — American College of Cardiology / American Heart Association cardiovascular risk calculator. Drives statin decisions in primary prevention.

**ASCVD** — Atherosclerotic Cardiovascular Disease. The thing the ACC/AHA risk calculator predicts.

**A1C** — Glycated hemoglobin. Three-month average blood glucose. Diabetes diagnosis ≥ 6.5%.

---

## Acronyms used in code/docs

| Acronym | Expansion |
|---|---|
| ACGME | Accreditation Council for Graduate Medical Education |
| CDS | Clinical Decision Support |
| DPC | Direct Primary Care |
| EHR / EMR | Electronic Health Record / Medical Record |
| HPI | History of Present Illness |
| IM | Internal Medicine |
| FP | Family Practice |
| NP | Nurse Practitioner |
| PHI | Protected Health Information |
| PII | Personally Identifiable Information |
| PGY | Post-Graduate Year (residency year) |
| STT | Speech-to-Text |
| TTS | Text-to-Speech |
| YAML | Yet Another Markup Language (Athena content files) |
