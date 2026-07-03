import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  validateInstallManifest,
  validateTargetManifest,
  loadManifest,
  saveManifest,
} from '../src/install/manifest.mjs';

function makeTmpRoot() {
  return mkdtempSync(join(tmpdir(), 'code-guidelines-manifest-'));
}

function validInstallManifest() {
  return {
    version: '1.0.0',
    installedAt: '2026-07-03T00:00:00.000Z',
    files: [
      {
        path: '/home/user/.claude/skills/code-guidelines/SKILL.md',
        sha256: 'a'.repeat(64),
        skill: 'code-guidelines',
        platform: 'claude',
      },
      { path: '/home/user/.code-guidelines/VERSION', sha256: 'b'.repeat(64) },
    ],
    skills: ['code-guidelines'],
    platforms: ['claude', 'codex'],
  };
}

function validTargetManifest() {
  return {
    version: '1.0.0',
    rules: [{ file: 'react.md', sourceVersion: 'abc123', sha256: 'c'.repeat(64) }],
    lint: [
      { tool: 'eslint', armedAt: '2026-07-03T00:00:00.000Z', sha256: 'd'.repeat(64) },
      { tool: 'prettier', armedAt: '2026-07-03T00:00:00.000Z', sha256: null, optedOut: true },
    ],
    conventions: { sha256: 'e'.repeat(64), distilledAt: '2026-07-03T00:00:00.000Z' },
  };
}

// --- validateInstallManifest ------------------------------------------------------------

test('validateInstallManifest: a well-formed manifest passes', () => {
  assert.equal(validateInstallManifest(validInstallManifest()), true);
});

test('validateInstallManifest: missing a required top-level key fails', () => {
  for (const key of ['version', 'installedAt', 'files', 'skills', 'platforms']) {
    const o = validInstallManifest();
    delete o[key];
    assert.equal(validateInstallManifest(o), false, `expected missing "${key}" to fail`);
  }
});

test('validateInstallManifest: wrong type on a top-level field fails', () => {
  assert.equal(validateInstallManifest({ ...validInstallManifest(), version: 123 }), false);
  assert.equal(validateInstallManifest({ ...validInstallManifest(), installedAt: null }), false);
  assert.equal(validateInstallManifest({ ...validInstallManifest(), files: {} }), false);
  assert.equal(
    validateInstallManifest({ ...validInstallManifest(), skills: 'code-guidelines' }),
    false
  );
  assert.equal(validateInstallManifest({ ...validInstallManifest(), platforms: 'claude' }), false);
});

test('validateInstallManifest: an illegal value in platforms[] fails', () => {
  const o = validInstallManifest();
  o.platforms = ['claude', 'not-a-real-platform'];
  assert.equal(validateInstallManifest(o), false);
});

test('validateInstallManifest: an illegal platform value on a file entry fails', () => {
  const o = validInstallManifest();
  o.files[0].platform = 'not-a-real-platform';
  assert.equal(validateInstallManifest(o), false);
});

test('validateInstallManifest: a file entry missing path fails', () => {
  const o = validInstallManifest();
  delete o.files[0].path;
  assert.equal(validateInstallManifest(o), false);
});

test('validateInstallManifest: a file entry missing sha256 fails', () => {
  const o = validInstallManifest();
  delete o.files[0].sha256;
  assert.equal(validateInstallManifest(o), false);
});

test('validateInstallManifest: a file entry may omit skill/platform (only path+sha256 required)', () => {
  const o = validInstallManifest();
  // second entry already has no skill/platform — assert it alone still validates
  assert.equal(validateInstallManifest(o), true);
});

test('validateInstallManifest: non-object input fails', () => {
  assert.equal(validateInstallManifest(null), false);
  assert.equal(validateInstallManifest('not an object'), false);
  assert.equal(validateInstallManifest([]), false);
  assert.equal(validateInstallManifest(undefined), false);
});

// --- validateTargetManifest --------------------------------------------------------------

