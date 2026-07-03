# code-guidelines

A zero-third-party-dependency Node.js installer that delivers three explicitly-invoked commands —
`/code-guidelines`, `/code-guidelines-lint`, and `/code-guidelines-distill` — to four AI coding
tools: Claude Code, Codex, opencode, and Gemini CLI. Once installed, `/code-guidelines` detects a
target repository's tech stack and keeps a curated set of guardrail rules (plus a managed pointer
block in the entry file) in sync; `/code-guidelines-lint` arms machine-enforced lint baselines for
the detected stack; and `/code-guidelines-distill` distills the repository's own real conventions
into a project-specific guardrail file. Each command is manual-only and does one thing — none fires
from intent.

See [README.zh-CN.md](README.zh-CN.md) for the Simplified Chinese version of this document (aligned
section by section with this one).

## Overview

`code-guidelines` follows a progressive-disclosure design: instead of dumping hundreds of rules
into a single context-hungry file, it delivers three layers of constraints on demand, each behind
its own explicit command —

1. `/code-guidelines` — a small, curated library of 48 guardrail rule files (one per supported
   stack/framework/language), plus a managed pointer block in the entry file;
2. `/code-guidelines-lint` — machine-enforced lint baselines (11 toolchains), armed once the first
   time a stack is detected and the project has no existing lint configuration for that tool;
3. `/code-guidelines-distill` — a project-specific `project-conventions.md`, distilled from the
   target repository's own source code.

The three commands are installed once per machine (per platform) via the `code-guidelines` CLI, and
then invoked per target project by explicitly typing the command — each does only what you asked
for, nothing more.

## Supported platforms

The three commands are delivered to four AI coding tools. Each tool receives the platform-native
artifact form (one file per command) and manages that platform's own entry file. The table shows the
core command's artifact; the `-lint` and `-distill` commands sit right beside it — a sibling
`code-guidelines-lint/` / `code-guidelines-distill/` skill directory on Claude Code, or a
`code-guidelines-lint.<ext>` / `code-guidelines-distill.<ext>` file in the same directory elsewhere:

| Platform | Installed skill artifact (core command) | Entry file it manages | Invocation |
|---|---|---|---|
| Claude Code | `~/.claude/skills/code-guidelines/SKILL.md` (Markdown + `disable-model-invocation: true`) | `CLAUDE.md` | `/code-guidelines`, `/code-guidelines-lint`, `/code-guidelines-distill` |
| Codex | `~/.codex/prompts/code-guidelines.md` (custom prompt) | `AGENTS.md` | the same three |
| opencode | `~/.config/opencode/commands/code-guidelines.md` | `AGENTS.md` | the same three |
| Gemini CLI | `~/.gemini/commands/code-guidelines.toml` (TOML) | `GEMINI.md` | the same three |

The `--platform` flag on `install` / `uninstall` accepts any comma-separated subset of `claude`,
`codex`, `opencode`, `gemini` (default: all four).

## Supported stacks & languages

Detection selects from **48 guardrail rule files across 9 categories**. `guardrails-core` is always
applied; the rest are selected by detecting the repository's stack, with a total-ordered cap of 12
rule files per repository:

- **Core (1):** guardrails-core — universal clean-code / anti-over-engineering guardrails, always on.
- **Languages (12):** TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin, Swift, C#, C++, PHP, Ruby.
- **Frontend (9):** React, Next.js, Vue, Nuxt, Angular, Svelte, Astro, Tailwind CSS, HTML/CSS.
- **Mobile (4):** React Native, Flutter, Android (Jetpack Compose), iOS (SwiftUI).
- **Backend (9):** Node.js API, Django, FastAPI, Flask, Spring Boot, Laravel, Rails, ASP.NET Core, GraphQL.
- **Data (3):** SQL, MongoDB, Python ML.
- **Testing (3):** JS unit testing, end-to-end testing, pytest.
- **DevOps (4):** Docker, Kubernetes, Terraform, GitHub Actions.
- **Cross-cutting (3):** REST API, Security (OWASP-oriented), Accessibility (a11y).

**Lint baselines (11 toolchains)** are armed by the separate `/code-guidelines-lint` command, once
per tool, when a stack is detected and the project has no existing config for that tool — using each
tool's current (non-deprecated) format:

