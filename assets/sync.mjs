#!/usr/bin/env node
// assets/sync.mjs — zero-dependency, single-file sync engine (SPEC-SYNC-001 .. SPEC-STATUS-001,
// SPEC-DETECT-001, SPEC-SELECT-001, SPEC-RECONCILE-001, SPEC-LINT-001, SPEC-PRECHECK-001,
// SPEC-HOSTFMT-001, SPEC-MANIFEST-001, SPEC-DISTILL-001).
//
// DESIGN-FORCED STANDALONE: this file ships inside the shared assets (~/.code-guidelines/) and
// runs inside arbitrary TARGET repos with NO install step. It therefore MUST NOT import anything
// from src/* or any relative path. All fs-safety (lstat symlink rejection at target + every
// ancestor, path confinement, atomic temp-file + rename) and sha256 (CRLF->LF normalized) are
// inlined here — deliberately duplicating src/install/fsutil.mjs rather than importing it.
//
// Exit codes (shared with the CLI, SPEC-CLI-001): 0 ok / 2 usage / 3 precheck-abort (current
// platform entry file missing) / 4 conflict-or-safety (fs-safety/symlink reject, or
// malformed/duplicate/orphan host-block marker).

import { createHash, randomBytes } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ASSET_ROOT = dirname(fileURLToPath(import.meta.url));

// Fixed platform -> repo-root entry file mapping (SPEC-PRECHECK-001).
const PLATFORM_ENTRY = {
  claude: 'CLAUDE.md',
  codex: 'AGENTS.md',
  opencode: 'AGENTS.md',
  gemini: 'GEMINI.md',
};
// All entry-doc filenames whose managed block is maintained when present at repo root.
const ENTRY_FILES = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'];

const EXCLUDED_DIRS = new Set(['node_modules', 'vendor', 'dist', 'build', '.git']);

const BLOCK_BEGIN = '<!-- code-guidelines:begin -->';
const BLOCK_END = '<!-- code-guidelines:end -->';

// category -> specificity layer (SPEC-SELECT-001). Lower rank = higher retention priority.
const LAYER_BY_CATEGORY = {
  核心: -1, // guardrails-core: always top, never truncated
  前端: 0,
  移动: 0,
  后端: 0, // framework layer
  语言: 1, // language layer
  数据: 2,
  测试: 2,
  DevOps: 2,
  横切: 2, // domain layer
};

const RULE_CAP = 12; // rule-file cap INCLUDING guardrails-core (SPEC-SELECT-001)

// The 11 lint baselines: existing-config probe filenames (current + common historical names,
// SPEC-BASELINE-001). Any hit => tool already configured => never arm.
const LINT_PROBE_FILES = {
  'js-ts': [
    'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts',
    '.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml',
    '.eslintrc.yaml', '.prettierrc', '.prettierrc.json', '.prettierrc.yml', '.prettierrc.yaml',
    '.prettierrc.js', '.prettierrc.cjs', 'prettier.config.js', 'prettier.config.cjs',
    'tsconfig.json',
  ],
  python: ['ruff.toml', '.ruff.toml', 'mypy.ini', '.mypy.ini', 'setup.cfg'],
  go: ['.golangci.yml', '.golangci.yaml', '.golangci.toml', '.golangci.json'],
  rust: ['rustfmt.toml', '.rustfmt.toml', 'clippy.toml', '.clippy.toml'],
  java: ['checkstyle.xml', 'config/checkstyle/checkstyle.xml'],
  kotlin: ['.editorconfig', 'detekt.yml', 'detekt.yaml', 'config/detekt/detekt.yml'],
  swift: ['.swiftlint.yml', '.swiftlint.yaml'],
  csharp: ['.editorconfig', 'Directory.Build.props'],
  php: [
    '.php-cs-fixer.dist.php', '.php-cs-fixer.php', '.php_cs', '.php_cs.dist',
    'phpstan.neon', 'phpstan.neon.dist',
  ],
  ruby: ['.rubocop.yml', '.rubocop.yaml'],
  cpp: ['.clang-format', '.clang-tidy', '_clang-format'],
};

// Exact install commands to print (deps are NEVER auto-installed, SPEC-LINT-001 / SCOPE-OUT-003).
const LINT_INSTALL_CMD = {
  'js-ts': 'npm install -D eslint prettier typescript',
  python: 'pip install ruff mypy',
  go: 'go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest',
  rust: 'rustup component add clippy rustfmt',
  java: 'add the Checkstyle plugin to your Maven/Gradle build',
  kotlin: 'add the ktlint and detekt plugins to your Gradle build',
  swift: 'brew install swiftlint',
  csharp: 'enable Roslyn analyzers via <AnalysisLevel>latest-all</AnalysisLevel>',
  php: 'composer require --dev friendsofphp/php-cs-fixer phpstan/phpstan',
  ruby: 'gem install rubocop',
  cpp: 'install clang-format and clang-tidy from LLVM',
};
const LINT_KEYS = new Set(Object.keys(LINT_PROBE_FILES));

