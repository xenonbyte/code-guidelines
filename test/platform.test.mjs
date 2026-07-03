// test/platform.test.mjs — artifact emission tests across all three commands × four platforms
// (SPEC-BUILD-001, SPEC-PLATFORM-001, SPEC-TRIGGER-001). This package emits THREE explicit-
// invocation commands (code-guidelines / -lint / -distill), each its own registry entry, so every
// check here iterates the registry rather than pinning a single skill. Covers:
//   1. Self-conformance: build({ check: true }) reports every artifact byte-identical to committed
//      generated/ (the SPEC-BUILD-001 gate `node src/build/build.mjs --check` also exercises).
//   2. Structural/content invariants per (command, platform): the artifact exists at its registry
//      path; it carries ITS OWN command's negative-invocation guard verbatim; it has the four
//      prose sections; it carries no argument-placeholder plumbing (these commands take no args);
//      disable-model-invocation appears only on Claude; Gemini artifacts are valid TOML.
//   3. Per-platform --platform burn-in on the CORE command's sync.mjs invocation; the lint command
//      references `sync.mjs lint`.
//   4. Determinism: emitPlatform is byte-identical across repeated calls (RISK-DET-001).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { build } from '../src/build/build.mjs';
import { emitPlatform } from '../src/build/platforms.mjs';
import { REGISTRY } from '../src/build/registry.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const GENERATED_DIR = join(REPO_ROOT, 'generated');
const FRAGMENTS_DIR = join(REPO_ROOT, 'fragments');

// Every (command, platform) artifact — path + that command's own guard sentence + params — derived
// from the registry so this test can never drift from what the build actually emits.
function artifactCases() {
  const cases = [];
  for (const skill of REGISTRY) {
    const guard = readFileSync(join(FRAGMENTS_DIR, skill.fragmentsDir, 'triggers.md'), 'utf8').trim();
    for (const [platform, params] of Object.entries(skill.platforms)) {
      cases.push({
        skillId: skill.id,
        platform,
        path: join(GENERATED_DIR, platform, params.generatedFile),
        guard,
        params,
      });
    }
  }
  return cases;
}
const CASES = artifactCases();

/**
 * Parse the narrow TOML shape platforms.mjs emits for Gemini: a single-quoted literal
 * `description = '...'` line followed by a triple-single-quoted literal multi-line
 * `prompt = '''...'''` block, and nothing else. Zero-deps grammar-accurate parser for exactly the
 * two keys this artifact uses, not a general-purpose TOML implementation.
 */
function parseGeminiToml(text) {
  const lines = text.split('\n');
  const descMatch = lines[0]?.match(/^description = '(.*)'$/);
  if (!descMatch) {
    throw new Error(`line 1 is not a valid TOML single-quoted-literal "description": ${lines[0]}`);
  }
  if (lines[1] !== "prompt = '''") {
    throw new Error(`line 2 is not a valid TOML triple-single-quoted-literal "prompt" opener: ${lines[1]}`);
  }
  const closingIdx = lines.indexOf("'''", 2);
  if (closingIdx === -1) {
    throw new Error('prompt triple-single-quoted literal string is never closed with a bare \'\'\' line');
  }
  const trailing = lines.slice(closingIdx + 1).join('\n').trim();
  if (trailing !== '') {
    throw new Error(`unexpected content after the closing '''`);
  }
  return { description: descMatch[1], prompt: lines.slice(2, closingIdx).join('\n') };
}

// --- self-conformance (SPEC-BUILD-001) -------------------------------------------------------

test('self-conformance: build({ check: true }) reports every artifact matching committed generated/', async () => {
  const results = await build({ check: true });
  assert.equal(results.length, 12, 'one artifact per (command, platform): 3 commands × 4 platforms');
  for (const r of results) {
    assert.equal(r.matches, true, `${r.path} does not match a fresh in-memory build`);
  }
});

// --- existence -------------------------------------------------------------------------------

test('every (command, platform) artifact exists on disk at its registry path', () => {
  for (const c of CASES) {
    assert.ok(existsSync(c.path), `missing ${c.skillId}/${c.platform}: ${c.path}`);
  }
});

// --- negative-invocation guard (SPEC-TRIGGER-001) --------------------------------------------

test('every artifact carries ITS OWN command guard sentence verbatim and forbids intent invocation', () => {
  for (const c of CASES) {
    const content = readFileSync(c.path, 'utf8');
    assert.ok(content.includes(c.guard), `${c.skillId}/${c.platform} is missing its own guard sentence`);
    assert.ok(
      content.includes(`the user types /${c.skillId}.`),
      `${c.skillId}/${c.platform} guard must name its own command /${c.skillId}`
    );
    assert.match(content, /never invoke from intent/i, `${c.skillId}/${c.platform} must forbid intent invocation`);
  }
});

