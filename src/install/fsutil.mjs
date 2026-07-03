// src/install/fsutil.mjs — shared filesystem-safety invariants and content hashing
// (SPEC-INSTALL-001, DES-FSSAFE-001, DECISION-004). This module is the single source of
// the fs-safety invariant shared by the install engine, sync.mjs's target-repo writes, and
// entry-file managed-block edits: never follow a symlink, never write outside an allowed
// root, and always write via temp-file + atomic rename.
import { createHash, randomBytes } from 'node:crypto';
import { lstatSync } from 'node:fs';
import { rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

/**
 * Hash content after normalizing line endings (CRLF -> LF) so that cross-platform line-ending
 * differences alone are never mistaken for a user edit (DECISION-004). `buf` may be a Buffer
 * or a string; it is coerced via String() before normalization.
 */
export function sha256Normalized(buf) {
  return createHash('sha256').update(String(buf).replace(/\r\n/g, '\n')).digest('hex');
}

/**
 * Assert that `targetPath` is safe to read or write:
 *  - After lexical normalization (path.resolve — no symlink-following), the path MUST fall
 *    within one of `allowedRoots`; otherwise this is a path-confinement violation.
 *  - Neither the target itself, nor any ancestor directory between the matched allowed root
 *    and the target (inclusive of the matched root itself, so a root that has been replaced
 *    by a symlink is also caught), may be a symlink. Checked with `lstat`, which reports the
 *    final path component's own type without following it.
 * The walk proceeds shallow-to-deep (root first) so that once a level is confirmed to be a
 * real (non-symlink) directory, the next lstat's implicit OS resolution of everything-but-the-
 * final-component is resolving only real, already-verified directories — it cannot be fooled
 * by an unverified symlink further up the chain.
 * Throws on any violation. Ancestors that do not exist yet are treated as safe to create
 * (there is nothing to check, and nothing deeper can exist without them).
 */
export function assertSafeTarget(targetPath, allowedRoots) {
  const resolvedTarget = resolve(targetPath);
  const resolvedRoots = allowedRoots.map((root) => resolve(root));
  const matchedRoot = resolvedRoots.find(
    (root) => resolvedTarget === root || resolvedTarget.startsWith(root + sep)
  );
  if (!matchedRoot) {
    throw new Error(`fsutil: path escapes allowed roots: ${targetPath}`);
  }

  const rel = relative(matchedRoot, resolvedTarget);
  const segments = rel === '' ? [] : rel.split(sep);

  let current = matchedRoot;
  const chain = [current];
  for (const segment of segments) {
    current = join(current, segment);
    chain.push(current);
  }

  for (const candidate of chain) {
    let stats;
    try {
      stats = lstatSync(candidate);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Nothing here yet, and nothing deeper can exist without it — safe to create.
        break;
      }
      throw err;
    }
    if (stats.isSymbolicLink()) {
      throw new Error(`fsutil: refusing to operate through a symlink: ${candidate}`);
    }
  }
}

/**
 * Write `content` atomically: write to a temp file in the SAME directory as `path` (so the
 * final rename stays on one volume and is therefore atomic), then rename into place. If the
 * write or rename fails, the temp file is removed so no residue is left behind.
 */
export async function atomicWrite(path, content) {
  const dir = dirname(path);
  const tmpPath = join(dir, `.${randomBytes(8).toString('hex')}.tmp`);
  try {
    await writeFile(tmpPath, content);
    await rename(tmpPath, path);
  } catch (err) {
    await rm(tmpPath, { force: true });
    throw err;
  }
}
