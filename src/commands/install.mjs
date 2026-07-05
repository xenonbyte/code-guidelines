// src/commands/install.mjs — resolve platform roots + shared asset root, gather the desired
// file set, and drive the two-phase-commit engine (SPEC-INSTALL-001, SPEC-PLATFORM-001,
// SCOPE-IN-005, SPEC-CLI-001). This module owns the ONLY knowledge of where things go on disk;
// the transaction engine is source-agnostic. Roots are injectable ({ home, env }) so tests
// never touch the real home dir.
import { readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest, validateInstallManifest, INSTALL_PLATFORMS } from '../install/manifest.mjs';
import { runInstallTransaction, EXIT_CONFLICT } from '../install/transaction.mjs';
import { REGISTRY } from '../build/registry.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
export const SKILL_NAME = 'code-guidelines';

const SKILL_DEF = REGISTRY.find((s) => s.id === SKILL_NAME);
if (!SKILL_DEF) {
  throw new Error(`install.mjs: no registry.mjs entry found for skill "${SKILL_NAME}"`);
}

/**
 * The on-disk product file name each platform installs, per SPEC-PLATFORM-001. Derived directly
 * from src/build/registry.mjs's per-platform `generatedFile` (PLAN-TASK-008 reconciliation: this
 * used to be a second, independently hand-maintained copy of the same filenames — registry.mjs is
 * now the single source of truth, so the two can never drift apart). Used both to find the built
 * product under `generated/<platform>/` and to place it under the platform root; also referenced
 * by test fixtures (test/install.test.mjs). (Kept for reference / single-file platforms; the
 * default gatherer below mirrors the whole generated/<platform>/ subtree so multi-file skills
 * also work without consulting this map.)
 */
export const PLATFORM_PRODUCT_FILE = Object.freeze(
  Object.fromEntries(
    Object.entries(SKILL_DEF.platforms).map(([platform, params]) => [platform, params.generatedFile])
  )
);

/**
 * Resolve every install path from an injectable home + env (SPEC-PLATFORM-001).
 * - claude:   <home>/.claude/skills/          (one <skill-id>/SKILL.md directory per command)
 * - codex:    <home>/.agents/skills/          (one <skill-id>/SKILL.md directory per command — the
 *             Agent Skills location Codex reads; it replaced the deprecated ~/.codex/prompts/*.md
 *             custom-prompt slash commands, which newer Codex no longer surfaces the same way)
 * - opencode: <XDG_CONFIG_HOME | <home>/.config>/opencode/commands/  (one <skill-id>.md per command)
 * - gemini:   <home>/.gemini/commands/        (one <skill-id>.toml per command)
 * - shared:   <home>/.code-guidelines/  (full asset set + install-manifest.json; SCOPE-IN-005)
 * `allowedRoots` always spans the shared root plus ALL four platform roots so a partial-platform
 * reinstall can still safely remove no-longer-installed platforms' files. It also spans `legacyRoots`
 * — install locations this tool no longer WRITES to but must still be allowed to CLEAN UP: the old
 * Codex custom-prompts dir (~/.codex/prompts). A reinstall's owned-file removal (transaction Phase
 * 2c) assertSafeTarget-gates each deletion, so without the old root there the previously-owned
 * ~/.codex/prompts/code-guidelines*.md would be orphaned (skipped as unsafe) instead of migrated
 * away. The claude root is the `skills/` parent (not a single skill dir) so all three command skill
 * directories land under it; the codex root works the same way.
 */
export function resolveConfig({ home = homedir(), env = process.env } = {}) {
  const sharedRoot = join(home, '.code-guidelines');
  const xdg =
    typeof env.XDG_CONFIG_HOME === 'string' && env.XDG_CONFIG_HOME.trim() !== ''
      ? env.XDG_CONFIG_HOME
      : join(home, '.config');
  const platformRoots = {
    claude: join(home, '.claude', 'skills'),
    codex: join(home, '.agents', 'skills'),
    opencode: join(xdg, 'opencode', 'commands'),
    gemini: join(home, '.gemini', 'commands'),
  };
  // Locations we no longer install to but must be allowed to clean up on reinstall (see the
  // resolveConfig doc comment above): the deprecated Codex custom-prompts dir.
  const legacyRoots = [join(home, '.codex', 'prompts')];
  return {
    home,
    sharedRoot,
    platformRoots,
    legacyRoots,
    manifestPath: join(sharedRoot, 'install-manifest.json'),
    allowedRoots: [sharedRoot, ...Object.values(platformRoots), ...legacyRoots],
  };
}

