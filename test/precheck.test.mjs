// test/precheck.test.mjs — dedicated platform-precheck + managed-host-block coverage
// (SPEC-PRECHECK-001, SPEC-HOSTFMT-001). Complements the broader assets/sync.mjs pipeline tests
// in test/sync.test.mjs with focused fixtures for: the fixed platform->entry-file map, precheck
// abort + zero-write guarantees, "never create an entry file", whole-block regeneration with
// outside-block bytes untouched, and malformed/duplicate/orphan marker handling.
//
// Uses only temp dirs (os.tmpdir()) + assets/sync.mjs's injectable repoRoot/assetRoot options —
// NEVER the real home directory or this repo's own CLAUDE.md/AGENTS.md.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sync, maintainHostBlock } from '../assets/sync.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REAL_ASSETS = join(REPO_ROOT, 'assets');
const FIXTURES = join(__dirname, 'fixtures');

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const tmps = [];
function tmpDir(prefix = 'cg-precheck-') {
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

// Copy a committed fixture directory into a fresh temp dir; the fixture itself is never mutated.
function copyFixture(name) {
  const dest = tmpDir(`cg-precheck-${name}-`);
  cpSync(join(FIXTURES, name), dest, { recursive: true });
  return dest;
}

// Minimal injectable asset root: real stacks.json + VERSION, no library/lint payload. sync()'s
// reconcile()/armLint() degrade to no-op-for-that-file when the underlying library/lint asset is
// absent (SPEC-RECONCILE-001 / SPEC-LINT-001 "library-missing" skip), so this is sufficient to
// drive the full pipeline for precheck/host-block assertions without needing the 57-rule library
// or the 11 lint baselines (later tasks).
function buildMinimalAssetRoot() {
  const assetRoot = tmpDir('cg-precheck-assets-');
  cpSync(join(REAL_ASSETS, 'stacks.json'), join(assetRoot, 'stacks.json'));
  writeF(join(assetRoot, 'VERSION'), '1.0.0\n');
  return assetRoot;
}

// Recursively list every relative path under `root` (files + dirs), for strict zero-write proof.
function snapshotTree(root) {
  const out = new Set();
  function walk(dir, rel) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      out.add(childRel);
      if (ent.isDirectory()) walk(join(dir, ent.name), childRel);
    }
  }
  walk(root, '');
  return out;
}

const BLOCK_BEGIN = '<!-- code-guidelines:begin -->';
const BLOCK_END = '<!-- code-guidelines:end -->';

// The fixed platform -> repo-root entry-file map under test (SPEC-PRECHECK-001).
const PLATFORM_ENTRY = {
  claude: 'CLAUDE.md',
  codex: 'AGENTS.md',
  opencode: 'AGENTS.md',
  gemini: 'GEMINI.md',
};

// ---------------------------------------------------------------------------------------------
// Fixed platform -> entry-file map (all four platforms)
// ---------------------------------------------------------------------------------------------

for (const [platform, file] of Object.entries(PLATFORM_ENTRY)) {
  test(`precheck map: ${platform} → ${file} present at repo root → precheck passes (exitCode !== 3)`, async () => {
    const repo = tmpDir(`cg-precheck-pass-${platform}-`);
    writeF(join(repo, file), `# ${file}\n`);
    const assetRoot = buildMinimalAssetRoot();
    const r = await sync({ platform, repoRoot: repo, assetRoot, now: 'T0' });
    assert.notEqual(r.exitCode, 3, `${platform}: precheck must pass once ${file} exists at repo root`);
  });
}

// ---------------------------------------------------------------------------------------------
// Missing current-platform entry file → abort exit 3, ZERO writes, message names platform + file
// (all four platform mappings; includes the required claude/CLAUDE.md case).
// ---------------------------------------------------------------------------------------------

