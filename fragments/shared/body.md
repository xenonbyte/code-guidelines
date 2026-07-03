This skill package keeps its rule library, lint baselines, and distillation tooling in one shared location on this machine, `~/.code-guidelines/`:

- `library/` — the curated, per-stack rule files this skill installs into target repositories.
- `lint/` — the first-run lint baseline configuration for each supported toolchain.
- `distill/` — the `project-conventions.md` template and the veto checklist the `/code-guidelines-distill` command applies.
- `stacks.json` — the stack-detection registry driving every step in Behavior below.
- `sync.mjs` — the synchronization engine these commands run; see Behavior for its no-`node` manual equivalent.
- `VERSION` — the installed package version.

Every platform this package is installed on reads from this same shared location rather than keeping its own copy, so reinstalling or upgrading the package upgrades every platform at once.
