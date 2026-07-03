import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  symlinkSync,
  readdirSync,
  statSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import { install, resolveConfig, PLATFORM_PRODUCT_FILE } from '../src/commands/install.mjs';
import { uninstall } from '../src/commands/uninstall.mjs';
import { status } from '../src/commands/status.mjs';
import { runInstallTransaction } from '../src/install/transaction.mjs';
import { loadManifest, validateInstallManifest } from '../src/install/manifest.mjs';

// ---- helpers ---------------------------------------------------------------------------------

function makeTmpHome() {
  return mkdtempSync(join(tmpdir(), 'code-guidelines-install-'));
}

// A fixture desired set targeted under the resolved roots for `home`. Shared assets are held
// identical across tags; platform product content varies by tag so reinstalls are observable.
function makeSources(cfg, platforms, tag = 'v1') {
  const sources = [
    { targetPath: join(cfg.sharedRoot, 'stacks.json'), content: '{"version":"1"}\n' },
    { targetPath: join(cfg.sharedRoot, 'library', 'core.md'), content: 'core rule\n' },
    { targetPath: join(cfg.sharedRoot, 'VERSION'), content: '0.1.0\n' },
  ];
  for (const p of platforms) {
    sources.push({
      targetPath: join(cfg.platformRoots[p], PLATFORM_PRODUCT_FILE[p]),
      content: `product ${p} ${tag}\n`,
      skill: 'code-guidelines',
      platform: p,
    });
  }
  return sources;
}

// Recursively collect every regular-file path under `dir`.
function walkFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

function hasStagingResidue(root) {
  return walkFiles(root).some((p) => /\.cg-stage-[0-9a-f]+\.tmp$/.test(p));
}

async function captureConsole(fn) {
  const lines = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a) => lines.push(a.join(' '));
  console.error = (...a) => lines.push(a.join(' '));
  try {
    const rc = await fn();
    return { rc, out: lines.join('\n') };
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
}

