// src/install/transaction.mjs — source-agnostic two-phase-commit install engine
// (SPEC-INSTALL-001, DES-INSTALL-001, DECISION-006). This module knows nothing about
// platforms, generated products, or assets: it operates over an explicit desired file set
// (`[{ targetPath, content, skill?, platform? }]`), a list of `allowedRoots`, and the prior
// install-manifest. It NEVER touches the real home dir on its own; callers resolve all paths.
//
// Safety composition (mandated by TASK-003/004 reviews): fsutil.assertSafeTarget and
// manifest.saveManifest have NO built-in confinement or parent-dir creation, so THIS module
// must, before every write, (a) call assertSafeTarget and (b) mkdir the parent recursively.
//
// Two phases:
//  1. Preflight (zero disk change): for every target, assertSafeTarget + conflict check. Any
//     symlink/escape or user-modified/foreign-unmarked file aborts with exit 4 and no changes.
//  2. Commit: stage every new file to a same-directory (same-volume) temp file, then atomic-
//     rename each into place, THEN remove own files no longer in the desired set, THEN write the
//     new install-manifest. A pre-commit (staging) failure deletes staging and leaves the
//     original install untouched. A mid-commit interruption converges idempotently on the next
//     run (reentrant recovery) — see the conflict rule below.
import { lstatSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile, rmdir, readdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { assertSafeTarget, sha256Normalized } from './fsutil.mjs';
import { saveManifest } from './manifest.mjs';

/** Exit codes shared with SPEC-CLI-001: 0 success, 4 conflict/fs-safety abort. */
export const EXIT_OK = 0;
export const EXIT_CONFLICT = 4;

/**
 * Build a `path -> sha256` lookup from a prior install-manifest's `files[]`. A path is
 * "installer-owned" iff it appears here (SPEC-MANIFEST-001: ownership = manifest tracking).
 */
function priorHashMap(priorManifest) {
  const map = new Map();
  const files = priorManifest && Array.isArray(priorManifest.files) ? priorManifest.files : [];
  for (const entry of files) {
    if (entry && typeof entry.path === 'string' && typeof entry.sha256 === 'string') {
      map.set(entry.path, entry.sha256);
    }
  }
  return map;
}

/**
 * Classify one desired target against disk + prior manifest. Returns null when there is no
 * conflict, or a `{ path, reason }` conflict record otherwise.
 *
 * The refined rule (a deliberate strengthening of SPEC-INSTALL-001's literal "diskHash !=
 * manifestHash OR unmarked" so the SPEC's own reentrancy guarantee holds): a target is NOT a
 * conflict when
 *   - it does not exist on disk (fresh), OR
 *   - its disk content already equals the desired content (already converged — idempotent
 *     reinstall and mid-commit recovery both land here), OR
 *   - it is installer-owned AND its disk content still matches the manifest record (our own
 *     unchanged file, safe to replace).
 * Everything else is a conflict: an installer-owned file the user edited, or a foreign unmarked
 * file whose content differs from what we would write.
 */
function classifyTarget(targetPath, desiredHash, priorMap) {
  let stat;
  try {
    // assertSafeTarget already proved no symlink is in the chain; lstat is enough to test presence.
    stat = lstatSync(targetPath);
  } catch (err) {
    if (err.code === 'ENOENT') return null; // fresh — nothing to protect
    throw err;
  }
  if (!stat.isFile()) return null; // a directory (or other) at the path: not a file we would clobber
  const diskHash = sha256Normalized(readFileSync(targetPath));
  if (diskHash === desiredHash) return null; // already converged (idempotent reinstall / recovery)
  if (priorMap.has(targetPath) && priorMap.get(targetPath) === diskHash) return null; // own, unchanged
  return {
    path: targetPath,
    reason: priorMap.has(targetPath) ? 'user-modified' : 'foreign-unmarked',
  };
}

/**
 * Run the two-phase-commit install transaction.
 *
 * @param {object} args
 * @param {Array<{targetPath:string, content:(string|Buffer), skill?:string, platform?:string}>} args.desired
 * @param {string[]} args.allowedRoots  every write path must resolve within one of these
 * @param {object|null} args.priorManifest  parsed install-manifest, or null on first install
 * @param {string} args.manifestPath  where to write the new install-manifest.json
 * @param {{version:string, skills:string[], platforms:string[]}} args.manifestMeta
 * @returns {Promise<{exitCode:number, conflicts:Array, written:string[], removed:string[], skippedRemovals:Array, manifest?:object}>}
 */
export async function runInstallTransaction({
  desired,
  allowedRoots,
  priorManifest = null,
  manifestPath,
  manifestMeta,
}) {
  const priorMap = priorHashMap(priorManifest);
  const conflicts = [];

  // --- Phase 1: preflight — zero disk change ------------------------------------------------
  // Safety first: any symlink at a target/ancestor, or a path escaping the allowed roots, is a
  // hard abort. We check the manifest path too since we will write it during commit.
  for (const { targetPath } of desired) {
    try {
      assertSafeTarget(targetPath, allowedRoots);
    } catch (err) {
      conflicts.push({ path: targetPath, reason: 'unsafe-path', detail: err.message });
    }
  }
  try {
    assertSafeTarget(manifestPath, allowedRoots);
  } catch (err) {
    conflicts.push({ path: manifestPath, reason: 'unsafe-path', detail: err.message });
  }

  // Only run content conflict checks if the paths are all safe; a symlink means we must not read
  // through it either.
  if (conflicts.length === 0) {
    for (const { targetPath, content } of desired) {
      const desiredHash = sha256Normalized(content);
      const conflict = classifyTarget(targetPath, desiredHash, priorMap);
      if (conflict) conflicts.push(conflict);
    }
  }

  if (conflicts.length > 0) {
    return { exitCode: EXIT_CONFLICT, conflicts, written: [], removed: [], skippedRemovals: [] };
  }

  // --- Phase 2a: stage — write every new file to a same-directory temp; original untouched ---
  const staged = []; // { tmpPath, targetPath }
  try {
    for (const { targetPath, content } of desired) {
      assertSafeTarget(targetPath, allowedRoots); // re-check (cheap) right before writing
      const parent = dirname(targetPath);
      await mkdir(parent, { recursive: true });
      const tmpPath = join(parent, `.cg-stage-${randomBytes(8).toString('hex')}.tmp`);
      await writeFile(tmpPath, content);
      staged.push({ tmpPath, targetPath });
    }
  } catch (err) {
    // Pre-commit failure: discard all staging, leave the original install untouched, propagate.
    await Promise.all(staged.map((s) => rm(s.tmpPath, { force: true })));
    throw err;
  }

  // --- Phase 2b: commit — atomic-rename staged files into place -----------------------------
  const written = [];
  try {
    for (const s of staged) {
      await rename(s.tmpPath, s.targetPath);
      written.push(s.targetPath);
    }
  } catch (err) {
    // A rename mid-commit is a partial state that the next `install` run converges (reentrant
    // recovery); clean up only the not-yet-renamed temps, then propagate.
    const remaining = staged.filter((s) => !written.includes(s.targetPath));
    await Promise.all(remaining.map((s) => rm(s.tmpPath, { force: true })));
    throw err;
  }

  // --- Phase 2c: remove own files no longer in the desired set (after new set is in place) ---
  const desiredPaths = new Set(desired.map((d) => d.targetPath));
  const removed = [];
  const skippedRemovals = [];
  for (const entry of priorManifest && Array.isArray(priorManifest.files) ? priorManifest.files : []) {
    if (desiredPaths.has(entry.path)) continue;
    try {
      assertSafeTarget(entry.path, allowedRoots);
    } catch (err) {
      skippedRemovals.push({ path: entry.path, reason: 'unsafe-path', detail: err.message });
      continue;
    }
    let diskContent;
    try {
      diskContent = await readFile(entry.path);
    } catch (err) {
      if (err.code === 'ENOENT') continue; // already gone — nothing to do
      throw err;
    }
    if (sha256Normalized(diskContent) === entry.sha256) {
      await rm(entry.path, { force: true });
      removed.push(entry.path);
    } else {
      skippedRemovals.push({ path: entry.path, reason: 'user-modified' });
    }
  }

  // --- Phase 2d: write the new install-manifest --------------------------------------------
  const manifest = {
    version: manifestMeta.version,
    installedAt: new Date().toISOString(),
    files: desired.map((d) => {
      const entry = { path: d.targetPath, sha256: sha256Normalized(d.content) };
      if (typeof d.skill === 'string') entry.skill = d.skill;
      if (typeof d.platform === 'string') entry.platform = d.platform;
      return entry;
    }),
    skills: manifestMeta.skills,
    platforms: manifestMeta.platforms,
  };
  assertSafeTarget(manifestPath, allowedRoots);
  await mkdir(dirname(manifestPath), { recursive: true });
  await saveManifest(manifestPath, manifest);

  return { exitCode: EXIT_OK, conflicts: [], written, removed, skippedRemovals, manifest };
}

/**
 * Remove a file that the caller owns: assertSafeTarget, then `rm --force`. Returns true if it
 * was present and removed, false if it was already absent. Used by uninstall (SPEC-INSTALL-001).
 */
export async function safeRemove(targetPath, allowedRoots) {
  assertSafeTarget(targetPath, allowedRoots);
  try {
    await rm(targetPath, { force: false });
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

/**
 * Recursively remove empty directories bottom-up starting at `root` (inclusive). A directory
 * that still holds files is left intact. Each directory is assertSafeTarget-checked before
 * removal. Never follows symlinks (rmdir operates on the final component only).
 */
export async function pruneEmptyDirs(root, allowedRoots) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return; // already gone
    throw err;
  }
  for (const dirent of entries) {
    if (dirent.isDirectory()) {
      await pruneEmptyDirs(join(root, dirent.name), allowedRoots);
    }
  }
  // Re-read after pruning children; only remove if now empty.
  let after;
  try {
    after = await readdir(root);
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  if (after.length === 0) {
    assertSafeTarget(root, allowedRoots);
    await rmdir(root).catch((err) => {
      if (err.code !== 'ENOENT') throw err;
    });
  }
}
