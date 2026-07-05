---
name: code-guidelines-distill
description: "Explicit-invocation only: run only when the user types /code-guidelines-distill. Never invoke from intent, keywords, or as a side effect of coding tasks."
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

`code-guidelines-distill` mines this repository's own real conventions — naming patterns, directory organization, error-handling idioms, technology choices, and testing patterns — and renders the ones backed by real evidence into `.code-guidelines/project-conventions.md`, phrased as negative guardrails. It is an agent-driven procedure, not a deterministic script: it samples source files and writes prose, gated by a fixed template, a two-evidence-paths requirement, an 80-line cap, and a veto checklist.

It writes only `.code-guidelines/project-conventions.md` and that file's record in `.code-guidelines/manifest.json`; it never touches the rule library, the lint baselines, or the entry file's pointer block — those belong to the separate `/code-guidelines` and `/code-guidelines-lint` commands.

## Triggers

Explicit-invocation only: run only when the user types /code-guidelines-distill. Never invoke from intent, keywords, or as a side effect of coding tasks.

## Behavior

This command never configures or recommends a hook, keyword binding, or any other automatic trigger for itself; every run starts because a user typed `/code-guidelines-distill` by hand. It does not require the platform entry-point file to exist and never creates it — distillation writes only inside `.code-guidelines/`.

Distilling project-specific conventions is an agent-driven procedure, not a script — carry it out directly:

1. **Sample** — read `~/.code-guidelines/stacks.json` and detect the repository's stacks exactly as the `/code-guidelines` command's detect step does. For each detected stack, sample at least 10 of its source files, preferring files that were modified recently and files referenced from many other places in the repository; if a stack has fewer than 10 source files in total, use all of them.
2. **Extract** — read the sampled files looking for this repository's actual, real conventions: naming patterns, directory organization, error-handling idioms, technology choices, and testing patterns. Anything that is really just general best practice — the kind of thing the rule library already covers — is not a project-specific convention; leave it out.
3. **Evidence-gate** — keep only conventions backed by at least two real, repository-relative file paths as evidence. Drop everything else, including anything that merely sounds plausible: no evidence, no entry.
4. **Veto** — check every surviving entry against `~/.code-guidelines/distill/veto-checklist.md` before it is allowed into the output; anything that fails a checklist item is dropped, not fixed up.
5. **Write** — render the survivors into `.code-guidelines/project-conventions.md` using the fixed skeleton at `~/.code-guidelines/distill/conventions-template.md`: guardrails phrasing (negative constraints, not general advice), at most 80 lines total. (`~/.code-guidelines/distill/template.md` holds the sampling/extraction/evidence procedure; `~/.code-guidelines/distill/veto-checklist.md` holds the gates checked in step 4.)
6. **Record** — write the new file's content hash and today's date into `.code-guidelines/manifest.json`'s `conventions` entry, leaving the `rules` and `lint` arrays exactly as they were. The deterministic recording step is `node ~/.code-guidelines/sync.mjs --distill-record .code-guidelines/project-conventions.md` (add `--force` to pass the overwrite guard in step 7); when `node` is unavailable, write the same `conventions` object by hand.
7. **Protect existing conventions** — if `project-conventions.md` already exists, first hash it and compare against the manifest's recorded hash. A mismatch means the user edited it by hand: refuse to overwrite, and instead print a report comparing the existing content against what a fresh distillation would produce, so the user can decide. Only proceed past this guard when the user explicitly re-runs with `--force`, or after they delete the file themselves and re-run — both remain inside this explicit invocation, not a new automatic one.

This command's output never folds into the `/code-guidelines` command's expected rule set; that command only ever reports whether `project-conventions.md` is present and when it was last distilled — it neither judges that date nor triggers distillation itself.

## Output

This command's output is the new or refreshed `.code-guidelines/project-conventions.md` file plus its `conventions` record in `.code-guidelines/manifest.json` — never a silent overwrite. On a protected overwrite (the existing file was hand-edited since it was last distilled), the output is instead a comparison report of the existing content against a fresh distillation, and nothing is written until the user re-runs with `--force` or deletes the file first.

The deterministic recording seam reports its result on success (`conventions recorded: <hash> @ <date>`) and, on the overwrite guard, prints the old and new hashes with instructions to re-run with `--force` or delete the file.

Exit codes are shared across this package's commands: `0` success; `2` usage error; `4` the overwrite guard tripped or the target manifest was invalid. This command does not maintain the entry-point managed block, so it never emits the `3` precheck code.
