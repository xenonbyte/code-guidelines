// test/readme.test.mjs — README/LICENSE/THIRD-PARTY documentation tests (PLAN-TASK-020;
// SPEC-DOC-001). Pins down:
//   1. Both README.md (English) and README.zh-CN.md (Simplified Chinese) exist.
//   2. Their heading structure is aligned: same count and sequence of heading levels (bilingual
//      structural pairing), and the two mandatory sections ("How to use"/"怎么使用" and
//      "When to use"/"什么时候使用") occupy the SAME position in each file's heading sequence.
//   3. Both mandatory sections' required substrings are present verbatim in the right file.
//   4. Both files mention the generated `.code-guidelines/` output and the distill residual risk.
// Agent-authored prose quality is not machine-testable (SPEC-TEST-001); this file only pins
// structure and required-content substrings, per SPEC-DOC-001's "钉住测试" contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');

const README_EN_PATH = join(REPO_ROOT, 'README.md');
const README_ZH_PATH = join(REPO_ROOT, 'README.zh-CN.md');
const LICENSE_PATH = join(REPO_ROOT, 'LICENSE');
const THIRD_PARTY_PATH = join(REPO_ROOT, 'THIRD-PARTY.md');

// Extract `# ...` / `## ...` heading lines in document order, keeping only the heading level
// (number of leading `#`) — content text intentionally discarded here so structural alignment can
// be checked independent of the (different-language) heading text.
function headingLevels(markdown) {
  const lines = markdown.split('\n');
  const levels = [];
  for (const line of lines) {
    const match = /^(#{1,6})\s+\S/.exec(line);
    if (match) levels.push(match[1].length);
  }
  return levels;
}

// Extract heading text lines (level + trimmed text) in document order.
function headings(markdown) {
  const lines = markdown.split('\n');
  const result = [];
  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match) result.push({ level: match[1].length, text: match[2] });
  }
  return result;
}

test('both README.md and README.zh-CN.md exist', () => {
  assert.ok(existsSync(README_EN_PATH), 'README.md must exist');
  assert.ok(existsSync(README_ZH_PATH), 'README.zh-CN.md must exist');
});

test('LICENSE exists and is MIT', () => {
  assert.ok(existsSync(LICENSE_PATH), 'LICENSE must exist');
  const license = readFileSync(LICENSE_PATH, 'utf8');
  assert.match(license, /MIT License/i);
  assert.match(license, /Permission is hereby granted, free of charge/);
});

test('THIRD-PARTY.md exists', () => {
  assert.ok(existsSync(THIRD_PARTY_PATH), 'THIRD-PARTY.md must exist');
});

test('THIRD-PARTY.md contains its key attribution language', () => {
  const thirdParty = readFileSync(THIRD_PARTY_PATH, 'utf8');
  // Pins the substance of the attribution/license wording so silent corruption (e.g. an edit
  // that drops a credited project or its license) is caught, not just the file's existence.
  assert.match(thirdParty, /CC0-1\.0/);
  assert.match(thirdParty, /MIT/);
  assert.match(thirdParty, /awesome-cursorrules/);
  assert.match(thirdParty, /awesome-copilot/);
  assert.match(thirdParty, /original/);
});

test('README heading structure (level sequence) is aligned between EN and ZH', () => {
  const en = readFileSync(README_EN_PATH, 'utf8');
  const zh = readFileSync(README_ZH_PATH, 'utf8');

  const enLevels = headingLevels(en);
  const zhLevels = headingLevels(zh);

  assert.ok(enLevels.length > 0, 'README.md must contain at least one heading');
  assert.deepEqual(
    zhLevels,
    enLevels,
    'README.zh-CN.md heading level sequence must match README.md exactly (same count and nesting, bilingual pairing)'
  );
});

