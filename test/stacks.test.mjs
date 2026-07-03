import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// PURE DATA SCHEMA validation only (SPEC-STACKS-001). This file intentionally does
// NOT import sync.mjs and does NOT cross-check rules -> library file existence or
// lint -> baseline directory existence: those files are created by later tasks
// (PLAN-TASK-013..018), and the disk cross-reference gate belongs to PLAN-TASK-021.
// Behavioral golden samples (detection sets, the four-level total order, the
// 12-file cap, monorepo exclusion) belong to PLAN-TASK-010's sync.test.mjs, which
// reuses the fixtures created alongside this file.

const __dirname = dirname(fileURLToPath(import.meta.url));
const STACKS_PATH = join(__dirname, '..', 'assets', 'stacks.json');

const CATEGORY_ENUM = new Set([
  '核心',
  '语言',
  '前端',
  '移动',
  '后端',
  '数据',
  '测试',
  'DevOps',
  '横切',
]);

// The 11 lint baseline keys (Controller Conventions, execution/progress.md).
const LINT_KEYS = new Set([
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
]);

function loadStacks() {
  const raw = readFileSync(STACKS_PATH, 'utf8');
  return JSON.parse(raw);
}

test('stacks.json parses and has a top-level version + stacks array', () => {
  const data = loadStacks();
  assert.equal(typeof data.version, 'string');
  assert.ok(data.version.length > 0, 'version must be non-empty');
  assert.ok(Array.isArray(data.stacks), 'stacks must be an array');
});

test('stacks.json contains exactly 48 stack entries', () => {
  const { stacks } = loadStacks();
  assert.equal(stacks.length, 48);
});

test('every stack id is a non-empty string and unique', () => {
  const { stacks } = loadStacks();
  const ids = stacks.map((s) => s.id);
  for (const id of ids) {
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0, 'id must be non-empty');
  }
  assert.equal(new Set(ids).size, ids.length, 'ids must be unique');
});

test('every stack category is one of the 9-category enum', () => {
  const { stacks } = loadStacks();
  for (const stack of stacks) {
    assert.ok(
      CATEGORY_ENUM.has(stack.category),
      `${stack.id}: unexpected category '${stack.category}'`,
    );
  }
});

test('every stack specificity is an integer', () => {
  const { stacks } = loadStacks();
  for (const stack of stacks) {
    assert.equal(typeof stack.specificity, 'number', `${stack.id}: specificity must be a number`);
    assert.ok(Number.isInteger(stack.specificity), `${stack.id}: specificity must be an integer`);
  }
});

test('exactly one 核心 stack (guardrails-core) and it declares no detect', () => {
  const { stacks } = loadStacks();
  const coreStacks = stacks.filter((s) => s.category === '核心');
  assert.equal(coreStacks.length, 1, 'exactly one 核心 stack expected');
  const [core] = coreStacks;
  assert.equal(core.id, 'guardrails-core');
  assert.ok(
    core.detect === null || core.detect === undefined,
    'guardrails-core must not declare a detect predicate',
  );
});

