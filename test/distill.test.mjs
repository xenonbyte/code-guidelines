import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { distillRecord, sync } from '../assets/sync.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REAL_ASSETS = join(REPO_ROOT, 'assets');

// ---------------------------------------------------------------------------------------------
// Helpers (mirrors test/sync.test.mjs setup: temp dirs only, never touch real files)
// ---------------------------------------------------------------------------------------------

const tmps = [];
function tmpDir(prefix = 'cg-distill-') {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tmps.push(d);
  return d;
}
test.after(() => {
  for (const d of tmps) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function writeF(p, content) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

function targetManifestPath(repo) {
  return join(repo, '.code-guidelines', 'manifest.json');
}
function readManifest(repo) {
  return JSON.parse(readFileSync(targetManifestPath(repo), 'utf8'));
}

// small local hash mirror (CRLF->LF then sha256), matching sync.mjs's sha256Normalized
function hashNormalized(s) {
  return createHash('sha256').update(String(s).replace(/\r\n/g, '\n')).digest('hex');
}

// ---------------------------------------------------------------------------------------------
// SPEC-RULEFMT-001 / SPEC-DISTILL-001 — template + veto assets exist
// ---------------------------------------------------------------------------------------------

test('distill assets: template.md, conventions-template.md, and veto-checklist.md exist', () => {
  assert.ok(existsSync(join(REAL_ASSETS, 'distill', 'template.md')), 'assets/distill/template.md exists');
  assert.ok(
    existsSync(join(REAL_ASSETS, 'distill', 'conventions-template.md')),
    'assets/distill/conventions-template.md exists',
  );
  assert.ok(
    existsSync(join(REAL_ASSETS, 'distill', 'veto-checklist.md')),
    'assets/distill/veto-checklist.md exists',
  );
});

// ---------------------------------------------------------------------------------------------
// SPEC-DISTILL-001 — distillRecord: first write, hash-mismatch refusal, --force override
// ---------------------------------------------------------------------------------------------

test('distillRecord: first distill of a conventions file writes manifest.conventions {sha256, distilledAt}', () => {
  const repo = tmpDir();
  const conv = join(repo, '.code-guidelines', 'project-conventions.md');
  const content = '# Project Conventions\n\n## Guardrails\n\n- MUST do X. (Evidence: `a.ts`, `b.ts`)\n';
  writeF(conv, content);

  const res = distillRecord('.code-guidelines/project-conventions.md', { repoRoot: repo, now: 'T0' });
  assert.equal(res.ok, true, 'first distill succeeds');
  assert.equal(res.exitCode, 0);

  const manifest = readManifest(repo);
  assert.ok(manifest.conventions, 'manifest.conventions written');
  assert.ok('sha256' in manifest.conventions, 'sha256 field present');
  assert.ok('distilledAt' in manifest.conventions, 'distilledAt field present');
  assert.equal(manifest.conventions.sha256, hashNormalized(content), 'sha256 matches normalized content');
  assert.equal(manifest.conventions.distilledAt, 'T0');
});

test('distillRecord: re-distill with a changed conventions file (hash mismatch) WITHOUT force REFUSES and leaves manifest.conventions unchanged', () => {
  const repo = tmpDir();
  const conv = join(repo, '.code-guidelines', 'project-conventions.md');

  // Seed a prior record whose hash does not match the CURRENT on-disk content (simulating a
  // user hand-edit or a fresh distillation attempt against changed source since last accepted run).
  const oldContent = '# Project Conventions\n\n## Guardrails\n\n- MUST do X. (Evidence: `a.ts`, `b.ts`)\n';
  const seeded = {
    version: '1.0.0',
    rules: [],
    lint: [],
    conventions: { sha256: hashNormalized(oldContent), distilledAt: 'T-old' },
  };
  writeF(targetManifestPath(repo), `${JSON.stringify(seeded, null, 2)}\n`);

  const newContent = '# Project Conventions\n\n## Guardrails\n\n- MUST do Y instead. (Evidence: `c.ts`, `d.ts`)\n';
  writeF(conv, newContent);

  const res = distillRecord('.code-guidelines/project-conventions.md', { repoRoot: repo, now: 'T1' });
  assert.equal(res.ok, false, 'refuses to overwrite on hash mismatch');
  assert.equal(res.exitCode, 4, 'conflict/safety exit-code class');
  assert.equal(res.reason, 'hash-mismatch');
  // A comparison is returned: old vs new hash (+ prior distilledAt) so the caller can render a diff.
  assert.equal(res.oldHash, seeded.conventions.sha256);
  assert.equal(res.oldDistilledAt, seeded.conventions.distilledAt);
  assert.equal(res.newHash, hashNormalized(newContent));
  assert.notEqual(res.newHash, res.oldHash);

  // manifest.conventions must be UNCHANGED by the refused attempt.
  assert.deepEqual(readManifest(repo).conventions, seeded.conventions, 'manifest.conventions untouched on refusal');
});

test('distillRecord: re-distill WITH force:true overwrites manifest.conventions with new sha256/distilledAt', () => {
  const repo = tmpDir();
  const conv = join(repo, '.code-guidelines', 'project-conventions.md');

  const oldContent = '# Project Conventions\n\n## Guardrails\n\n- MUST do X. (Evidence: `a.ts`, `b.ts`)\n';
  const seeded = {
    version: '1.0.0',
    rules: [],
    lint: [],
    conventions: { sha256: hashNormalized(oldContent), distilledAt: 'T-old' },
  };
  writeF(targetManifestPath(repo), `${JSON.stringify(seeded, null, 2)}\n`);

  const newContent = '# Project Conventions\n\n## Guardrails\n\n- MUST do Y instead. (Evidence: `c.ts`, `d.ts`)\n';
  writeF(conv, newContent);

  const res = distillRecord('.code-guidelines/project-conventions.md', {
    repoRoot: repo,
    force: true,
    now: 'T2',
  });
  assert.equal(res.ok, true, 'force overrides the hash-mismatch refusal');
  assert.equal(res.exitCode, 0);

  const manifest = readManifest(repo);
  assert.equal(manifest.conventions.sha256, hashNormalized(newContent), 'sha256 updated to new content');
  assert.notEqual(manifest.conventions.sha256, seeded.conventions.sha256, 'sha256 actually changed');
  assert.equal(manifest.conventions.distilledAt, 'T2', 'distilledAt updated');
  assert.notEqual(manifest.conventions.distilledAt, seeded.conventions.distilledAt);
});

// ---------------------------------------------------------------------------------------------
// SPEC-SYNC-001 / SPEC-DISTILL-001 — the no-arg sync path never invokes distill
// ---------------------------------------------------------------------------------------------

test('sync: no-arg pipeline never calls distillRecord — conventions stays exactly as seeded, never null-initialized or reset', async () => {
  const assetRoot = tmpDir('cg-distill-assets-');
  // Minimal real-shaped asset root: reuse the real stacks.json + VERSION so detect()/select() work.
  writeF(join(assetRoot, 'stacks.json'), readFileSync(join(REAL_ASSETS, 'stacks.json'), 'utf8'));
  writeF(join(assetRoot, 'VERSION'), '1.0.0\n');
  writeF(join(assetRoot, 'library', 'guardrails-core.md'), '# guardrails-core\nbody\n');

  const repo = tmpDir('cg-distill-repo-');
  writeF(join(repo, 'CLAUDE.md'), '# App\n');

  const seededConventions = { sha256: 'preexisting-hash', distilledAt: '2026-01-01T00:00:00.000Z' };
  writeF(
    targetManifestPath(repo),
    `${JSON.stringify({ version: '1.0.0', rules: [], lint: [], conventions: seededConventions }, null, 2)}\n`,
  );

  const r = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T0' });
  assert.equal(r.exitCode, 0);
  assert.deepEqual(
    readManifest(repo).conventions,
    seededConventions,
    'no-arg sync leaves manifest.conventions byte-for-byte untouched (never distills)',
  );
  assert.equal(
    existsSync(join(repo, '.code-guidelines', 'project-conventions.md')),
    false,
    'no-arg sync never writes project-conventions.md itself',
  );
});