function cleanup(...dirs) {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

// ---- fresh install ---------------------------------------------------------------------------

test('install: fresh install writes products + shared assets and a valid manifest', async () => {
  const home = makeTmpHome();
  try {
    const cfg = resolveConfig({ home });
    const platforms = ['claude', 'codex'];
    const { rc } = await captureConsole(() =>
      install(platforms, { home, sources: makeSources(cfg, platforms) })
    );
    assert.equal(rc, 0);

    assert.equal(
      readFileSync(join(cfg.platformRoots.claude, 'SKILL.md'), 'utf8'),
      'product claude v1\n'
    );
    assert.equal(
      readFileSync(join(cfg.platformRoots.codex, 'code-guidelines.md'), 'utf8'),
      'product codex v1\n'
    );
    assert.equal(readFileSync(join(cfg.sharedRoot, 'library', 'core.md'), 'utf8'), 'core rule\n');

    const manifest = await loadManifest(cfg.manifestPath);
    assert.ok(validateInstallManifest(manifest), 'manifest must pass shape validation');
    assert.deepEqual(manifest.platforms, ['claude', 'codex']);
    assert.deepEqual(manifest.skills, ['code-guidelines']);
    assert.equal(manifest.files.length, makeSources(cfg, platforms).length);
    assert.ok(!hasStagingResidue(home), 'no staging temp residue');
  } finally {
    cleanup(home);
  }
});

// ---- reinstall stage-then-swap + idempotent rerun -------------------------------------------

test('install: reinstall stages new content then swaps it in', async () => {
  const home = makeTmpHome();
  try {
    const cfg = resolveConfig({ home });
    await captureConsole(() =>
      install(['claude'], { home, sources: makeSources(cfg, ['claude'], 'v1') })
    );
    const { rc } = await captureConsole(() =>
      install(['claude'], { home, sources: makeSources(cfg, ['claude'], 'v2') })
    );
    assert.equal(rc, 0);
    assert.equal(
      readFileSync(join(cfg.platformRoots.claude, 'SKILL.md'), 'utf8'),
      'product claude v2\n'
    );
    assert.ok(!hasStagingResidue(home));
  } finally {
    cleanup(home);
  }
});

test('install: rerunning an identical install is a conflict-free no-op (idempotent)', async () => {
  const home = makeTmpHome();
  try {
    const cfg = resolveConfig({ home });
    await captureConsole(() => install(['claude'], { home, sources: makeSources(cfg, ['claude']) }));
    const { rc } = await captureConsole(() =>
      install(['claude'], { home, sources: makeSources(cfg, ['claude']) })
    );
    assert.equal(rc, 0);
    assert.equal(
      readFileSync(join(cfg.platformRoots.claude, 'SKILL.md'), 'utf8'),
      'product claude v1\n'
    );
  } finally {
    cleanup(home);
  }
});

// ---- pre-commit (staging) failure leaves original untouched --------------------------------

test('transaction: a pre-commit staging failure discards staging and leaves the original install untouched', async () => {
  const home = makeTmpHome();
  try {
    const cfg = resolveConfig({ home });
    // First, a clean install to have an "original" to protect.
    await captureConsole(() => install(['claude'], { home, sources: makeSources(cfg, ['claude']) }));
    const skillPath = join(cfg.platformRoots.claude, 'SKILL.md');
    const originalProduct = readFileSync(skillPath, 'utf8');
    const originalManifest = readFileSync(cfg.manifestPath, 'utf8');
    const priorManifest = JSON.parse(originalManifest);

    // A second (v2) transaction whose desired set includes a bad entry: `content` is a number,
    // which passes the hash preflight (String()) but makes writeFile throw during staging.
    const desired = [
      { targetPath: skillPath, content: 'product claude v2\n', skill: 'code-guidelines', platform: 'claude' },
      { targetPath: join(cfg.sharedRoot, 'bad.md'), content: 12345 },
    ];

    await assert.rejects(() =>
      runInstallTransaction({
        desired,
        allowedRoots: cfg.allowedRoots,
        priorManifest,
        manifestPath: cfg.manifestPath,
        manifestMeta: { version: '0.1.0', skills: ['code-guidelines'], platforms: ['claude'] },
      })
    );

    // Original untouched, staging cleaned, and the bad target never created.
    assert.equal(readFileSync(skillPath, 'utf8'), originalProduct);
    assert.equal(readFileSync(cfg.manifestPath, 'utf8'), originalManifest);
    assert.ok(!existsSync(join(cfg.sharedRoot, 'bad.md')));
    assert.ok(!hasStagingResidue(home), 'staging temps must be cleaned up on failure');
  } finally {
    cleanup(home);
  }
});

// ---- user-modified file rejected with exit 4, disk unchanged -------------------------------

test('install: a user-modified owned file aborts with exit 4 and changes nothing', async () => {
  const home = makeTmpHome();
  try {
    const cfg = resolveConfig({ home });
    await captureConsole(() => install(['claude'], { home, sources: makeSources(cfg, ['claude']) }));
    const skillPath = join(cfg.platformRoots.claude, 'SKILL.md');
    writeFileSync(skillPath, 'USER EDITED THIS\n');
    const manifestBefore = readFileSync(cfg.manifestPath, 'utf8');

    const { rc } = await captureConsole(() =>
      install(['claude'], { home, sources: makeSources(cfg, ['claude'], 'v2') })
    );
    assert.equal(rc, 4);
    assert.equal(readFileSync(skillPath, 'utf8'), 'USER EDITED THIS\n', 'user edit preserved');
    assert.equal(readFileSync(cfg.manifestPath, 'utf8'), manifestBefore, 'manifest unchanged');
  } finally {
    cleanup(home);
  }
});

test('install: a foreign unmarked file at a target aborts with exit 4 and writes nothing', async () => {
  const home = makeTmpHome();
  try {
    const cfg = resolveConfig({ home });
    const skillPath = join(cfg.platformRoots.claude, 'SKILL.md');
    mkdirSync(dirname(skillPath), { recursive: true });
    writeFileSync(skillPath, 'pre-existing foreign content\n');

    const { rc } = await captureConsole(() =>
      install(['claude'], { home, sources: makeSources(cfg, ['claude']) })
    );
    assert.equal(rc, 4);
    assert.equal(readFileSync(skillPath, 'utf8'), 'pre-existing foreign content\n');
    assert.ok(!existsSync(cfg.manifestPath), 'no manifest written on abort');
  } finally {
    cleanup(home);
  }
});

test('transaction: a directory at any desired target is a preflight conflict with zero writes', async () => {
  const home = makeTmpHome();
  try {
    const cfg = resolveConfig({ home });
    const firstPath = join(cfg.sharedRoot, 'library', 'first.md');
    const directoryTarget = join(cfg.platformRoots.codex, PLATFORM_PRODUCT_FILE.codex);
    mkdirSync(directoryTarget, { recursive: true });

    const result = await runInstallTransaction({
      desired: [
        { targetPath: firstPath, content: 'first\n' },
        { targetPath: directoryTarget, content: 'codex product\n', skill: 'code-guidelines', platform: 'codex' },
      ],
      allowedRoots: cfg.allowedRoots,
      priorManifest: null,
      manifestPath: cfg.manifestPath,
      manifestMeta: { version: '0.1.0', skills: ['code-guidelines'], platforms: ['codex'] },
    });

    assert.equal(result.exitCode, 4);
    assert.deepEqual(result.written, [], 'no staged file was renamed into place');
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.conflicts[0].path, directoryTarget);
    assert.equal(result.conflicts[0].reason, 'non-file-target');
    assert.equal(existsSync(firstPath), false, 'earlier desired file was not partially installed');
    assert.ok(statSync(directoryTarget).isDirectory(), 'directory target was left intact');
    assert.equal(existsSync(cfg.manifestPath), false, 'manifest not written on preflight conflict');
  } finally {
    cleanup(home);
  }
});

