# Example Target Project

A plain project with no `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` entry file at
its root. Used by `test/precheck.test.mjs` (SPEC-PRECHECK-001) as a
starting-point fixture for platform-precheck-abort scenarios: whichever
platform is asked for, its mapped entry file is missing here, so
`sync()` must abort with exit 3 and write nothing.
