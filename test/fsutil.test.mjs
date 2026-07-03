import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256Normalized, assertSafeTarget, atomicWrite } from '../src/install/fsutil.mjs';

function makeTmpRoot() {
  return mkdtempSync(join(tmpdir(), 'code-guidelines-fsutil-'));
}

// --- sha256Normalized (DECISION-004) ---------------------------------------------------

test('sha256Normalized: CRLF and LF content hash equal', () => {
  const crlf = 'line one\r\nline two\r\n';
  const lf = 'line one\nline two\n';
  assert.equal(sha256Normalized(crlf), sha256Normalized(lf));
});

test('sha256Normalized: mixed CRLF/LF content hashes the same as fully-normalized LF', () => {
  const mixed = 'a\r\nb\nc\r\n';
  const lf = 'a\nb\nc\n';
  assert.equal(sha256Normalized(mixed), sha256Normalized(lf));
});

test('sha256Normalized: differing content produces differing hashes', () => {
  assert.notEqual(sha256Normalized('a\n'), sha256Normalized('b\n'));
});

test('sha256Normalized: accepts a Buffer input equivalently to the same string', () => {
  const s = 'hello\r\nworld\r\n';
  assert.equal(sha256Normalized(Buffer.from(s, 'utf8')), sha256Normalized(s));
});

// --- assertSafeTarget (SPEC-INSTALL-001 fs-safety invariant) ----------------------------

test('assertSafeTarget: a path inside an allowed root with no symlinks passes', () => {
  const root = makeTmpRoot();
  try {
    const target = join(root, 'nested', 'file.md');
    mkdirSync(join(root, 'nested'), { recursive: true });
    writeFileSync(target, 'hello');
    assert.doesNotThrow(() => assertSafeTarget(target, [root]));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assertSafeTarget: a non-existent target and ancestors are treated as safe to create', () => {
  const root = makeTmpRoot();
  try {
    const target = join(root, 'new-dir', 'new-file.md');
    assert.doesNotThrow(() => assertSafeTarget(target, [root]));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assertSafeTarget: rejects when the target itself is a symlink', () => {
  const root = makeTmpRoot();
  try {
    const real = join(root, 'real.md');
    writeFileSync(real, 'hello');
    const link = join(root, 'link.md');
    symlinkSync(real, link);
    assert.throws(() => assertSafeTarget(link, [root]));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assertSafeTarget: rejects when an ancestor/parent directory is a symlink', () => {
  const root = makeTmpRoot();
  try {
    const realDir = join(root, 'real-dir');
    mkdirSync(realDir);
    const linkedDir = join(root, 'linked-dir');
    symlinkSync(realDir, linkedDir, 'dir');
    const target = join(linkedDir, 'file.md');
    assert.throws(() => assertSafeTarget(target, [root]));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assertSafeTarget: rejects when the allowed root itself has been replaced by a symlink', () => {
  const parent = makeTmpRoot();
  try {
    const realElsewhere = join(parent, 'elsewhere');
    mkdirSync(realElsewhere);
    const root = join(parent, 'root-as-symlink');
    symlinkSync(realElsewhere, root, 'dir');
    const target = join(root, 'file.md');
    assert.throws(() => assertSafeTarget(target, [root]));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('assertSafeTarget: rejects a path that escapes allowedRoots', () => {
  const root = makeTmpRoot();
  const outside = makeTmpRoot();
  try {
    const target = join(outside, 'file.md');
    assert.throws(() => assertSafeTarget(target, [root]));
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('assertSafeTarget: a sibling path that merely shares a string prefix with the root is rejected', () => {
  const root = makeTmpRoot();
  const evilSibling = `${root}-evil`;
  mkdirSync(evilSibling);
  try {
    const target = join(evilSibling, 'file.md');
    assert.throws(() => assertSafeTarget(target, [root]));
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(evilSibling, { recursive: true, force: true });
  }
});

test('assertSafeTarget: accepts when the target matches any one of multiple allowedRoots', () => {
  const rootA = makeTmpRoot();
  const rootB = makeTmpRoot();
  try {
    const target = join(rootB, 'file.md');
    assert.doesNotThrow(() => assertSafeTarget(target, [rootA, rootB]));
  } finally {
    rmSync(rootA, { recursive: true, force: true });
    rmSync(rootB, { recursive: true, force: true });
  }
});

// --- atomicWrite --------------------------------------------------------------------------

test('atomicWrite: writes the correct content and leaves no temp residue', async () => {
  const root = makeTmpRoot();
  try {
    const target = join(root, 'out.md');
    await atomicWrite(target, 'hello atomic world\n');
    assert.equal(readFileSync(target, 'utf8'), 'hello atomic world\n');
    assert.deepEqual(readdirSync(root), ['out.md']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('atomicWrite: overwrites existing content atomically and still leaves no residue', async () => {
  const root = makeTmpRoot();
  try {
    const target = join(root, 'out.md');
    await atomicWrite(target, 'first\n');
    await atomicWrite(target, 'second\n');
    assert.equal(readFileSync(target, 'utf8'), 'second\n');
    assert.deepEqual(readdirSync(root), ['out.md']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('atomicWrite: failure when the parent directory is missing leaves no temp residue', async () => {
  const root = makeTmpRoot();
  try {
    const target = join(root, 'missing-dir', 'out.md');
    await assert.rejects(() => atomicWrite(target, 'content\n'));
    assert.deepEqual(readdirSync(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