// --- prose sections --------------------------------------------------------------------------

test('every artifact has the Purpose / Triggers / Behavior / Output sections', () => {
  for (const c of CASES) {
    const content = readFileSync(c.path, 'utf8');
    for (const heading of ['## Purpose', '## Triggers', '## Behavior', '## Output']) {
      assert.ok(content.includes(heading), `${c.skillId}/${c.platform} is missing ${heading}`);
    }
  }
});

// --- no argument plumbing (these commands take no arguments) ----------------------------------

test('no artifact carries argument-placeholder plumbing or an unsubstituted template token', () => {
  const forbidden = ['$ARGUMENTS', '{{args}}', 'argument-hint', 'the `distill` argument', '{{PLATFORM}}', '{{ARGUMENT_PLACEHOLDER}}'];
  for (const c of CASES) {
    const content = readFileSync(c.path, 'utf8');
    for (const token of forbidden) {
      assert.ok(!content.includes(token), `${c.skillId}/${c.platform} must not contain "${token}"`);
    }
  }
});

// --- disable-model-invocation only on Claude -------------------------------------------------

test('disable-model-invocation appears ONLY on the Claude artifacts', () => {
  for (const c of CASES) {
    const content = readFileSync(c.path, 'utf8');
    if (c.platform === 'claude') {
      assert.ok(content.includes('disable-model-invocation'), `claude ${c.skillId} must set disable-model-invocation`);
    } else {
      assert.ok(
        !content.includes('disable-model-invocation'),
        `${c.platform} ${c.skillId} must NOT contain disable-model-invocation (Claude-only hard-disable)`
      );
    }
  }
});

test('each Claude artifact sets frontmatter name: <command-id>', () => {
  for (const c of CASES.filter((x) => x.platform === 'claude')) {
    const content = readFileSync(c.path, 'utf8');
    assert.match(content, new RegExp(`^name: ${c.skillId}$`, 'm'), `claude ${c.skillId} frontmatter must set name: ${c.skillId}`);
  }
});

// --- Gemini valid TOML -----------------------------------------------------------------------

test('every Gemini artifact is syntactically valid TOML with a non-empty prompt and its guard as description', () => {
  for (const c of CASES.filter((x) => x.platform === 'gemini')) {
    const parsed = parseGeminiToml(readFileSync(c.path, 'utf8'));
    assert.equal(parsed.description, c.guard);
    assert.ok(parsed.prompt.includes('## Purpose'));
    assert.ok(parsed.prompt.includes('## Output'));
  }
});

// --- per-platform --platform burn-in on the CORE command (SPEC-PLATFORM-001, SPEC-SYNC-001) ---

test('core artifacts burn in their OWN literal sync.mjs --platform name, unique per platform', () => {
  const core = CASES.filter((c) => c.skillId === 'code-guidelines');
  const seen = {};
  for (const c of core) {
    const content = readFileSync(c.path, 'utf8');
    assert.ok(
      content.includes(`sync.mjs --platform ${c.platform}`),
      `core/${c.platform} artifact must literally contain "sync.mjs --platform ${c.platform}"`
    );
    const match = content.match(/sync\.mjs --platform (\w+)/);
    assert.ok(match, `core/${c.platform} is missing the sync.mjs --platform invocation entirely`);
    seen[c.platform] = match[1];
  }
  const values = Object.values(seen);
  assert.equal(new Set(values).size, values.length, `--platform token must be unique per platform, got: ${JSON.stringify(seen)}`);
});

test('lint artifacts reference the `sync.mjs lint` command (no --platform)', () => {
  for (const c of CASES.filter((x) => x.skillId === 'code-guidelines-lint')) {
    const content = readFileSync(c.path, 'utf8');
    assert.ok(content.includes('sync.mjs lint'), `lint/${c.platform} must reference "sync.mjs lint"`);
  }
});

// --- determinism (RISK-DET-001) --------------------------------------------------------------

test('emitPlatform: rendering the same context twice is byte-identical (no timestamps/randomness)', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  async function readDir(dir) {
    const names = (await readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .sort();
    const out = {};
    for (const name of names) out[name] = await readFile(join(dir, name), 'utf8');
    return out;
  }
  for (const skill of REGISTRY) {
    const fragments = {
      own: await readDir(join(FRAGMENTS_DIR, skill.fragmentsDir)),
      shared: await readDir(join(FRAGMENTS_DIR, 'shared')),
    };
    for (const [platform, params] of Object.entries(skill.platforms)) {
      const once = emitPlatform({ skill, platform, params, fragments });
      const twice = emitPlatform({ skill, platform, params, fragments });
      assert.equal(once, twice, `${skill.id}/${platform} emission is not deterministic across repeated calls`);
    }
  }
});
