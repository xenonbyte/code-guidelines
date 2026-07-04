// PLAN-TASK-021: structural validation for the whole rule library (assets/library/).
// Closes the Task-9 DEFER: every stacks.json `rules` entry must resolve to a real
// library file (rules entries are bare basenames -> assets/library/<entry>.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const libraryDir = path.join(repoRoot, 'assets', 'library');
const stacksPath = path.join(repoRoot, 'assets', 'stacks.json');

const EXPECTED_FILE_COUNT = 57;
const MAX_LINES = 100;
const REQUIRED_KEYS = ['name', 'description', 'appliesTo', 'stacks', 'source'];

function listLibraryFiles() {
  return fs
    .readdirSync(libraryDir)
    .filter((f) => f.endsWith('.md'))
    .sort();
}

// Minimal frontmatter parser: no eval, only scalar/array values needed here.
function parseFrontmatter(raw, filename) {
  assert.ok(
    raw.startsWith('---\n'),
    `${filename}: must start with YAML frontmatter delimited by "---"`
  );
  const end = raw.indexOf('\n---', 4);
  assert.ok(end !== -1, `${filename}: frontmatter is missing closing "---"`);
  const fmBlock = raw.slice(4, end);
  const body = raw.slice(end + 4);
  const data = {};
  const lines = fmBlock.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    assert.ok(m, `${filename}: unparseable frontmatter line: ${JSON.stringify(line)}`);
    const key = m[1];
    let value = m[2];
    if (value.startsWith('[')) {
      // Array possibly spanning to a closing bracket on the same or later line.
      let arrText = value;
      while (!arrText.includes(']') && i + 1 < lines.length) {
        i += 1;
        arrText += '\n' + lines[i];
      }
      assert.ok(
        arrText.includes(']'),
        `${filename}: frontmatter array for "${key}" never closes with "]"`
      );
      data[key] = JSON.parse(arrText);
    } else {
      // Strip a single layer of surrounding quotes if present.
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      data[key] = value;
    }
    i += 1;
  }
  return { data, body };
}

test('assets/library/ contains exactly 57 .md files', () => {
  const files = listLibraryFiles();
  assert.equal(
    files.length,
    EXPECTED_FILE_COUNT,
    `expected ${EXPECTED_FILE_COUNT} library files, found ${files.length}: ${files.join(', ')}`
  );
});

test('every library file has complete, well-typed frontmatter', () => {
  const files = listLibraryFiles();
  for (const file of files) {
    const full = path.join(libraryDir, file);
    const raw = fs.readFileSync(full, 'utf8');
    const { data } = parseFrontmatter(raw, file);

    for (const key of REQUIRED_KEYS) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(data, key),
        `${file}: frontmatter is missing required key "${key}"`
      );
    }

    const basename = file.slice(0, -3); // strip ".md"
    assert.equal(
      data.name,
      basename,
      `${file}: frontmatter "name" (${JSON.stringify(data.name)}) must equal file basename "${basename}"`
    );

    assert.ok(
      Array.isArray(data.appliesTo) && data.appliesTo.length > 0,
      `${file}: frontmatter "appliesTo" must be a non-empty array`
    );

    assert.ok(
      Array.isArray(data.stacks) && data.stacks.length > 0,
      `${file}: frontmatter "stacks" must be a non-empty array`
    );

    const isOriginal = data.source === 'original';
    const looksLikeRef = typeof data.source === 'string' && data.source.trim().length > 0;
    assert.ok(
      isOriginal || looksLikeRef,
      `${file}: frontmatter "source" must be the literal "original" or a non-empty upstream path+commit reference, got ${JSON.stringify(data.source)}`
    );
  }
});

test('web-perf appliesTo covers frontend template stacks that emit frontend tags', () => {
  const raw = fs.readFileSync(path.join(libraryDir, 'web-perf.md'), 'utf8');
  const { data } = parseFrontmatter(raw, 'web-perf.md');

  for (const glob of ['**/*.astro', '**/*.razor']) {
    assert.ok(
      data.appliesTo.includes(glob),
      `web-perf.md: appliesTo must include ${glob} so frontend-tagged template files trigger the host-block pointer`
    );
  }
});

test('every library file is at most 100 lines', () => {
  const files = listLibraryFiles();
  for (const file of files) {
    const full = path.join(libraryDir, file);
    const raw = fs.readFileSync(full, 'utf8');
    const lineCount = raw.split('\n').length;
    assert.ok(
      lineCount <= MAX_LINES,
      `${file}: has ${lineCount} lines, exceeds the ${MAX_LINES}-line limit`
    );
  }
});

test('every library file orders hard-constraints before ecosystem-idioms', () => {
  // Learn the heading convention from typescript.md, then assert it holds everywhere.
  const referenceFile = 'typescript.md';
  const referenceRaw = fs.readFileSync(path.join(libraryDir, referenceFile), 'utf8');
  const { body: referenceBody } = parseFrontmatter(referenceRaw, referenceFile);
  const hardConstraintsHeadingMatch = referenceBody.match(/^##\s+(.*Hard Constraints.*MUST NOT.*)$/m);
  const idiomsHeadingMatch = referenceBody.match(/^##\s+(.*Ecosystem Idioms.*Conventions.*)$/m);
  assert.ok(
    hardConstraintsHeadingMatch,
    `${referenceFile}: could not learn the "Hard Constraints" heading convention from the reference file`
  );
  assert.ok(
    idiomsHeadingMatch,
    `${referenceFile}: could not learn the "Ecosystem Idioms & Conventions" heading convention from the reference file`
  );
  const hardConstraintsHeadingText = hardConstraintsHeadingMatch[0];
  const idiomsHeadingText = idiomsHeadingMatch[0];

  const files = listLibraryFiles();
  for (const file of files) {
    const full = path.join(libraryDir, file);
    const raw = fs.readFileSync(full, 'utf8');
    const { body } = parseFrontmatter(raw, file);

    const hardConstraintsIndex = body.indexOf(hardConstraintsHeadingText);
    const idiomsIndex = body.indexOf(idiomsHeadingText);

    assert.ok(
      hardConstraintsIndex !== -1,
      `${file}: missing the hard-constraints section heading (${JSON.stringify(hardConstraintsHeadingText)})`
    );
    assert.ok(
      idiomsIndex !== -1,
      `${file}: missing the ecosystem-idioms section heading (${JSON.stringify(idiomsHeadingText)})`
    );
    assert.ok(
      hardConstraintsIndex < idiomsIndex,
      `${file}: hard-constraints section must appear before ecosystem-idioms section (found hard-constraints at offset ${hardConstraintsIndex}, idioms at offset ${idiomsIndex})`
    );
  }
});

test('every stacks.json `rules` entry resolves to an existing library file', () => {
  const stacksRaw = fs.readFileSync(stacksPath, 'utf8');
  const stacksData = JSON.parse(stacksRaw);
  assert.ok(Array.isArray(stacksData.stacks), 'stacks.json must have a top-level "stacks" array');

  for (const stack of stacksData.stacks) {
    assert.ok(
      Array.isArray(stack.rules),
      `stack "${stack.id}": "rules" must be an array`
    );
    for (const ruleEntry of stack.rules) {
      const resolvedPath = path.join(libraryDir, `${ruleEntry}.md`);
      assert.ok(
        fs.existsSync(resolvedPath),
        `stack "${stack.id}": rules entry "${ruleEntry}" does not resolve to an existing file at assets/library/${ruleEntry}.md`
      );
    }
  }
});