test('"How to use" and "When to use" sections occupy the same position in both READMEs', () => {
  const en = readFileSync(README_EN_PATH, 'utf8');
  const zh = readFileSync(README_ZH_PATH, 'utf8');

  const enHeadings = headings(en);
  const zhHeadings = headings(zh);

  const enHowIndex = enHeadings.findIndex((h) => h.text.includes('How to use'));
  const enWhenIndex = enHeadings.findIndex((h) => h.text.includes('When to use'));
  const zhHowIndex = zhHeadings.findIndex((h) => h.text.includes('怎么使用'));
  const zhWhenIndex = zhHeadings.findIndex((h) => h.text.includes('什么时候使用'));

  assert.notEqual(enHowIndex, -1, 'README.md must have a "How to use" heading');
  assert.notEqual(enWhenIndex, -1, 'README.md must have a "When to use" heading');
  assert.notEqual(zhHowIndex, -1, 'README.zh-CN.md must have a "怎么使用" heading');
  assert.notEqual(zhWhenIndex, -1, 'README.zh-CN.md must have a "什么时候使用" heading');

  assert.equal(
    zhHowIndex,
    enHowIndex,
    'the "How to use"/"怎么使用" heading must be at the same position in both heading sequences'
  );
  assert.equal(
    zhWhenIndex,
    enWhenIndex,
    'the "When to use"/"什么时候使用" heading must be at the same position in both heading sequences'
  );
  // "When to use" must come after "How to use" in both documents (consistent ordering).
  assert.ok(enHowIndex < enWhenIndex, 'README.md: "How to use" must precede "When to use"');
  assert.ok(zhHowIndex < zhWhenIndex, 'README.zh-CN.md: "怎么使用" must precede "什么时候使用"');
});

test('README.md contains required section markers', () => {
  const en = readFileSync(README_EN_PATH, 'utf8');
  assert.match(en, /How to use/);
  assert.match(en, /When to use/);
});

test('README.zh-CN.md contains required section markers', () => {
  const zh = readFileSync(README_ZH_PATH, 'utf8');
  assert.match(zh, /怎么使用/);
  assert.match(zh, /什么时候使用/);
});

test('"When to use" section contains a timing table (explicit invoke vs when NOT to)', () => {
  const en = readFileSync(README_EN_PATH, 'utf8');
  const zh = readFileSync(README_ZH_PATH, 'utf8');

  // A markdown table has a header separator row like "|---|---|---|".
  assert.match(en, /\|---\|---\|---\|/, 'README.md "When to use" section must render a table');
  assert.match(zh, /\|---\|---\|---\|/, 'README.zh-CN.md "什么时候使用" section must render a table');

  // The table must cover both "do invoke" and "do not invoke" guidance.
  assert.match(en, /do not\*\*? invoke|Do \*\*not\*\* invoke/i);
  assert.match(zh, /不要/);
});

test('both READMEs explain the generated .code-guidelines/ output', () => {
  const en = readFileSync(README_EN_PATH, 'utf8');
  const zh = readFileSync(README_ZH_PATH, 'utf8');
  assert.match(en, /\.code-guidelines\//);
  assert.match(zh, /\.code-guidelines\//);
  // Must also explain the managed entry-file block and lint scaffolding, not just the dir name.
  assert.match(en, /manifest\.json/);
  assert.match(zh, /manifest\.json/);
});

test('both READMEs state the R2 intentional deviation (no intent-trigger section, explicit invocation only)', () => {
  const en = readFileSync(README_EN_PATH, 'utf8');
  const zh = readFileSync(README_ZH_PATH, 'utf8');
  assert.match(en, /disable-model-invocation/);
  assert.match(en, /explicit invocation|explicit-invocation/i);
  assert.match(zh, /disable-model-invocation/);
  assert.match(zh, /显式调用/);
});

test('both READMEs state the distill depends-on-agent residual risk', () => {
  const en = readFileSync(README_EN_PATH, 'utf8');
  const zh = readFileSync(README_ZH_PATH, 'utf8');
  assert.match(en, /agent-produced, not machine-verified|not machine-verified/i);
  assert.match(zh, /依赖 agent|残余风险/);
});