/** The installer's own version, from package.json (assets/VERSION is created by a later task). */
export function readInstallerVersion() {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

// Recursively list files (not directories) under `dir` as paths relative to `dir`. Returns []
// when `dir` does not exist.
async function listFilesRelative(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return out;
    throw err;
  }
  for (const dirent of entries) {
    const rel = dirent.name;
    if (dirent.isDirectory()) {
      for (const nested of await listFilesRelative(join(dir, rel))) {
        out.push(join(rel, nested));
      }
    } else if (dirent.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

/**
 * Gather the desired file set from the built repo: every file under `assets/` becomes a shared
 * asset targeted at `<sharedRoot>/<rel>`, and every file under `generated/<platform>/` (for each
 * selected platform) is mirrored into that platform's root. NOTE: `generated/*` (TASK-008) and
 * the full `assets/*` (TASK-009+) do not exist yet, so this returns whatever is present today;
 * real end-to-end source wiring is verified once those tasks land. Tests bypass this by passing
 * `options.sources`.
 */
export async function gatherDefaultSources(platforms, cfg) {
  const desired = [];

  // Shared assets → ~/.code-guidelines/<rel>
  const assetsDir = join(REPO_ROOT, 'assets');
  for (const rel of await listFilesRelative(assetsDir)) {
    const content = await readFile(join(assetsDir, rel));
    desired.push({ targetPath: join(cfg.sharedRoot, rel), content });
  }

  // Per-platform built products → <platformRoot>/<rel>. Each product file is tagged with the
  // registry skill id that owns it (derived from that skill's `generatedFile` for the platform),
  // so the install manifest records true per-command ownership across all three commands.
  for (const platform of platforms) {
    const genDir = join(REPO_ROOT, 'generated', platform);
    const root = cfg.platformRoots[platform];
    const skillByRel = new Map(
      REGISTRY.filter((s) => s.platforms[platform]).map((s) => [s.platforms[platform].generatedFile, s.id])
    );
    for (const rel of await listFilesRelative(genDir)) {
      const content = await readFile(join(genDir, rel));
      desired.push({ targetPath: join(root, rel), content, skill: skillByRel.get(rel) ?? SKILL_NAME, platform });
    }
  }

  return desired;
}

/**
 * `install [--platform <csv>]` — SPEC-INSTALL-001 two-phase commit.
 * @param {string[]} platforms  resolved platform list (defaults to all four via the CLI parser)
 * @param {object} [options]  { home, env, sources } — `sources` injects a fixture desired set.
 * @returns {Promise<number>} exit code (0 success, 2 corrupt/invalid-shape existing manifest,
 *   4 conflict/fs-safety abort, 1 generic internal/precondition error outside SPEC-CLI-001's set).
 */
export async function install(platforms, options = {}) {
  const cfg = resolveConfig(options);
  const desired = options.sources ?? (await gatherDefaultSources(platforms, cfg));

  if (desired.length === 0) {
    // Generic precondition failure (dev-only: nothing has been built yet). SPEC-CLI-001's
    // install exit-code set (0/2/3/4) has no enumerated code for this "not built yet" case, so
    // exit 1 is used as a generic internal/precondition error, intentionally outside that set.
    console.error(
      'install: no source artifacts found under assets/ or generated/. Build the project first.'
    );
    return 1;
  }

  let priorManifest = null;
  try {
    priorManifest = await loadManifest(cfg.manifestPath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // A present-but-corrupt/unparseable existing manifest is a "manifest 形状不合法" case per
      // SPEC-CLI-001, not a generic failure — exit 2, consistent with `status`'s invalid-manifest
      // handling. A genuinely-absent manifest (ENOENT, fresh install) is NOT an error and falls
      // through with priorManifest left null.
      console.error(`install: cannot read existing install manifest: ${err.message}`);
      return 2;
    }
  }

  if (priorManifest !== null && !validateInstallManifest(priorManifest)) {
    // Valid JSON but the wrong shape is still "manifest 形状不合法" (SPEC-CLI-001) — exit 2.
    console.error(`install: existing install manifest at ${cfg.manifestPath} has an invalid shape.`);
    return 2;
  }

  const manifestMeta = {
    version: readInstallerVersion(),
    skills: REGISTRY.map((s) => s.id),
    platforms: platforms.filter((p) => INSTALL_PLATFORMS.includes(p)),
  };

  let result;
  try {
    result = await runInstallTransaction({
      desired,
      allowedRoots: cfg.allowedRoots,
      priorManifest,
      manifestPath: cfg.manifestPath,
      manifestMeta,
    });
  } catch (err) {
    // Pre-commit staging failure (unexpected fs error mid-stage): staging was discarded, the
    // original install is untouched. Accepted as a generic internal error, intentionally outside
    // SPEC-CLI-001's closed install exit-code set (0/2/3/4) — there is no enumerated code for an
    // unclassified I/O failure during staging.
    console.error(`install: aborted, no changes made: ${err.message}`);
    return 1;
  }

  if (result.exitCode === EXIT_CONFLICT) {
    console.error('install: aborted — refusing to overwrite modified or foreign files:');
    for (const c of result.conflicts) {
      console.error(`  [${c.reason}] ${c.path}`);
    }
    return EXIT_CONFLICT;
  }

  console.log(
    `install: complete — ${result.written.length} file(s) written for platform(s) ${manifestMeta.platforms.join(', ')}.`
  );
  if (result.removed.length > 0) {
    console.log(`install: removed ${result.removed.length} no-longer-installed file(s).`);
  }
  for (const s of result.skippedRemovals) {
    console.log(`install: kept user-modified file (not removed): ${s.path}`);
  }
  return result.exitCode;
}