| Language | Baseline configs |
|---|---|
| JS / TypeScript | ESLint flat config (`eslint.config.mjs`) + Prettier + strict `tsconfig.json` |
| Python | Ruff (`ruff.toml`) + mypy (strict) |
| Go | golangci-lint v2 (`.golangci.yml`) |
| Rust | rustfmt + Clippy |
| Java | Checkstyle |
| Kotlin | ktlint (`.editorconfig`) + detekt |
| Swift | SwiftLint |
| C# | Roslyn analyzers (`.editorconfig` + `Directory.Build.props`) |
| PHP | PHP-CS-Fixer + PHPStan |
| Ruby | RuboCop |
| C / C++ | clang-format + clang-tidy |

## How to use

### 1. Install the skill

Install from npm — the CLI has **zero third-party dependencies**. Run it once without a global
install:

```sh
npx code-guidelines install
```

Or install the CLI globally and run it:

```sh
npm install -g code-guidelines
code-guidelines install
```

You can also run it directly from a checkout of this repository: `node bin/code-guidelines install`.

By default this installs the skill to all four supported platforms. To install only a subset, pass a
comma-separated `--platform` list drawn from `claude`, `codex`, `opencode`, `gemini`:

```sh
code-guidelines install --platform claude,codex
```

Other CLI commands:

- `code-guidelines status` — read-only report of what is currently installed (manifest shape,
  installed skills/assets/platforms).
- `code-guidelines uninstall [--platform <list>]` — remove installed files that this tool owns and
  has not seen modified by hand.
- `code-guidelines version` / `help` — print version / usage.

### 2. Invoke a command in a target project

Inside any target repository, type one of the three commands. `/code-guidelines` requires the
platform's entry file to already exist (`CLAUDE.md`, `AGENTS.md`, or `GEMINI.md` — see "What gets
generated" below); the other two write only inside `.code-guidelines/` (and, for lint, the tool
config files) and do not require it:

- `/code-guidelines` — detects the tech stack, reconciles the rule library inside
  `.code-guidelines/`, and maintains a managed pointer block inside the entry file. Running it again
  with nothing changed writes nothing (idempotent, zero-write). It never arms lint or distills.
- `/code-guidelines-lint` — arms the machine-enforced lint baseline for each detected stack that has
  no existing config for that tool, the first time it applies. It writes the tool's config files but
  never installs dependencies — it prints the exact command instead. Deleting an armed scaffold is a
  permanent opt-out.
- `/code-guidelines-distill` — one-shot, agent-driven distillation of this specific repository's
  real conventions (naming, structure, error handling, tooling choices, test patterns) into
  `.code-guidelines/project-conventions.md`. See the residual-risk note below before relying on it.

### 3. Read the output

Each command ends with a status report.

- `/code-guidelines` covers files added / removed / upgraded / skipped this run (anything a user
  edited by hand is skipped, never silently overwritten), whether `project-conventions.md` exists
  and, if so, when it was last distilled (stated as a fact, not judged stale or fresh), and a
  one-line pointer to the two companion commands.
- `/code-guidelines-lint` reports, per lint tool: whether it is armed, whether there is a dependency
  gap (with the exact install command to run — dependencies are never installed automatically),
  whether an existing config was left untouched (read-only recommendation), or whether the user has
  opted out by deleting the scaffold.

Pass `--dry-run` to compute and print the same report without writing anything, or `--json` for a
machine-readable version of the same structure.

## When to use

All three commands are explicit-invocation only (see Design notes). Use the table below to decide
which to type when — and, just as importantly, when not to.

| Situation | Action | Why |
|---|---|---|
| Routine day-to-day rule sync, or right after adding/removing a stack dependency | Type `/code-guidelines` (rules + managed block only) | Re-detects the stack and reconciles rules deterministically; safe to run as often as you like — a no-op run writes nothing |
| You want lint enforcement to start on a stack that has no config yet | Type `/code-guidelines-lint` | Arms the machine-enforced baseline once, per tool; a deliberate, separate command — never a side effect of the rule sync |
| Starting a brand-new (greenfield) project with no code yet | Type `/code-guidelines` and `/code-guidelines-lint` now for guardrails + lint from day one; run `/code-guidelines-distill` later, once a few real files exist | An empty repo has nothing to distill — the guardrail library and lint baselines apply immediately; project-specific conventions can only firm up once there is code to evidence them |
| Onboarding an existing codebase that already has real conventions worth capturing | Type `/code-guidelines-distill` once | One-time, evidence-gated extraction of this repo's actual patterns into `project-conventions.md` |
| After a large refactor changed real conventions on purpose | Manually re-run `/code-guidelines-distill --force` (or delete `project-conventions.md` first) | Distillation never happens automatically; a stale `project-conventions.md` is reported as a fact, not auto-refreshed |
| You are mid-task and think "I could use some guidance for this file" | Do **not** invoke any of them from that thought alone | Explicit-invocation only (R2): the commands never trigger from intent, keywords, or as a side effect of a coding task |
| You want it to run automatically on every commit or file save | Do **not** ask it to configure a hook | The commands never suggest or wire up hook-based automation |
| You mentioned "python" or "docker" in conversation | Do **not** expect that to trigger anything | Keyword/intent-based triggering is explicitly out of scope |

