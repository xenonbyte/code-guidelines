# Example Target Project

Pre-existing Claude Code entry file at the project root. Used by
`test/precheck.test.mjs` (SPEC-PRECHECK-001 / SPEC-HOSTFMT-001) as a
starting-point fixture: `CLAUDE.md` exists here (so the `claude` platform's
precheck passes and its managed block may be maintained), while
`AGENTS.md` / `GEMINI.md` do not (so other platforms' prechecks still abort,
and a passing sync must never create them).

## Existing project notes

These notes predate `code-guidelines` and must survive byte-for-byte outside
the managed block.