for (const [platform, file] of Object.entries(PLATFORM_ENTRY)) {
  test(`precheck abort: ${platform} missing ${file} → exit 3, zero writes, message contains platform+filename`, async () => {
    const repo = copyFixture('precheck-missing'); // only README.md — no entry file of any kind
    const assetRoot = buildMinimalAssetRoot();
    const before = snapshotTree(repo);

    const r = await sync({ platform, repoRoot: repo, assetRoot, now: 'T0' });

    assert.equal(r.exitCode, 3, `${platform}: missing ${file} must abort with exit 3`);
    assert.ok(r.text.includes(platform), `message must name the platform (${platform}): ${r.text}`);
    assert.ok(r.text.includes(file), `message must name the target file (${file}): ${r.text}`);
    assert.equal(existsSync(join(repo, '.code-guidelines')), false, 'no .code-guidelines/ created');
    assert.equal(existsSync(join(repo, file)), false, `${file} itself was never created`);

    const after = snapshotTree(repo);
    assert.deepEqual(after, before, `zero writes anywhere under the target dir for ${platform}`);
  });
}

// ---------------------------------------------------------------------------------------------
// Another platform's entry file present, but the CURRENT platform's is missing → still aborts.
// ---------------------------------------------------------------------------------------------

test('precheck abort: CLAUDE.md present but current platform is codex (needs AGENTS.md) → still aborts, zero writes', async () => {
  const repo = copyFixture('precheck-claude'); // CLAUDE.md exists; AGENTS.md / GEMINI.md do not
  const assetRoot = buildMinimalAssetRoot();
  const before = snapshotTree(repo);

  const r = await sync({ platform: 'codex', repoRoot: repo, assetRoot, now: 'T0' });

  assert.equal(r.exitCode, 3, "another platform's file existing must not satisfy codex's precheck");
  assert.ok(r.text.includes('codex') && r.text.includes('AGENTS.md'), r.text);
  assert.equal(existsSync(join(repo, 'AGENTS.md')), false, 'AGENTS.md was never created');

  const after = snapshotTree(repo);
  assert.deepEqual(after, before, 'zero writes anywhere under the target dir');
});

test('precheck abort: CLAUDE.md present but current platform is gemini (needs GEMINI.md) → still aborts, zero writes', async () => {
  const repo = copyFixture('precheck-claude');
  const assetRoot = buildMinimalAssetRoot();
  const before = snapshotTree(repo);

  const r = await sync({ platform: 'gemini', repoRoot: repo, assetRoot, now: 'T0' });

  assert.equal(r.exitCode, 3, "CLAUDE.md existing must not satisfy gemini's precheck");
  assert.ok(r.text.includes('gemini') && r.text.includes('GEMINI.md'), r.text);
  assert.equal(existsSync(join(repo, 'GEMINI.md')), false, 'GEMINI.md was never created');

  const after = snapshotTree(repo);
  assert.deepEqual(after, before, 'zero writes anywhere under the target dir');
});

// ---------------------------------------------------------------------------------------------
// After precheck passes: only writes into ALREADY-EXISTING entry files, never creates one.
// ---------------------------------------------------------------------------------------------

test('precheck pass: sync maintains the managed block only in entry files that already exist, and never creates the other two', async () => {
  const repo = copyFixture('precheck-claude'); // CLAUDE.md exists; AGENTS.md / GEMINI.md do not
  const assetRoot = buildMinimalAssetRoot();

  const r = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T0' });

  assert.equal(r.exitCode, 0);
  const claudeMd = readFileSync(join(repo, 'CLAUDE.md'), 'utf8');
  assert.ok(claudeMd.includes(BLOCK_BEGIN) && claudeMd.includes(BLOCK_END), 'existing CLAUDE.md gets the managed block');
  assert.equal(existsSync(join(repo, 'AGENTS.md')), false, 'AGENTS.md is never created by sync');
  assert.equal(existsSync(join(repo, 'GEMINI.md')), false, 'GEMINI.md is never created by sync');
});