## What gets generated

The three commands (or `install`, at the machine level) produce the following artifacts. Anyone
reviewing a diff or onboarding onto a project that uses this tool should recognize these:

- **`.code-guidelines/` (inside the target repository)** — the curated guardrail rule files
  currently selected for this repository's detected stack, plus `manifest.json`, which records
  each rule file's source version and content hash, each lint tool's arm/opt-out state, and the
  content hash + distillation date of `project-conventions.md` (when present). This directory is
  fully owned and reconciled by the tool; hand edits to a tracked file are detected by hash and
  are never silently overwritten.
- **A managed block inside the platform's entry file** (`CLAUDE.md` for Claude Code, `AGENTS.md`
  for Codex and opencode, `GEMINI.md` for Gemini CLI) — a `<!-- code-guidelines:begin -->` /
  `<!-- code-guidelines:end -->` block, at most 25 lines, listing a one-line, condition-based
  pointer per installed rule (for example, "Before editing `*.tsx`, read
  `.code-guidelines/react.md`"). Everything outside the block is left byte-for-byte untouched, and
  the block itself is only rewritten when its content actually changes. The tool never creates
  this entry file — it must already exist.
- **Lint scaffold configuration files** (for example `eslint.config.mjs` + `.prettierrc` +
  `tsconfig.json` for JS/TS, `ruff.toml` + `mypy.ini` for Python, and similar per-language sets for
  the other 9 supported toolchains) — written by the separate `/code-guidelines-lint` command, only
  the first time a matching stack is detected **and** the project has no existing configuration for
  that tool. Dependencies are never installed automatically; the status report prints the exact
  command to run. Once armed, an unmodified scaffold is upgraded across tool versions; a scaffold the
  user has hand-edited is treated as their property and left alone permanently; deleting a scaffold
  is treated as an intentional opt-out and is not revived without an explicit
  `/code-guidelines-lint --relint <tool>`.

## Design notes: explicit invocation only, and the distill residual risk

**Intentional deviation from typical skill authoring (R2).** Most agent skills are written with a
short "when to use this" or "trigger" section in their own body so a model can decide, from intent
or keywords, to invoke them. Each of these three commands' bodies deliberately has no such section,
and each `description` is written as a negative guard instead of a positive trigger — for example,
"run only when the user types `/code-guidelines`... never invoke from intent, keywords, or as a side
effect of coding tasks." On Claude Code each command additionally sets `disable-model-invocation:
true` in its frontmatter, which hard-disables automatic loading at the platform level. This is a
deliberate choice, not an oversight: a tool that rewrites files across a repository (even
conservatively) should never fire as a side effect of an unrelated coding task, and it should never
be wired up to run automatically via a hook — the commands will not suggest that either. If you
expect to find a "when should the model call this" section in a command's own body, you will not;
that guidance lives in this README instead, read by humans, not used by the model to self-trigger.

**`distill` quality is agent-produced, not machine-verified.** The deterministic commands
(`/code-guidelines` and `/code-guidelines-lint` — detection, selection, reconciliation, lint arming)
are a zero-dependency script with byte-for-byte reproducible output — exhaustively covered by
automated tests. `/code-guidelines-distill` is different: it is an agent-driven procedure (defined
in the command body, not a script) that samples source files and writes prose. The tooling enforces structural guardrails around it — a fixed
template, an 80-line cap, and a requirement that every convention cite at least two real
repository file paths as evidence, with unsupported or generically-best-practice entries dropped —
but it cannot verify that the *semantic content* of a distilled convention is actually correct or
representative of the repository. Automated tests can (and do) check that the template, evidence
format, and overwrite-protection logic work; they cannot check the judgment quality of what an
agent chose to write. Review a freshly distilled `project-conventions.md` before trusting it, the
same way you would review any other agent-authored document.

## License

MIT — see `LICENSE`. Third-party sources and licenses for the curated rule library and lint
baselines are documented in `THIRD-PARTY.md`.