// ---------------------------------------------------------------------------------------------
// Inlined fs-safety + hashing (mirror of src/install/fsutil.mjs; DES-FSSAFE-001, DECISION-004).
// ---------------------------------------------------------------------------------------------

/** sha256 of content after CRLF->LF normalization, so line-ending differences alone are never
 * mistaken for a user edit (DECISION-004). */
function sha256Normalized(buf) {
  return createHash('sha256').update(String(buf).replace(/\r\n/g, '\n')).digest('hex');
}

/** Assert `targetPath` is safe: lexically confined to an allowed root, and neither the target
 * nor any ancestor (from the matched root down, inclusive) is a symlink. Throws on violation. */
function assertSafeTarget(targetPath, allowedRoots) {
  const resolvedTarget = resolve(targetPath);
  const resolvedRoots = allowedRoots.map((root) => resolve(root));
  const matchedRoot = resolvedRoots.find(
    (root) => resolvedTarget === root || resolvedTarget.startsWith(root + sep),
  );
  if (!matchedRoot) {
    throw new Error(`sync: path escapes allowed roots: ${targetPath}`);
  }
  const rel = relative(matchedRoot, resolvedTarget);
  const segments = rel === '' ? [] : rel.split(sep);
  let current = matchedRoot;
  const chain = [current];
  for (const segment of segments) {
    current = join(current, segment);
    chain.push(current);
  }
  for (const candidate of chain) {
    let stats;
    try {
      stats = lstatSync(candidate);
    } catch (err) {
      if (err.code === 'ENOENT') break; // nothing here yet; safe to create
      throw err;
    }
    if (stats.isSymbolicLink()) {
      throw new Error(`sync: refusing to operate through a symlink: ${candidate}`);
    }
  }
}

