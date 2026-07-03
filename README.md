# code-guidelines

A zero-third-party-dependency Node.js installer that delivers one explicitly-invoked skill,
`/code-guidelines`, to four AI coding tools — Claude Code, Codex, opencode, and Gemini CLI. Once
installed, the skill can detect a target repository's tech stack, keep a curated set of guardrail
rules and lint baselines in sync inside that repository, and (on request) distill the repository's
own real conventions into a project-specific guardrail file.

See [README.zh-CN.md](README.zh-CN.md) for the Simplified Chinese version of this document (aligned
section by section with this one).

## Overview

`code-guidelines` follows a progressive-disclosure design: instead of dumping hundreds of rules
into a single context-hungry file, it delivers three layers of constraints on demand —

1. a small, curated library of 48 guardrail rule files (one per supported stack/framework/language);
2. machine-enforced lint baselines (11 toolchains) that are armed once, for free, the first time a
   stack is detected and the project has no existing lint configuration for that tool;
3. a project-specific `project-conventions.md`, distilled on request from the target repository's
   own source code.

The skill is installed once per machine (per platform) via the `code-guidelines` CLI, and then
invoked per target project by explicitly typing `/code-guidelines`.

## Supported platforms

The one skill is delivered to four AI coding tools. Each receives the platform-native artifact form
and manages that platform's own entry file:

| Platform | Installed skill artifact | Entry file it manages | Invocation |
|---|---|---|---|
| Claude Code | `~/.claude/skills/code-guidelines/SKILL.md` (Markdown + `disable-model-invocation: true`) | `CLAUDE.md` | `/code-guidelines` |
| Codex | `~/.codex/prompts/code-guidelines.md` (custom prompt) | `AGENTS.md` | `/code-guidelines` |
| opencode | `~/.config/opencode/commands/code-guidelines.md` | `AGENTS.md` | `/code-guidelines` |
| Gemini CLI | `~/.gemini/commands/code-guidelines.toml` (TOML) | `GEMINI.md` | `/code-guidelines` |

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

**Lint baselines (11 toolchains)** are armed once, for free, when a stack is first detected and the
project has no existing config for that tool — using each tool's current (non-deprecated) format:

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

### 2. Invoke the skill in a target project

Inside any target repository, with the platform's entry file already present (`CLAUDE.md`,
`AGENTS.md`, or `GEMINI.md` — see "What gets generated" below), type:

- `/code-guidelines` — no-argument sync. Detects the tech stack, reconciles the rule library and
  lint baselines inside `.code-guidelines/`, arms lint scaffolding the first time it applies, and
  maintains a managed block inside the entry file. Running it again with nothing changed writes
  nothing (idempotent, zero-write).
- `/code-guidelines distill` — one-shot, agent-driven distillation of this specific repository's
  real conventions (naming, structure, error handling, tooling choices, test patterns) into
  `.code-guidelines/project-conventions.md`. See the residual-risk note below before relying on it.

### 3. Read the output

Every no-argument run ends with a status report covering:

- files added / removed / upgraded / skipped this run, including anything skipped because a user
  had edited it by hand (those are never silently overwritten);
- per lint tool: whether it is armed, whether there is a gap (with the exact install command to
  run — dependencies are never installed automatically), or whether the user has opted out by
  deleting the scaffold;
- whether `project-conventions.md` exists and, if so, when it was last distilled (stated as a
  fact, not judged as stale or fresh).

Pass `--dry-run` to compute and print the same report without writing anything, or `--json` for a
machine-readable version of the same structure.

## When to use

`/code-guidelines` is explicit-invocation only (see Design notes). Use the table below to decide
when to type it — and, just as importantly, when not to.

| Situation | Action | Why |
|---|---|---|
| Routine day-to-day sync, or right after adding/removing a stack dependency | Type `/code-guidelines` (no arguments) | Re-detects the stack and reconciles rules/lint deterministically; safe to run as often as you like — a no-op run writes nothing |
| Onboarding an existing codebase that already has real conventions worth capturing | Type `/code-guidelines distill` once | One-time, evidence-gated extraction of this repo's actual patterns into `project-conventions.md` |
| After a large refactor changed real conventions on purpose | Manually re-run `/code-guidelines distill --force` (or delete `project-conventions.md` first) | Distillation never happens automatically; a stale `project-conventions.md` is reported as a fact, not auto-refreshed |
| You want lint enforcement to start on a stack that has no config yet | Nothing extra — it happens automatically inside the plain `/code-guidelines` run | Lint first-arm is part of the no-argument pipeline, not a separate invocation |
| You are mid-task and think "I could use some guidance for this file" | Do **not** invoke it from that thought alone | Explicit-invocation only (R2): the skill never triggers from intent, keywords, or as a side effect of a coding task |
| You want it to run automatically on every commit or file save | Do **not** ask it to configure a hook | The skill never suggests or wires up hook-based automation |
| You mentioned "python" or "docker" in conversation | Do **not** expect that to trigger anything | Keyword/intent-based triggering is explicitly out of scope |

## What gets generated

Running `/code-guidelines` (or `install`, at the machine level) produces the following artifacts.
Anyone reviewing a diff or onboarding onto a project that uses this tool should recognize these:

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
  the other 9 supported toolchains) — written into the target repository only the first time a
  matching stack is detected **and** the project has no existing configuration for that tool.
  Dependencies are never installed automatically; the status report prints the exact command to
  run. Once armed, an unmodified scaffold is upgraded across tool versions; a scaffold the user has
  hand-edited is treated as their property and left alone permanently; deleting a scaffold is
  treated as an intentional opt-out and is not revived without an explicit `--relint <tool>`.

## Design notes: explicit invocation only, and the distill residual risk

**Intentional deviation from typical skill authoring (R2).** Most agent skills are written with a
short "when to use this" or "trigger" section in their own body so a model can decide, from intent
or keywords, to invoke them. This skill's body deliberately has no such section, and its
`description` is written as a negative guard instead of a positive trigger — for example, "run
only when the user types `/code-guidelines`... never invoke from intent, keywords, or as a side
effect of coding tasks." On Claude Code the skill additionally sets `disable-model-invocation:
true` in its frontmatter, which hard-disables automatic loading at the platform level. This is a
deliberate choice, not an oversight: a tool that rewrites files across a repository (even
conservatively) should never fire as a side effect of an unrelated coding task, and it should never
be wired up to run automatically via a hook — the skill will not suggest that either. If you expect
to find a "when should the model call this" section in the skill's own body, you will not; that
guidance lives in this README instead, read by humans, not used by the model to self-trigger.

**`distill` quality is agent-produced, not machine-verified.** The no-argument sync path
(detection, selection, reconciliation, lint arming) is a deterministic, zero-dependency script with
byte-for-byte reproducible output — it is exhaustively covered by automated tests. `distill` is
different: it is an agent-driven procedure (defined in the skill body, not a script) that samples
source files and writes prose. The tooling enforces structural guardrails around it — a fixed
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
