import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  detect,
  select,
  reconcile,
  armLint,
  maintainHostBlock,
  distillRecord,
  sync,
  syncLint,
} from '../assets/sync.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REAL_ASSETS = join(REPO_ROOT, 'assets');
const FIXTURES = join(__dirname, 'fixtures');

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const tmps = [];
function tmpDir(prefix = 'cg-sync-') {
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

// Build a temp asset root: real stacks.json + VERSION + injected library/lint fixtures.
function buildAssetRoot({ library = {}, lint = {}, version = '1.0.0' } = {}) {
  const assetRoot = tmpDir('cg-assets-');
  copyFileSync(join(REAL_ASSETS, 'stacks.json'), join(assetRoot, 'stacks.json'));
  writeF(join(assetRoot, 'VERSION'), `${version}\n`);
  for (const [name, content] of Object.entries(library)) {
    writeF(join(assetRoot, 'library', name), content);
  }
  for (const [tool, files] of Object.entries(lint)) {
    for (const [fn, content] of Object.entries(files)) {
      writeF(join(assetRoot, 'lint', tool, fn), content);
    }
  }
  return assetRoot;
}

function targetManifestPath(repo) {
  return join(repo, '.code-guidelines', 'manifest.json');
}
function readManifest(repo) {
  return JSON.parse(readFileSync(targetManifestPath(repo), 'utf8'));
}

// Recursively snapshot mtimeMs of every file under a dir (for zero-write assertions).
function snapshotMtimes(root) {
  const out = new Map();
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile()) out.set(p, statSync(p).mtimeMs);
    }
  }
  walk(root);
  return out;
}

// ---------------------------------------------------------------------------------------------
// SPEC-DETECT-001 — detection golden samples
// ---------------------------------------------------------------------------------------------

test('detect: detect-go fixture → go (+ always-on core)', () => {
  const hits = detect(join(FIXTURES, 'detect-go'));
  const ids = hits.map((h) => h.id);
  assert.ok(ids.includes('guardrails-core'), 'guardrails-core always detected');
  assert.deepEqual(
    ids.filter((id) => id !== 'guardrails-core'),
    ['go'],
    'only go detected besides core',
  );
});

test('detect: detect-monorepo aggregate scan → react + a11y + security + web-perf via two-pass tag emission', () => {
  const hits = detect(join(FIXTURES, 'detect-monorepo'));
  const ids = hits.map((h) => h.id).filter((id) => id !== 'guardrails-core');
  // react matches via packageDeps (root package.json) and emits the "frontend" tag;
  // a11y and web-perf (both requiresTags:["frontend"]) resolve in pass 2, as does security
  // (requiresTags is OR of ["backend","frontend"] — Task-10 Fix Wave 1 — so a frontend-only repo
  // satisfies it too).
  assert.deepEqual(ids.sort(), ['a11y', 'react', 'security', 'web-perf']);
});

test('detect: excluded dirs (node_modules/dist/…) are NOT scanned', () => {
  const repo = tmpDir('cg-exclude-');
  // Decoys that MUST be ignored:
  writeF(join(repo, 'node_modules', 'go.mod'), 'module decoy\n');
  writeF(join(repo, 'dist', 'a.go'), 'package main\n');
  writeF(join(repo, 'build', 'b.rs'), 'fn main(){}\n');
  writeF(join(repo, 'vendor', 'c.py'), 'x=1\n');
  writeF(join(repo, '.git', 'x.ts'), 'const a=1\n');
  const hits = detect(repo).map((h) => h.id).filter((id) => id !== 'guardrails-core');
  assert.deepEqual(hits, [], 'nothing detected — all matches were inside excluded dirs');
});

test('detect: files predicate treats a DIRECTORY as existing (github-actions → .github/workflows)', () => {
  const repo = tmpDir('cg-gha-');
  mkdirSync(join(repo, '.github', 'workflows'), { recursive: true });
  const ids = detect(repo).map((h) => h.id);
  assert.ok(ids.includes('github-actions'), 'directory .github/workflows counts as existing');
});

test('detect: bare-basename files predicate matches anywhere in the tree (monorepo aggregate)', () => {
  const repo = tmpDir('cg-nested-');
  writeF(join(repo, 'packages', 'svc', 'go.mod'), 'module x\n');
  const ids = detect(repo).map((h) => h.id);
  assert.ok(ids.includes('go'), 'nested go.mod detected via aggregate scan');
});

test('detect: nested-only package.json (no root package.json) is aggregated by scanRepo', () => {
  // Locks in the scanRepo `join(abs, name)` fix for monorepo packageDeps detection: only a
  // subdirectory package.json exists, no root-level one.
  const repo = tmpDir('cg-nested-pkg-');
  writeF(join(repo, 'packages', 'ui', 'package.json'), JSON.stringify({ dependencies: { vue: '^3.4.0' } }));
  const ids = detect(repo).map((h) => h.id);
  assert.ok(ids.includes('vue'), 'vue detected via a nested-only package.json');
  assert.ok(ids.includes('a11y'), 'a11y resolves via the frontend tag emitted by nested vue detection');
});

test('detect: js-only repo with scaffolded tsconfig.json does NOT become TypeScript on rerun', () => {
  const repo = tmpDir('cg-js-tsconfig-only-');
  writeF(join(repo, 'package.json'), JSON.stringify({ name: 'plain-js' }));
  writeF(join(repo, 'index.js'), 'module.exports = {};\n');
  writeF(join(repo, 'lib', 'a.js'), 'exports.a = 1;\n');
  writeF(join(repo, 'lib', 'b.js'), 'exports.b = 1;\n');
  writeF(join(repo, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));

  const ids = detect(repo).map((h) => h.id);
  assert.ok(ids.includes('javascript'), 'javascript still detected from real .js files');
  assert.ok(!ids.includes('typescript'), 'tsconfig.json alone must not trigger the TypeScript stack');
});

test('detect: real tsx source file still detects TypeScript', () => {
  const repo = tmpDir('cg-tsx-');
  writeF(join(repo, 'src', 'App.tsx'), 'export function App() { return null; }\n');

  const ids = detect(repo).map((h) => h.id);
  assert.ok(ids.includes('typescript'), 'tsx source files trigger the TypeScript stack');
});

