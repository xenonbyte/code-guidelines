// src/build/build.mjs — single-source deterministic build engine (SPEC-BUILD-001, DES-BUILD-001).
// Composes per-section fragments (purpose/triggers/behavior/output) + shared body + templates +
// the skill registry (registry.mjs) into each platform's artifact under generated/. Determinism
// is the entire point (RISK-DET-001): explicit registry order, recursively sorted object keys,
// fixed `\n` line endings, and NO timestamps, randomness, or locale-dependent behavior anywhere
// in this file.
//
// fragments/ (PLAN-TASK-007) and src/build/platforms.mjs + generated/ (PLAN-TASK-008) do not
// exist yet at this task. `stableStringify` and `normalizeEol` below are pure primitives with no
// dependency on any of that and are independently unit-tested now (test/build.test.mjs). `build()`
// touches fragments/platforms.mjs/generated only lazily, INSIDE its own function body (fs reads +
// `await import('./platforms.mjs')`) — never at module-load time — so importing this module never
// throws for their absence.
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWrite } from '../install/fsutil.mjs';
import { REGISTRY } from './registry.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const FRAGMENTS_DIR = join(REPO_ROOT, 'fragments');
const GENERATED_DIR = join(REPO_ROOT, 'generated');

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Recursively sort object keys so serialization is identical regardless of the input's own key
 * insertion order. Array element order is preserved (order is meaningful there — e.g. registry
 * / fragment ordering).
 */
function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeysDeep(value[key]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * Serialize `value` deterministically: recursively key-sorted, 2-space indent. Two objects that
 * are deep-equal but built with keys inserted in a different order stringify identically.
 */
export function stableStringify(value) {
  return JSON.stringify(sortKeysDeep(value), null, 2);
}

/**
 * Normalize every line ending in `s` to a single `\n`: CRLF -> LF, then any remaining lone CR ->
 * LF. Idempotent — normalizeEol(normalizeEol(s)) === normalizeEol(s) — since no CR survives the
 * first pass. Pure string transform: no timestamps, randomness, or locale dependence (RISK-DET-001).
 */
export function normalizeEol(s) {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// Read every file directly under fragments/<skillId>/ (and fragments/shared/, once that exists)
// as { relativeName: content }, sorted by name for deterministic iteration. Returns {} when the
// directory does not exist yet (fragments/ lands in PLAN-TASK-007) — this must NOT throw at
// module load, only when build() is actually invoked.
async function readFragmentDir(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
  const names = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .sort();
  const out = {};
  for (const name of names) {
    out[name] = await readFile(join(dir, name), 'utf8');
  }
  return out;
}

/**
 * Gather the fragment set a skill's platform emitters need: its own per-section fragments
 * (fragments/<skillId>/*) plus the shared cross-skill fragments (fragments/shared/*), both
 * sorted by file name for deterministic composition.
 */
async function readFragments(skillId) {
  const [own, shared] = await Promise.all([
    readFragmentDir(join(FRAGMENTS_DIR, skillId)),
    readFragmentDir(join(FRAGMENTS_DIR, 'shared')),
  ]);
  return { own, shared };
}

/**
 * Build every skill/platform combination from REGISTRY (explicit order — see registry.mjs).
 * - `check: false` (default): writes each rendered artifact to generated/<platform>/<generatedFile>
 *   via atomic write, creating parent directories as needed.
 * - `check: true`: renders each artifact and compares it byte-for-byte against what is already on
 *   disk under generated/ WITHOUT writing anything; throws listing every mismatching/missing path
 *   if any artifact is out of sync. This is the self-conformance gate (SPEC-BUILD-001); the full
 *   gate is exercised once fragments/platforms.mjs/generated all exist (PLAN-TASK-008) — calling
 *   `build()` before then will fail via the dynamic import below, by design.
 * Platform emitters are loaded lazily via `await import('./platforms.mjs')` (created in
 * PLAN-TASK-008) so this module never hard-depends on that file existing at load time.
 * @param {{ check?: boolean }} [options]
 * @returns {Promise<Array<{ path: string, matches?: boolean, written?: boolean }>>}
 */
export async function build({ check = false } = {}) {
  const { emitPlatform } = await import('./platforms.mjs');
  const results = [];

  for (const skill of REGISTRY) {
    const fragments = await readFragments(skill.id);
    for (const [platform, params] of Object.entries(skill.platforms)) {
      const rendered = normalizeEol(emitPlatform({ skill, platform, params, fragments }));
      const outPath = join(GENERATED_DIR, platform, params.generatedFile);

      if (check) {
        let onDisk = null;
        try {
          onDisk = await readFile(outPath, 'utf8');
        } catch (err) {
          if (err.code !== 'ENOENT') throw err;
        }
        results.push({ path: outPath, matches: onDisk === rendered });
      } else {
        await mkdir(dirname(outPath), { recursive: true });
        await atomicWrite(outPath, rendered);
        results.push({ path: outPath, written: true });
      }
    }
  }

  if (check) {
    const mismatches = results.filter((r) => !r.matches);
    if (mismatches.length > 0) {
      throw new Error(
        `build --check: generated/ is out of sync with a fresh build:\n${mismatches
          .map((m) => `  ${m.path}`)
          .join('\n')}`
      );
    }
  }

  return results;
}
