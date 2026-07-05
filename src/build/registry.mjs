// src/build/registry.mjs — explicit ordered command registry for the single-source build
// (SPEC-BUILD-001, DES-BUILD-001, DES-PLAT-001). Determinism requires this list's order, and each
// platform's key order, to be fixed by hand here rather than derived from any non-deterministic
// enumeration (directory listing order, Object.keys() of a dynamically-populated map, etc.).
//
// This package installs THREE explicit-invocation commands, each its own registry entry:
//   - code-guidelines          — sync the rule library + the entry-file managed block
//   - code-guidelines-lint     — arm machine-enforced lint baselines for the detected stack
//   - code-guidelines-distill  — distill this repository's own conventions
// None of them takes an argument; each is a separate command file per platform.
//
// Per-command `platforms` entries hold the mechanical, build-time facts a platform emitter
// (src/build/platforms.mjs) needs to render that command's artifact: its file format and where it
// lands under generated/<platform>/ (must match the product path src/commands/install.mjs installs
// — SPEC-PLATFORM-001), plus its frontmatter conventions. Claude Code and Codex both keep one
// directory per skill (`<id>/SKILL.md`) — Codex reads Agent Skills from `~/.agents/skills/<id>/
// SKILL.md`, the format that replaced its deprecated `~/.codex/prompts/*.md` custom prompts; the
// other two platforms (opencode, gemini) differentiate commands by file name in one shared
// directory. The actual command prose (purpose/triggers/behavior/output, the negative-invocation-
// guard description text, the sync.mjs manual-fallback algorithm, the distill program) is sourced
// from fragments/<fragmentsDir>/*, not duplicated here — this registry never carries prose.
export const REGISTRY = [
  {
    id: 'code-guidelines',
    fragmentsDir: 'core',
    platforms: {
      claude: {
        format: 'markdown',
        generatedFile: 'code-guidelines/SKILL.md',
        frontmatter: {
          name: 'code-guidelines',
          'disable-model-invocation': true,
        },
      },
      codex: {
        format: 'markdown',
        generatedFile: 'code-guidelines/SKILL.md',
        frontmatter: {
          name: 'code-guidelines',
        },
      },
      opencode: {
        format: 'markdown',
        generatedFile: 'code-guidelines.md',
        frontmatter: {},
      },
      gemini: {
        format: 'toml',
        generatedFile: 'code-guidelines.toml',
      },
    },
  },
  {
    id: 'code-guidelines-lint',
    fragmentsDir: 'lint',
    platforms: {
      claude: {
        format: 'markdown',
        generatedFile: 'code-guidelines-lint/SKILL.md',
        frontmatter: {
          name: 'code-guidelines-lint',
          'disable-model-invocation': true,
        },
      },
      codex: {
        format: 'markdown',
        generatedFile: 'code-guidelines-lint/SKILL.md',
        frontmatter: {
          name: 'code-guidelines-lint',
        },
      },
      opencode: {
        format: 'markdown',
        generatedFile: 'code-guidelines-lint.md',
        frontmatter: {},
      },
      gemini: {
        format: 'toml',
        generatedFile: 'code-guidelines-lint.toml',
      },
    },
  },
  {
    id: 'code-guidelines-distill',
    fragmentsDir: 'distill',
    platforms: {
      claude: {
        format: 'markdown',
        generatedFile: 'code-guidelines-distill/SKILL.md',
        frontmatter: {
          name: 'code-guidelines-distill',
          'disable-model-invocation': true,
        },
      },
      codex: {
        format: 'markdown',
        generatedFile: 'code-guidelines-distill/SKILL.md',
        frontmatter: {
          name: 'code-guidelines-distill',
        },
      },
      opencode: {
        format: 'markdown',
        generatedFile: 'code-guidelines-distill.md',
        frontmatter: {},
      },
      gemini: {
        format: 'toml',
        generatedFile: 'code-guidelines-distill.toml',
      },
    },
  },
];