// ---- symlink target / ancestor rejected with exit 4, zero change ---------------------------

test('install: a symlink AT a target aborts with exit 4 and zero disk change', async () => {
  const home = makeTmpHome();
  const elsewhere = makeTmpHome();
  try {
    const cfg = resolveConfig({ home });
    const decoy = join(elsewhere, 'decoy.md');
    writeFileSync(decoy, 'decoy content\n');
    const skillPath = join(cfg.platformRoots.claude, 'SKILL.md');
    mkdirSync(dirname(skillPath), { recursive: true });
    symlinkSync(decoy, skillPath);

    const { rc } = await captureConsole(() =>
      install(['claude'], { home, sources: makeSources(cfg, ['claude']) })
    );
    assert.equal(rc, 4);
    assert.equal(readFileSync(decoy, 'utf8'), 'decoy content\n', 'symlink was not followed/written');
    assert.ok(!existsSync(cfg.manifestPath));
  } finally {
    cleanup(home, elsewhere);
  }
});

test('install: a symlink ANCESTOR within an allowed root aborts with exit 4 and zero disk change', async () => {
  const home = makeTmpHome();
  const elsewhere = makeTmpHome();
  try {
    const cfg = resolveConfig({ home });
    mkdirSync(cfg.sharedRoot, { recursive: true });
    const realLib = join(elsewhere, 'real-lib');
    mkdirSync(realLib);
    // Replace <sharedRoot>/library with a symlink to a dir outside the root.
    symlinkSync(realLib, join(cfg.sharedRoot, 'library'), 'dir');

    const { rc } = await captureConsole(() =>
      install(['claude'], { home, sources: makeSources(cfg, ['claude']) })
    );
    assert.equal(rc, 4);
    assert.deepEqual(readdirSync(realLib), [], 'nothing written through the symlinked ancestor');
    assert.ok(!existsSync(cfg.manifestPath));
  } finally {
    cleanup(home, elsewhere);
  }
});

// ---- corrupt/invalid existing install-manifest aborts install with exit 2 (SPEC-CLI-001) ---

test('install: exit 2 when the existing install manifest is not valid JSON, and writes nothing', async () => {
  const home = makeTmpHome();
  try {
    const cfg = resolveConfig({ home });
    mkdirSync(cfg.sharedRoot, { recursive: true });
    writeFileSync(cfg.manifestPath, '{ not json');
    const before = readFileSync(cfg.manifestPath, 'utf8');

    const { rc } = await captureConsole(() =>
      install(['claude'], { home, sources: makeSources(cfg, ['claude']) })
    );
    assert.equal(rc, 2);
    assert.ok(!existsSync(join(cfg.platformRoots.claude, 'SKILL.md')), 'no product written');
    assert.ok(!existsSync(join(cfg.sharedRoot, 'library', 'core.md')), 'no shared asset written');
    assert.equal(readFileSync(cfg.manifestPath, 'utf8'), before, 'corrupt manifest left untouched');
  } finally {
    cleanup(home);
  }
});

