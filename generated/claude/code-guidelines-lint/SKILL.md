---
name: code-guidelines-lint
description: "Explicit-invocation only: run only when the user types /code-guidelines-lint. Never invoke from intent, keywords, or as a side effect of coding tasks."
disable-model-invocation: true
---

This skill package keeps its rule library, lint baselines, and distillation tooling in one shared location on this machine, `~/.code-guidelines/`:

- `library/` — the curated, per-stack rule files this skill installs into target repositories.
- `lint/` — the first-run lint baseline configuration for each supported toolchain.
- `distill/` — the `project-conventions.md` template and the veto checklist the `/code-guidelines-distill` command applies.
- `stacks.json` — the stack-detection registry driving every step in Behavior below.
- `sync.mjs` — the synchronization engine these commands run; see Behavior for its no-`node` manual equivalent.
- `VERSION` — the installed package version.

Every platform this package is installed on reads from this same shared location rather than keeping its own copy, so reinstalling or upgrading the package upgrades every platform at once.

## Purpose

`code-guidelines-lint` arms machine-enforced lint baselines for the stacks detected in the current repository. For every detected stack that has an associated lint toolchain, it writes that tool's baseline configuration in the tool's current (non-deprecated) format the first time it applies — and only the first time — so a project gets a strict, ready-to-run lint setup without hand-writing one.

It never installs the tool's dependencies (it prints the exact install command instead), never touches a tool that already has its own configuration, and treats a scaffold the user later deletes as a deliberate, permanent opt-out. All of this command's writes are confined to the lint configuration files themselves and to `.code-guidelines/manifest.json`; the rule library and its pointer block belong to the separate `/code-guidelines` command and are left untouched.

## Triggers

Explicit-invocation only: run only when the user types /code-guidelines-lint. Never invoke from intent, keywords, or as a side effect of coding tasks.

## Behavior

This command never configures or recommends a hook, keyword binding, or any other automatic trigger for itself; every run starts because a user typed `/code-guidelines-lint` by hand. It does not require the platform entry-point file to exist and never creates it — arming lint is independent of the entry-point managed block.

### Run: detect → arm lint → report

Run these steps in order against `~/.code-guidelines/` (the shared asset directory this package installed) and the target repository:

1. **Detect** — read `~/.code-guidelines/stacks.json` and evaluate its predicates against the whole repository exactly as the `/code-guidelines` command's detect step does (a monorepo is scanned in full from the root, excluding `node_modules/`, `vendor/`, `dist/`, `build/`, `.git/`, and common Python environment/cache directories such as `.venv/`, `venv/`, `env/`, `.env/`, `.tox/`, `.nox/`, `site-packages/`, `__pycache__/`, `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`, `.pyre/`, `.hypothesis/`, `.ipynb_checkpoints/`, and `.eggs/`; files, `package.json` dependencies, Python dependencies, extension thresholds, and second-pass required tags all use the same semantics). Only detected stacks are considered for arming.
2. **Arm lint** — for every detected stack that has an associated lint baseline, write that baseline's scaffold configuration only when all three hold: the stack was detected; the project has no existing configuration for that tool (check both current and legacy file names for that tool, plus relevant `package.json` fields); and `.code-guidelines/manifest.json` has no prior arming record for that tool. This is at most once per tool, ever. Never install the tool's dependencies — only print the exact install command in the report. If the user deletes an armed scaffold file, treat that as a deliberate opt-out: never recreate it, and flag it in the report; only after the user confirms in the same session should this command clear that opt-out and re-arm — by running `sync.mjs lint --relint <tool>`, or the equivalent manual step below — and this remains inside the current explicit invocation, not a new one. An unmodified scaffold (hash still matches the manifest) upgrades silently with the baseline version; a modified one is the user's property and is skipped forever. A tool that already has its own configuration is never touched — only its recommended rule set and a sample snippet are offered, read-only, in the report. Record each newly armed tool in `.code-guidelines/manifest.json`'s `lint` array; carry the manifest's `rules` and `conventions` records through unchanged — never clear or rewrite them here.
3. **Report** — see the Output section below. If the reconciled lint state is already identical to what is on disk and the manifest would not change, write nothing at all — not even a modified timestamp.