test('detect: PHP lint scaffolds alone do NOT detect the PHP stack', () => {
  const repo = tmpDir('cg-php-scaffold-only-');
  writeF(join(repo, '.php-cs-fixer.dist.php'), "<?php\nreturn (new PhpCsFixer\\Config());\n");
  writeF(join(repo, 'phpstan.neon'), 'parameters:\n  level: 10\n');

  const ids = detect(repo).map((h) => h.id);
  assert.ok(!ids.includes('php'), 'generated PHP lint scaffolds are not PHP source evidence');
});

test('detect: real PHP source file still detects the PHP stack without composer.json', () => {
  const repo = tmpDir('cg-php-src-');
  writeF(join(repo, 'src', 'index.php'), "<?php\necho 'ok';\n");

  const ids = detect(repo).map((h) => h.id);
  assert.ok(ids.includes('php'), 'real .php source files trigger the PHP stack');
});

for (const ext of ['cc', 'hpp', 'h']) {
  test(`detect: C++ stack recognizes .${ext} files`, () => {
    const repo = tmpDir(`cg-cpp-${ext}-`);
    const content = ext === 'h' ? '#pragma once\n' : 'int main() { return 0; }\n';
    writeF(join(repo, 'src', `sample.${ext}`), content);

    const ids = detect(repo).map((h) => h.id);
    assert.ok(ids.includes('cpp'), `.${ext} files trigger the C++ stack`);
  });
}

// ---------------------------------------------------------------------------------------------
// SPEC-PYDEPS-001 / SPEC-PREDICATE-001 — pythonDeps detection (a)-(g), SPEC-SYNCTEST-001.
// ---------------------------------------------------------------------------------------------

test('detect: (a) bare main.py with no declared deps does NOT detect fastapi nor cascade to security', () => {
  const repo = tmpDir('cg-py-main-only-');
  writeF(join(repo, 'main.py'), '');
  const ids = detect(repo).map((h) => h.id);
  assert.ok(!ids.includes('fastapi'), 'bare main.py alone must not be mistaken for FastAPI');
  assert.ok(!ids.includes('security'), 'no backend tag emitted, so security must not cascade in either');
});

test('detect: (b) pyproject [project].dependencies with fastapi is detected', () => {
  const repo = tmpDir('cg-py-pep621-');
  writeF(join(repo, 'pyproject.toml'), '[project]\ndependencies = ["fastapi"]\n');
  const ids = detect(repo).map((h) => h.id);
  assert.ok(ids.includes('fastapi'), 'fastapi detected via PEP 621 [project].dependencies');
});

test('detect: (c) requirements.txt with Flask is detected (case-insensitive PEP503 normalize)', () => {
  const repo = tmpDir('cg-py-requirements-');
  writeF(join(repo, 'requirements.txt'), 'Flask==3.0\n');
  const ids = detect(repo).map((h) => h.id);
  assert.ok(ids.includes('flask'), 'Flask==3.0 normalizes to flask and is detected');
});

test('detect: (d) poetry dependencies table detects fastapi (python key internally dropped)', () => {
  const repo = tmpDir('cg-py-poetry-');
  writeF(
    join(repo, 'pyproject.toml'),
    '[tool.poetry.dependencies]\npython = "^3.11"\nfastapi = "^0.110"\n',
  );
  const ids = detect(repo).map((h) => h.id);
  assert.ok(ids.includes('fastapi'), 'fastapi detected via [tool.poetry.dependencies] table key');
});

test('detect: (e) PEP621 optional-dependencies detects pytest', () => {
  const repo = tmpDir('cg-py-optional-');
  writeF(join(repo, 'pyproject.toml'), '[project.optional-dependencies]\ndev = ["pytest"]\n');
  const ids = detect(repo).map((h) => h.id);
  assert.ok(ids.includes('pytest'), 'pytest detected via [project.optional-dependencies]');
});

test('detect: (f) malformed pyproject.toml does not throw and does not affect other detection', () => {
  const repo = tmpDir('cg-py-malformed-');
  writeF(join(repo, 'pyproject.toml'), '[project\ndependencies = ["unterminated\n');
  writeF(join(repo, 'package.json'), JSON.stringify({ dependencies: { vue: '^3' } }));
  assert.doesNotThrow(() => detect(repo));
  const ids = detect(repo).map((h) => h.id);
  assert.ok(ids.includes('vue'), 'vue is still detected despite the malformed pyproject.toml alongside it');
});

test('detect: (g) .venv/ is excluded — a fastapi pyproject.toml inside it does not participate', () => {
  const repo = tmpDir('cg-py-venv-excluded-');
  writeF(
    join(repo, '.venv', 'lib', 'site-packages', 'fastapi', 'pyproject.toml'),
    '[project]\ndependencies=["fastapi"]\n',
  );
  const ids = detect(repo).map((h) => h.id);
  assert.ok(!ids.includes('fastapi'), '.venv contents must not participate in detection');
});

test('detect: (h) multi-line array with a non-final extras-qualified entry still detects the later dep (regression)', () => {
  const repo = tmpDir('cg-py-multiline-extras-');
  writeF(
    join(repo, 'pyproject.toml'),
    '[project]\ndependencies = [\n  "uvicorn[standard]",\n  "fastapi",\n]\n',
  );
  const ids = detect(repo).map((h) => h.id);
  assert.ok(
    ids.includes('fastapi'),
    'the "]" inside "uvicorn[standard]" must not prematurely close the multi-line array and drop fastapi',
  );
});

// ---------------------------------------------------------------------------------------------
// SPEC-DETECT-001 — requiresTags is OR (Task-10 Fix Wave 1): security:["backend","frontend"]
// applies to EITHER a backend-only or a frontend-only repo, not only a full-stack one.
// ---------------------------------------------------------------------------------------------

