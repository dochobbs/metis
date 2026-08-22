# Metis Security Hardening Handoff

**Date:** 2026-06-09  
**Scope:** Metis portal, gateway/deployment scaffolding, orchestration scripts, shared model sync validation, and generated shared-model outputs in sibling services.

## Current Status

Metis is ready to share for internal code review and handoff.
It is not yet cleared for external internet deployment because backend JWT verification and gateway-level auth enforcement are still open.

## What Changed

- Portal API calls now use same-origin gateway helpers for `/api/{service}/...`.
- Tool links now use same-origin `/apps/{service}/...` paths.
- Supabase sessions are forwarded to backend API calls as `Authorization: Bearer <jwt>`.
- Routes render protected dashboard/tool views when Supabase auth is configured or `VITE_REQUIRE_AUTH=true`.
- Echo UI port was corrected from `5000` to `9101` in shared service config.
- Tool iframe now has `sandbox` and `referrerPolicy` attributes, but see residual issue below.
- ESLint flat config and Vitest were added.
- Runtime/dev dependencies were upgraded until `npm audit` reported zero vulnerabilities.
- `shared/sync.py` now validates Python identifiers/docstring text, emits safer literals, uses deterministic ordering, and compares normalized generated output in `--validate`.
- `start-all.sh` writes PID files; `stop-all.sh` now stops PID/known-port scoped services instead of broad `pkill` patterns.
- Deployment scaffolding was added:
  - `portal/Dockerfile`
  - `portal/nginx.conf`
  - `portal/.dockerignore`
  - `deploy/Caddyfile`
- Docs updated:
  - `README.md`
  - `CHANGELOG.md`
  - `CLAUDE.md`
  - `docs/DEPLOYMENT.md`
  - `docs/INTEGRATION.md`

## Changed Repos / Files

Primary repo:

- `metis/`

Generated shared-model files were also refreshed by `metis/shared/sync.py` in sibling checkouts:

- `synpat/src/models/_generated/`
- `synvoice/models/_generated/`
- `synchart/backend/src/models/_generated/`
- `echo/src/models/_generated/`

Known unrelated dirty files existed before this work:

- Untracked demo/export artifacts in `synpat/`
- Untracked encounter artifacts in `synvoice/`

Do not revert those unrelated files while preparing this handoff.

## Verification Completed

Commands run from `metis/portal`:

```bash
npm test
npm run lint
npm run build
npm audit --audit-level=low
npm audit --omit=dev --audit-level=low
```

Results:

- Vitest: 1 file, 4 tests passing
- ESLint: clean
- Production build: clean
- Full npm audit: 0 vulnerabilities
- Production-only npm audit: 0 vulnerabilities

Commands run from `metis/shared`:

```bash
python3 -m unittest discover -s tests
python3 sync.py --validate
```

Results:

- Python unit tests: 3 passing
- Generated model validation: `oread`, `syrinx`, `mneme`, and `echo` all OK

Commands run from `metis/scripts`:

```bash
bash -n start-all.sh stop-all.sh status.sh e2e-smoke.sh
```

Result:

- Shell syntax check passed.

## Security Audit Findings Still Open

### 1. High: Tool iframe still bypasses gateway

`portal/src/pages/ToolEmbed.tsx` computes `appPath`, but the iframe still uses:

```tsx
src={`http://localhost:${tool.uiPort}`}
```

Fix:

```tsx
src={appPath}
```

Add a regression test proving embedded tools use `/apps/{service}/...`, not `localhost`.

### 2. High for external deploy: auth is not enforced at the gateway

React route protection is client-side only.
`deploy/Caddyfile` proxies `/api/*` without validating JWTs.

Required before external deployment:

- Each backend must reject missing/invalid Supabase JWTs.
- Backends must enforce per-user or per-program authorization.
- Gateway auth middleware can be added later, but backend enforcement is the non-negotiable control.

### 3. Medium: `X-Metis-User` is client-controlled

`portal/src/lib/metisApi.ts` sends:

```ts
'X-Metis-User': session.user.id
```

Any browser client can spoof this header.

Preferred fix:

- Remove `X-Metis-User` from browser requests.
- Backends should derive identity from the verified JWT claims.

### 4. Medium: CSP is missing

`portal/nginx.conf` and `deploy/Caddyfile` set useful headers, but neither defines a Content Security Policy.

Add a CSP before external deployment.
The final policy will need to account for Supabase, same-origin API routes, Vite/dev behavior if reused locally, and `/apps/*` embeds.

## Not Yet Verified

- `deploy/Caddyfile` was not validated with `caddy validate`; `caddy` was not installed locally.
- `scripts/e2e-smoke.sh` was not run; it requires the full six-service stack running and may make real API calls.
- Backend JWT verification was not implemented because it spans `echo`, `synchart`, `synvoice`, `synpat`, and `athena`.

## Recommended Next Steps

1. Patch `ToolEmbed` iframe `src` to use `appPath` and extend `metisApi` tests.
2. Remove `X-Metis-User` from browser-sent headers unless a backend explicitly ignores it.
3. Add CSP to `portal/nginx.conf` and `deploy/Caddyfile`.
4. Validate `deploy/Caddyfile` with `caddy validate --config deploy/Caddyfile` on a machine with Caddy installed.
5. Run the full stack and execute `metis/scripts/e2e-smoke.sh`.
6. Implement Supabase JWT verification in each backend before any external deploy.

