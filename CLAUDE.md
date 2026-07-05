# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A **zero-third-party-dependency** Node.js tool that installs THREE explicitly-invoked commands —
`/code-guidelines` (sync the curated guardrail rules + the entry-file managed block),
`/code-guidelines-lint` (arm machine-enforced lint baselines), and `/code-guidelines-distill`
(distill this repo's own conventions) — to four AI coding tools (Claude Code, Codex, opencode, Gemini
CLI). Each is manual-only; none fires from intent. Read `README.md` first; it is the authoritative
product spec.

Node `>=20`. No runtime dependencies — `package.json` has no `dependencies` block, and that is a
hard product constraint (see `assets/sync.mjs` header), not an accident. Do not add dependencies.

## Commands

```sh
node --test                       # run the whole suite (282 tests, node:test — no framework)
node --test test/sync.test.mjs    # run one test file
node --test --test-name-pattern "zero-write"   # run tests matching a name
npm run build                     # regenerate generated/ from fragments/ + registry.mjs
npm run check                     # build --check: assert generated/ matches a fresh build (CI gate)
node bin/code-guidelines install [--platform claude,codex,...]   # exercise the CLI from a checkout
```

**If you edit anything under `fragments/` or `src/build/registry.mjs`, you MUST run `npm run build`
and commit the updated `generated/`.** `npm run check` fails the build otherwise — `generated/` is a
committed, byte-for-byte reproducible artifact, and `test/platform.test.mjs` / the check gate enforce
that it is never stale.

There is **no lint or typecheck step for this repo itself** — `node --test`, `npm run build`, and
`npm run check` are the entire gate. The configs under `assets/lint/` are payloads shipped into
*other* repos; do not run eslint/ruff/etc. against this codebase. `AGENTS.md` is a parallel dev
guide covering the same ground for non-Claude agents — keep the two consistent when behavior changes.
This gate (`npm run check` and `node --test`) also runs in CI on every push and pull request.

### Release (CI-driven, `.github/workflows/`)

`ci.yml` runs the gate on every push to `main` and every PR across a 3-OS × Node 20/22/24 matrix.
`release.yml` fires on `v*` tags: it reruns the gate, then `npm publish --provenance --access public`
via npm **OIDC trusted publishing** (`permissions: id-token: write`, no `NPM_TOKEN` secret). To cut a
release: bump `package.json#version` (and `assets/VERSION` if the rule library changed — they move
independently), commit, then push an annotated `vX.Y.Z` tag; the workflow publishes. One-time
prerequisite: the package's trusted publisher must be configured on npmjs.com (repo +
`release.yml`), or the publish step fails with `npm E404` (empty auth identity), not a code error.

## The three programs (this is the key architecture)

This repo contains three distinct programs that run at three different times. Keep them separate —
the most common mistake is blurring the boundary between them.

1. **Installer CLI** — `bin/code-guidelines` → `src/cli.mjs` → `src/commands/*.mjs`, on top of the
   source-agnostic two-phase-commit engine in `src/install/`. Runs **at install time, machine-level**.
   Copies `assets/*` → `~/.code-guidelines/` (shared) and `generated/<platform>/*` → each platform's
   config dir. Tracks ownership in `~/.code-guidelines/install-manifest.json`.

2. **Build system** — `src/build/build.mjs` + `src/build/platforms.mjs` + `src/build/registry.mjs`,
   composing `fragments/**` → `generated/<platform>/*`. Runs **at author time** (`npm run build`).
   Each command's prose lives ONLY in `fragments/` (per-section `purpose/triggers/behavior/output.md`
   under `fragments/core/`, `fragments/lint/`, `fragments/distill/`, shared body in
   `fragments/shared/body.md`); each platform's file-format and frontmatter facts live ONLY in
   `registry.mjs` (three skill entries). Never duplicate prose into the registry.

3. **Runtime sync engine** — `assets/sync.mjs`. Runs **at command-invocation time, inside an
   arbitrary target repo**, when a user types `/code-guidelines`, `/code-guidelines-lint`, or
   `/code-guidelines-distill`. This is the actual product logic.

### `assets/sync.mjs` is deliberately standalone — do not "DRY it up"

`assets/sync.mjs` ships inside `~/.code-guidelines/` and executes in target repos with **no install
step and no `node_modules`**. It therefore **must not import anything from `src/*` or any relative
path**. It inlines its own copies of fs-safety (`assertSafeTarget`), atomic write, and LF-normalized
SHA-256 that mirror `src/install/fsutil.mjs`. This duplication is intentional and load-bearing.
Do not refactor it to import from `src/`.

The core and lint command bodies (`fragments/core/behavior.md`, `fragments/lint/behavior.md`) each
document a **manual, no-`node` fallback** that must reach the byte-identical end state `sync.mjs` /
`sync.mjs lint` produce. If you change sync or lint semantics, update that prose in the same pass, or
the two paths diverge.

### Single source of truth: `registry.mjs`

`src/build/registry.mjs` is the sole authority for each platform's output filename. Both the build
(`generated/<platform>/<generatedFile>`) and the installer's product-file map
(`src/commands/install.mjs` `PLATFORM_PRODUCT_FILE`) derive from it, so they can't drift.

## Runtime pipeline (`assets/sync.mjs`)

