# Security Policy

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, email **michael@hobbs.md** with:

- A description of the vulnerability and its impact
- Steps to reproduce
- Which service is affected (Metis / Echo / Mneme / Syrinx / Oread / Athena)
- Any suggested mitigations

You'll get an acknowledgement within **3 business days**. We aim to triage and respond with a fix or mitigation plan within **14 days** for high-severity issues.

---

## Scope

Security reports are welcome for:

- The portal (`metis/portal`) — XSS, auth bypass, CSRF, dependency vulnerabilities
- The model sync tool (`metis/shared`) — code generation issues, schema injection
- Orchestration scripts (`metis/scripts`) — command injection, privilege issues
- Cross-service integration (proxy config, auth token handling)

For vulnerabilities in a specific backend service, file with that service's repo (Echo, Mneme, Syrinx, Oread). Suite-level coordination issues go here.

---

## Out of scope

- Issues in third-party dependencies — please report upstream first
- Vulnerabilities requiring physical access to a developer machine
- Social engineering of contributors
- Self-XSS

---

## Sensitive data

MedEd is a **medical education** platform — it generates **synthetic patient data** and uses **mock clinical content**. No real patient data should ever be entered into MedEd services.

If you discover real PHI/PII has been committed to any repo, email **michael@hobbs.md** immediately so we can purge git history.

---

## Disclosure policy

We coordinate disclosure with reporters. By default we'd like to:

1. Acknowledge receipt within 3 business days
2. Develop and test a fix
3. Release the fix and credit the reporter (if they want credit)
4. Publish a brief advisory once the fix is available

If you need a faster timeline (active exploitation, regulatory requirement), say so in your report.
