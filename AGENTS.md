# AGENTS.md — dev guide for the code-guidelines installer

This repo **is** the `code-guidelines` installer/skill authoring project (published to npm as
`code-guidelines`). It is NOT a target repository that consumes the skill. Do not confuse the
two: the lint baselines under `assets/lint/` are payloads shipped into other repos — they are
not applied to this codebase.

## Commands

- Tests: `npm test` (i.e. `node --test`, auto-discovers `test/*.test.mjs`). 267 tests, all must pass.
  - Single file: `node --test test/library.test.mjs`
  - By name: `node --test --test-name-pattern="48"`
- Build (regenerate checked-in output): `npm run build` (`node src/build/build.mjs`)
- Build self-conformance gate: `npm run check` (`node src/build/build.mjs --check`) — fails if
  `generated/` is not byte-identical to a fresh build.
- Run the CLI from a checkout: `node bin/code-guidelines <command>` (no `npm install` needed).
- There is NO lint or typecheck step configured for this repo. Do not run eslint/ruff/etc. here.

This gate (`npm run check` and `node --test`) also runs in CI on every push and pull request.

## The deterministic single-source build (most important invariant)

`generated/<platform>/*` is **committed output**, never hand-edited. It is composed from:

```
fragments/{core,lint,distill}/{purpose,triggers,behavior,output}.md + fragments/shared/body.md
fragments/templates/*.tmpl        (per-platform render templates)
src/build/registry.mjs            (three ordered skill entries + per-platform facts)
src/build/platforms.mjs           (emitters)
  --> src/build/build.mjs --> generated/{claude,codex,gemini,opencode}/
```

If you edit **anything** under `fragments/`, or `registry.mjs` / `platforms.mjs` / `build.mjs`,
you MUST run `npm run build` to rewrite `generated/`, then `npm run check` + `npm test`.
Editing files under `generated/` directly is always wrong.

Determinism is enforced: no `Date.now` / `new Date` / `Math.random` / `crypto.random` in any
build module (pinned by `test/build.test.mjs`). Output is CRLF→LF normalized with fixed key order.

## Three programs, three times (the key boundary)

This repo holds three distinct programs running at three different times — the most common mistake
is blurring the boundary between them:

1. **Installer CLI** — `bin/code-guidelines` → `src/cli.mjs` → `src/commands/*` over the
   two-phase-commit engine in `src/install/*`. Runs at **install time, machine-level**: copies
   `assets/*` → `~/.code-guidelines/` and `generated/<platform>/*` → each platform's config dir.
2. **Build** — `src/build/{build,platforms,registry}.mjs` composing `fragments/**` →
   `generated/<platform>/*`. Runs at **author time** (`npm run build`).
3. **Runtime sync** — `assets/sync.mjs`. Runs at **command-invocation time, inside a target repo**
   when a user types `/code-guidelines[-lint|-distill]`. This is the actual product logic.

`assets/` is the shared-asset root installed to `~/.code-guidelines/` (rule library, lint
baselines, `stacks.json` detection registry, `VERSION`, `sync.mjs`). `test/` + `test/fixtures/`
are all executable; fixtures pin detection/sync golden behavior.

`src/build/registry.mjs` is the single source of truth for each platform's output filename — both
the build output and the installer's product-file map derive from it so they cannot drift.

### `assets/sync.mjs` is deliberately standalone — do not "DRY it up"

It ships into `~/.code-guidelines/` and runs in target repos with no install step and no
`node_modules`, so it MUST NOT import from `src/*` or any relative path. It inlines its own copies
of fs-safety/hashing that mirror `src/install/fsutil.mjs` — mirror changes in both. The core/lint
command bodies (`fragments/{core,lint}/behavior.md`) each document a manual no-`node` fallback
that must reach the byte-identical end state `sync.mjs` produces; update that prose in the same
pass whenever you change sync/lint semantics, or the two paths diverge.

## Invariants enforced by tests (edits that miss these break CI)

- `assets/library/`: exactly **48** `.md` files; each ≤100 lines; frontmatter keys
  `name`/`description`/`appliesTo`/`stacks`/`source`; `name` must equal the file basename; body in
  English with `## Hard Constraints (MUST NOT)` before `## Ecosystem Idioms & Conventions`
  (exact heading text matters — see `test/library.test.mjs`).
- `assets/lint/`: exactly **11** set dirs; each set has specific required filenames + a `meta.json`
  (the exact required filenames per set are pinned in `test/baseline.test.mjs`).
- `assets/stacks.json`: every `rules` entry resolves to `assets/library/<entry>.md`; every non-null
  `lint` key resolves to an `assets/lint/<key>/` directory. Adding a stack means adding both.
- `README.md` (EN) and `README.zh-CN.md` (ZH) must keep an **identical heading-level sequence**,
  plus the pinned mandatory sections/substrings (see `test/readme.test.mjs`). Edit them in lockstep.

## Versions

Two independent version numbers, do not conflate: `package.json#version` (the installer, currently
0.2.0) and `assets/VERSION` (the rule-library asset, currently 1.2.0; it drives reconcile upgrades
in target repos).

## Toolchain

Pure Node.js, ESM (`"type": "module"`), Node ≥20, **zero third-party runtime dependencies** (only
`node:*` builtins). No `npm install` is required to build or test. Rule-library upstream sources
and licenses are documented in `THIRD-PARTY.md` and each rule's `source` frontmatter.

## Conventions

- Source comments cite spec IDs (`SPEC-*`, `DES-*`, `DECISION-*`, `RISK-*`, `PLAN-TASK-*`) as
  in-code cross-references — the same ID recurs across the code and tests that implement it
  (e.g. `git grep RISK-DET-001` lands on the determinism code plus the tests pinning it). They are
  how design intent is traced (the originating spec docs are git-ignored and absent from a clone),
  so preserve them when editing near them.
- `.xsk/` and `.req-to-plan/` are workflow/planning artifacts, not application code.
- `CLAUDE.md` is the fuller parallel guide for Claude Code; keep the two consistent when behavior
  changes.

## Dogfooding

Do **not** run `/code-guidelines` against this repository. `test/fixtures/` holds sample files for
many stacks (Go, PHP, React, …) that exist only to exercise the detector; a repo-root run aggregates
them, falsely detects those stacks, and scaffolds irrelevant lint configs plus managed blocks into the
working tree (root-level dogfood output is git-ignored, but it still clutters the tree). To dogfood
the tool, run it in a throwaway scratch project instead.
