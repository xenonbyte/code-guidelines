# Third-Party Notices

`code-guidelines` itself is licensed under the MIT License (see `LICENSE`). This file documents the
provenance of the two content sets this project ships that were not authored purely from this
repository's own reasoning: the curated rule library (`assets/library/`) and the lint baseline
configurations (`assets/lint/`).

## Rule library (`assets/library/`, 48 files)

Every file in `assets/library/` is an **original work, authored fresh for this project**. None of
the 48 rule files is a verbatim copy, near-verbatim copy, or line-for-line adaptation of any
upstream text. Each file's frontmatter carries a `source` field; for every file currently in this
library that value is `original`, meaning it was distilled and written from scratch rather than
copied from an upstream `.mdc`/rule file — see the frontmatter of any file under
`assets/library/*.md` to confirm this directly.

That said, the *idea* of a curated, per-stack guardrail rule library — and the general shape of
what such a rule file should contain (hard constraints before ecosystem idioms, one file per
stack/framework/language) — was inspired by, and written in the spirit of, two open-source
community rule collections. This project acknowledges them even though no upstream text was
copied:

- **[PatrickJS/awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules)** — licensed
  under **CC0-1.0** (public domain dedication). Primary inspiration for the scope and per-stack
  organization of the rule library.
- **[github/awesome-copilot](https://github.com/github/awesome-copilot)** — licensed under **MIT**.
  Secondary inspiration for rule scope and structure.

If a future revision of this library does incorporate adapted text from either project, the
corresponding rule file's `source` frontmatter field will be updated to record the exact upstream
repository path and commit it was adapted from (per `SPEC-RULEFMT-001`), and this section will be
updated to list that file explicitly with its upstream attribution. Until then, both projects are
credited here as acknowledgements of inspiration, not as sources of copied material.

## Lint baseline configurations (`assets/lint/`, 11 toolchains)

The lint baseline configuration files under `assets/lint/<language>/` (ESLint, Prettier, tsconfig,
ruff, mypy, golangci-lint, clippy/rustfmt, Checkstyle, ktlint/detekt, SwiftLint,
`.editorconfig`/Roslyn analyzer settings, PHP-CS-Fixer/PHPStan, RuboCop, clang-format/clang-tidy)
are original configuration files written for this project. They are not copied from any single
upstream template. Each one follows that tool's own currently documented, non-deprecated
configuration format and file naming convention (for example, ESLint's flat `eslint.config.mjs`
rather than the removed `.eslintrc*` format, and golangci-lint's v2 schema with a top-level
`version: "2"`) as published in that tool's own official documentation at the time this project's
lint baselines were authored. Each baseline directory includes a `meta.json` describing which
constraints it enforces mechanically, so the rule library's prose never restates what a lint tool
already checks. These tools' own licenses (all are separately-licensed open-source projects, e.g.
ESLint: MIT, Prettier: MIT, golangci-lint: GPL-3.0, RuboCop: MIT) govern the tools themselves, not
this project's small configuration files that merely invoke them.

## Everything else

All other source code, documentation, and assets in this repository (the CLI, installer, sync
engine, build pipeline, `stacks.json`, tests, and this document) are original work licensed under
this project's own `LICENSE` (MIT).
