// src/install/manifest.mjs — two-tier manifest read/write and shape validation (SPEC-MANIFEST-001).
// Install manifest lives at ~/.code-guidelines/install-manifest.json and is the sole source of
// truth for file ownership: a path is "installer-owned" iff it appears in `files[]` here. Target
// manifest lives at <repo>/.code-guidelines/manifest.json and records what sync.mjs has reconciled
// into a target repository (rules, lint scaffolding, distilled conventions). Both manifests store
// SHA-256 hashes computed over line-ending-normalized content (DECISION-004, see fsutil.mjs).
import { readFile } from 'node:fs/promises';
import { atomicWrite } from './fsutil.mjs';

/** Legal values for a platform field, per SPEC-PLATFORM-001. */
export const INSTALL_PLATFORMS = Object.freeze(['claude', 'codex', 'opencode', 'gemini']);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * A file entry `{path, sha256, skill, platform}` is well-formed when `path` and `sha256` are
 * present non-empty strings (the only fields SPEC-MANIFEST-001 requires); `skill` and `platform`
 * are optional but, when present, must be a string and a legal INSTALL_PLATFORMS value respectively.
 */
function isValidFileEntry(entry) {
  if (!isPlainObject(entry)) return false;
  if (!isNonEmptyString(entry.path) || !isNonEmptyString(entry.sha256)) return false;
  if ('skill' in entry && typeof entry.skill !== 'string') return false;
  if ('platform' in entry && !INSTALL_PLATFORMS.includes(entry.platform)) return false;
  return true;
}

/**
 * Validate the shape of an install manifest (~/.code-guidelines/install-manifest.json):
 * `{ version, installedAt, files: [{path, sha256, skill, platform}], skills: [...], platforms: [...] }`.
 * Never throws; returns false for any missing required key, wrong type, illegal `platform` value
 * (top-level `platforms[]` or a file entry's `platform`), or a file entry missing path/sha256.
 */
export function validateInstallManifest(o) {
  if (!isPlainObject(o)) return false;
  if (!isNonEmptyString(o.version)) return false;
  if (!isNonEmptyString(o.installedAt)) return false;
  if (!Array.isArray(o.files) || !o.files.every(isValidFileEntry)) return false;
  if (!Array.isArray(o.skills) || !o.skills.every((s) => typeof s === 'string')) return false;
  if (!Array.isArray(o.platforms) || !o.platforms.every((p) => INSTALL_PLATFORMS.includes(p))) {
    return false;
  }
  return true;
}

function isValidRuleEntry(entry) {
  return (
    isPlainObject(entry) &&
    isNonEmptyString(entry.file) &&
    isNonEmptyString(entry.sourceVersion) &&
    isNonEmptyString(entry.sha256)
  );
}

function isValidLintEntry(entry) {
  if (!isPlainObject(entry)) return false;
  if (!isNonEmptyString(entry.tool)) return false;
  if (!isNonEmptyString(entry.armedAt)) return false;
  if (!(entry.sha256 === null || typeof entry.sha256 === 'string')) return false;
  if ('optedOut' in entry && typeof entry.optedOut !== 'boolean') return false;
  return true;
}

function isValidConventions(v) {
  if (v === null) return true;
  return isPlainObject(v) && isNonEmptyString(v.sha256) && isNonEmptyString(v.distilledAt);
}

/**
 * Validate the shape of a target manifest (<repo>/.code-guidelines/manifest.json):
 * `{ version, rules: [{file, sourceVersion, sha256}], lint: [{tool, armedAt, sha256|null, optedOut?}],
 * conventions: {sha256, distilledAt} | null }`.
 * Never throws; returns false for any missing required key, wrong type, or malformed rules/lint entry.
 */
export function validateTargetManifest(o) {
  if (!isPlainObject(o)) return false;
  if (!isNonEmptyString(o.version)) return false;
  if (!Array.isArray(o.rules) || !o.rules.every(isValidRuleEntry)) return false;
  if (!Array.isArray(o.lint) || !o.lint.every(isValidLintEntry)) return false;
  if (!('conventions' in o) || !isValidConventions(o.conventions)) return false;
  return true;
}

/**
 * Read and JSON.parse the manifest file at `path`. Does not validate shape — callers should run
 * the matching `validate*` function on the result before trusting it.
 */
export async function loadManifest(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

/**
 * Recursively sort object keys so that serialization is deterministic regardless of the input's
 * own key insertion order (arrays keep their element order — order is meaningful there).
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
 * Serialize `o` deterministically (recursively key-sorted, 2-space indent, trailing `\n`) and
 * write it to `path` atomically via fsutil's temp-file + rename (DES-FSSAFE-001).
 */
export function saveManifest(path, o) {
  const content = `${JSON.stringify(sortKeysDeep(o), null, 2)}\n`;
  return atomicWrite(path, content);
}
