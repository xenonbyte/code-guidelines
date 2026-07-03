# AGENTS.md — dev guide for the code-guidelines installer

This repo **is** the `code-guidelines` installer/skill authoring project (published to npm as
`code-guidelines`). It is NOT a target repository that consumes the skill. Do not confuse the
two: the lint baselines under `assets/lint/` are payloads shipped into other repos — they are
not applied to this codebase.

## Commands

- Tests: `npm test` (i.e. `node --test`, auto-discovers `test/*.test.mjs`). 230 tests, all must pass.
  - Single file: `node --test test/library.test.mjs`
  - By name: `node --test --test-name-pattern="48"`
- Build (regenerate checked-in output): `npm run build` (`node src/build/build.mjs`)
- Build self-conformance gate: `npm run check` (`node src/build/build.mjs --check`) — fails if
  `generated/` is not byte-identical to a fresh build.
- Run the CLI from a checkout: `node bin/code-guidelines <command>` (no `npm install` needed).
- There is NO lint or typecheck step configured for this repo. Do not run eslint/ruff/etc. here.

## The deterministic single-source build (most important invariant)

`generated/<platform>/*` is **committed output**, never hand-edited. It is composed from:

```
fragments/skill/{purpose,triggers,behavior,output}..md + fragments/shared/body.md
fragments/templates/*.tmpl        (per-platform render templates)
src/build/registry.mjs            (explicit ordered skill list + per-platform facts)
src/build/platforms.mjs           (emitters)
  --> src/build/build.mjs --> generated/{claude,codex,gemini,opencode}/
```

If you edit **anything** under `fragments/`, or `registry.mjs` / `platforms.mjs` / `build.mjs`,
you MUST run `npm run build` to rewrite `generated/`, then `npm run check` + `npm test`.
Editing files under `generated/` directly is always wrong.

Determinism is enforced: no `Date.now` / `new Date` / `Math.random` / `crypto.random` in any
build module (pinned by `test/build.test.mjs`). Output is CRLF→LF normalized with fixed key order.

## Code map

- `src/` — installer code (Node ESM). `cli.mjs` dispatches to `src/commands/*`; `src/install/*`
  is the two-phase-commit install/safety engine; `src/build/*` is the build pipeline above.
- `assets/` — the shared-asset root installed to `~/.code-guidelines/`. Contains the rule
  library, lint baselines, `stacks.json` (detection registry), `VERSION`, and `sync.mjs`.
- `assets/sync.mjs` — **forced standalone**: it runs inside arbitrary target repos with no
  install step and MUST NOT import from `src/*` or any relative path. It deliberately duplicates
  the fs-safety/hashing logic from `src/install/fsutil.mjs`. Mirror changes in both places.
- `test/` + `test/fixtures/` — all executable; fixtures pin detection/sync golden behavior.
- `.xsk/` and `.req-to-plan/` are workflow/planning artifacts, not application code.

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

Two independent version numbers, do not conflate: `package.json#version` (the installer, e.g.
0.1.1) and `assets/VERSION` (the rule-library asset version, e.g. 1.1.0).

## Toolchain

Pure Node.js, ESM (`"type": "module"`), Node ≥20, **zero third-party runtime dependencies** (only
`node:*` builtins). No `npm install` is required to build or test. Rule-library upstream sources
and licenses are documented in `THIRD-PARTY.md` and each rule's `source` frontmatter.

## Dogfooding

Do **not** run `/code-guidelines` against this repository. `test/fixtures/` holds sample files for
many stacks (Go, PHP, React, …) that exist only to exercise the detector; a repo-root run aggregates
them, falsely detects those stacks, and scaffolds irrelevant lint configs plus managed blocks into the
working tree (root-level dogfood output is git-ignored, but it still clutters the tree). To dogfood
the tool, run it in a throwaway scratch project instead.