test('install: exit 2 when the existing install manifest has an invalid shape, and writes nothing', async () => {
  const home = makeTmpHome();
  try {
    const cfg = resolveConfig({ home });
    mkdirSync(cfg.sharedRoot, { recursive: true });
    writeFileSync(cfg.manifestPath, JSON.stringify({ version: '1' })); // missing required keys
    const before = readFileSync(cfg.manifestPath, 'utf8');

    const { rc } = await captureConsole(() =>
      install(['claude'], { home, sources: makeSources(cfg, ['claude']) })
    );
    assert.equal(rc, 2);
    assert.ok(!existsSync(join(cfg.platformRoots.claude, 'SKILL.md')), 'no product written');
    assert.ok(!existsSync(join(cfg.sharedRoot, 'library', 'core.md')), 'no shared asset written');
    assert.equal(readFileSync(cfg.manifestPath, 'utf8'), before, 'invalid-shape manifest left untouched');
  } finally {
    cleanup(home);
  }
});

// ---- uninstall clears manifest + empty root ------------------------------------------------

test('uninstall: removes all owned files, the manifest, and the now-empty shared root', async () => {
  const home = makeTmpHome();
  try {
    const cfg = resolveConfig({ home });
    const platforms = ['claude', 'codex', 'opencode', 'gemini'];
    await captureConsole(() => install(platforms, { home, sources: makeSources(cfg, platforms) }));
    assert.ok(existsSync(cfg.manifestPath));

    const { rc } = await captureConsole(() => uninstall(platforms, { home }));
    assert.equal(rc, 0);
    assert.ok(!existsSync(cfg.manifestPath), 'manifest removed');
    assert.ok(!existsSync(cfg.sharedRoot), 'empty shared root pruned');
    assert.ok(!existsSync(join(cfg.platformRoots.claude, 'SKILL.md')), 'claude product removed');
    assert.ok(!existsSync(join(cfg.platformRoots.gemini, 'code-guidelines.toml')), 'gemini product removed');
  } finally {
    cleanup(home);
  }
});

test('uninstall: on an empty machine reports nothing installed and returns 0', async () => {
  const home = makeTmpHome();
  try {
    const { rc, out } = await captureConsole(() => uninstall(['claude'], { home }));
    assert.equal(rc, 0);
    assert.match(out, /nothing installed/i);
  } finally {
    cleanup(home);
  }
});

// ---- user-modified file skipped on uninstall ----------------------------------------------

test('uninstall: skips (and keeps) a user-modified owned file, retaining it in the manifest', async () => {
  const home = makeTmpHome();
  try {
    const cfg = resolveConfig({ home });
    await captureConsole(() => install(['claude'], { home, sources: makeSources(cfg, ['claude']) }));
    const skillPath = join(cfg.platformRoots.claude, 'SKILL.md');
    writeFileSync(skillPath, 'USER EDITED\n');

    const { rc, out } = await captureConsole(() => uninstall(['claude'], { home }));
    assert.equal(rc, 0);
    assert.ok(existsSync(skillPath), 'user-modified file kept');
    assert.equal(readFileSync(skillPath, 'utf8'), 'USER EDITED\n');
    assert.match(out, /kept user-modified file/i);

    // Manifest is retained (not deleted) and now records only the kept file.
    assert.ok(existsSync(cfg.manifestPath), 'manifest kept because an owned file survives');
    const manifest = await loadManifest(cfg.manifestPath);
    assert.ok(validateInstallManifest(manifest));
    assert.equal(manifest.files.length, 1);
    assert.equal(manifest.files[0].path, skillPath);
    assert.deepEqual(manifest.platforms, ['claude']);
    // Shared assets (unmodified) were removed.
    assert.ok(!existsSync(join(cfg.sharedRoot, 'library', 'core.md')));
  } finally {
    cleanup(home);
  }
});

// ---- status reports platforms / assets ----------------------------------------------------

test('status: reports installed platforms, skills, and shared assets', async () => {
  const home = makeTmpHome();
  try {
    const cfg = resolveConfig({ home });
    const platforms = ['claude', 'gemini'];
    await captureConsole(() => install(platforms, { home, sources: makeSources(cfg, platforms) }));

    const { rc, out } = await captureConsole(() => status({ home }));
    assert.equal(rc, 0);
    assert.match(out, /installed/i);
    assert.match(out, /platforms:\s*claude, gemini/);
    assert.match(out, /skills:\s*code-guidelines/);
    assert.match(out, /shared assets:\s*3 file/);
    assert.match(out, /- claude: 1 product file/);
    assert.match(out, /- gemini: 1 product file/);
  } finally {
    cleanup(home);
  }
});