test('every non-core stack has a well-formed four-predicate detect shape', () => {
  const { stacks } = loadStacks();
  for (const stack of stacks) {
    if (stack.id === 'guardrails-core') continue;

    const { detect } = stack;
    assert.ok(
      detect && typeof detect === 'object' && !Array.isArray(detect),
      `${stack.id}: detect must be a non-null object`,
    );

    let hasActionablePredicate = false;

    if ('files' in detect) {
      assert.ok(Array.isArray(detect.files), `${stack.id}: detect.files must be an array`);
      for (const f of detect.files) {
        assert.equal(typeof f, 'string', `${stack.id}: detect.files entries must be strings`);
        assert.ok(f.length > 0);
      }
      if (detect.files.length > 0) hasActionablePredicate = true;
    }

    if ('packageDeps' in detect) {
      assert.ok(
        Array.isArray(detect.packageDeps),
        `${stack.id}: detect.packageDeps must be an array`,
      );
      for (const dep of detect.packageDeps) {
        assert.equal(typeof dep, 'string', `${stack.id}: detect.packageDeps entries must be strings`);
        assert.ok(dep.length > 0);
      }
      if (detect.packageDeps.length > 0) hasActionablePredicate = true;
    }

    if ('extensions' in detect) {
      assert.ok(
        Array.isArray(detect.extensions),
        `${stack.id}: detect.extensions must be an array`,
      );
      for (const entry of detect.extensions) {
        assert.equal(typeof entry, 'object', `${stack.id}: detect.extensions entries must be objects`);
        assert.ok(!Array.isArray(entry));
        assert.equal(typeof entry.ext, 'string', `${stack.id}: extensions[].ext must be a string`);
        assert.ok(entry.ext.length > 0);
        assert.ok(
          Number.isInteger(entry.minCount) && entry.minCount > 0,
          `${stack.id}: extensions[].minCount must be a positive integer`,
        );
        if ('excludeFiles' in entry) {
          assert.ok(
            Array.isArray(entry.excludeFiles),
            `${stack.id}: extensions[].excludeFiles must be an array`,
          );
          for (const f of entry.excludeFiles) {
            assert.equal(
              typeof f,
              'string',
              `${stack.id}: extensions[].excludeFiles entries must be strings`,
            );
            assert.ok(f.length > 0);
          }
        }
      }
      if (detect.extensions.length > 0) hasActionablePredicate = true;
    }

    if ('tags' in detect) {
      assert.ok(Array.isArray(detect.tags), `${stack.id}: detect.tags must be an array`);
      for (const t of detect.tags) {
        assert.equal(typeof t, 'string', `${stack.id}: detect.tags entries must be strings`);
        assert.ok(t.length > 0);
      }
    }

    if ('requiresTags' in detect) {
      assert.ok(
        Array.isArray(detect.requiresTags),
        `${stack.id}: detect.requiresTags must be an array`,
      );
      for (const t of detect.requiresTags) {
        assert.equal(typeof t, 'string', `${stack.id}: detect.requiresTags entries must be strings`);
        assert.ok(t.length > 0);
      }
      if (detect.requiresTags.length > 0) hasActionablePredicate = true;
    }

    assert.ok(
      hasActionablePredicate,
      `${stack.id}: detect must declare at least one actionable predicate ` +
        '(files/packageDeps/extensions/requiresTags)',
    );
  }
});

test('every stack rules is a non-empty array of strings', () => {
  const { stacks } = loadStacks();
  for (const stack of stacks) {
    assert.ok(Array.isArray(stack.rules), `${stack.id}: rules must be an array`);
    assert.ok(stack.rules.length > 0, `${stack.id}: rules must be non-empty`);
    for (const rule of stack.rules) {
      assert.equal(typeof rule, 'string', `${stack.id}: rules entries must be strings`);
      assert.ok(rule.length > 0);
    }
  }
});

test('every rules entry is one of the 48 stack ids (bare basenames)', () => {
  const { stacks } = loadStacks();
  const ids = new Set(stacks.map((s) => s.id));
  for (const stack of stacks) {
    for (const rule of stack.rules) {
      assert.ok(ids.has(rule), `${stack.id}: rules entry '${rule}' is not one of the 48 stack ids`);
      assert.ok(!rule.endsWith('.md'), `${stack.id}: rules entry '${rule}' must be a bare basename`);
    }
  }
});

test('every stack lint is a string or null', () => {
  const { stacks } = loadStacks();
  for (const stack of stacks) {
    assert.ok(
      stack.lint === null || typeof stack.lint === 'string',
      `${stack.id}: lint must be a string or null`,
    );
  }
});

test('every non-null lint value is one of the 11 baseline keys', () => {
  const { stacks } = loadStacks();
  for (const stack of stacks) {
    if (stack.lint !== null) {
      assert.ok(LINT_KEYS.has(stack.lint), `${stack.id}: lint '${stack.lint}' not in the 11 baseline keys`);
    }
  }
});

test('every requiresTags value is emitted by at least one stack\'s tags (SPEC-DETECT-001 two-pass)', () => {
  const { stacks } = loadStacks();
  const emittedTags = new Set();
  for (const stack of stacks) {
    const detect = stack.detect;
    if (detect && Array.isArray(detect.tags)) {
      for (const t of detect.tags) emittedTags.add(t);
    }
  }
  for (const stack of stacks) {
    const detect = stack.detect;
    if (detect && Array.isArray(detect.requiresTags)) {
      for (const t of detect.requiresTags) {
        assert.ok(
          emittedTags.has(t),
          `${stack.id}: requiresTags '${t}' is never emitted by any stack's tags — ` +
            'SPEC-DETECT-001 two-pass predicate can never resolve',
        );
      }
    }
  }
});
