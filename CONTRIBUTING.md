# Contributing to Metis / MedEd

Thanks for your interest in MedEd. This repo is the **suite hub** — most code changes happen in the per-service repos. Use this guide to understand where to file issues, how to set up locally, and how PRs are reviewed.

---

## Where to file issues

| If your issue is about… | File it in |
|---|---|
| Suite-level docs, the dashboard, model sync, orchestration scripts | this repo (**dochobbs/metis**) |
| AI tutor behavior, Socratic prompts, framework loading | [dochobbs/echo](https://github.com/dochobbs/echo) |
| EMR interface, chart importing, learning sessions | [dochobbs/mneme](https://github.com/dochobbs/mneme) |
| Voice scripts, TTS audio, error injection | [dochobbs/syrinx](https://github.com/dochobbs/syrinx) |
| Patient generation, Time Travel, exports | [dochobbs/oread](https://github.com/dochobbs/oread) |
| Curriculum content, conditions, frameworks, specialty resolver | internal (Athena) — file here and we'll route |

When in doubt, file in this repo. We'll move or cross-reference it.

---

## Local setup

### Prerequisites

- **macOS** (latest or latest-1) — Linux works but is untested
- **Python 3.11+**
- **Node.js 20+** and **npm**
- **Git**

### Get the suite

The six services live in sibling directories. The Metis repo on its own only ships the portal, orchestration scripts, and shared models — to run the full suite you also need the per-service repos checked out beside it:

```
MedEd/
├── athena/    # not yet on GitHub
├── echo/      # git@github.com:dochobbs/echo.git
├── metis/     # this repo
├── synchart/  # git@github.com:dochobbs/mneme.git
├── synpat/    # git@github.com:dochobbs/oread.git
└── synvoice/  # git@github.com:dochobbs/syrinx.git
```

### Run the portal only

```bash
cd metis/portal
npm install
cp .env.example .env   # then fill in Supabase values
npm run dev            # → http://localhost:9100
```

### Run the full suite

See [docs/QUICKSTART.md](docs/QUICKSTART.md) for env vars, Supabase setup, and per-service prereqs. The short version:

```bash
cd metis/scripts
./start-all.sh
./status.sh
```

---

## Pull request process

1. **Branch** off `main` with a descriptive name: `fix/specialty-selector-resets`, `feature/im-condition-pool`.
2. **Conventional commits.** Format: `TYPE: Description` where TYPE is one of:
   - `FEATURE:` — new functionality
   - `FIX:` — bug fix
   - `DOCS:` — documentation only
   - `REFACTOR:` — restructure without behavior change
   - `CHORE:` — tooling, deps, build
   - `SECURITY:` — security-relevant change
3. **Test what you change.** No mandatory CI in this repo yet, but per-service repos have their own test suites. Run them locally before opening a PR.
4. **Update docs.** If your change affects the suite (new endpoint, port move, env var, integration flow), update the relevant doc in `docs/`.
5. **Keep PRs focused.** Mixing unrelated changes makes review harder.

---

## Code style

| Language | Convention |
|---|---|
| Python | 2-space indent, type hints required, Pydantic v2, Black formatter |
| TypeScript / React | 2-space indent, functional components, hooks, Tailwind for styling |
| Shell | POSIX-compatible where possible; `set -euo pipefail` at the top |
| Markdown | One sentence per line is fine; reflow on edit |

---

## Reporting bugs

Please include:

- What you expected
- What happened instead
- How to reproduce (commands, URLs, screenshots)
- Which services were running (`./scripts/status.sh` output is gold)
- Browser / OS / Python version if relevant

---

## Security

Found a vulnerability? Don't open a public issue — see [SECURITY.md](SECURITY.md).

---

## License

By contributing, you agree your contributions are licensed under the [MIT License](LICENSE).