test('status: reports "not installed" and returns 0 when no manifest exists', async () => {
  const home = makeTmpHome();
  try {
    const { rc, out } = await captureConsole(() => status({ home }));
    assert.equal(rc, 0);
    assert.match(out, /not installed/i);
  } finally {
    cleanup(home);
  }
});

test('status: exit 2 when the manifest is present but shape-invalid', async () => {
  const home = makeTmpHome();
  try {
    const cfg = resolveConfig({ home });
    mkdirSync(cfg.sharedRoot, { recursive: true });
    writeFileSync(cfg.manifestPath, JSON.stringify({ version: '1' })); // missing required keys
    const { rc } = await captureConsole(() => status({ home }));
    assert.equal(rc, 2);
  } finally {
    cleanup(home);
  }
});

test('status: exit 2 when the manifest is not valid JSON', async () => {
  const home = makeTmpHome();
  try {
    const cfg = resolveConfig({ home });
    mkdirSync(cfg.sharedRoot, { recursive: true });
    writeFileSync(cfg.manifestPath, '{ not json');
    const { rc } = await captureConsole(() => status({ home }));
    assert.equal(rc, 2);
  } finally {
    cleanup(home);
  }
});

// ---- reentrant convergence after a simulated mid-commit interruption -----------------------

test('install: converges idempotently after a simulated mid-commit interruption (reentrant recovery)', async () => {
  const home = makeTmpHome();
  try {
    const cfg = resolveConfig({ home });
    // v1: claude + codex installed.
    await captureConsole(() =>
      install(['claude', 'codex'], { home, sources: makeSources(cfg, ['claude', 'codex'], 'v1') })
    );

    // Simulate a crash midway through a v2 install that (a) changes the claude product to v2 and
    // (b) drops codex: the new claude content was renamed in, codex was NOT yet removed, and the
    // manifest was NOT yet rewritten (still records v1 + both platforms).
    const skillPath = join(cfg.platformRoots.claude, 'SKILL.md');
    writeFileSync(skillPath, 'product claude v2\n'); // "already renamed in"
    // codex product left in place; manifest left as v1.

    // Re-run the same v2 install (the retry). Disk claude == desired v2 (converged branch),
    // shared unchanged, codex must be reconciled away.
    const { rc } = await captureConsole(() =>
      install(['claude'], { home, sources: makeSources(cfg, ['claude'], 'v2') })
    );
    assert.equal(rc, 0);

    assert.equal(readFileSync(skillPath, 'utf8'), 'product claude v2\n');
    assert.ok(
      !existsSync(join(cfg.platformRoots.codex, 'code-guidelines.md')),
      'dropped codex product reconciled away'
    );
    const manifest = await loadManifest(cfg.manifestPath);
    assert.ok(validateInstallManifest(manifest));
    assert.deepEqual(manifest.platforms, ['claude']);
    assert.ok(!hasStagingResidue(home));
  } finally {
    cleanup(home);
  }
});

// ---- partial-platform reinstall cleans up dropped platforms --------------------------------

test('install: reinstalling a platform subset removes the no-longer-installed platform files', async () => {
  const home = makeTmpHome();
  try {
    const cfg = resolveConfig({ home });
    await captureConsole(() =>
      install(['claude', 'codex'], { home, sources: makeSources(cfg, ['claude', 'codex']) })
    );
    assert.ok(existsSync(join(cfg.platformRoots.codex, 'code-guidelines.md')));

    const { rc } = await captureConsole(() =>
      install(['claude'], { home, sources: makeSources(cfg, ['claude']) })
    );
    assert.equal(rc, 0);
    assert.ok(existsSync(join(cfg.platformRoots.claude, 'SKILL.md')));
    assert.ok(!existsSync(join(cfg.platformRoots.codex, 'code-guidelines.md')), 'codex removed');
    const manifest = await loadManifest(cfg.manifestPath);
    assert.deepEqual(manifest.platforms, ['claude']);
  } finally {
    cleanup(home);
  }
});