test('detect: requiresTags OR — security applies in a backend-only repo', () => {
  const repo = tmpDir('cg-sec-backend-');
  writeF(join(repo, 'package.json'), JSON.stringify({ dependencies: { express: '^4.19.0' } }));
  const ids = detect(repo).map((h) => h.id);
  assert.ok(ids.includes('node-api'), 'node-api (backend) detected');
  assert.ok(ids.includes('security'), 'security applies via the backend-only OR branch');
  assert.ok(!ids.includes('a11y'), 'a11y (frontend-gated) must NOT apply to a backend-only repo');
});

test('detect: requiresTags OR — security applies in a frontend-only repo', () => {
  const repo = tmpDir('cg-sec-frontend-');
  writeF(join(repo, 'package.json'), JSON.stringify({ dependencies: { react: '^18.2.0' } }));
  const ids = detect(repo).map((h) => h.id);
  assert.ok(ids.includes('react'), 'react (frontend) detected');
  assert.ok(ids.includes('security'), 'security applies via the frontend-only OR branch');
  assert.ok(ids.includes('a11y'), 'a11y also applies (frontend tag)');
});

// ---------------------------------------------------------------------------------------------
// SPEC-SELECT-001 — four-level total order + 12 cap
// ---------------------------------------------------------------------------------------------

function hit(id, category, specificity, index) {
  return { id, category, specificity, index, rules: [id] };
}

test('select: four-level total order (core > framework > language > domain; spec desc; index asc)', () => {
  const hits = [
    hit('domainLow', '横切', 10, 9),
    hit('langA', '语言', 50, 3),
    hit('fw-hi', '前端', 70, 2),
    hit('guardrails-core', '核心', 0, 0),
    hit('fw-lo', '后端', 50, 1),
    hit('fw-tie-late', '移动', 70, 8), // same layer+spec as fw-hi but later index
    hit('domainHi', '测试', 40, 5),
  ];
  const { selected } = select(hits);
  assert.deepEqual(
    selected.map((s) => s.id),
    ['guardrails-core', 'fw-hi', 'fw-tie-late', 'fw-lo', 'langA', 'domainHi', 'domainLow'],
  );
});

test('select: 12-file cap incl. core, truncates lowest priority, reports truncated', () => {
  const hits = [hit('guardrails-core', '核心', 0, 0)];
  // 15 non-core language stacks, descending specificity so index order == priority order.
  for (let i = 0; i < 15; i += 1) {
    hits.push(hit(`lang${i}`, '语言', 100 - i, i + 1));
  }
  const { selected, truncated } = select(hits);
  assert.equal(selected.length, 12, 'cap is 12 including core');
  assert.equal(selected[0].id, 'guardrails-core', 'core stays on top');
  assert.equal(truncated.length, 15 - 11, 'kept 11 non-core, truncated the rest');
  // The truncated ones are the lowest-priority (last by total order): lang11..lang14.
  assert.deepEqual(
    truncated.map((t) => t.id),
    ['lang11', 'lang12', 'lang13', 'lang14'],
  );
});

// ---------------------------------------------------------------------------------------------
// SPEC-RECONCILE-001 — add / upgrade / user-override protection
// ---------------------------------------------------------------------------------------------

const LIB = {
  'guardrails-core.md': '# guardrails-core\nv1 body\n',
  'go.md': '# go\nv1 body\n',
};
const selCoreGo = [{ rules: ['guardrails-core'] }, { rules: ['go'] }];

test('reconcile: fresh repo adds all expected rule files', () => {
  const assetRoot = buildAssetRoot({ library: LIB });
  const repo = tmpDir('cg-recon-');
  const plan = reconcile(selCoreGo, { rules: [], lint: [], conventions: null }, { repoRoot: repo, assetRoot });
  assert.deepEqual(plan.added.map((a) => a.file).sort(), ['go.md', 'guardrails-core.md']);
  assert.equal(plan.writes.length, 2);
  assert.equal(plan.removed.length, 0);
});

test('reconcile: untracked existing rule file is skipped, never overwritten', () => {
  const assetRoot = buildAssetRoot({ library: LIB });
  const repo = tmpDir('cg-recon-untracked-');
  writeF(join(repo, '.code-guidelines', 'go.md'), '# go\nFOREIGN CONTENT\n');

  const plan = reconcile([{ rules: ['go'] }], { rules: [], lint: [], conventions: null }, { repoRoot: repo, assetRoot });

  assert.equal(plan.writes.length, 0, 'no write to an untracked existing rule file');
  assert.deepEqual(plan.skipped, [{ file: 'go.md', reason: 'untracked-existing' }]);
  assert.ok(!plan.nextRules.some((r) => r.file === 'go.md'), 'foreign content is not adopted into the manifest');
});

test('reconcile: user-override (disk hash ≠ manifest) is skipped, never overwritten', () => {
  const assetRoot = buildAssetRoot({ library: LIB });
  const repo = tmpDir('cg-recon-uo-');
  // Manifest says go.md hash = H(v1). Disk has USER-EDITED content.
  const v1hash = hashNormalized(LIB['go.md']);
  writeF(join(repo, '.code-guidelines', 'go.md'), '# go\nUSER EDIT\n');
  const manifest = {
    rules: [{ file: 'go.md', sourceVersion: '1.0.0', sha256: v1hash }],
    lint: [],
    conventions: null,
  };
  const plan = reconcile([{ rules: ['go'] }], manifest, { repoRoot: repo, assetRoot });
  assert.equal(plan.writes.length, 0, 'no write to a user-edited file');
  assert.deepEqual(plan.skipped, [{ file: 'go.md', reason: 'user-override' }]);
});

test('reconcile: upgrade when disk==manifest but library has a new version', () => {
  // library ships v2 of go.md; manifest+disk hold v1 unmodified → upgrade.
  const v1 = '# go\nv1 body\n';
  const v2 = '# go\nv2 body\n';
  const assetRoot = buildAssetRoot({ library: { 'go.md': v2 } });
  const repo = tmpDir('cg-recon-up-');
  writeF(join(repo, '.code-guidelines', 'go.md'), v1);
  const manifest = {
    rules: [{ file: 'go.md', sourceVersion: '1.0.0', sha256: hashNormalized(v1) }],
    lint: [],
    conventions: null,
  };
  const plan = reconcile([{ rules: ['go'] }], manifest, { repoRoot: repo, assetRoot });
  assert.deepEqual(plan.upgraded.map((u) => u.file), ['go.md']);
  assert.equal(plan.writes.length, 1);
  assert.equal(plan.nextRules[0].sha256, hashNormalized(v2));
});