test('validateTargetManifest: a well-formed manifest passes', () => {
  assert.equal(validateTargetManifest(validTargetManifest()), true);
});

test('validateTargetManifest: conventions: null is valid', () => {
  const o = validTargetManifest();
  o.conventions = null;
  assert.equal(validateTargetManifest(o), true);
});

test('validateTargetManifest: missing a required top-level key fails', () => {
  for (const key of ['version', 'rules', 'lint', 'conventions']) {
    const o = validTargetManifest();
    delete o[key];
    assert.equal(validateTargetManifest(o), false, `expected missing "${key}" to fail`);
  }
});

test('validateTargetManifest: wrong type on a top-level field fails', () => {
  assert.equal(validateTargetManifest({ ...validTargetManifest(), version: 1 }), false);
  assert.equal(validateTargetManifest({ ...validTargetManifest(), rules: {} }), false);
  assert.equal(validateTargetManifest({ ...validTargetManifest(), lint: 'eslint' }), false);
  assert.equal(validateTargetManifest({ ...validTargetManifest(), conventions: 'nope' }), false);
});

test('validateTargetManifest: a rules[] entry missing a required field fails', () => {
  for (const key of ['file', 'sourceVersion', 'sha256']) {
    const o = validTargetManifest();
    delete o.rules[0][key];
    assert.equal(validateTargetManifest(o), false, `expected rules[] missing "${key}" to fail`);
  }
});

test('validateTargetManifest: a lint[] entry missing a required field fails', () => {
  for (const key of ['tool', 'armedAt']) {
    const o = validTargetManifest();
    delete o.lint[0][key];
    assert.equal(validateTargetManifest(o), false, `expected lint[] missing "${key}" to fail`);
  }
});

test('validateTargetManifest: a lint[] entry sha256 may be null but not another type', () => {
  const o = validTargetManifest();
  o.lint[0].sha256 = 42;
  assert.equal(validateTargetManifest(o), false);
});

test('validateTargetManifest: a lint[] entry optedOut, when present, must be boolean', () => {
  const o = validTargetManifest();
  o.lint[1].optedOut = 'yes';
  assert.equal(validateTargetManifest(o), false);
});

test('validateTargetManifest: non-object input fails', () => {
  assert.equal(validateTargetManifest(null), false);
  assert.equal(validateTargetManifest(42), false);
  assert.equal(validateTargetManifest([]), false);
});

// --- loadManifest / saveManifest round-trip -----------------------------------------------

test('saveManifest -> loadManifest round-trips an install manifest exactly', async () => {
  const root = makeTmpRoot();
  try {
    const path = join(root, 'install-manifest.json');
    const original = validInstallManifest();
    await saveManifest(path, original);
    const loaded = await loadManifest(path);
    assert.deepEqual(loaded, original);
    assert.equal(validateInstallManifest(loaded), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('saveManifest -> loadManifest round-trips a target manifest exactly', async () => {
  const root = makeTmpRoot();
  try {
    const path = join(root, 'manifest.json');
    const original = validTargetManifest();
    await saveManifest(path, original);
    const loaded = await loadManifest(path);
    assert.deepEqual(loaded, original);
    assert.equal(validateTargetManifest(loaded), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('saveManifest writes deterministically: key order of the input does not affect output bytes', async () => {
  const root = makeTmpRoot();
  try {
    const path = join(root, 'manifest.json');
    const original = validTargetManifest();
    const reordered = {
      lint: original.lint,
      conventions: original.conventions,
      version: original.version,
      rules: original.rules,
    };
    await saveManifest(path, original);
    const first = readFileSync(path, 'utf8');
    await saveManifest(path, reordered);
    const second = readFileSync(path, 'utf8');
    assert.equal(first, second);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('saveManifest leaves no temp residue in the target directory', async () => {
  const root = makeTmpRoot();
  try {
    const path = join(root, 'manifest.json');
    await saveManifest(path, validTargetManifest());
    const { readdirSync } = await import('node:fs');
    assert.deepEqual(readdirSync(root), ['manifest.json']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
