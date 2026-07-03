This command never configures or recommends a hook, keyword binding, or any other automatic trigger for itself; every run starts because a user typed `/code-guidelines-lint` by hand. It does not require the platform entry-point file to exist and never creates it — arming lint is independent of the entry-point managed block.

### Run: detect → arm lint → report

Run these steps in order against `~/.code-guidelines/` (the shared asset directory this package installed) and the target repository:

1. **Detect** — read `~/.code-guidelines/stacks.json` and evaluate its predicates against the whole repository exactly as the `/code-guidelines` command's detect step does (a monorepo is scanned in full from the root, excluding `node_modules/`, `vendor/`, `dist/`, `build/`, and `.git/`). Only detected stacks are considered for arming.
2. **Arm lint** — for every detected stack that has an associated lint baseline, write that baseline's scaffold configuration only when all three hold: the stack was detected; the project has no existing configuration for that tool (check both current and legacy file names for that tool, plus relevant `package.json` fields); and `.code-guidelines/manifest.json` has no prior arming record for that tool. This is at most once per tool, ever. Never install the tool's dependencies — only print the exact install command in the report. If the user deletes an armed scaffold file, treat that as a deliberate opt-out: never recreate it, and flag it in the report; only after the user confirms in the same session should this command clear that opt-out and re-arm — by running `sync.mjs lint --relint <tool>`, or the equivalent manual step below — and this remains inside the current explicit invocation, not a new one. An unmodified scaffold (hash still matches the manifest) upgrades silently with the baseline version; a modified one is the user's property and is skipped forever. A tool that already has its own configuration is never touched — only its recommended rule set and a sample snippet are offered, read-only, in the report. Record each newly armed tool in `.code-guidelines/manifest.json`'s `lint` array; carry the manifest's `rules` and `conventions` records through unchanged — never clear or rewrite them here.
3. **Report** — see the Output section below. If the reconciled lint state is already identical to what is on disk and the manifest would not change, write nothing at all — not even a modified timestamp.

### Manual fallback (no `node` available)

The preferred path is running `node ~/.code-guidelines/sync.mjs lint`. When `node` is not available, carry out the steps above by hand, using ordinary file-reading and shell tools, to reach the exact same end state `sync.mjs lint` would:

- Read `~/.code-guidelines/stacks.json` and `.code-guidelines/manifest.json` as plain JSON; evaluate each detection predicate by inspecting the files it names directly.
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