test('reconcile: no-longer-matched unmodified file is removed; project-conventions.md never expected', () => {
  const assetRoot = buildAssetRoot({ library: LIB });
  const repo = tmpDir('cg-recon-rm-');
  const v1 = LIB['go.md'];
  writeF(join(repo, '.code-guidelines', 'go.md'), v1);
  const manifest = {
    rules: [{ file: 'go.md', sourceVersion: '1.0.0', sha256: hashNormalized(v1) }],
    lint: [],
    conventions: null,
  };
  // Expected set is now only core (go no longer selected).
  const plan = reconcile([{ rules: ['guardrails-core'] }], manifest, { repoRoot: repo, assetRoot });
  assert.deepEqual(plan.removed.map((r) => r.file), ['go.md']);
  const expected = plan.nextRules.map((r) => r.file);
  assert.ok(!expected.includes('project-conventions.md'), 'conventions never in expected set');
});

// small local hash mirror so tests don't depend on sync internals (CRLF→LF then sha256)
function hashNormalized(s) {
  return createHash('sha256').update(String(s).replace(/\r\n/g, '\n')).digest('hex');
}

// ---------------------------------------------------------------------------------------------
// SPEC-LINT-001 — first-time arming (three-condition gate), existing-config, at-most-once
// ---------------------------------------------------------------------------------------------

const GO_LINT = { '.golangci.yml': 'version: "2"\nlinters:\n  default: standard\n' };

test('armLint: fresh detect → arms scaffold + reports gap with install command', () => {
  const assetRoot = buildAssetRoot({ lint: { go: GO_LINT } });
  const repo = tmpDir('cg-lint-');
  const detected = [{ id: 'go', lint: 'go' }];
  const plan = armLint(detected, { lint: [] }, { repoRoot: repo, assetRoot, now: 'T0' });
  assert.equal(plan.writes.length, 1);
  assert.equal(plan.nextLint[0].tool, 'go');
  const row = plan.status.find((r) => r.tool === 'go');
  assert.equal(row.armed, true);
  assert.equal(row.gap, true);
  assert.ok(row.installCmd && row.installCmd.includes('golangci-lint'));
});

test('armLint: baseline meta.json is asset metadata, not a repo scaffold', () => {
  const assetRoot = buildAssetRoot({
    lint: {
      go: {
        ...GO_LINT,
        'meta.json': '{"tools":["golangci-lint"],"files":[".golangci.yml"]}\n',
      },
    },
  });
  const repo = tmpDir('cg-lint-meta-');
  const rootMeta = '{"project":"metadata that must stay untouched"}\n';
  writeF(join(repo, 'meta.json'), rootMeta);

  const plan = armLint([{ id: 'go', lint: 'go' }], { lint: [] }, { repoRoot: repo, assetRoot, now: 'T0' });

  assert.deepEqual(
    plan.writes.map((w) => w.absPath.slice(repo.length + 1)).sort(),
    ['.golangci.yml'],
    'only scaffold files are scheduled for target repo writes',
  );
  assert.equal(
    plan.nextLint[0].sha256,
    combinedLintHash(GO_LINT),
    'lint manifest hash excludes asset-only meta.json',
  );

  for (const w of plan.writes) writeF(w.absPath, w.content);
  assert.equal(readFileSync(join(repo, 'meta.json'), 'utf8'), rootMeta, 'root meta.json is not overwritten');
});

test('armLint: ruby install command includes RuboCop plugin gems required by the scaffold', () => {
  const assetRoot = buildAssetRoot({
    lint: { ruby: { '.rubocop.yml': 'plugins:\n  - rubocop-performance\n  - rubocop-rspec\n' } },
  });
  const repo = tmpDir('cg-lint-ruby-');
  const plan = armLint([{ id: 'ruby', lint: 'ruby' }], { lint: [] }, { repoRoot: repo, assetRoot, now: 'T0' });

  const row = plan.status.find((r) => r.tool === 'ruby');
  assert.equal(row.armed, true);
  assert.equal(row.gap, true);
  assert.ok(row.installCmd.includes('rubocop-performance'));
  assert.ok(row.installCmd.includes('rubocop-rspec'));
});

test('armLint: existing config → untouched, no arm, no manifest record', () => {
  const assetRoot = buildAssetRoot({ lint: { go: GO_LINT } });
  const repo = tmpDir('cg-lint-existing-');
  writeF(join(repo, '.golangci.yml'), 'version: "2"\n# user config\n');
  const plan = armLint([{ id: 'go', lint: 'go' }], { lint: [] }, { repoRoot: repo, assetRoot, now: 'T0' });
  assert.equal(plan.writes.length, 0, 'never touch an already-configured tool');
  assert.equal(plan.nextLint.length, 0, 'no manifest record when not armed');
  const row = plan.status.find((r) => r.tool === 'go');
  assert.equal(row.armed, false);
});

test('armLint: at-most-once — armed record + unmodified scaffold → no re-write', () => {
  const assetRoot = buildAssetRoot({ lint: { go: GO_LINT } });
  const repo = tmpDir('cg-lint-once-');
  // scaffold present on disk, matching manifest sha256
  writeF(join(repo, '.golangci.yml'), GO_LINT['.golangci.yml']);
  const armedHash = combinedLintHash(GO_LINT);
  const manifest = { lint: [{ tool: 'go', armedAt: 'T0', sha256: armedHash }] };
  const plan = armLint([{ id: 'go', lint: 'go' }], manifest, { repoRoot: repo, assetRoot });
  assert.equal(plan.writes.length, 0, 'no re-arm when already armed + unmodified');
});

test('armLint: deleted scaffold = opt-out (not revived)', () => {
  const assetRoot = buildAssetRoot({ lint: { go: GO_LINT } });
  const repo = tmpDir('cg-lint-opt-');
  const armedHash = combinedLintHash(GO_LINT);
  const manifest = { lint: [{ tool: 'go', armedAt: 'T0', sha256: armedHash }] };
  const plan = armLint([{ id: 'go', lint: 'go' }], manifest, { repoRoot: repo, assetRoot });
  assert.equal(plan.writes.length, 0, 'deleted scaffold is NOT revived');
  const row = plan.status.find((r) => r.tool === 'go');
  assert.equal(row.optedOut, true);
});