### Manual fallback (no `node` available)

The preferred path is running `node ~/.code-guidelines/sync.mjs lint`. When `node` is not available, carry out the steps above by hand, using ordinary file-reading and shell tools, to reach the exact same end state `sync.mjs lint` would:

- Read `~/.code-guidelines/stacks.json` and `.code-guidelines/manifest.json` as plain JSON; evaluate the same five detection predicate types as `sync.mjs`: files, `package.json` dependencies, Python dependencies from `pyproject.toml` and `requirements*.txt` (ignoring TOML and requirements comments, then PEP 503-normalizing names), source-extension thresholds, and second-pass required tags.
- Apply the three-condition arming gate above literally: detected, no existing config for that tool (current and legacy names, plus `package.json` fields), and no prior `lint` record in the manifest. Never install dependencies — print the install command instead.
- Compute a scaffold's content hash with `shasum -a 256 <file>` (or `sha256sum <file>` where available) after normalizing its line endings to `\n`; this is the exact algorithm `sync.mjs` uses — SHA-256 over LF-normalized content. A hash that still matches the manifest means an unmodified scaffold (upgradeable); any mismatch means the user's property (skip forever). A deleted scaffold is a permanent opt-out.
- Write `.code-guidelines/manifest.json` with the same shape `sync.mjs` would, updating only the `lint` array and carrying the `rules` and `conventions` entries through exactly as they were:

      {
        "version": "...",
        "rules": [{ "file": "...", "sourceVersion": "...", "sha256": "..." }],
        "lint": [{ "tool": "...", "armedAt": "...", "sha256": "...", "optedOut": false }],
        "conventions": { "sha256": "...", "distilledAt": "..." }
      }

- Before any write, confirm the target path and every parent directory is not a symlink, and that the resolved path stays inside the repository root; write through a temporary file followed by a rename rather than in place.
- Produce the same report shape described in the Output section, whether run by `sync.mjs lint` or carried out by hand.

Every rule above — the three-condition arming gate, the hash-based conflict check, the delete-is-opt-out rule, the zero-write short-circuit, and carrying the `rules`/`conventions` manifest records through untouched — applies identically whether `node` ran it or an agent carried it out by hand; none of it is optional just because `node` is missing.

## Output

Every run ends with a status report, whether or not anything was written. For every detected stack that has a lint baseline:

- **armed** — the scaffold was already in place, or was written this run;
- **armed, with a gap** — the scaffold is in place but the tool's dependency is missing, printed together with the exact command to install it (dependencies are never installed automatically);
- **existing config, read-only** — the tool already has its own configuration, so nothing was written; only the recommended rule set and a sample snippet are offered;
- **opted out** — the user deleted a previously armed scaffold and it has not been re-confirmed;
- **skipped (user-modified)** — the scaffold was hand-edited and is now the user's property;
- **skipped (path conflict)** — two baselines targeted the same path.
- When nothing needed to change: "already up to date, nothing changed," with zero files written.

`--dry-run` computes and prints this same report without writing anything. `--relint <tool>` clears a genuine opt-out (a fully deleted or managed-unmodified scaffold) and re-arms just that tool; a foreign existing config or a hand-modified scaffold is reported and never overwritten. `--json` prints the machine-readable equivalent:

    {
      "upToDate": false,
      "lint": [{ "tool": "...", "armed": true, "gap": false, "installCmd": "...", "optedOut": false }],
      "exitCode": 0
    }

Exit codes are shared across this package's commands: `0` success; `2` usage error; `4` a conflict or safety abort (a rejected symlink or a scaffold path conflict). This command does not maintain the entry-point managed block, so it never emits the `3` precheck code.
