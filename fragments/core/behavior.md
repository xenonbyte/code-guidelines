This command never configures or recommends a hook, keyword binding, or any other automatic trigger for itself; every run starts because a user typed `/code-guidelines` by hand.

### 0. Platform precheck (always first, on every run)

Before touching any file, resolve the current platform's fixed entry-point file:

| Platform | Entry-point file |
|---|---|
| Claude Code | `CLAUDE.md` |
| Codex | `AGENTS.md` |
| opencode | `AGENTS.md` |
| Gemini CLI | `GEMINI.md` |

If that file does not exist at the repository root, abort immediately with zero writes and print:

`当前平台(<平台名>)无约束文件 <文件名>,请先创建该文件后重新执行 /code-guidelines`

filling `<平台名>` with the current platform's name and `<文件名>` with its mapped entry-point file above. This command never creates that file itself, on any platform, under any condition — the user must create it and re-run the command.

### Run: detect → select → reconcile → maintain block → report

Run these steps in order against `~/.code-guidelines/` (the shared asset directory this package installed) and the target repository:

1. **Detect** — read `~/.code-guidelines/stacks.json`. For every entry, evaluate its predicates against the whole repository (a monorepo is scanned in full from the root, excluding `node_modules/`, `vendor/`, `dist/`, `build/`, and `.git/`); rules are only ever installed at the repository root, never per-package. Predicates come in four kinds: a listed file exists (e.g. `go.mod`, `Cargo.toml`, `pyproject.toml`); a `package.json` dependency name matches exactly; a source-file extension count meets the entry's declared threshold; or a tag the entry requires was produced by another entry's detection, evaluated in a second pass after all non-tag-dependent entries are resolved (e.g. any detected frontend framework satisfies the accessibility entry's tag requirement).
2. **Select** — `guardrails-core` is always selected and always kept, first, regardless of detection. Every other detected entry is ordered by: framework tier (frontend, mobile, backend) before language tier before domain tier (data, testing, DevOps, cross-cutting); within a tier, higher declared specificity first; ties broken by the entry's position in `stacks.json`, earlier first. Keep the top 12 rule files by this order (core counts toward the 12); anything beyond the cutoff is dropped and named in the report — never dropped silently.
3. **Reconcile** — compare the selected set against `.code-guidelines/manifest.json`'s recorded rule files. Add anything missing. Remove anything installed but no longer selected, but only when its on-disk content hash still matches the manifest (unmodified by the user). Upgrade anything whose on-disk content hash still matches the manifest but whose library copy has changed. Anything whose on-disk content hash no longer matches the manifest is treated as a user edit: leave it untouched and list it as skipped — never overwrite it silently. `project-conventions.md` is never part of this expected set; it is only ever written by the separate `/code-guidelines-distill` command, and this command only reports its presence and distillation date. The manifest's `lint` and `conventions` records belong to the `/code-guidelines-lint` and `/code-guidelines-distill` commands; carry them through unchanged — never clear or rewrite them here.
   - Content hashes are SHA-256 over the file's content with all line endings normalized to `\n` first, so a CRLF checkout is never mistaken for a user edit.
   - If the reconciled set is already identical to what is on disk (same files, same hashes) and the manifest would not change, write nothing at all — not even a modified timestamp — and report "already up to date, nothing changed."
4. **Maintain the managed block** — on each entry-point file that exists at the repository root (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md` — as many as exist, never fewer, never more created), find the `<!-- code-guidelines:begin -->` / `<!-- code-guidelines:end -->` markers. If a file has no markers, append a new managed block at the end of that existing file. If markers are malformed — a begin with no matching end, more than one pair, or markers nested inside another pair — abort with zero writes and report the malformed file; never guess at a repair. Otherwise regenerate the whole block's content from scratch: at most 25 lines total, up to 3 lines of framing text followed by one line per installed rule naming the trigger condition under which to read it (e.g. "Before editing `*.tsx`, read `.code-guidelines/react.md`"); the `project-conventions.md` pointer, when that file exists, always comes first. Leave everything outside the markers exactly as it was, byte for byte. Write the file only if the block's content actually changed.
5. **Report** — see the Output section below.

This command does not arm lint baselines or distill conventions — those are the separate `/code-guidelines-lint` and `/code-guidelines-distill` commands.

### Manual fallback (no `node` available)

The preferred path is running `node ~/.code-guidelines/sync.mjs --platform {{PLATFORM}}`. When `node` is not available, carry out steps 1–5 above by hand, using ordinary file-reading and shell tools, with these substitutions — this is required to reach the exact same end state `sync.mjs` would, not an approximation of it:

- Read `~/.code-guidelines/stacks.json` and `.code-guidelines/manifest.json` as plain JSON; evaluate each predicate by inspecting the files it names directly.
- Compute a file's content hash with `shasum -a 256 <file>` (or `sha256sum <file>` where available) after normalizing its line endings to `\n`, and compare that digest against the manifest's recorded value character for character. This must be the exact algorithm `sync.mjs` uses — SHA-256 over LF-normalized content — never substitute a different digest, and never substitute a byte-for-byte `diff` in its place, since either can disagree with the manifest's recorded hashes.
- Write `.code-guidelines/manifest.json` with the same shape `sync.mjs` would, updating only the `rules` array and carrying the `lint` and `conventions` entries through exactly as they were:

      {
        "version": "...",
        "rules": [{ "file": "...", "sourceVersion": "...", "sha256": "..." }],
        "lint": [{ "tool": "...", "armedAt": "...", "sha256": "...", "optedOut": false }],
        "conventions": { "sha256": "...", "distilledAt": "..." }
      }

  (`lint` stays whatever `/code-guidelines-lint` last recorded, `[]` if it never ran; `conventions` stays `null` until a `/code-guidelines-distill` run has produced `project-conventions.md`.)
- Before any write, confirm the target path and every parent directory is not a symlink, and that the resolved path stays inside `.code-guidelines/` or the repository root; write through a temporary file followed by a rename rather than in place.
- Produce the same report shape described in the Output section, whether run by `sync.mjs` or carried out by hand.

Every rule above — the hash-based conflict check, the 12-file cap, the managed-block regeneration, the zero-write short-circuit, and carrying the `lint`/`conventions` manifest records through untouched — applies identically whether `node` ran it or an agent carried it out by hand; none of it is optional just because `node` is missing.