test('armLint: --relint clears marker and re-arms', () => {
  const assetRoot = buildAssetRoot({ lint: { go: GO_LINT } });
  const repo = tmpDir('cg-lint-relint-');
  const armedHash = combinedLintHash(GO_LINT);
  const manifest = { lint: [{ tool: 'go', armedAt: 'T0', sha256: armedHash }] };
  const plan = armLint([{ id: 'go', lint: 'go' }], manifest, { repoRoot: repo, assetRoot, relint: 'go', now: 'T1' });
  assert.equal(plan.writes.length, 1, 'relint re-writes the scaffold');
});

test('armLint: duplicate scaffold target paths do not clobber or double-arm manifests', () => {
  const assetRoot = buildAssetRoot({
    lint: {
      kotlin: { '.editorconfig': 'root = true\n[*.kt]\nktlint_standard = enabled\n', 'detekt.yml': 'config:\n' },
      csharp: { '.editorconfig': 'root = true\n[*.cs]\ndotnet_style_qualification_for_field = false:error\n', 'Directory.Build.props': '<Project />\n' },
    },
  });
  const repo = tmpDir('cg-lint-conflict-');
  const detected = [
    { id: 'kotlin', lint: 'kotlin' },
    { id: 'csharp', lint: 'csharp' },
  ];

  const plan = armLint(detected, { lint: [] }, { repoRoot: repo, assetRoot, now: 'T0' });

  assert.deepEqual(
    plan.writes.map((w) => w.absPath.slice(repo.length + 1)).sort(),
    ['.editorconfig', 'detekt.yml'],
    'the first baseline owns the shared target path; the conflicting baseline is not written',
  );
  assert.deepEqual(plan.nextLint.map((l) => l.tool), ['kotlin'], 'only the actually written baseline is armed');
  const csharpRow = plan.status.find((r) => r.tool === 'csharp');
  assert.equal(csharpRow.armed, false);
  assert.equal(csharpRow.reason, 'path-conflict');
});

// combined lint scaffold hash mirror (matches armLint's combinedHash algorithm)
function combinedLintHash(files) {
  const h = createHash('sha256');
  const entries = Object.entries(files).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  for (const [name, content] of entries) {
    h.update(name).update('\0').update(String(content).replace(/\r\n/g, '\n')).update('\0');
  }
  return h.digest('hex');
}

// ---------------------------------------------------------------------------------------------
// SPEC-HOSTFMT-001 / SPEC-PRECHECK-001 — managed block maintenance
// ---------------------------------------------------------------------------------------------

test('maintainHostBlock: inserts block into an existing entry file, leaves outside untouched', () => {
  const repo = tmpDir('cg-host-');
  writeF(join(repo, 'CLAUDE.md'), '# My Project\n\nSome notes.\n');
  const plan = maintainHostBlock(['CLAUDE.md'], { repoRoot: repo, pointers: ['- read x'] });
  assert.equal(plan.malformed, false);
  assert.equal(plan.writes.length, 1);
  const next = plan.writes[0].content;
  assert.ok(next.startsWith('# My Project\n\nSome notes.\n'), 'existing bytes preserved verbatim');
  assert.ok(next.includes('<!-- code-guidelines:begin -->'));
  assert.ok(next.includes('<!-- code-guidelines:end -->'));
});

test('maintainHostBlock: malformed (duplicate) markers → aborts, zero writes', () => {
  const repo = tmpDir('cg-host-bad-');
  writeF(
    join(repo, 'CLAUDE.md'),
    '<!-- code-guidelines:begin -->\na\n<!-- code-guidelines:end -->\n' +
      '<!-- code-guidelines:begin -->\nb\n<!-- code-guidelines:end -->\n',
  );
  const plan = maintainHostBlock(['CLAUDE.md'], { repoRoot: repo, pointers: ['- x'] });
  assert.equal(plan.malformed, true);
  assert.equal(plan.writes.length, 0);
});

// ---------------------------------------------------------------------------------------------
// SPEC-HOSTFMT-001 — glob-conditioned pointers (Task-10 Fix Wave 1)
// ---------------------------------------------------------------------------------------------

test('sync: host block renders a glob-conditioned pointer for a rule declaring appliesTo, generic fallback otherwise', async () => {
  const REACT_RULE = [
    '---',
    'name: react',
    'description: React rules',
    'appliesTo:',
    '  - "*.tsx"',
    '  - "*.jsx"',
    'stacks: [react]',
    'source: original',
    '---',
    '# React',
    'Body.',
    '',
  ].join('\n');
  const assetRoot = buildAssetRoot({
    library: { 'guardrails-core.md': LIB['guardrails-core.md'], 'react.md': REACT_RULE },
  });
  const repo = tmpDir('cg-hostfmt-glob-');
  writeF(join(repo, 'package.json'), JSON.stringify({ dependencies: { react: '^18.2.0' } }));
  writeF(join(repo, 'CLAUDE.md'), '# App\n');

  const r = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T0' });
  assert.equal(r.exitCode, 0);
  const claudeMd = readFileSync(join(repo, 'CLAUDE.md'), 'utf8');
  assert.ok(
    claudeMd.includes('Before editing `*.tsx`, `*.jsx`, read `.code-guidelines/react.md`.'),
    'react pointer is trigger-conditioned on its declared globs',
  );
  assert.ok(
    claudeMd.includes('Before related edits, read `.code-guidelines/guardrails-core.md`.'),
    'guardrails-core (no appliesTo) falls back to the generic phrasing',
  );
  const blockMatch = claudeMd.match(/<!-- code-guidelines:begin -->[\s\S]*?<!-- code-guidelines:end -->/);
  assert.ok(blockMatch, 'managed block present');
  assert.ok(blockMatch[0].split('\n').length <= 25, 'host block stays within the 25-line budget');
});