`assets/sync.mjs` exposes three explicit-invocation commands, one per installed skill: `sync()` =
`/code-guidelines` (**precheck → detect → select → reconcile → maintainHostBlock → report**: rules +
the entry-file managed block; carries the manifest `lint`/`conventions` slices through untouched);
`syncLint()` = `/code-guidelines-lint` (**detect → armLint → report**: lint scaffolds + the manifest
`lint` slice only; no precheck, no `--platform`, no exit 3); and the `distillRecord()` seam =
`/code-guidelines-distill`. Every stage is a **pure planner** returning a write plan; nothing touches
disk until a single deferred commit phase at the end. This is why `--dry-run`, `--json`, and the
zero-write short-circuit (identical state ⇒ write nothing, not even an mtime) fall out for free.

- **detect** (`SPEC-DETECT-001`) — two-pass predicate eval over `assets/stacks.json` (files /
  packageDeps / extensions with a count threshold / `requiresTags` / pythonDeps). See the big comment block above
  `scanRepo` for the exact AND/OR semantics before touching it.
- **select** (`SPEC-SELECT-001`) — `guardrails-core` always kept first; others ordered by
  framework→language→domain tier, then specificity, then registry index; capped at 12 rule files
  total. Truncated files are always named in the report, never dropped silently.
- **reconcile** (`SPEC-RECONCILE-001`) — add/remove/upgrade/skip vs the target manifest.
- **armLint** (`SPEC-LINT-001`) — runs only under `syncLint()` (the `/code-guidelines-lint`
  command), never the core sync; first-run-only, three-condition gate; never installs deps (prints
  the command instead); deleting an armed scaffold = permanent opt-out.

### User-edit protection is the invariant everywhere

A tracked file is "owned" only while its on-disk **LF-normalized SHA-256** still matches the manifest
record. Any mismatch = the user edited it = **never overwrite, never remove; report as skipped**.
This rule holds identically in the installer (`src/install/transaction.mjs`) and the runtime
(`assets/sync.mjs`). LF normalization means a CRLF checkout is never mistaken for an edit.

### Two manifests

- `~/.code-guidelines/install-manifest.json` — machine-level file ownership (installer).
- `<target-repo>/.code-guidelines/manifest.json` — per-repo reconcile state: rules, lint arm state,
  and the `conventions` record. Shapes and validators live in `src/install/manifest.mjs`.

`distill` (agent-driven, defined in `fragments/distill/behavior.md` prose — NOT a script; the
`/code-guidelines-distill` command) is the only writer of `project-conventions.md` + the manifest
`conventions` field. The core sync only *reports* it. `distillRecord()` in `sync.mjs` is the
deterministic manifest-recording seam distill calls.

## Exit codes (shared across CLI and sync)

`0` ok · `2` usage error · `3` precheck abort (**core `/code-guidelines` only** — platform entry file
`CLAUDE.md`/`AGENTS.md`/`GEMINI.md` missing; the tool never creates it; the lint/distill commands do
not maintain the block, so they never emit `3`) · `4` conflict/safety abort (user-modified file,
rejected symlink, or malformed managed block).

## Determinism is a hard requirement (`RISK-DET-001`)

No timestamps, `Math.random`, `Date.now`, or locale-dependent behavior anywhere in the build path
(`src/build/*`). Object keys are recursively sorted before serialization; line endings are forced to
`\n`; registry and fragment order are fixed by hand. Two deep-equal inputs must serialize identically.

## Conventions

- ES modules only (`.mjs`, `"type": "module"`). Tests use the built-in `node:test` runner + `node:assert/strict` — no Jest/Mocha/Vitest.
- Source comments cite spec IDs (`SPEC-*`, `DES-*`, `DECISION-*`, `RISK-*`, `PLAN-TASK-*`) as **in-source cross-references** — the same ID recurs across the code and tests that implement it (e.g. `git grep RISK-DET-001` lands on the determinism code plus the tests pinning it). Those IDs, not any external doc, are the durable anchor: the spec-driven-development run they originated in lives under `.req-to-plan/archive/`, which is git-ignored and absent from a clone. Preserve the ID references when editing near them; they are how design intent is traced.
- Modules with disk knowledge (path layout) are kept separate from source-agnostic engines, and roots are injectable (`{ home, env, repoRoot, assetRoot }`) so tests never touch the real home dir. Follow that pattern for new I/O code.
- `README.md` and `README.zh-CN.md` are kept section-by-section aligned; `test/readme.test.mjs` guards claims in them. Update both, and the test, when product behavior changes.
- **Two independent version numbers, never conflated:** `package.json#version` (the installer, `0.3.0`) and `assets/VERSION` (the rule-library asset, `1.3.0`). The latter drives reconcile upgrades in target repos.
- **Asset shape is test-pinned** — adding a stack means touching several files in lockstep, or a test fails: `assets/library/` holds exactly 57 `.md` rule files (each ≤100 lines, fixed frontmatter + heading order — see `test/library.test.mjs`); `assets/lint/` holds exactly 11 baseline sets each with required filenames + `meta.json` (`test/baseline.test.mjs`); and every `assets/stacks.json` entry must resolve to a real `assets/library/<rule>.md` and `assets/lint/<key>/` (`test/stacks.test.mjs`).

## Dogfooding

Do **not** run `/code-guidelines` against this repository. `test/fixtures/` holds sample files for
many stacks (Go, PHP, React, …) that exist only to exercise the detector; a repo-root run aggregates
them, falsely detects those stacks, and scaffolds irrelevant lint configs plus managed blocks into the
working tree (root-level dogfood output is git-ignored, but it still clutters the tree). To dogfood
the tool, run it in a throwaway scratch project instead.
