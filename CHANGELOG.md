# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

This project tracks **two independent version numbers** (see `CLAUDE.md`): the installer
(`package.json#version`) and the rule-library asset (`assets/VERSION`). Each release below notes both.

## [0.3.1] — 2026-07-05

Installer `0.3.0 → 0.3.1` · rule-library asset unchanged (`1.3.0`). Installer-only fix; rule content,
exit codes, the two-phase-commit flow, and user-edit protection are unchanged.

### Fixed

- **Codex install target migrated to Agent Skills.** Codex commands were installed as deprecated
  custom prompts under `~/.codex/prompts/<id>.md`, which current Codex CLI no longer surfaces the way
  the other platforms do (they appear, if at all, only under a `/prompts:` prefix). They now install
  as Agent Skills at `~/.agents/skills/<id>/SKILL.md` — the location Codex reads and recommends —
  matching the `SKILL.md`-per-directory shape already used for Claude. In Codex, invoke them via the
  `/skills` picker or `$code-guidelines` (`$code-guidelines-lint` / `$code-guidelines-distill`).
- **Reinstall migrates cleanly.** `~/.codex/prompts/` is retained as a cleanup-only legacy root, so a
  reinstall removes the previously-owned `~/.codex/prompts/code-guidelines*.md` rather than orphaning
  it — otherwise it would linger as a duplicate deprecated `/prompts:code-guidelines`.

## [0.3.0] — 2026-07-05

Installer `0.2.0 → 0.3.0` · rule-library asset `1.2.0 → 1.3.0`. Backward-compatible: exit codes,
the two-phase-commit flow, and user-edit protection are unchanged.

### Added

- **Rule library expanded 48 → 57** — nine new stack guardrails: `blazor`, `dotnet-maui`,
  `electron`, `expo`, `frontend-state`, `llm-app`, `prisma`, `solidjs`, `web-perf`, each wired into
  `assets/stacks.json` detection.
- **`pythonDeps` detection predicate** (`SPEC-PYDEPS-001`) — a zero-dependency, hand-rolled parser
  for `pyproject.toml` (PEP 621 arrays, PEP 735 dependency-groups, Poetry tables) and
  `requirements*.txt`, with PEP 503 name normalization. Detection now matches on the **actual
  declared dependency** instead of mere file presence, eliminating fastapi/flask false positives on
  repos that only carry a `requirements.txt`.
- **Continuous integration** — `.github/workflows/ci.yml` runs the `npm run check` + `node --test`
  gate across a 3-OS × Node 20/22/24 matrix on every push to `main` and every pull request.
- **Release automation** — `.github/workflows/release.yml` publishes to npm on `v*` tags via OIDC
  trusted publishing with build provenance (`--provenance`), no long-lived token.

### Changed

- **Virtualenv exclusion hardened** — `.venv`, `venv`, `.tox`, `.nox`, `site-packages` are excluded
  during detection; `env`/`ENV` are excluded only when they contain a `pyvenv.cfg`, so a real source
  directory named `env/` is no longer skipped.
- **Multi-line `pyproject.toml` arrays are quote-aware** — a `]` inside an extras spec such as
  `"uvicorn[standard]"` on a non-final line no longer prematurely closes the dependency array.
- **Tailwind rule** updated to the Tailwind v4 important-modifier syntax.
- **`a11y` rule** now also applies to `**/*.astro`; cross-cutting rules' `appliesTo` broadened and a
  repo-wide `.gitattributes` enforces LF, keeping detection's LF-normalized ownership hashes stable.
- Developer guides (`README.md`, `README.zh-CN.md`, `AGENTS.md`, `CLAUDE.md`) kept in sync, including
  the `pythonDeps` predicate and the CI gate; test count updated (now 281 tests).

## [0.2.0] — 2026-07-04

Baseline for this changelog. Installer `0.2.0`, rule-library asset `1.2.0`.

[0.3.1]: https://github.com/xenonbyte/code-guidelines/releases/tag/v0.3.1
[0.3.0]: https://github.com/xenonbyte/code-guidelines/releases/tag/v0.3.0
[0.2.0]: https://github.com/xenonbyte/code-guidelines/releases/tag/v0.2.0
