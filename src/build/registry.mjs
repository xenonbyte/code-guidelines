// src/build/registry.mjs — explicit ordered skill registry for the single-source build
// (SPEC-BUILD-001, DES-BUILD-001, DES-PLAT-001). Determinism requires this list's order, and each
// platform's key order, to be fixed by hand here rather than derived from any non-deterministic
// enumeration (directory listing order, Object.keys() of a dynamically-populated map, etc.).
//
// Per-skill `platforms` entries hold the mechanical, build-time facts a platform emitter
// (src/build/platforms.mjs, PLAN-TASK-008) needs to render this skill's artifact: its file
// format, where it lands under generated/<platform>/ (must match the single-file product name
// src/commands/install.mjs's PLATFORM_PRODUCT_FILE already installs — SPEC-PLATFORM-001), its
// frontmatter conventions, and its argument-placeholder syntax. The actual skill prose
// (purpose/triggers/behavior/output, the negative-invocation-guard description text, the
// sync.mjs manual-fallback algorithm, the distill program) is sourced from fragments/
// (PLAN-TASK-007), not duplicated here — this registry never carries prose.
export const REGISTRY = [
  {
    id: 'code-guidelines',
    // Directory under fragments/ holding this skill's per-section prose (purpose/triggers/
    // behavior/output.md) — kept as an explicit field, separate from `id`, so the registry (not
    // a filesystem-naming coincidence) is the single source of truth build.mjs's readFragments()
    // uses to locate them (PLAN-TASK-008 reconciliation with fragments/skill/*).
    fragmentsDir: 'skill',
    platforms: {
      claude: {
        format: 'markdown',
        generatedFile: 'SKILL.md',
        frontmatter: {
          name: 'code-guidelines',
          'disable-model-invocation': true,
        },
      },
      codex: {
        format: 'markdown',
        generatedFile: 'code-guidelines.md',
        frontmatter: {
          'argument-hint': '[distill]',
        },
        argumentPlaceholder: '$ARGUMENTS',
      },
      opencode: {
        format: 'markdown',
        generatedFile: 'code-guidelines.md',
        frontmatter: {},
        argumentPlaceholder: '$ARGUMENTS',
      },
      gemini: {
        format: 'toml',
        generatedFile: 'code-guidelines.toml',
        argumentPlaceholder: '{{args}}',
      },
    },
  },
];