// ---------------------------------------------------------------------------------------------
// Managed block regenerated wholly; content OUTSIDE the block is byte-for-byte untouched.
// ---------------------------------------------------------------------------------------------

test('maintainHostBlock: block regenerated wholly on pointer change, bytes outside the block are byte-for-byte unchanged', () => {
  const repo = tmpDir('cg-precheck-regen-');
  const original = '# Project\n\nIntro paragraph.\n\nSome trailing notes.\n';
  writeF(join(repo, 'CLAUDE.md'), original);

  const plan1 = maintainHostBlock(['CLAUDE.md'], { repoRoot: repo, pointers: ['- read a'] });
  assert.equal(plan1.malformed, false);
  assert.equal(plan1.writes.length, 1);
  writeFileSync(join(repo, 'CLAUDE.md'), plan1.writes[0].content);
  const afterFirst = readFileSync(join(repo, 'CLAUDE.md'), 'utf8');
  assert.ok(afterFirst.startsWith(original), 'original bytes preserved verbatim before the inserted block');

  // Regenerate with a DIFFERENT pointer set — the block must be replaced wholly, and every byte
  // outside the begin/end markers must be identical to the previous version.
  const plan2 = maintainHostBlock(['CLAUDE.md'], { repoRoot: repo, pointers: ['- read a', '- read b', '- read c'] });
  assert.equal(plan2.writes.length, 1, 'a changed pointer set must still produce exactly one write');
  const afterSecond = plan2.writes[0].content;

  const preBlock1 = afterFirst.slice(0, afterFirst.indexOf(BLOCK_BEGIN));
  const postBlock1 = afterFirst.slice(afterFirst.indexOf(BLOCK_END) + BLOCK_END.length);
  const preBlock2 = afterSecond.slice(0, afterSecond.indexOf(BLOCK_BEGIN));
  const postBlock2 = afterSecond.slice(afterSecond.indexOf(BLOCK_END) + BLOCK_END.length);
  assert.equal(preBlock2, preBlock1, 'bytes before the block are untouched across a full regeneration');
  assert.equal(postBlock2, postBlock1, 'bytes after the block are untouched across a full regeneration');
  assert.ok(afterSecond.includes('read b') && afterSecond.includes('read c'), 'new block body reflects the new pointer set');
  assert.ok(!afterFirst.includes('read b'), 'old block body did not already contain the new pointer (sanity)');
});

// ---------------------------------------------------------------------------------------------
// Malformed / duplicate / orphan managed-block markers → abort exit 4, ZERO writes.
// ---------------------------------------------------------------------------------------------

test('maintainHostBlock: orphan END marker with no BEGIN → malformed, zero writes', () => {
  const repo = tmpDir('cg-precheck-orphan-end-');
  writeF(join(repo, 'CLAUDE.md'), `Some content\n${BLOCK_END}\nmore content\n`);
  const plan = maintainHostBlock(['CLAUDE.md'], { repoRoot: repo, pointers: ['- x'] });
  assert.equal(plan.malformed, true);
  assert.equal(plan.malformedFile, 'CLAUDE.md');
  assert.equal(plan.writes.length, 0);
});

test('maintainHostBlock: orphan BEGIN marker with no END → malformed, zero writes', () => {
  const repo = tmpDir('cg-precheck-orphan-begin-');
  writeF(join(repo, 'CLAUDE.md'), `${BLOCK_BEGIN}\nunterminated\n`);
  const plan = maintainHostBlock(['CLAUDE.md'], { repoRoot: repo, pointers: ['- x'] });
  assert.equal(plan.malformed, true);
  assert.equal(plan.writes.length, 0);
});

test('maintainHostBlock: duplicate begin/end pairs → malformed, zero writes', () => {
  const repo = tmpDir('cg-precheck-dup-');
  writeF(
    join(repo, 'CLAUDE.md'),
    `${BLOCK_BEGIN}\na\n${BLOCK_END}\n${BLOCK_BEGIN}\nb\n${BLOCK_END}\n`,
  );
  const plan = maintainHostBlock(['CLAUDE.md'], { repoRoot: repo, pointers: ['- x'] });
  assert.equal(plan.malformed, true);
  assert.equal(plan.writes.length, 0);
});

