// PLAN-TASK-021: structural validation for the 11 lint baseline sets (assets/lint/).
// Closes the Task-9 DEFER: every non-null stacks.json `lint` key must resolve to a
// real assets/lint/<key>/ directory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const lintDir = path.join(repoRoot, 'assets', 'lint');
const stacksPath = path.join(repoRoot, 'assets', 'stacks.json');

const EXPECTED_SETS = [
  'js-ts',
  'python',
  'go',
  'rust',
  'java',
  'kotlin',
  'swift',
  'csharp',
  'php',
  'ruby',
  'cpp',
];

// Per SPEC-BASELINE-001 (current, non-deprecated formats as of 2026-07-03).
// `contains` entries are literal substrings the file's raw content must include.
const SET_REQUIREMENTS = {
  'js-ts': [
    {
      file: 'eslint.config.mjs',
      contains: ['typescript-eslint', 'parser: tseslint.parser', '@typescript-eslint/no-unused-vars'],
    },
    { file: '.prettierrc' },
    { file: 'tsconfig.json', json: true, contains: ['noUncheckedIndexedAccess'] },
  ],
  python: [
    { file: 'ruff.toml', contains: ['[lint]'] },
    { file: 'mypy.ini' },
  ],
  go: [{ file: '.golangci.yml', contains: ['version: "2"'] }],
  rust: [{ file: 'rustfmt.toml' }, { file: 'clippy.toml' }],
  java: [{ file: 'checkstyle.xml' }],
  kotlin: [{ file: '.editorconfig' }, { file: 'detekt.yml' }],
  swift: [{ file: '.swiftlint.yml', contains: ['only_rules'] }],
  csharp: [{ file: '.editorconfig' }, { file: 'Directory.Build.props' }],
  php: [{ file: '.php-cs-fixer.dist.php' }, { file: 'phpstan.neon' }],
  ruby: [{ file: '.rubocop.yml', contains: ['plugins:'] }],
  cpp: [{ file: '.clang-format' }, { file: '.clang-tidy' }],
};

test('assets/lint/ contains exactly the 11 SPEC-BASELINE-001 sets', () => {
  const dirs = fs
    .readdirSync(lintDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const expectedSorted = [...EXPECTED_SETS].sort();
  assert.deepEqual(
    dirs,
    expectedSorted,
    `assets/lint/ directory set mismatch: found [${dirs.join(', ')}], expected [${expectedSorted.join(', ')}]`
  );
});

for (const lang of EXPECTED_SETS) {
  test(`assets/lint/${lang}/ has the current SPEC-BASELINE-001 filenames and meta.json`, () => {
    const setDir = path.join(lintDir, lang);
    assert.ok(
      fs.existsSync(setDir) && fs.statSync(setDir).isDirectory(),
      `assets/lint/${lang}/ directory is missing`
    );

    const requirements = SET_REQUIREMENTS[lang];
    assert.ok(requirements, `no requirement table entry for lang "${lang}" (test bug)`);

    for (const req of requirements) {
      const fullPath = path.join(setDir, req.file);
      assert.ok(
        fs.existsSync(fullPath),
        `assets/lint/${lang}/${req.file} is missing (SPEC-BASELINE-001 current filename)`
      );
      const raw = fs.readFileSync(fullPath, 'utf8');

      if (req.json) {
        let parsed;
        assert.doesNotThrow(() => {
          parsed = JSON.parse(raw);
        }, `assets/lint/${lang}/${req.file} is not valid JSON`);
        void parsed;
      }

      if (req.contains) {
        for (const needle of req.contains) {
          assert.ok(
            raw.includes(needle),
            `assets/lint/${lang}/${req.file} must contain ${JSON.stringify(needle)}`
          );
        }
      }
    }

    // meta.json must exist and parse as valid JSON for every set.
    const metaPath = path.join(setDir, 'meta.json');
    assert.ok(fs.existsSync(metaPath), `assets/lint/${lang}/meta.json is missing`);
    const metaRaw = fs.readFileSync(metaPath, 'utf8');
    assert.doesNotThrow(() => {
      JSON.parse(metaRaw);
    }, `assets/lint/${lang}/meta.json is not valid JSON`);
  });
}

test('every non-null stacks.json `lint` key resolves to an existing assets/lint/<key>/ directory', () => {
  const stacksRaw = fs.readFileSync(stacksPath, 'utf8');
  const stacksData = JSON.parse(stacksRaw);
  assert.ok(Array.isArray(stacksData.stacks), 'stacks.json must have a top-level "stacks" array');

  for (const stack of stacksData.stacks) {
    if (stack.lint === null || stack.lint === undefined) {
      continue;
    }
    const resolvedDir = path.join(lintDir, stack.lint);
    assert.ok(
      fs.existsSync(resolvedDir) && fs.statSync(resolvedDir).isDirectory(),
      `stack "${stack.id}": lint key "${stack.lint}" does not resolve to an existing directory at assets/lint/${stack.lint}/`
    );
  }
});
