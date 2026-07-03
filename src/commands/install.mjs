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
import { loadManifest, INSTALL_PLATFORMS } from '../install/manifest.mjs';
import { runInstallTransaction, EXIT_CONFLICT } from '../install/transaction.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
export const SKILL_NAME = 'code-guidelines';

/**
 * The on-disk product file name each platform installs, per SPEC-PLATFORM-001. Used both to
 * find the built product under `generated/<platform>/` and to place it under the platform root.
 * (Kept for reference / single-file platforms; the default gatherer mirrors the whole
 * generated/<platform>/ subtree so multi-file skills also work.)
 */
export const PLATFORM_PRODUCT_FILE = Object.freeze({
  claude: 'SKILL.md',
  codex: 'code-guidelines.md',
  opencode: 'code-guidelines.md',
  gemini: 'code-guidelines.toml',
});

/**
 * Resolve every install path from an injectable home + env (SPEC-PLATFORM-001).
 * - claude:   <home>/.claude/skills/code-guidelines/
 * - codex:    <home>/.codex/prompts/
 * - opencode: <XDG_CONFIG_HOME | <home>/.config>/opencode/commands/
 * - gemini:   <home>/.gemini/commands/
 * - shared:   <home>/.code-guidelines/  (full asset set + install-manifest.json; SCOPE-IN-005)
 * `allowedRoots` always spans the shared root plus ALL four platform roots so a partial-platform
 * reinstall can still safely remove no-longer-installed platforms' files.
 */
export function resolveConfig({ home = homedir(), env = process.env } = {}) {
  const sharedRoot = join(home, '.code-guidelines');
  const xdg =
    typeof env.XDG_CONFIG_HOME === 'string' && env.XDG_CONFIG_HOME.trim() !== ''
      ? env.XDG_CONFIG_HOME
      : join(home, '.config');
  const platformRoots = {
    claude: join(home, '.claude', 'skills', 'code-guidelines'),
    codex: join(home, '.codex', 'prompts'),
    opencode: join(xdg, 'opencode', 'commands'),
    gemini: join(home, '.gemini', 'commands'),
  };
  return {
    home,
    sharedRoot,
    platformRoots,
    manifestPath: join(sharedRoot, 'install-manifest.json'),
    allowedRoots: [sharedRoot, ...Object.values(platformRoots)],
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

  // Per-platform built products → <platformRoot>/<rel>
  for (const platform of platforms) {
    const genDir = join(REPO_ROOT, 'generated', platform);
    const root = cfg.platformRoots[platform];
    for (const rel of await listFilesRelative(genDir)) {
      const content = await readFile(join(genDir, rel));
      desired.push({ targetPath: join(root, rel), content, skill: SKILL_NAME, platform });
    }
  }

  return desired;
}

/**
 * `install [--platform <csv>]` — SPEC-INSTALL-001 two-phase commit.
 * @param {string[]} platforms  resolved platform list (defaults to all four via the CLI parser)
 * @param {object} [options]  { home, env, sources } — `sources` injects a fixture desired set.
 * @returns {Promise<number>} exit code (0 success, 4 conflict/fs-safety abort, 1 unexpected).
 */
export async function install(platforms, options = {}) {
  const cfg = resolveConfig(options);
  const desired = options.sources ?? (await gatherDefaultSources(platforms, cfg));

  if (desired.length === 0) {
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
      // A corrupt/unreadable manifest is a real problem; surface it rather than guessing.
      console.error(`install: cannot read existing install manifest: ${err.message}`);
      return 1;
    }
  }

  const manifestMeta = {
    version: readInstallerVersion(),
    skills: [SKILL_NAME],
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
    // Pre-commit staging failure: staging was discarded, the original install is untouched.
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