test('maintainHostBlock: reversed markers (END before BEGIN) → malformed, zero writes', () => {
  const repo = tmpDir('cg-precheck-reversed-');
  writeF(join(repo, 'CLAUDE.md'), `${BLOCK_END}\nstuff in between\n${BLOCK_BEGIN}\n`);
  const plan = maintainHostBlock(['CLAUDE.md'], { repoRoot: repo, pointers: ['- x'] });
  assert.equal(plan.malformed, true);
  assert.equal(plan.writes.length, 0);
});

test('sync: malformed marker (duplicate BEGIN/END pairs) end-to-end → exit 4, zero writes, entry file bytes unchanged', async () => {
  const repo = copyFixture('precheck-claude');
  const claudeMdPath = join(repo, 'CLAUDE.md');
  const malformed = `${BLOCK_BEGIN}\na\n${BLOCK_END}\n${BLOCK_BEGIN}\nb\n${BLOCK_END}\n`;
  writeFileSync(claudeMdPath, malformed);
  const assetRoot = buildMinimalAssetRoot();
  const before = snapshotTree(repo);

  const r = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T0' });

  assert.equal(r.exitCode, 4);
  assert.equal(existsSync(join(repo, '.code-guidelines')), false, 'no .code-guidelines/ created on malformed abort');
  assert.equal(readFileSync(claudeMdPath, 'utf8'), malformed, 'CLAUDE.md bytes are byte-for-byte unchanged');

  const after = snapshotTree(repo);
  assert.deepEqual(after, before, 'zero writes anywhere under the target dir on malformed-marker abort');
});

test('sync: orphan BEGIN-only marker end-to-end → exit 4, zero writes', async () => {
  const repo = copyFixture('precheck-claude');
  const claudeMdPath = join(repo, 'CLAUDE.md');
  const malformed = `${BLOCK_BEGIN}\norphaned begin, no end\n`;
  writeFileSync(claudeMdPath, malformed);
  const assetRoot = buildMinimalAssetRoot();
  const before = snapshotTree(repo);

  const r = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T0' });

  assert.equal(r.exitCode, 4);
  assert.equal(readFileSync(claudeMdPath, 'utf8'), malformed, 'CLAUDE.md bytes untouched');
  const after = snapshotTree(repo);
  assert.deepEqual(after, before, 'zero writes anywhere under the target dir');
});

// ---------------------------------------------------------------------------------------------
// Fix Wave 1 (task-11-review.md #1 / #2): two SPEC-PRECHECK-001 / SPEC-HOSTFMT-001 contract lines
// that had zero coverage anywhere in the suite — multi-entry-file maintenance ("有几个维护几个")
// and the "project-conventions.md pointer always ranks first" ordering guarantee.
// ---------------------------------------------------------------------------------------------

