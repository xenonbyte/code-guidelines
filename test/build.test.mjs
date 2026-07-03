// test/build.test.mjs — unit tests for the deterministic build primitives (SPEC-BUILD-001,
// RISK-DET-001). Self-contained by design: fragments/ (PLAN-TASK-007) and
// src/build/platforms.mjs + generated/ (PLAN-TASK-008) do not exist yet, so this file tests ONLY
// stableStringify and normalizeEol, and never calls build() or its `--check` gate — that full
// self-conformance test lands in PLAN-TASK-008 once generated/ and the emitters exist.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stableStringify, normalizeEol } from '../src/build/build.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BUILD_MJS_PATH = join(HERE, '..', 'src', 'build', 'build.mjs');
const PLATFORMS_MJS_PATH = join(HERE, '..', 'src', 'build', 'platforms.mjs');
const REGISTRY_MJS_PATH = join(HERE, '..', 'src', 'build', 'registry.mjs');

// --- stableStringify: sorted keys, deterministic regardless of insertion order -------------

test('stableStringify: identical output for objects with the same keys inserted in a different order', () => {
  const a = { z: 1, a: 2, m: 3 };
  const b = { a: 2, m: 3, z: 1 };
  assert.equal(stableStringify(a), stableStringify(b));
});

test('stableStringify: keys appear in sorted order in the output', () => {
  const out = stableStringify({ z: 1, a: 2, m: 3 });
  assert.equal(out, JSON.stringify({ a: 2, m: 3, z: 1 }, null, 2));
});

test('stableStringify: nested objects are recursively key-sorted regardless of insertion order', () => {
  const a = { outer: { z: 1, a: { d: 4, c: 3 } } };
  const b = { outer: { a: { c: 3, d: 4 }, z: 1 } };
  assert.equal(stableStringify(a), stableStringify(b));
});

test('stableStringify: array element order is preserved, not sorted', () => {
  const out = stableStringify({ list: [3, 1, 2] });
  assert.equal(out, JSON.stringify({ list: [3, 1, 2] }, null, 2));
});

test('stableStringify: array of objects sorts each object key set but keeps array order', () => {
  const a = { list: [{ b: 2, a: 1 }, { d: 4, c: 3 }] };
  const expected = JSON.stringify({ list: [{ a: 1, b: 2 }, { c: 3, d: 4 }] }, null, 2);
  assert.equal(stableStringify(a), expected);
});

test('stableStringify: repeated calls on deep-equal-but-differently-ordered input are stable', () => {
  const variants = [
    { a: 1, b: { y: 2, x: 1 } },
    { b: { x: 1, y: 2 }, a: 1 },
  ];
  const outputs = new Set(variants.map((v) => stableStringify(v)));
  assert.equal(outputs.size, 1);
});

// --- normalizeEol: force \n, idempotent -----------------------------------------------------

test('normalizeEol: converts CRLF to LF', () => {
  assert.equal(normalizeEol('line one\r\nline two\r\n'), 'line one\nline two\n');
});

test('normalizeEol: converts lone CR to LF', () => {
  assert.equal(normalizeEol('line one\rline two\r'), 'line one\nline two\n');
});

test('normalizeEol: leaves LF-only content unchanged', () => {
  const s = 'already\nnormalized\n';
  assert.equal(normalizeEol(s), s);
});

test('normalizeEol: is idempotent on CRLF input', () => {
  const s = 'a\r\nb\r\nc\r\n';
  const once = normalizeEol(s);
  const twice = normalizeEol(once);
  assert.equal(once, twice);
});

test('normalizeEol: is idempotent on mixed CRLF/LF/CR input', () => {
  const s = 'a\r\nb\nc\rd';
  const once = normalizeEol(s);
  const twice = normalizeEol(once);
  assert.equal(once, twice);
});

test('normalizeEol: handles empty string', () => {
  assert.equal(normalizeEol(''), '');
});

// --- no timestamps / randomness (RISK-DET-001) ---------------------------------------------

test('build.mjs source contains no timestamp or randomness calls', () => {
  const source = readFileSync(BUILD_MJS_PATH, 'utf8');
  assert.doesNotMatch(source, /Date\.now\s*\(/);
  assert.doesNotMatch(source, /new Date\s*\(/);
  assert.doesNotMatch(source, /Math\.random\s*\(/);
  assert.doesNotMatch(source, /crypto\.random/i);
});

// The build pipeline is split across build.mjs, platforms.mjs (per-platform emitters), and
// registry.mjs (the explicit skill registry) — the determinism guard above only covered
// build.mjs, leaving a coverage gap on the other two build-time modules. Extend it here so all
// three are pinned against timestamp/randomness non-determinism (RISK-DET-001).
for (const [label, path] of [
  ['platforms.mjs', PLATFORMS_MJS_PATH],
  ['registry.mjs', REGISTRY_MJS_PATH],
]) {
  test(`${label} source contains no timestamp or randomness calls`, () => {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /Date\.now\s*\(/);
    assert.doesNotMatch(source, /new Date\s*\(/);
    assert.doesNotMatch(source, /Math\.random\s*\(/);
    assert.doesNotMatch(source, /crypto\.random/i);
  });
}

test('stableStringify and normalizeEol produce identical output across repeated calls (no hidden nondeterminism)', () => {
  const input = { z: 1, a: [3, 1, 2], nested: { y: 'hello\r\nworld\r\n' } };
  const first = stableStringify(input);
  const second = stableStringify(input);
  assert.equal(first, second);

  const s = 'a\r\nb\rc\n';
  assert.equal(normalizeEol(s), normalizeEol(s));
});