// ---------------------------------------------------------------------------------------------
// SPEC-SYNC-001 / SPEC-STATUS-001 — full pipeline
// ---------------------------------------------------------------------------------------------

function goRepo() {
  const repo = tmpDir('cg-go-repo-');
  writeF(join(repo, 'go.mod'), 'module example.com/app\n\ngo 1.22\n');
  writeF(join(repo, 'CLAUDE.md'), '# App\n');
  return repo;
}

test('sync: first run installs; second run is a NO-OP with zero writes and unchanged mtimes', async () => {
  const assetRoot = buildAssetRoot({ library: LIB, lint: { go: GO_LINT } });
  const repo = goRepo();

  const r1 = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T0' });
  assert.equal(r1.exitCode, 0);
  assert.equal(r1.status.upToDate, false);
  assert.ok(existsSync(join(repo, '.code-guidelines', 'go.md')));
  assert.ok(existsSync(join(repo, '.code-guidelines', 'guardrails-core.md')));
  assert.ok(existsSync(targetManifestPath(repo)));
  assert.ok(readFileSync(join(repo, 'CLAUDE.md'), 'utf8').includes('code-guidelines:begin'));
  // Core sync no longer arms lint — that is the separate `/code-guidelines-lint` command.
  assert.equal(existsSync(join(repo, '.golangci.yml')), false, 'core sync does not arm lint');

  const before = snapshotMtimes(repo);
  const r2 = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T9' });
  assert.equal(r2.exitCode, 0);
  assert.equal(r2.status.upToDate, true, 'second run reports up-to-date');
  assert.ok(r2.text.startsWith('已是最新,无变更'), 'no-op core report leads with the up-to-date line');

  const after = snapshotMtimes(repo);
  assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort(), 'no files added/removed');
  for (const [p, m] of before) {
    assert.equal(after.get(p), m, `mtime unchanged: ${p}`);
  }
});

test('lint: no-op run still reports a deleted lint scaffold opt-out in text mode', async () => {
  const assetRoot = buildAssetRoot({ library: LIB, lint: { go: GO_LINT } });
  const repo = goRepo();

  const r1 = await syncLint({ repoRoot: repo, assetRoot, now: 'T0' });
  assert.equal(r1.exitCode, 0);
  rmSync(join(repo, '.golangci.yml'), { force: true });

  const r2 = await syncLint({ repoRoot: repo, assetRoot, now: 'T1' });

  assert.equal(r2.exitCode, 0);
  assert.equal(r2.status.upToDate, true, 'manifest is unchanged (opt-out already recorded state)');
  assert.ok(r2.text.includes('已是最新,无变更'));
  assert.ok(r2.text.includes('lint go: 已退出(用户删除脚手架)'));
  assert.equal(existsSync(join(repo, '.golangci.yml')), false, 'deleted scaffold is not revived');
});

test('sync: no-op run still reports a user-modified managed rule in text mode', async () => {
  const assetRoot = buildAssetRoot({ library: LIB });
  const repo = goRepo();

  const r1 = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T0' });
  assert.equal(r1.exitCode, 0);
  writeF(join(repo, '.code-guidelines', 'go.md'), '# go\nUSER EDIT\n');

  const r2 = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T1' });

  assert.equal(r2.exitCode, 0);
  assert.equal(r2.status.upToDate, true, 'manifest and managed host block are unchanged');
  assert.ok(r2.text.includes('已是最新,无变更'));
  assert.ok(r2.text.includes('跳过: go.md(user-override)'));
  assert.equal(readFileSync(join(repo, '.code-guidelines', 'go.md'), 'utf8'), '# go\nUSER EDIT\n');
});

test('lint: no-op run reports a user-modified lint scaffold in text and json modes', async () => {
  const assetRoot = buildAssetRoot({ library: LIB, lint: { go: GO_LINT } });
  const repo = goRepo();

  const r1 = await syncLint({ repoRoot: repo, assetRoot, now: 'T0' });
  assert.equal(r1.exitCode, 0);
  writeF(join(repo, '.golangci.yml'), `${GO_LINT['.golangci.yml']}# user edit\n`);

  const textResult = await syncLint({ repoRoot: repo, assetRoot, now: 'T1' });
  assert.equal(textResult.exitCode, 0);
  assert.equal(textResult.status.upToDate, true, 'manifest and scaffold records are unchanged');
  assert.ok(textResult.text.includes('lint go: 已布防,跳过(用户修改脚手架)'));
  assert.equal(textResult.status.lint.find((row) => row.tool === 'go').reason, 'user-modified');

  const jsonResult = await syncLint({ repoRoot: repo, assetRoot, json: true, now: 'T2' });
  assert.equal(jsonResult.exitCode, 0);
  assert.equal(jsonResult.json.lint.find((row) => row.tool === 'go').reason, 'user-modified');
});

test('sync: --dry-run computes a plan but writes NOTHING', async () => {
  const assetRoot = buildAssetRoot({ library: LIB, lint: { go: GO_LINT } });
  const repo = goRepo();
  const r = await sync({ platform: 'claude', repoRoot: repo, assetRoot, dryRun: true, now: 'T0' });
  assert.equal(r.exitCode, 0);
  assert.equal(existsSync(join(repo, '.code-guidelines')), false, 'no target dir created');
  assert.equal(existsSync(join(repo, '.golangci.yml')), false, 'no scaffold written');
  assert.ok(!readFileSync(join(repo, 'CLAUDE.md'), 'utf8').includes('code-guidelines:begin'));
});

test('sync: --json emits the SPEC-STATUS-001 structured shape', async () => {
  const assetRoot = buildAssetRoot({ library: LIB, lint: { go: GO_LINT } });
  const repo = goRepo();
  const r = await sync({ platform: 'claude', repoRoot: repo, assetRoot, json: true, now: 'T0' });
  const o = r.json;
  // Core sync's JSON no longer carries `lint` — that moved to the `/code-guidelines-lint` command.
  for (const k of ['upToDate', 'added', 'removed', 'upgraded', 'skipped', 'conventions', 'exitCode']) {
    assert.ok(k in o, `json has key ${k}`);
  }
  assert.ok(!('lint' in o), 'core sync json must not carry a lint field');
  assert.equal(typeof o.upToDate, 'boolean');
  assert.ok(Array.isArray(o.added));
  assert.equal(typeof o.conventions.present, 'boolean');
  assert.equal(o.exitCode, 0);
});

