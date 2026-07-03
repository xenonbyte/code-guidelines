import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// SPEC-TRIGGER-001 structural checks against the 4 committed generated artifacts. These are the
// actual shipped files under `generated/`, not a fresh build — the build's byte-for-byte
// self-conformance to `generated/` is covered by test/platform.test.mjs (SPEC-BUILD-001).

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const GUARD_SNIPPET = 'Explicit-invocation only';

const ARTIFACTS = {
  claude: join(REPO_ROOT, 'generated', 'claude', 'SKILL.md'),
  codex: join(REPO_ROOT, 'generated', 'codex', 'code-guidelines.md'),
  opencode: join(REPO_ROOT, 'generated', 'opencode', 'code-guidelines.md'),
  gemini: join(REPO_ROOT, 'generated', 'gemini', 'code-guidelines.toml'),
};

function readArtifact(platform) {
  return readFileSync(ARTIFACTS[platform], 'utf8');
}

// Splits a Markdown artifact into { description, body }: description is the frontmatter
// `description:` value (YAML string, single- or double-quoted), body is everything after the
// closing `---` frontmatter fence. For the Gemini TOML artifact, description is the top-level
// `description = '...'` value and body is the `prompt = '''...'''` block.
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
  const body = text.slice(promptStart);
  return { description: m[1], body };
}

const PARSED = {
  claude: splitMarkdownArtifact(readArtifact('claude')),
  codex: splitMarkdownArtifact(readArtifact('codex')),
  opencode: splitMarkdownArtifact(readArtifact('opencode')),
  gemini: splitTomlArtifact(readArtifact('gemini')),
};

// ---------------------------------------------------------------------------------------------
// SPEC-TRIGGER-001 — every platform's description carries the explicit-invocation negative guard
// ---------------------------------------------------------------------------------------------

for (const platform of Object.keys(ARTIFACTS)) {
  test(`skill (${platform}): description contains the explicit-invocation negative guard`, () => {
    const { description } = PARSED[platform];
    assert.ok(
      description.includes(GUARD_SNIPPET),
      `${platform} description must contain "${GUARD_SNIPPET}"; got: ${description}`,
    );
    assert.match(
      description,
      /never invoke from intent/i,
      `${platform} description must forbid intent/keyword/side-effect invocation`,
    );
  });
}

// ---------------------------------------------------------------------------------------------
// SPEC-TRIGGER-001 — R2 intentional deviation: no intent-trigger / "when to use" clue section in
// any artifact's body (the negative guard above is the ONLY trigger surface).
// ---------------------------------------------------------------------------------------------

for (const platform of Object.keys(ARTIFACTS)) {
  test(`skill (${platform}): body has NO intent-trigger / "when to use" clue section`, () => {
    const { body } = PARSED[platform];
    assert.doesNotMatch(body, /when to use/i, `${platform} body must not contain a "when to use" section`);
    assert.doesNotMatch(body, /意图触发/, `${platform} body must not contain an intent-trigger (意图触发) section`);
    assert.doesNotMatch(body, /何时使用/, `${platform} body must not contain a "何时使用" section`);
    assert.doesNotMatch(
      body,
      /^##+\s*(when|use\s*cases?|auto[- ]?trigger)/im,
      `${platform} body must not contain an auto-trigger / use-case heading`,
    );
  });
}

// ---------------------------------------------------------------------------------------------
// SPEC-TRIGGER-001 — only the Claude artifact hard-disables model invocation
// ---------------------------------------------------------------------------------------------

test('skill: ONLY the Claude artifact (generated/claude/SKILL.md) declares disable-model-invocation: true', () => {
  const claudeText = readArtifact('claude');
  assert.match(
    claudeText,
    /^disable-model-invocation:\s*true\s*$/m,
    'claude SKILL.md frontmatter has disable-model-invocation: true',
  );

  for (const platform of ['codex', 'opencode', 'gemini']) {
    const text = readArtifact(platform);
    assert.doesNotMatch(
      text,
      /disable-model-invocation/,
      `${platform} artifact must NOT mention disable-model-invocation (Claude-only, platform-level hard-disable)`,
    );
  }
});