test('sync: MORE THAN ONE entry file present simultaneously (CLAUDE.md + AGENTS.md), platform=claude → BOTH get the managed block independently maintained, each own outside-block bytes unchanged (SPEC-PRECHECK-001 "有几个维护几个")', async () => {
  const repo = tmpDir('cg-precheck-multi-');
  const assetRoot = buildMinimalAssetRoot();
  const claudeOriginal = '# Project (Claude)\n\nSome CLAUDE-specific notes.\n';
  const agentsOriginal = '# Project (Agents)\n\nSome AGENTS-specific notes, distinct from CLAUDE.md.\n';
  writeF(join(repo, 'CLAUDE.md'), claudeOriginal);
  writeF(join(repo, 'AGENTS.md'), agentsOriginal);

  // precheck is keyed only on the CURRENT platform's mapped file (CLAUDE.md for claude); it must
  // still pass even though a second, non-current-platform entry file (AGENTS.md) also exists.
  const r = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T0' });
  assert.equal(r.exitCode, 0, 'precheck passes on CLAUDE.md for platform claude');

  const claudeAfter = readFileSync(join(repo, 'CLAUDE.md'), 'utf8');
  const agentsAfter = readFileSync(join(repo, 'AGENTS.md'), 'utf8');

  for (const [label, before, after] of [
    ['CLAUDE.md', claudeOriginal, claudeAfter],
    ['AGENTS.md', agentsOriginal, agentsAfter],
  ]) {
    assert.ok(
      after.includes(BLOCK_BEGIN) && after.includes(BLOCK_END),
      `${label} gets its OWN managed block, not only the current platform's mapped file`,
    );
    assert.ok(after.startsWith(before), `${label}: original bytes preserved verbatim before the inserted block`);
    const outsideAfterEnd = after.slice(after.indexOf(BLOCK_END) + BLOCK_END.length);
    assert.equal(outsideAfterEnd, '\n', `${label}: nothing but a trailing newline after the block`);
  }

  assert.notEqual(claudeAfter, agentsAfter, 'sanity: each file kept its own distinct body, not a copy of the other');
  assert.equal(existsSync(join(repo, 'GEMINI.md')), false, 'GEMINI.md is still never created (only existing files are maintained)');
});

test('sync: project-conventions.md present + a rule pointer both in the block → conventions pointer ranks FIRST (SPEC-HOSTFMT-001 "project-conventions.md 存在时其指针恒排第一")', async () => {
  // Fixture rule declaring appliesTo, via the injectable library asset dir, so a second,
  // non-conventions pointer kind (a glob-conditioned rule pointer) is also present in the block.
  const RULE_WITH_APPLIES_TO = [
    '---',
    'name: guardrails-core',
    'description: core guardrails',
    'appliesTo:',
    '  - "*.ts"',
    'stacks: [guardrails-core]',
    'source: original',
    '---',
    '# guardrails-core',
    'Body.',
    '',
  ].join('\n');
  const assetRoot = buildMinimalAssetRoot();
  writeF(join(assetRoot, 'library', 'guardrails-core.md'), RULE_WITH_APPLIES_TO);

  const repo = tmpDir('cg-precheck-hostfmt-order-');
  writeF(join(repo, 'CLAUDE.md'), '# App\n');
  // Present BEFORE sync runs: conventionsPresent is a plain existsSync check, independent of the
  // manifest, so writing the file directly onto disk is sufficient to drive this branch.
  writeF(join(repo, '.code-guidelines', 'project-conventions.md'), '# Conventions\n- always X (a.ts, b.ts)\n');

  const r = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T0' });
  assert.equal(r.exitCode, 0);

  const claudeMd = readFileSync(join(repo, 'CLAUDE.md'), 'utf8');
  const blockMatch = claudeMd.match(/<!-- code-guidelines:begin -->[\s\S]*?<!-- code-guidelines:end -->/);
  assert.ok(blockMatch, 'managed block present');

  const pointerLines = blockMatch[0].split('\n').filter((l) => l.startsWith('- '));
  assert.ok(pointerLines.length >= 2, 'both a conventions pointer and a rule pointer are present');
  assert.ok(
    pointerLines[0].includes('project-conventions.md') && pointerLines[0].includes('project conventions'),
    `conventions pointer must be the FIRST pointer line, got: ${pointerLines[0]}`,
  );
  assert.ok(
    pointerLines.slice(1).some((l) => l.includes('guardrails-core.md')),
    'the rule pointer is present, ranked after the conventions pointer',
  );

  const conventionsIdx = blockMatch[0].indexOf('project-conventions.md');
  const ruleIdx = blockMatch[0].indexOf('guardrails-core.md');
  assert.ok(conventionsIdx !== -1 && ruleIdx !== -1);
  assert.ok(conventionsIdx < ruleIdx, 'conventions pointer byte-offset precedes the rule pointer byte-offset');
});