test('sync: no-arg run neither writes nor references project-conventions.md (not in expected set)', async () => {
  const assetRoot = buildAssetRoot({ library: LIB, lint: { go: GO_LINT } });
  const repo = goRepo();
  await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T0' });
  assert.equal(
    existsSync(join(repo, '.code-guidelines', 'project-conventions.md')),
    false,
    'sync never creates project-conventions.md',
  );
  const manifest = readManifest(repo);
  assert.equal(manifest.conventions, null, 'conventions stays null under no-arg sync');
  assert.ok(
    !manifest.rules.some((r) => r.file === 'project-conventions.md'),
    'conventions not tracked as a rule',
  );
});

test('sync: preserves an existing manifest.conventions untouched across a rules change', async () => {
  const assetRoot = buildAssetRoot({ library: LIB, lint: { go: GO_LINT } });
  const repo = goRepo();
  // Pre-seed a manifest carrying conventions but no rules yet.
  const seeded = {
    version: '1.0.0',
    rules: [],
    lint: [],
    conventions: { sha256: 'deadbeef', distilledAt: '2026-01-01T00:00:00.000Z' },
  };
  writeF(targetManifestPath(repo), `${JSON.stringify(seeded, null, 2)}\n`);
  await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T0' });
  const after = readManifest(repo);
  assert.ok(after.rules.length > 0, 'rules were reconciled');
  assert.deepEqual(after.conventions, seeded.conventions, 'conventions preserved byte-for-byte');
});

test('sync: precheck — missing current-platform entry file → exit 3, zero writes', async () => {
  const assetRoot = buildAssetRoot({ library: LIB, lint: { go: GO_LINT } });
  const repo = tmpDir('cg-precheck-');
  writeF(join(repo, 'go.mod'), 'module x\n');
  // No CLAUDE.md, but an AGENTS.md exists (a DIFFERENT platform's file) — still must abort.
  writeF(join(repo, 'AGENTS.md'), '# agents\n');
  const r = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T0' });
  assert.equal(r.exitCode, 3);
  assert.ok(r.text.includes('claude') && r.text.includes('CLAUDE.md'));
  assert.equal(existsSync(join(repo, '.code-guidelines')), false, 'zero writes on precheck abort');
});

test('sync: malformed host-block marker → exit 4, zero writes (host file bytes untouched)', async () => {
  const assetRoot = buildAssetRoot({ library: LIB, lint: { go: GO_LINT } });
  const repo = tmpDir('cg-malformed-');
  writeF(join(repo, 'go.mod'), 'module x\n');
  const claudeMdPath = join(repo, 'CLAUDE.md');
  const originalClaudeMd = '<!-- code-guidelines:begin -->\norphaned begin with no end\n';
  writeF(claudeMdPath, originalClaudeMd);
  const r = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T0' });
  assert.equal(r.exitCode, 4);
  assert.equal(existsSync(join(repo, '.code-guidelines')), false, 'zero writes on malformed marker');
  assert.equal(
    readFileSync(claudeMdPath, 'utf8'),
    originalClaudeMd,
    'CLAUDE.md own bytes are byte-for-byte unchanged, not just .code-guidelines absent',
  );
});

test('sync: malformed target manifest → exit 4, existing .code-guidelines files are not overwritten', async () => {
  const assetRoot = buildAssetRoot({ library: LIB, lint: { go: GO_LINT } });
  const repo = goRepo();
  const userRulePath = join(repo, '.code-guidelines', 'go.md');
  const malformedManifestPath = targetManifestPath(repo);
  writeF(userRulePath, '# go\nUSER EDIT THAT MUST SURVIVE\n');
  writeF(malformedManifestPath, '{ not json');
  const before = snapshotMtimes(repo);

  const r = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T0' });

  assert.equal(r.exitCode, 4);
  assert.match(r.text, /manifest/);
  assert.equal(
    readFileSync(userRulePath, 'utf8'),
    '# go\nUSER EDIT THAT MUST SURVIVE\n',
    'existing rule file left byte-for-byte unchanged',
  );
  assert.equal(readFileSync(malformedManifestPath, 'utf8'), '{ not json', 'bad manifest left untouched');
  assert.equal(existsSync(join(repo, '.golangci.yml')), false, 'lint scaffold not written after abort');
  const after = snapshotMtimes(repo);
  assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort(), 'no files added/removed');
  for (const [p, m] of before) {
    assert.equal(after.get(p), m, `mtime unchanged: ${p}`);
  }
});

test('sync: symlink at a write ancestor (.code-guidelines) → exit 4, zero writes', async () => {
  const assetRoot = buildAssetRoot({ library: LIB, lint: { go: GO_LINT } });
  const repo = goRepo();
  const outside = tmpDir('cg-outside-');
  symlinkSync(outside, join(repo, '.code-guidelines'));
  const r = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T0' });
  assert.equal(r.exitCode, 4);
  // The symlink target must be empty — nothing written through the symlink.
  assert.deepEqual(readdirSync(outside), [], 'no files written through the symlink');
  assert.ok(lstatSync(join(repo, '.code-guidelines')).isSymbolicLink(), 'symlink not replaced');
});

test('sync: symlink at a write TARGET (leaf rule file, not just the .code-guidelines ancestor) → exit 4, zero disk change', async () => {
  const assetRoot = buildAssetRoot({ library: LIB, lint: { go: GO_LINT } });
  const repo = goRepo();
  const outside = tmpDir('cg-outside-leaf-');
  const outsideFile = join(outside, 'evil-target.md');
  writeF(outsideFile, 'ORIGINAL OUTSIDE CONTENT\n');
  // .code-guidelines itself is a REAL directory (not a symlink); only the leaf go.md is a symlink.
  mkdirSync(join(repo, '.code-guidelines'), { recursive: true });
  symlinkSync(outsideFile, join(repo, '.code-guidelines', 'go.md'));

  const before = snapshotMtimes(repo);
  const r = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T0' });
  assert.equal(r.exitCode, 4);
  assert.equal(
    readFileSync(outsideFile, 'utf8'),
    'ORIGINAL OUTSIDE CONTENT\n',
    'outside target left untouched through the leaf symlink',
  );
  assert.ok(lstatSync(join(repo, '.code-guidelines', 'go.md')).isSymbolicLink(), 'leaf symlink not replaced');
  assert.equal(existsSync(targetManifestPath(repo)), false, 'manifest never written (zero disk change)');
  const after = snapshotMtimes(repo);
  assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort(), 'no other files added/removed');
});

