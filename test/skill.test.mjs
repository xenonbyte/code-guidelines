import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { REGISTRY } from '../src/build/registry.mjs';

// SPEC-TRIGGER-001 structural checks against the committed generated artifacts for all three
// explicit-invocation commands (code-guidelines / -lint / -distill) × four platforms. These are the
// actual shipped files under `generated/`, not a fresh build — the build's byte-for-byte
// self-conformance to `generated/` is covered by test/platform.test.mjs (SPEC-BUILD-001).

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const GENERATED_DIR = join(REPO_ROOT, 'generated');

const GUARD_SNIPPET = 'Explicit-invocation only';

// (command, platform, absolute artifact path, format) derived from the registry.
function artifactCases() {
  const cases = [];
  for (const skill of REGISTRY) {
    for (const [platform, params] of Object.entries(skill.platforms)) {
      cases.push({
        skillId: skill.id,
        platform,
        path: join(GENERATED_DIR, platform, params.generatedFile),
        format: params.format,
      });
    }
  }
  return cases;
}
const CASES = artifactCases();

// Splits a Markdown artifact into { description, body }: description is the frontmatter
// `description:` value (single- or double-quoted), body is everything after the closing `---`.
function splitMarkdownArtifact(text) {
  const fmEnd = text.indexOf('\n---', 3);
  assert.ok(text.startsWith('---') && fmEnd !== -1, 'markdown artifact has a YAML frontmatter fence');
  const frontmatter = text.slice(0, fmEnd);
  const body = text.slice(fmEnd + 4);
  const m = /^description:\s*"([^"]*)"\s*$/m.exec(frontmatter) ?? /^description:\s*'([^']*)'\s*$/m.exec(frontmatter);
  assert.ok(m, 'frontmatter has a description: field');
  return { description: m[1], body };
}

function splitTomlArtifact(text) {
  const m = /^description\s*=\s*'([^']*)'\s*$/m.exec(text);
  assert.ok(m, 'TOML artifact has a top-level description field');
  const promptStart = text.indexOf("prompt = '''");
  assert.ok(promptStart !== -1, 'TOML artifact has a prompt block');
  return { description: m[1], body: text.slice(promptStart) };
}

function parse(c) {
  const text = readFileSync(c.path, 'utf8');
  return c.format === 'toml' ? splitTomlArtifact(text) : splitMarkdownArtifact(text);
}

// ---------------------------------------------------------------------------------------------
// SPEC-TRIGGER-001 — every command's description carries the explicit-invocation negative guard,
// naming its own command.
// ---------------------------------------------------------------------------------------------

for (const c of CASES) {
  test(`skill (${c.skillId}/${c.platform}): description contains the explicit-invocation negative guard for its own command`, () => {
    const { description } = parse(c);
    assert.ok(
      description.includes(GUARD_SNIPPET),
      `${c.skillId}/${c.platform} description must contain "${GUARD_SNIPPET}"; got: ${description}`,
    );
    assert.ok(
      description.includes(`the user types /${c.skillId}.`),
      `${c.skillId}/${c.platform} description must name its own command /${c.skillId}; got: ${description}`,
    );
    assert.match(
      description,
      /never invoke from intent/i,
      `${c.skillId}/${c.platform} description must forbid intent/keyword/side-effect invocation`,
    );
  });
}

// ---------------------------------------------------------------------------------------------
// SPEC-TRIGGER-001 — R2 intentional deviation: no intent-trigger / "when to use" clue section in
// any artifact's body (the negative guard above is the ONLY trigger surface).
// ---------------------------------------------------------------------------------------------

for (const c of CASES) {
  test(`skill (${c.skillId}/${c.platform}): body has NO intent-trigger / "when to use" clue section`, () => {
    const { body } = parse(c);
    assert.doesNotMatch(body, /when to use/i, `${c.skillId}/${c.platform} body must not contain a "when to use" section`);
    assert.doesNotMatch(body, /意图触发/, `${c.skillId}/${c.platform} body must not contain an intent-trigger section`);
    assert.doesNotMatch(body, /何时使用/, `${c.skillId}/${c.platform} body must not contain a "何时使用" section`);
    assert.doesNotMatch(
      body,
      /^##+\s*(when|use\s*cases?|auto[- ]?trigger)/im,
      `${c.skillId}/${c.platform} body must not contain an auto-trigger / use-case heading`,
    );
  });
}

// ---------------------------------------------------------------------------------------------
// SPEC-TRIGGER-001 — only the Claude artifacts hard-disable model invocation
// ---------------------------------------------------------------------------------------------

test('skill: ONLY the Claude artifacts declare disable-model-invocation: true', () => {
  for (const c of CASES) {
    const text = readFileSync(c.path, 'utf8');
    if (c.platform === 'claude') {
      assert.match(text, /^disable-model-invocation:\s*true\s*$/m, `claude ${c.skillId} must set disable-model-invocation: true`);
    } else {
      assert.doesNotMatch(
        text,
        /disable-model-invocation/,
        `${c.platform} ${c.skillId} must NOT mention disable-model-invocation (Claude-only, platform-level hard-disable)`,
      );
    }
  }
});