/** Write atomically via a temp file in the same directory + rename. */
function atomicWriteFile(path, content) {
  const dir = dirname(path);
  const tmp = join(dir, `.${randomBytes(8).toString('hex')}.tmp`);
  try {
    writeFileSync(tmp, content);
    renameSync(tmp, path);
  } catch (err) {
    try {
      rmSync(tmp, { force: true });
    } catch {
      /* ignore cleanup failure */
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------------------------
// Asset access
// ---------------------------------------------------------------------------------------------

function loadStacks(assetRoot) {
  const p = join(assetRoot ?? DEFAULT_ASSET_ROOT, 'stacks.json');
  return JSON.parse(readFileSync(p, 'utf8'));
}

function readVersion(assetRoot) {
  try {
    return readFileSync(join(assetRoot ?? DEFAULT_ASSET_ROOT, 'VERSION'), 'utf8').trim();
  } catch {
    return '0.0.0';
  }
}

function readIfExists(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function loadTargetManifest(repoRoot) {
  const raw = readIfExists(join(repoRoot, '.code-guidelines', 'manifest.json'));
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// SPEC-DETECT-001: repo scan + four-predicate two-pass detection (PURE, deterministic).
//
// AND/OR SEMANTICS (pinned here, documented per Task-9 DEFER):
//   * within a `files` list      -> OR (any listed path exists; a DIRECTORY counts as existing)
//   * within a `packageDeps` list -> OR (any listed dep present in any package.json)
//   * within an `extensions` list -> OR (any {ext,minCount} threshold met across the repo)
//   * ACROSS the three populated non-requiresTags predicate types -> OR (any type matching = base hit)
//   * `requiresTags` -> AND gate: EVERY required tag must have been emitted by a pass-1 hit
//   A stack matches iff (baseMatch) AND (all requiresTags satisfied). A stack whose only
//   populated predicate is requiresTags has baseMatch == true (gated solely by requiresTags).
//   Two passes: pass 1 evaluates non-requiresTags stacks and collects their emitted `tags`;
//   pass 2 evaluates requiresTags-bearing stacks against those tags (e.g. a11y<-frontend,
//   python-ml<-python). guardrails-core (detect==null) always matches.
// ---------------------------------------------------------------------------------------------

function scanRepo(repoRoot) {
  const fileRelPaths = new Set();
  const dirRelPaths = new Set();
  const fileBasenames = new Set();
  const extCounts = new Map();
  const packageJsons = [];

  const stack = [''];
  while (stack.length) {
    const rel = stack.pop();
    const abs = rel === '' ? repoRoot : join(repoRoot, rel);
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const name = ent.name;
      const childRel = rel === '' ? name : `${rel}/${name}`;
      // Symlinks: isDirectory()/isFile() are false for symlinks, so they are naturally skipped
      // (we never follow them during detection).
      if (ent.isDirectory()) {
        if (EXCLUDED_DIRS.has(name)) continue;
        dirRelPaths.add(childRel);
        stack.push(childRel);
      } else if (ent.isFile()) {
        fileRelPaths.add(childRel);
        fileBasenames.add(name);
        const dot = name.lastIndexOf('.');
        if (dot > 0) {
          const ext = name.slice(dot + 1);
          extCounts.set(ext, (extCounts.get(ext) || 0) + 1);
        }
        if (name === 'package.json') {
          try {
            packageJsons.push(JSON.parse(readFileSync(join(abs, name), 'utf8')));
          } catch {
            /* ignore malformed/unreadable package.json */
          }
        }
      }
    }
  }
  return { fileRelPaths, dirRelPaths, fileBasenames, extCounts, packageJsons };
}

function mergeDeps(packageJsons) {
  const deps = new Set();
  const FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  for (const pkg of packageJsons) {
    if (!pkg || typeof pkg !== 'object') continue;
    for (const field of FIELDS) {
      const map = pkg[field];
      if (map && typeof map === 'object') {
        for (const key of Object.keys(map)) deps.add(key);
      }
    }
  }
  return deps;
}

function matchFiles(files, scan) {
  for (const entry of files) {
    if (entry.includes('/')) {
      // structural, root-relative path (file or directory, e.g. .github/workflows)
      if (scan.fileRelPaths.has(entry) || scan.dirRelPaths.has(entry)) return true;
    } else if (scan.fileBasenames.has(entry)) {
      // bare basename: aggregate/monorepo scan — matches anywhere in the tree
      return true;
    }
  }
  return false;
}

function matchExtensions(exts, scan) {
  for (const { ext, minCount } of exts) {
    if ((scan.extCounts.get(ext) || 0) >= minCount) return true;
  }
  return false;
}

function matchPackageDeps(names, mergedDeps) {
  for (const name of names) if (mergedDeps.has(name)) return true;
  return false;
}

export function detect(repoRoot, { assetRoot } = {}) {
  const root = repoRoot ?? process.cwd();
  const { stacks } = loadStacks(assetRoot);
  const scan = scanRepo(root);
  const mergedDeps = mergeDeps(scan.packageJsons);

  function baseMatch(det) {
    if (!det) return true; // guardrails-core (null) always matches
    const results = [];
    if (Array.isArray(det.files) && det.files.length) results.push(matchFiles(det.files, scan));
    if (Array.isArray(det.packageDeps) && det.packageDeps.length) {
      results.push(matchPackageDeps(det.packageDeps, mergedDeps));
    }
    if (Array.isArray(det.extensions) && det.extensions.length) {
      results.push(matchExtensions(det.extensions, scan));
    }
    if (results.length === 0) return true; // only requiresTags (or nothing) populated
    return results.some(Boolean); // OR across predicate types
  }

  const detected = new Map(); // id -> augmented stack (with registry index)
  const emittedTags = new Set();

  const hasRequires = (det) =>
    det && Array.isArray(det.requiresTags) && det.requiresTags.length > 0;

  // Pass 1: base stacks (no requiresTags).
  stacks.forEach((stackEntry, index) => {
    const det = stackEntry.detect;
    if (hasRequires(det)) return;
    if (baseMatch(det)) {
      detected.set(stackEntry.id, { ...stackEntry, index });
      if (det && Array.isArray(det.tags)) for (const t of det.tags) emittedTags.add(t);
    }
  });

  // Pass 2: requiresTags-dependent stacks.
  stacks.forEach((stackEntry, index) => {
    const det = stackEntry.detect;
    if (!hasRequires(det)) return;
    const reqOk = det.requiresTags.every((t) => emittedTags.has(t));
    if (reqOk && baseMatch(det)) {
      detected.set(stackEntry.id, { ...stackEntry, index });
      if (Array.isArray(det.tags)) for (const t of det.tags) emittedTags.add(t);
    }
  });

  return [...detected.values()].sort((a, b) => a.index - b.index);
}

// ---------------------------------------------------------------------------------------------
// SPEC-SELECT-001: four-level total order + 12-file cap (PURE).
// ---------------------------------------------------------------------------------------------

export function select(hits) {
  const core = hits.filter((h) => h.category === '核心');
  const nonCore = hits.filter((h) => h.category !== '核心');

  nonCore.sort((a, b) => {
    const la = LAYER_BY_CATEGORY[a.category];
    const lb = LAYER_BY_CATEGORY[b.category];
    if (la !== lb) return la - lb; // framework(0) < language(1) < domain(2)
    if (a.specificity !== b.specificity) return b.specificity - a.specificity; // specificity desc
    return a.index - b.index; // registry index asc (final tiebreak)
  });

  const nonCoreCap = Math.max(0, RULE_CAP - core.length);
  const keptNonCore = nonCore.slice(0, nonCoreCap);
  const truncated = nonCore.slice(nonCoreCap);
  const selected = [...core, ...keptNonCore];
  return { selected, truncated };
}

function ruleFilesOf(selected) {
  const files = [];
  const seen = new Set();
  for (const s of selected) {
    for (const r of s.rules) {
      const file = `${r}.md`;
      if (!seen.has(file)) {
        seen.add(file);
        files.push(file);
      }
    }
  }
  return files;
}

// ---------------------------------------------------------------------------------------------
// SPEC-RECONCILE-001: full reconcile over manifest-recorded rules (add / remove / upgrade /
// user-override skip). project-conventions.md is NEVER in the expected set (distill-only).
// ---------------------------------------------------------------------------------------------

export function reconcile(selected, manifest, ctx = {}) {
  const repoRoot = ctx.repoRoot ?? process.cwd();
  const assetRoot = ctx.assetRoot ?? DEFAULT_ASSET_ROOT;
  const libraryDir = ctx.libraryDir ?? join(assetRoot, 'library');
  const version = ctx.version ?? readVersion(assetRoot);
  const targetDir = join(repoRoot, '.code-guidelines');

  const expectedFiles = ruleFilesOf(selected);
  const expectedSet = new Set(expectedFiles);
  const manifestRules = Array.isArray(manifest?.rules) ? manifest.rules : [];
  const manifestByFile = new Map(manifestRules.map((r) => [r.file, r]));

  const added = [];
  const upgraded = [];
  const removed = [];
  const skipped = [];
  const kept = [];
  const writes = []; // {file, absPath, content}
  const removals = []; // {file, absPath}
  const nextRules = [];

  function libInfo(file) {
    const content = readIfExists(join(libraryDir, file));
    if (content == null) return null;
    return { content, hash: sha256Normalized(content) };
  }
  function diskInfo(file) {
    const raw = readIfExists(join(targetDir, file));
    if (raw == null) return { present: false, hash: null };
    return { present: true, hash: sha256Normalized(raw) };
  }

  // Expected files.
  for (const file of expectedFiles) {
    const rec = manifestByFile.get(file);
    const lib = libInfo(file);
    if (!lib) {
      // Library file missing (only reachable pre-TASK-013..016 or a broken install): leave alone.
      skipped.push({ file, reason: 'library-missing' });
      if (rec) nextRules.push(rec);
      continue;
    }
    if (!rec) {
      added.push({ file });
      writes.push({ file, absPath: join(targetDir, file), content: lib.content });
      nextRules.push({ file, sourceVersion: version, sha256: lib.hash });
      continue;
    }
    const disk = diskInfo(file);
    if (!disk.present) {
      // Expected + recorded but gone from disk -> restore (no user content to protect).
      added.push({ file });
      writes.push({ file, absPath: join(targetDir, file), content: lib.content });
      nextRules.push({ file, sourceVersion: version, sha256: lib.hash });
      continue;
    }
    if (disk.hash !== rec.sha256) {
      // User override -> never overwrite (SPEC-RECONCILE-001).
      skipped.push({ file, reason: 'user-override' });
      nextRules.push(rec);
      continue;
    }
    if (lib.hash !== rec.sha256) {
      // Unmodified on disk + library has a new version -> upgrade.
      upgraded.push({ file });
      writes.push({ file, absPath: join(targetDir, file), content: lib.content });
      nextRules.push({ file, sourceVersion: version, sha256: lib.hash });
    } else {
      kept.push({ file });
      nextRules.push(rec);
    }
  }

  // Removals: manifest-recorded files no longer expected.
  for (const rec of manifestRules) {
    if (expectedSet.has(rec.file)) continue;
    const disk = diskInfo(rec.file);
    if (disk.present && disk.hash !== rec.sha256) {
      // User modified -> skip removal, keep tracking (never touch user property).
      skipped.push({ file: rec.file, reason: 'user-override' });
      nextRules.push(rec);
    } else {
      removed.push({ file: rec.file });
      if (disk.present) removals.push({ file: rec.file, absPath: join(targetDir, rec.file) });
      // dropped from nextRules
    }
  }

  return { added, upgraded, removed, skipped, kept, writes, removals, nextRules, targetDir };
}

// ---------------------------------------------------------------------------------------------
// SPEC-LINT-001: first-time lint arming (three-condition gate, at-most-once), opt-out on delete,
// --relint re-arm, version upgrade for unmodified scaffolds, permanent skip for modified ones.
// Scaffold config files are written to the REPO ROOT (where the tool expects them).
// ---------------------------------------------------------------------------------------------

export function armLint(detected, manifest, ctx = {}) {
  const repoRoot = ctx.repoRoot ?? process.cwd();
  const assetRoot = ctx.assetRoot ?? DEFAULT_ASSET_ROOT;
  const lintDir = ctx.lintDir ?? join(assetRoot, 'lint');
  const relint = ctx.relint ?? null; // tool name forced to re-arm
  const now = ctx.now ?? new Date().toISOString();

  const manifestLint = Array.isArray(manifest?.lint) ? manifest.lint : [];
  const lintByTool = new Map(manifestLint.map((l) => [l.tool, l]));

  // Unique lint keys across detected stacks, registry order preserved.
  const tools = [];
  const seenTool = new Set();
  for (const s of detected) {
    if (s.lint && !seenTool.has(s.lint)) {
      seenTool.add(s.lint);
      tools.push(s.lint);
    }
  }

  const writes = []; // {absPath, content}
  const nextLint = [];
  const statusByTool = new Map(); // tool -> {tool, armed, gap, installCmd?, optedOut?, reason?}

  function baselineFiles(tool) {
    const dir = join(lintDir, tool);
    let names;
    try {
      names = readdirSync(dir);
    } catch {
      return null;
    }
    const files = [];
    for (const name of names) {
      const p = join(dir, name);
      try {
        if (statSync(p).isFile()) files.push({ name, content: readFileSync(p) });
      } catch {
        /* skip unreadable */
      }
    }
    return files.length ? files : null;
  }
  function combinedHash(files) {
    const h = createHash('sha256');
    for (const f of [...files].sort((a, b) => (a.name < b.name ? -1 : 1))) {
      h.update(f.name).update('\0').update(String(f.content).replace(/\r\n/g, '\n')).update('\0');
    }
    return h.digest('hex');
  }
  // On-disk scaffold state relative to the asset baseline: 'deleted' | 'modified' | 'unmodified'.
  function diskScaffoldState(files, recordedHash) {
    const present = [];
    for (const f of files) {
      const raw = readIfExists(join(repoRoot, f.name));
      if (raw == null) return 'deleted';
      present.push({ name: f.name, content: raw });
    }
    return combinedHash(present) === recordedHash ? 'unmodified' : 'modified';
  }
  function hasExistingConfig(tool) {
    for (const f of LINT_PROBE_FILES[tool] || []) {
      if (existsSync(join(repoRoot, f))) return true;
    }
    return false;
  }
  function scheduleWrite(files) {
    for (const f of files) {
      writes.push({ absPath: join(repoRoot, f.name), content: f.content });
    }
  }

  for (const tool of tools) {
    const baseline = baselineFiles(tool);
    if (!baseline) continue; // no baseline asset available -> not armable (silently skip)
    const assetHash = combinedHash(baseline);
    const rec = lintByTool.get(tool);
    const installCmd = LINT_INSTALL_CMD[tool];

    if (relint === tool) {
      // Explicit re-arm branch: clear any marker, write fresh scaffold (SPEC-LINT-001).
      scheduleWrite(baseline);
      nextLint.push({ tool, armedAt: now, sha256: assetHash });
      statusByTool.set(tool, { tool, armed: true, gap: true, installCmd });
      continue;
    }

    if (rec) {
      if (rec.optedOut) {
        nextLint.push(rec);
        statusByTool.set(tool, { tool, armed: false, gap: false, optedOut: true });
        continue;
      }
      const state = diskScaffoldState(baseline, rec.sha256);
      if (state === 'deleted') {
        // User deleted the scaffold = opt-out: do not revive (SPEC-LINT-001).
        nextLint.push(rec);
        statusByTool.set(tool, { tool, armed: false, gap: false, optedOut: true });
        continue;
      }
      if (state === 'modified') {
        // User modified scaffold = user property: permanently skip.
        nextLint.push(rec);
        statusByTool.set(tool, { tool, armed: true, gap: false, reason: 'user-modified' });
        continue;
      }
      // Unmodified scaffold.
      if (assetHash !== rec.sha256) {
        scheduleWrite(baseline); // version upgrade
        nextLint.push({ tool, armedAt: rec.armedAt, sha256: assetHash });
        statusByTool.set(tool, { tool, armed: true, gap: false });
      } else {
        nextLint.push(rec);
        statusByTool.set(tool, { tool, armed: true, gap: false });
      }
      continue;
    }

    // No manifest record: first-time consideration.
    if (hasExistingConfig(tool)) {
      // Existing config -> untouched, read-only recommendation (no manifest record written).
      statusByTool.set(tool, { tool, armed: false, gap: false });
      continue;
    }
    // Arm first time: three conditions satisfied.
    scheduleWrite(baseline);
    nextLint.push({ tool, armedAt: now, sha256: assetHash });
    statusByTool.set(tool, { tool, armed: true, gap: true, installCmd });
  }

  // Preserve manifest lint records for tools NOT currently detected (never lose arm state).
  for (const rec of manifestLint) {
    if (!seenTool.has(rec.tool)) nextLint.push(rec);
  }

  const status = tools
    .filter((t) => statusByTool.has(t))
    .map((t) => statusByTool.get(t));

  return { writes, nextLint, status };
}

// ---------------------------------------------------------------------------------------------
// SPEC-HOSTFMT-001 / SPEC-PRECHECK-001: maintain the managed block in existing entry docs.
// ---------------------------------------------------------------------------------------------

function buildPointers(selected, conventionsPresent) {
  const ptrs = [];
  if (conventionsPresent) {
    ptrs.push('- Before any edits, read `.code-guidelines/project-conventions.md` (project conventions).');
  }
  for (const s of selected) {
    for (const r of s.rules) {
      ptrs.push(`- Before related edits, read \`.code-guidelines/${r}.md\`.`);
    }
  }
  return ptrs;
}

function buildBlock(pointers) {
  const lines = [BLOCK_BEGIN];
  lines.push('Maintained by /code-guidelines. Do not edit between these markers.');
  lines.push('Progressive-disclosure rule pointers:');
  for (const p of pointers) lines.push(p);
  lines.push(BLOCK_END);
  return lines.join('\n');
}

function countOccurrences(haystack, needle) {
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

// Returns { kind: 'none'|'one'|'malformed', begin?, endEnd? }.
function parseManagedBlock(content) {
  const beginCount = countOccurrences(content, BLOCK_BEGIN);
  const endCount = countOccurrences(content, BLOCK_END);
  if (beginCount === 0 && endCount === 0) return { kind: 'none' };
  if (beginCount !== 1 || endCount !== 1) return { kind: 'malformed' };
  const bi = content.indexOf(BLOCK_BEGIN);
  const ei = content.indexOf(BLOCK_END);
  if (ei < bi) return { kind: 'malformed' }; // orphan / reversed / nested
  return { kind: 'one', begin: bi, endEnd: ei + BLOCK_END.length };
}

// Pure planner: returns { writes:[{absPath,content}], malformed:bool, files:[{name,changed}] }.
export function maintainHostBlock(entryFiles, ctx = {}) {
  const repoRoot = ctx.repoRoot ?? process.cwd();
  const pointers = ctx.pointers ?? [];
  const block = buildBlock(pointers);

  const writes = [];
  const files = [];
  for (const name of entryFiles) {
    const absPath = join(repoRoot, name);
    const content = readIfExists(absPath);
    if (content == null) continue; // never create entry files
    const parsed = parseManagedBlock(content);
    if (parsed.kind === 'malformed') {
      return { writes: [], malformed: true, malformedFile: name, files: [] };
    }
    let next;
    if (parsed.kind === 'none') {
      const base = content.replace(/\n?$/, '\n');
      next = `${base}\n${block}\n`;
    } else {
      next = content.slice(0, parsed.begin) + block + content.slice(parsed.endEnd);
    }
    const changed = next !== content;
    files.push({ name, changed });
    if (changed) writes.push({ absPath, content: next });
  }
  return { writes, malformed: false, files };
}

// ---------------------------------------------------------------------------------------------
// SPEC-DISTILL-001: deterministic distill-record seam. Invoked by the SKILL's distill agent,
// NEVER by no-arg sync. Guards manifest.conventions against silent overwrite.
// ---------------------------------------------------------------------------------------------

export function distillRecord(file, { force = false, repoRoot, now } = {}) {
  const root = repoRoot ?? process.cwd();
  const conventionsPath = resolve(root, file);
  const raw = readIfExists(conventionsPath);
  if (raw == null) {
    return { ok: false, exitCode: 2, reason: 'missing-conventions', path: conventionsPath };
  }
  const newHash = sha256Normalized(raw);
  const manifest = loadTargetManifest(root) ?? { version: readVersion(), rules: [], lint: [], conventions: null };
  const prior = manifest.conventions;

  if (prior && prior.sha256 && prior.sha256 !== newHash && !force) {
    return {
      ok: false,
      exitCode: 4,
      reason: 'hash-mismatch',
      oldHash: prior.sha256,
      newHash,
      oldDistilledAt: prior.distilledAt,
    };
  }

  const distilledAt = now ?? new Date().toISOString();
  const next = {
    version: manifest.version ?? readVersion(),
    rules: Array.isArray(manifest.rules) ? manifest.rules : [],
    lint: Array.isArray(manifest.lint) ? manifest.lint : [],
    conventions: { sha256: newHash, distilledAt },
  };
  const targetDir = join(root, '.code-guidelines');
  const manifestPath = join(targetDir, 'manifest.json');
  assertSafeTarget(manifestPath, [root]);
  mkdirSync(targetDir, { recursive: true });
  atomicWriteFile(manifestPath, serializeManifest(next));
  return { ok: true, exitCode: 0, sha256: newHash, distilledAt };
}

// ---------------------------------------------------------------------------------------------
// Manifest assembly + serialization (SPEC-MANIFEST-001). Fixed key order for byte-stable output.
// ---------------------------------------------------------------------------------------------

function serializeManifest(manifest) {
  const ordered = {
    version: manifest.version,
    rules: manifest.rules,
    lint: manifest.lint,
    conventions: manifest.conventions ?? null,
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

// ---------------------------------------------------------------------------------------------
// SPEC-SYNC-001 / SPEC-STATUS-001: the no-arg pipeline + switches + zero-write + report.
// ---------------------------------------------------------------------------------------------

export async function sync(opts = {}) {
  const repoRoot = opts.repoRoot ?? process.cwd();
  const assetRoot = opts.assetRoot ?? DEFAULT_ASSET_ROOT;
  const platform = opts.platform;
  const dryRun = Boolean(opts.dryRun);
  const json = Boolean(opts.json);
  const relint = opts.relint ?? null;
  const now = opts.now ?? undefined;

  // Usage validation (exit 2).
  const entryFile = platform ? PLATFORM_ENTRY[platform] : undefined;
  if (!entryFile) {
    return finalize({ exitCode: 2, message: `usage: unknown or missing --platform '${platform ?? ''}'`, json });
  }
  if (relint != null && !LINT_KEYS.has(relint)) {
    return finalize({ exitCode: 2, message: `usage: unknown --relint tool '${relint}'`, json });
  }

  // Pipeline step 1: precheck (SPEC-PRECHECK-001). Any missing current-platform entry -> exit 3,
  // ZERO writes. Because ALL writes are deferred to the commit phase below, this is trivially
  // zero-write.
  if (!existsSync(join(repoRoot, entryFile))) {
    return finalize({
      exitCode: 3,
      message: `当前平台(${platform})无约束文件 ${entryFile},请先创建该文件后重新执行 /code-guidelines`,
      json,
    });
  }

  // Step 2-3: detect + select.
  const hits = detect(repoRoot, { assetRoot });
  const { selected, truncated } = select(hits);

  // Step 4: load manifest.
  const manifest = loadTargetManifest(repoRoot) ?? {
    version: readVersion(assetRoot),
    rules: [],
    lint: [],
    conventions: null,
  };

  // Step 5: reconcile (never touches conventions).
  const rulePlan = reconcile(selected, manifest, { repoRoot, assetRoot });

  // Step 6: lint arm.
  const lintPlan = armLint(hits, manifest, { repoRoot, assetRoot, relint, now });

  // Step 7: host block. conventions pointer if project-conventions.md present on disk.
  const conventionsPresent = existsSync(join(repoRoot, '.code-guidelines', 'project-conventions.md'));
  const pointers = buildPointers(selected, conventionsPresent);
  const existingEntryFiles = ENTRY_FILES.filter((f) => existsSync(join(repoRoot, f)));
  const hostPlan = maintainHostBlock(existingEntryFiles, { repoRoot, pointers });
  if (hostPlan.malformed) {
    return finalize({
      exitCode: 4,
      message: `入口文档 ${hostPlan.malformedFile} 的 code-guidelines 托管块畸形/重复/孤立,已中止且零写入`,
      json,
    });
  }

  // Assemble next manifest (PRESERVE conventions untouched).
  const nextManifest = {
    version: manifest.version ?? readVersion(assetRoot),
    rules: rulePlan.nextRules,
    lint: lintPlan.nextLint,
    conventions: manifest.conventions ?? null,
  };
  const nextManifestStr = serializeManifest(nextManifest);
  const currentManifestStr = readIfExists(join(repoRoot, '.code-guidelines', 'manifest.json'));
  const manifestChanged = nextManifestStr !== currentManifestStr;

  const anyFileWrites =
    rulePlan.writes.length > 0 ||
    rulePlan.removals.length > 0 ||
    lintPlan.writes.length > 0 ||
    hostPlan.writes.length > 0;
  const upToDate = !anyFileWrites && !manifestChanged;

  const status = buildStatus({
    upToDate,
    rulePlan,
    lintPlan,
    truncated,
    conventionsPresent,
    conventions: manifest.conventions,
  });

  // Zero-write path (SPEC-SYNC-001): expected == current -> write NOTHING, do not touch mtime.
  if (upToDate) {
    return finalize({ exitCode: 0, status, json, upToDate: true });
  }

  // --dry-run: compute + report, ZERO writes.
  if (dryRun) {
    return finalize({ exitCode: 0, status, json, dryRun: true });
  }

  // Commit phase. Safety-check EVERY target FIRST so a symlink at any target/ancestor aborts with
  // exit 4 BEFORE a single byte is written (SPEC-INSTALL-001 / DES-FSSAFE-001).
  const allowedRoots = [repoRoot];
  const fileWrites = [
    ...rulePlan.writes.map((w) => ({ absPath: w.absPath, content: w.content })),
    ...lintPlan.writes.map((w) => ({ absPath: w.absPath, content: w.content })),
    ...hostPlan.writes.map((w) => ({ absPath: w.absPath, content: w.content })),
  ];
  if (manifestChanged) {
    fileWrites.push({ absPath: join(repoRoot, '.code-guidelines', 'manifest.json'), content: nextManifestStr });
  }
  const removals = rulePlan.removals.map((r) => ({ absPath: r.absPath }));

  try {
    for (const w of fileWrites) assertSafeTarget(w.absPath, allowedRoots);
    for (const r of removals) assertSafeTarget(r.absPath, allowedRoots);
  } catch (err) {
    return finalize({ exitCode: 4, message: `fs-safety 拒绝:${err.message},已中止且零写入`, json });
  }

  for (const w of fileWrites) {
    mkdirSync(dirname(w.absPath), { recursive: true });
    atomicWriteFile(w.absPath, w.content);
  }
  for (const r of removals) {
    rmSync(r.absPath, { force: true });
  }

  return finalize({ exitCode: 0, status, json });
}

function buildStatus({ upToDate, rulePlan, lintPlan, truncated, conventionsPresent, conventions }) {
  return {
    upToDate,
    added: rulePlan.added.map((a) => a.file),
    removed: rulePlan.removed.map((r) => r.file),
    upgraded: rulePlan.upgraded.map((u) => u.file),
    skipped: rulePlan.skipped.map((s) => ({ file: s.file, reason: s.reason })),
    truncated: truncated.map((t) => (t.rules && t.rules[0] ? `${t.rules[0]}.md` : t.id)),
    lint: lintPlan.status.map((row) => {
      const out = { tool: row.tool, armed: Boolean(row.armed), gap: Boolean(row.gap) };
      if (row.installCmd) out.installCmd = row.installCmd;
      if (row.optedOut) out.optedOut = true;
      return out;
    }),
    conventions: {
      present: conventionsPresent,
      ...(conventions && conventions.distilledAt ? { distilledAt: conventions.distilledAt } : {}),
    },
  };
}

function finalize({ exitCode, status, message, json, upToDate, dryRun }) {
  if (json) {
    const obj = status
      ? { ...status, exitCode }
      : { upToDate: false, added: [], removed: [], upgraded: [], skipped: [], truncated: [], lint: [], conventions: { present: false }, exitCode, message };
    return { exitCode, json: obj, text: null };
  }
  const text = message ?? renderTextReport(status, { upToDate, dryRun });
  return { exitCode, json: null, text, status };
}

function renderTextReport(status, { upToDate, dryRun } = {}) {
  if (!status) return '';
  if (upToDate) return '已是最新,无变更';
  const lines = [];
  if (dryRun) lines.push('[dry-run] 以下为拟改动,未写盘:');
  lines.push(`新增: ${status.added.length ? status.added.join(', ') : '(无)'}`);
  lines.push(`升级: ${status.upgraded.length ? status.upgraded.join(', ') : '(无)'}`);
  lines.push(`移除: ${status.removed.length ? status.removed.join(', ') : '(无)'}`);
  lines.push(
    `跳过: ${status.skipped.length ? status.skipped.map((s) => `${s.file}(${s.reason})`).join(', ') : '(无)'}`,
  );
  if (status.truncated.length) lines.push(`截断(超 12 上限): ${status.truncated.join(', ')}`);
  for (const row of status.lint) {
    if (row.armed && row.gap) lines.push(`lint ${row.tool}: 已布防,依赖缺口 -> ${row.installCmd}`);
    else if (row.optedOut) lines.push(`lint ${row.tool}: 已退出(用户删除脚手架)`);
    else if (row.armed) lines.push(`lint ${row.tool}: 已布防`);
    else lines.push(`lint ${row.tool}: 已有配置,只读推荐`);
  }
  lines.push(
    `project-conventions.md: ${status.conventions.present ? '存在' : '不存在'}${status.conventions.distilledAt ? ` (蒸馏于 ${status.conventions.distilledAt})` : ''}`,
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// CLI entrypoint (only when executed directly).
// ---------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { platform: undefined, dryRun: false, json: false, relint: null, distillRecord: null, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--platform':
        opts.platform = argv[++i];
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--json':
        opts.json = true;
        break;
      case '--relint':
        opts.relint = argv[++i];
        break;
      case '--distill-record':
        opts.distillRecord = argv[++i];
        break;
      case '--force':
        opts.force = true;
        break;
      default:
        return { error: `unknown option: ${arg}` };
    }
  }
  return { opts };
}

async function main() {
  const { opts, error } = parseArgs(process.argv.slice(2));
  if (error) {
    process.stderr.write(`${error}\n`);
    process.exit(2);
  }

  if (opts.distillRecord != null) {
    const res = distillRecord(opts.distillRecord, { force: opts.force });
    if (res.ok) {
      process.stdout.write(`conventions recorded: ${res.sha256} @ ${res.distilledAt}\n`);
      process.exit(0);
    }
    if (res.reason === 'hash-mismatch') {
      process.stderr.write(
        `distill refused: project-conventions.md changed since last record.\n` +
          `  old: ${res.oldHash} (${res.oldDistilledAt})\n  new: ${res.newHash}\n` +
          `  re-run with --force to overwrite, or delete project-conventions.md first.\n`,
      );
    } else if (res.reason === 'missing-conventions') {
      process.stderr.write(`distill: conventions file not found: ${res.path}\n`);
    }
    process.exit(res.exitCode);
  }

  const result = await sync(opts);
  if (result.json) process.stdout.write(`${JSON.stringify(result.json, null, 2)}\n`);
  else if (result.text) process.stdout.write(`${result.text}\n`);
  process.exit(result.exitCode);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