// ---------------------------------------------------------------------------------------------
// SPEC-SYNC-001 — commit-phase ordering + error handling (Task-10 Fix Wave 1, review §1): the
// manifest must be written LAST, only after all writes/removals succeed, so a mid-commit removal
// failure never orphans a file that the manifest has already stopped tracking.
// ---------------------------------------------------------------------------------------------

test('sync: removal failure mid-commit → defined exit code, manifest NOT rewritten to drop a file still on disk (no orphan)', async () => {
  const assetRoot = buildAssetRoot({ library: LIB, lint: { go: GO_LINT } });
  const repo = goRepo();

  // First run: installs go.md, tracked in the manifest.
  const r1 = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T0' });
  assert.equal(r1.exitCode, 0);
  assert.ok(existsSync(join(repo, '.code-guidelines', 'go.md')));

  // Remove go.mod so `go` is no longer detected → go.md becomes a pending removal.
  rmSync(join(repo, 'go.mod'), { force: true });

  // Deny write permission on the containing directory so unlink(go.md) fails with EACCES, while
  // the directory itself stays lstat-able (search bit kept) so the fs-safety pre-check still passes
  // and only the actual removal fails.
  const targetDir = join(repo, '.code-guidelines');
  chmodSync(targetDir, 0o555);
  let r2;
  try {
    r2 = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T1' });
  } finally {
    chmodSync(targetDir, 0o755); // restore so assertions/cleanup below can read/write again
  }

  assert.equal(r2.exitCode, 4, 'removal failure maps to a DEFINED exit code, not an uncaught throw');
  assert.ok(
    existsSync(join(repo, '.code-guidelines', 'go.md')),
    'go.md is still physically present (the removal failed)',
  );
  const manifestAfterFailure = readManifest(repo);
  assert.ok(
    manifestAfterFailure.rules.some((r) => r.file === 'go.md'),
    'manifest was NOT rewritten to drop go.md while it still exists on disk (no orphan)',
  );

  // A subsequent clean run (obstruction cleared) must still see go.md as pending removal — never
  // falsely report up-to-date while an untracked, un-cleaned-up file lingers.
  const r3 = await sync({ platform: 'claude', repoRoot: repo, assetRoot, now: 'T2' });
  assert.equal(r3.exitCode, 0);
  assert.equal(r3.status.upToDate, false, 'pending go.md removal must not be reported as up-to-date');
  assert.equal(
    existsSync(join(repo, '.code-guidelines', 'go.md')),
    false,
    'go.md is finally removed once the obstruction is gone',
  );
});

test('sync: unknown platform → exit 2 usage', async () => {
  const assetRoot = buildAssetRoot({ library: LIB });
  const repo = goRepo();
  const r = await sync({ platform: 'bogus', repoRoot: repo, assetRoot });
  assert.equal(r.exitCode, 2);
});

// ---------------------------------------------------------------------------------------------
// SPEC-DISTILL-001 — deterministic distill-record seam
// ---------------------------------------------------------------------------------------------

test('distillRecord: writes conventions the first time', () => {
  const repo = tmpDir('cg-distill-');
  writeF(targetManifestPath(repo), `${JSON.stringify({ version: '1.0.0', rules: [], lint: [], conventions: null }, null, 2)}\n`);
  const conv = join(repo, '.code-guidelines', 'project-conventions.md');
  writeF(conv, '# Conventions\n- always X (a.ts, b.ts)\n');
  const res = distillRecord('.code-guidelines/project-conventions.md', { repoRoot: repo, now: 'D0' });
  assert.equal(res.ok, true);
  const m = readManifest(repo);
  assert.equal(m.conventions.sha256, hashNormalized('# Conventions\n- always X (a.ts, b.ts)\n'));
  assert.equal(m.conventions.distilledAt, 'D0');
});

test('distillRecord: REFUSES on hash mismatch without --force (prints old/new), leaves manifest', () => {
  const repo = tmpDir('cg-distill-refuse-');
  const conv = join(repo, '.code-guidelines', 'project-conventions.md');
  writeF(conv, '# NEW conventions\n');
  const seeded = {
    version: '1.0.0',
    rules: [],
    lint: [],
    conventions: { sha256: 'oldhash1234', distilledAt: 'D-old' },
  };
  writeF(targetManifestPath(repo), `${JSON.stringify(seeded, null, 2)}\n`);
  const res = distillRecord(conv, { repoRoot: repo, now: 'D1' });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'hash-mismatch');
  assert.equal(res.oldHash, 'oldhash1234');
  assert.ok(res.newHash && res.newHash !== 'oldhash1234');
  assert.deepEqual(readManifest(repo).conventions, seeded.conventions, 'manifest untouched on refusal');
});

test('distillRecord: --force overrides a mismatched hash', () => {
  const repo = tmpDir('cg-distill-force-');
  const conv = join(repo, '.code-guidelines', 'project-conventions.md');
  writeF(conv, '# NEW conventions\n');
  const seeded = {
    version: '1.0.0',
    rules: [],
    lint: [],
    conventions: { sha256: 'oldhash1234', distilledAt: 'D-old' },
  };
  writeF(targetManifestPath(repo), `${JSON.stringify(seeded, null, 2)}\n`);
  const res = distillRecord(conv, { repoRoot: repo, force: true, now: 'D2' });
  assert.equal(res.ok, true);
  const m = readManifest(repo);
  assert.equal(m.conventions.sha256, hashNormalized('# NEW conventions\n'));
  assert.equal(m.conventions.distilledAt, 'D2');
});
