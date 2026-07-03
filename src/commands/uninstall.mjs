// src/commands/uninstall.mjs — remove installer-owned files (SPEC-INSTALL-001, SCOPE-IN-005).
// Only files recorded in the install-manifest whose on-disk hash is unchanged are removed;
// user-modified files are skipped and reported (never destroyed). When nothing installer-owned
// remains, the install-manifest itself and the now-empty ~/.code-guidelines/ are removed.
import { readFile } from 'node:fs/promises';
import { INSTALL_PLATFORMS, loadManifest, saveManifest } from '../install/manifest.mjs';
import { assertSafeTarget, sha256Normalized } from '../install/fsutil.mjs';
import { safeRemove, pruneEmptyDirs } from '../install/transaction.mjs';
import { resolveConfig } from './install.mjs';

/**
 * `uninstall [--platform <csv>]` — SPEC-INSTALL-001.
 * @param {string[]} platforms  platforms to remove (defaults to all four via the CLI parser)
 * @param {object} [options]  { home, env }
 * @returns {Promise<number>} exit code (0 success/nothing-installed; 1 unexpected).
 */
export async function uninstall(platforms, options = {}) {
  const cfg = resolveConfig(options);

  let manifest;
  try {
    manifest = await loadManifest(cfg.manifestPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('uninstall: nothing installed (no install manifest found).');
      return 0;
    }
    console.error(`uninstall: cannot read install manifest: ${err.message}`);
    return 1;
  }

  const files = Array.isArray(manifest.files) ? manifest.files : [];
  const targetPlatforms = new Set(platforms.filter((p) => INSTALL_PLATFORMS.includes(p)));
  const installedPlatforms = new Set(
    (Array.isArray(manifest.platforms) ? manifest.platforms : []).filter((p) =>
      INSTALL_PLATFORMS.includes(p)
    )
  );
  // Shared (platform-less) files are removed only when the last platform is being uninstalled,
  // so a per-platform uninstall never strands another platform's referenced assets.
  const remainingPlatforms = [...installedPlatforms].filter((p) => !targetPlatforms.has(p));
  const removingSharedAssets = remainingPlatforms.length === 0;

  const removed = [];
  const skipped = []; // { path, reason } — user-modified, kept
  const kept = []; // manifest entries retained (other platforms, or user-modified)

  for (const entry of files) {
    const belongsToTargetPlatform =
      typeof entry.platform === 'string' && targetPlatforms.has(entry.platform);
    const isShared = typeof entry.platform !== 'string';
    const shouldConsider = belongsToTargetPlatform || (isShared && removingSharedAssets);

    if (!shouldConsider) {
      kept.push(entry);
      continue;
    }

    // Safety + user-modification guard before removing.
    try {
      assertSafeTarget(entry.path, cfg.allowedRoots);
    } catch (err) {
      skipped.push({ path: entry.path, reason: 'unsafe-path' });
      kept.push(entry);
      continue;
    }
    let diskContent;
    try {
      diskContent = await readFile(entry.path);
    } catch (err) {
      if (err.code === 'ENOENT') {
        removed.push(entry.path); // already gone; drop from manifest
        continue;
      }
      console.error(`uninstall: cannot read ${entry.path}: ${err.message}`);
      return 1;
    }
    if (sha256Normalized(diskContent) === entry.sha256) {
      await safeRemove(entry.path, cfg.allowedRoots);
      removed.push(entry.path);
    } else {
      skipped.push({ path: entry.path, reason: 'user-modified' });
      kept.push(entry);
    }
  }

  // If nothing installer-owned remains, drop the manifest and prune the empty shared root +
  // platform dirs. Otherwise persist a manifest reflecting what is still installed.
  if (kept.length === 0) {
    await safeRemove(cfg.manifestPath, cfg.allowedRoots);
    for (const dir of [cfg.sharedRoot, ...Object.values(cfg.platformRoots)]) {
      await pruneEmptyDirs(dir, cfg.allowedRoots);
    }
  } else {
    const survivingPlatforms = new Set();
    for (const entry of kept) {
      if (typeof entry.platform === 'string') survivingPlatforms.add(entry.platform);
    }
    const updated = {
      ...manifest,
      files: kept,
      platforms: [...survivingPlatforms].sort(),
    };
    assertSafeTarget(cfg.manifestPath, cfg.allowedRoots);
    await saveManifest(cfg.manifestPath, updated);
    // Prune any platform dirs that became empty for fully-removed platforms.
    for (const platform of targetPlatforms) {
      await pruneEmptyDirs(cfg.platformRoots[platform], cfg.allowedRoots);
    }
  }

  console.log(`uninstall: removed ${removed.length} file(s).`);
  for (const s of skipped) {
    console.log(`uninstall: kept user-modified file (not removed): ${s.path}`);
  }
  return 0;
}
