// test/lint.test.mjs — PLAN-TASK-012: lint first-time arming, fixture-driven (SPEC-LINT-001,
// SPEC-BASELINE-001).
//
// SELF-CONTAINED BY DESIGN: armLint()'s baseline source in every test here is the injected
// test/fixtures/lint-baseline/ (via armLint's injectable `lintDir` option / sync()'s injectable
// `assetRoot` option) — NEVER assets/lint/, which does not exist yet (created in PLAN-TASK-017/018).
// See assets/sync.mjs armLint(detected, manifest, ctx) — `ctx.lintDir ?? join(assetRoot, 'lint')`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
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

import { armLint, sync } from '../assets/sync.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REAL_ASSETS = join(REPO_ROOT, 'assets');
const FIXTURES = join(__dirname, 'fixtures');
const LINT_BASELINE_ROOT = join(FIXTURES, 'lint-baseline'); // armLint's injected lint-root
const BASELINE_FILE = join(LINT_BASELINE_ROOT, 'js-ts', 'eslint.config.js');
const BASELINE_TEXT = readFileSync(BASELINE_FILE, 'utf8');
const JS_TS_INSTALL_CMD = 'npm install -D eslint prettier typescript typescript-eslint'; // SPEC-BASELINE-001, exact

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const tmps = [];
function tmpDir(prefix = 'cg-lint-') {
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

function applyWrites(writes) {
  for (const w of writes) {
    mkdirSync(dirname(w.absPath), { recursive: true });
    writeFileSync(w.absPath, w.content);
  }
}

// Mirrors armLint's internal combinedHash algorithm exactly (sorted filenames, CRLF->LF, \0-joined).
function combinedLintHashFromDir(dir) {
  const names = [...readdirSync(dir)].sort();
  const h = createHash('sha256');
  for (const name of names) {
    const content = readFileSync(join(dir, name), 'utf8');
    h.update(name).update('\0').update(content.replace(/\r\n/g, '\n')).update('\0');
  }
  return h.digest('hex');
}
const BASELINE_HASH = combinedLintHashFromDir(join(LINT_BASELINE_ROOT, 'js-ts'));

const DETECTED_JS = [{ id: 'javascript', lint: 'js-ts' }];

// Builds a fresh repo from the lint-blank fixture, arms it via armLint (first run), physically
// applies the resulting scaffold write, and returns the post-arm manifest for follow-up calls.
function armFreshBlankRepo(now = 'T0') {
  const repo = tmpDir('cg-lint-blank-');
  copyFileSync(join(FIXTURES, 'lint-blank', 'package.json'), join(repo, 'package.json'));
  const plan = armLint(DETECTED_JS, { lint: [] }, { repoRoot: repo, lintDir: LINT_BASELINE_ROOT, now });
  applyWrites(plan.writes);
  return { repo, manifest: { lint: plan.nextLint }, plan };
}

// ---------------------------------------------------------------------------------------------
// SPEC-LINT-001 — blank project first run: arming happens, exact install command, deps never
// installed.
// ---------------------------------------------------------------------------------------------

test('armLint: lint-blank fixture, first run → arms js-ts scaffold FROM the injected baseline + exact install command; deps never installed', () => {
  const repo = tmpDir('cg-lint-blank-');
  copyFileSync(join(FIXTURES, 'lint-blank', 'package.json'), join(repo, 'package.json'));

  const plan = armLint(DETECTED_JS, { lint: [] }, { repoRoot: repo, lintDir: LINT_BASELINE_ROOT, now: 'T0' });

  assert.equal(plan.writes.length, 1, 'exactly one baseline file scheduled (eslint.config.js)');
  assert.equal(plan.writes[0].absPath, join(repo, 'eslint.config.js'));
  assert.equal(
    plan.writes[0].content.toString('utf8'),
    BASELINE_TEXT,
    'scaffold content is written FROM the fixture baseline, verbatim',
  );

  assert.equal(plan.nextLint.length, 1);
  assert.equal(plan.nextLint[0].tool, 'js-ts');
  assert.equal(plan.nextLint[0].armedAt, 'T0');
  assert.equal(plan.nextLint[0].sha256, BASELINE_HASH);

  const row = plan.status.find((r) => r.tool === 'js-ts');
  assert.equal(row.armed, true);
  assert.equal(row.gap, true);
  assert.equal(row.installCmd, JS_TS_INSTALL_CMD, 'exact install command per SPEC-BASELINE-001');

  // Dependencies are NEVER auto-installed (SCOPE-OUT-003): applying the plan writes only the
  // scaffold file, nothing else — no node_modules, package.json left untouched.
  applyWrites(plan.writes);
  assert.equal(existsSync(join(repo, 'node_modules')), false, 'armLint never installs dependencies');
  assert.equal(
    readFileSync(join(repo, 'package.json'), 'utf8'),
    readFileSync(join(FIXTURES, 'lint-blank', 'package.json'), 'utf8'),
    'package.json (deps) left untouched by lint arming',
  );
});

// ---------------------------------------------------------------------------------------------
// SPEC-LINT-001 — at-most-once: second run is a zero-write no-op.
// ---------------------------------------------------------------------------------------------

test('armLint: second run against an already-armed, unmodified scaffold → ZERO writes (idempotent)', () => {
  const { repo, manifest } = armFreshBlankRepo('T0');
  assert.ok(existsSync(join(repo, 'eslint.config.js')), 'sanity: scaffold physically present after run 1');

  const plan2 = armLint(DETECTED_JS, manifest, { repoRoot: repo, lintDir: LINT_BASELINE_ROOT, now: 'T1' });
  assert.equal(plan2.writes.length, 0, 'second run performs zero writes');
  assert.deepEqual(plan2.nextLint, manifest.lint, 'manifest record carried forward unchanged');
  const row = plan2.status.find((r) => r.tool === 'js-ts');
  assert.equal(row.armed, true);
  assert.equal(row.gap, false, 'no gap reported once armed and unmodified');
});

// ---------------------------------------------------------------------------------------------
// SPEC-LINT-001 — user deletes the scaffold = opt-out; never revived; reported.
// ---------------------------------------------------------------------------------------------

test('armLint: user DELETES the scaffold → NOT revived (opt-out), and the report notes it', () => {
  const { repo, manifest } = armFreshBlankRepo('T0');
  rmSync(join(repo, 'eslint.config.js'));

  const plan = armLint(DETECTED_JS, manifest, { repoRoot: repo, lintDir: LINT_BASELINE_ROOT, now: 'T1' });
  assert.equal(plan.writes.length, 0, 'deleted scaffold is NOT revived');
  assert.equal(existsSync(join(repo, 'eslint.config.js')), false, 'file stays absent');
  assert.deepEqual(plan.nextLint, manifest.lint, 'manifest record preserved as-is (marker not cleared)');

  const row = plan.status.find((r) => r.tool === 'js-ts');
  assert.equal(row.optedOut, true, 'report notes the opt-out');
  assert.equal(row.armed, false);

  // Opt-out persists across further runs too — it is never spontaneously revived.
  const plan2 = armLint(DETECTED_JS, manifest, { repoRoot: repo, lintDir: LINT_BASELINE_ROOT, now: 'T2' });
  assert.equal(plan2.writes.length, 0, 'still not revived on a subsequent run');
  assert.equal(plan2.status.find((r) => r.tool === 'js-ts').optedOut, true);
});

// ---------------------------------------------------------------------------------------------
// SPEC-LINT-001 — `--relint <tool>` re-arms: clears the marker, rewrites the scaffold.
// ---------------------------------------------------------------------------------------------

test('armLint: --relint <tool> clears the opt-out marker and re-arms with a fresh scaffold', () => {
  const { repo, manifest } = armFreshBlankRepo('T0');
  rmSync(join(repo, 'eslint.config.js')); // user opts out first
  const optedOutPlan = armLint(DETECTED_JS, manifest, { repoRoot: repo, lintDir: LINT_BASELINE_ROOT, now: 'T1' });
  assert.equal(optedOutPlan.status.find((r) => r.tool === 'js-ts').optedOut, true, 'sanity: opted out before relint');

  const relintManifest = { lint: optedOutPlan.nextLint };
  const relintPlan = armLint(DETECTED_JS, relintManifest, {
    repoRoot: repo,
    lintDir: LINT_BASELINE_ROOT,
    relint: 'js-ts',
    now: 'T2',
  });
  assert.equal(relintPlan.writes.length, 1, '--relint rewrites the scaffold');
  assert.equal(relintPlan.writes[0].content.toString('utf8'), BASELINE_TEXT);
  assert.equal(relintPlan.nextLint[0].armedAt, 'T2', 'armedAt reset by the explicit re-arm');
  assert.equal(relintPlan.nextLint[0].sha256, BASELINE_HASH);
  const row = relintPlan.status.find((r) => r.tool === 'js-ts');
  assert.equal(row.armed, true);
  assert.equal(row.gap, true, 're-armed scaffold reports an install-command gap again');
});

// ---------------------------------------------------------------------------------------------
// SPEC-LINT-001 / SPEC-BASELINE-001 — existing config (current AND historical filename) is left
// byte-for-byte unchanged; only a read-only recommendation.
// ---------------------------------------------------------------------------------------------

test('armLint: existing config fixture (current eslint.config.js) → left byte-for-byte unchanged, read-only recommendation only', () => {
  const repo = tmpDir('cg-lint-existing-');
  copyFileSync(join(FIXTURES, 'lint-existing', 'eslint.config.js'), join(repo, 'eslint.config.js'));
  const before = readFileSync(join(repo, 'eslint.config.js'), 'utf8');

  const plan = armLint(DETECTED_JS, { lint: [] }, { repoRoot: repo, lintDir: LINT_BASELINE_ROOT, now: 'T0' });
  assert.equal(plan.writes.length, 0, 'never touch an already-configured tool');
  assert.equal(plan.nextLint.length, 0, 'no manifest record written for an existing config');
  const row = plan.status.find((r) => r.tool === 'js-ts');
  assert.equal(row.armed, false);
  assert.equal(row.gap, false);

  const after = readFileSync(join(repo, 'eslint.config.js'), 'utf8');
  assert.equal(after, before, 'byte-for-byte unchanged');
});

test('armLint: existing config via a HISTORICAL filename (.eslintrc.json) → also left untouched', () => {
  const repo = tmpDir('cg-lint-hist-');
  writeF(join(repo, '.eslintrc.json'), '{"rules": {}}\n');
  const before = readFileSync(join(repo, '.eslintrc.json'), 'utf8');

  const plan = armLint(DETECTED_JS, { lint: [] }, { repoRoot: repo, lintDir: LINT_BASELINE_ROOT, now: 'T0' });
  assert.equal(plan.writes.length, 0, 'historical config filename also counts as "already configured"');
  assert.equal(plan.nextLint.length, 0);
  assert.equal(plan.status.find((r) => r.tool === 'js-ts').armed, false);
  assert.equal(
    readFileSync(join(repo, '.eslintrc.json'), 'utf8'),
    before,
    'historical config file left byte-for-byte unchanged',
  );
});

for (const [field, value] of [
  ['eslintConfig', { rules: { eqeqeq: 'error' } }],
  ['prettier', { semi: true }],
]) {
  test(`armLint: existing js-ts config via package.json "${field}" field → left untouched`, () => {
    const repo = tmpDir('cg-lint-package-config-');
    writeF(join(repo, 'package.json'), `${JSON.stringify({ name: 'pkg-config', [field]: value }, null, 2)}\n`);

    const plan = armLint(DETECTED_JS, { lint: [] }, { repoRoot: repo, lintDir: LINT_BASELINE_ROOT, now: 'T0' });

    assert.equal(plan.writes.length, 0, 'package.json tool config counts as already configured');
    assert.equal(plan.nextLint.length, 0, 'no manifest record written for an existing package.json config');
    const row = plan.status.find((r) => r.tool === 'js-ts');
    assert.equal(row.armed, false);
    assert.equal(row.gap, false);
    assert.equal(existsSync(join(repo, 'eslint.config.js')), false, 'no eslint scaffold written');
    assert.equal(existsSync(join(repo, '.prettierrc')), false, 'no prettier scaffold written');
  });
}

// ---------------------------------------------------------------------------------------------
// SPEC-LINT-001 — unmodified scaffold upgrades with a new library version; a user-modified
// scaffold permanently skips (never rewritten).
// ---------------------------------------------------------------------------------------------

test('armLint: unmodified scaffold + newer library baseline → upgrades and re-records the hash', () => {
  const { repo, manifest } = armFreshBlankRepo('T0'); // manifest.lint[0].sha256 == v1 (fixture) hash

  // Simulate a version bump: a distinct baseline root whose js-ts/eslint.config.js content differs
  // from the fixture (v1) that was originally armed. The repo's on-disk scaffold is untouched
  // (still == v1, matching the manifest record), so this must be treated as an upgrade, not a
  // user edit.
  const v2Root = tmpDir('cg-lint-v2-');
  const v2Content = `${BASELINE_TEXT}// v2: bumped\n`;
  writeF(join(v2Root, 'js-ts', 'eslint.config.js'), v2Content);

  const plan = armLint(DETECTED_JS, manifest, { repoRoot: repo, lintDir: v2Root, now: 'T1' });
  assert.equal(plan.writes.length, 1, 'unmodified scaffold is upgraded to the new library version');
  assert.equal(plan.writes[0].content.toString('utf8'), v2Content);
  assert.notEqual(plan.nextLint[0].sha256, manifest.lint[0].sha256, 'sha256 updated to the new version');
  assert.equal(
    plan.nextLint[0].armedAt,
    manifest.lint[0].armedAt,
    'armedAt preserved from the original arming (only content refreshed)',
  );
});

test('armLint: user-modified scaffold on disk → permanently skipped, never rewritten', () => {
  const { repo, manifest } = armFreshBlankRepo('T0');
  writeFileSync(join(repo, 'eslint.config.js'), '// user hand-edited this scaffold\nexport default [];\n');

  const plan = armLint(DETECTED_JS, manifest, { repoRoot: repo, lintDir: LINT_BASELINE_ROOT, now: 'T1' });
  assert.equal(plan.writes.length, 0, 'a modified scaffold is user property — never rewritten');
  assert.deepEqual(plan.nextLint[0], manifest.lint[0], 'manifest record left unchanged for a permanently-skipped scaffold');
  const row = plan.status.find((r) => r.tool === 'js-ts');
  assert.equal(row.armed, true);
  assert.equal(row.gap, false);
  assert.equal(row.reason, 'user-modified');

  // Even a "version bump" on the library side must NOT resurrect a user-modified scaffold.
  const v2Root = tmpDir('cg-lint-v2-skip-');
  writeF(join(v2Root, 'js-ts', 'eslint.config.js'), `${BASELINE_TEXT}// v2\n`);
  const plan2 = armLint(DETECTED_JS, manifest, { repoRoot: repo, lintDir: v2Root, now: 'T2' });
  assert.equal(plan2.writes.length, 0, 'user-modified scaffold stays permanently skipped regardless of library version');
});

// ---------------------------------------------------------------------------------------------
// SPEC-LINT-001 / SPEC-BASELINE-001 — full sync() pipeline: existing config's fixture file is
// byte-for-byte unchanged AFTER A REAL RUN (not just a computed plan).
// ---------------------------------------------------------------------------------------------

test('sync: full pipeline run leaves an existing eslint.config.js fixture byte-for-byte unchanged, reports read-only recommendation only', async () => {
  // Self-contained asset root: real stacks.json (detection registry, already built in TASK-009)
  // + VERSION, but the js-ts lint baseline is the INJECTED fixture — never assets/lint/.
  const assetRoot = tmpDir('cg-lint-assetroot-');
  copyFileSync(join(REAL_ASSETS, 'stacks.json'), join(assetRoot, 'stacks.json'));
  writeF(join(assetRoot, 'VERSION'), '1.0.0\n');
  mkdirSync(join(assetRoot, 'lint', 'js-ts'), { recursive: true });
  copyFileSync(BASELINE_FILE, join(assetRoot, 'lint', 'js-ts', 'eslint.config.js'));

  const repo = tmpDir('cg-lint-run-');
  writeF(join(repo, 'CLAUDE.md'), '# App\n'); // platform precheck entry file
  // 3+ .js files -> the `javascript` stack (lint: js-ts) is detected (SPEC-DETECT-001 extension
  // threshold, per assets/stacks.json).
  writeF(join(repo, 'index.js'), 'module.exports = {};\n');
  writeF(join(repo, 'lib', 'a.js'), 'exports.a = 1;\n');
  writeF(join(repo, 'lib', 'b.js'), 'exports.b = 1;\n');
  copyFileSync(join(FIXTURES, 'lint-existing', 'eslint.config.js'), join(repo, 'eslint.config.js'));
  const before = readFileSync(join(repo, 'eslint.config.js'), 'utf8');

  const r = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T0' });
  assert.equal(r.exitCode, 0);

  const after = readFileSync(join(repo, 'eslint.config.js'), 'utf8');
  assert.equal(after, before, 'existing eslint.config.js is byte-for-byte unchanged after a real sync run');

  const jsTsRow = r.status.lint.find((row) => row.tool === 'js-ts');
  assert.ok(jsTsRow, 'js-ts baseline appears in the report');
  assert.equal(jsTsRow.armed, false, 'js-ts never armed when a config already exists');
  assert.equal(jsTsRow.gap, false);

  const manifest = JSON.parse(readFileSync(join(repo, '.code-guidelines', 'manifest.json'), 'utf8'));
  assert.ok(
    !manifest.lint.some((l) => l.tool === 'js-ts'),
    'no manifest lint record written for an already-configured tool',
  );
});
