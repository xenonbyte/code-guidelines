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
// platform entry file missing) / 4 conflict-or-safety (fs-safety/symlink reject,
// malformed/duplicate/orphan host-block marker, or a mid-commit write/removal I/O failure).

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

const EXCLUDED_DIRS = new Set([
  'node_modules', 'vendor', 'dist', 'build', '.git', '.venv', 'venv', '__pycache__',
]);

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
const LINT_PROBE_PACKAGE_FIELDS = {
  'js-ts': ['eslintConfig', 'prettier'],
};

// Exact install commands to print (deps are NEVER auto-installed, SPEC-LINT-001 / SCOPE-OUT-003).
const LINT_INSTALL_CMD = {
  'js-ts': 'npm install -D eslint prettier typescript typescript-eslint',
  python: 'pip install ruff mypy',
  go: 'go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest',
  rust: 'rustup component add clippy rustfmt',
  java: 'add the Checkstyle plugin to your Maven/Gradle build',
  kotlin: 'add the ktlint and detekt plugins to your Gradle build',
  swift: 'brew install swiftlint',
  csharp: 'enable Roslyn analyzers via <AnalysisLevel>latest-all</AnalysisLevel>',
  php: 'composer require --dev friendsofphp/php-cs-fixer phpstan/phpstan',
  ruby: 'gem install rubocop rubocop-performance rubocop-rspec',
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
  const p = join(repoRoot, '.code-guidelines', 'manifest.json');
  const raw = readIfExists(p);
  if (raw == null) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const e = new Error(`target manifest is not valid JSON: ${p}`);
    e.code = 'ERR_INVALID_TARGET_MANIFEST';
    e.path = p;
    e.cause = err;
    throw e;
  }
  if (!validateTargetManifest(parsed)) {
    const e = new Error(`target manifest has an invalid shape: ${p}`);
    e.code = 'ERR_INVALID_TARGET_MANIFEST';
    e.path = p;
    throw e;
  }
  return parsed;
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

function isValidRuleEntry(entry) {
  return (
    isPlainObject(entry) &&
    isNonEmptyString(entry.file) &&
    isNonEmptyString(entry.sourceVersion) &&
    isNonEmptyString(entry.sha256)
  );
}

function isValidLintEntry(entry) {
  if (!isPlainObject(entry)) return false;
  if (!isNonEmptyString(entry.tool)) return false;
  if (!isNonEmptyString(entry.armedAt)) return false;
  if (!(entry.sha256 === null || typeof entry.sha256 === 'string')) return false;
  if ('optedOut' in entry && typeof entry.optedOut !== 'boolean') return false;
  return true;
}

function isValidConventions(v) {
  if (v === null) return true;
  return isPlainObject(v) && isNonEmptyString(v.sha256) && isNonEmptyString(v.distilledAt);
}

function validateTargetManifest(o) {
  if (!isPlainObject(o)) return false;
  if (!isNonEmptyString(o.version)) return false;
  if (!Array.isArray(o.rules) || !o.rules.every(isValidRuleEntry)) return false;
  if (!Array.isArray(o.lint) || !o.lint.every(isValidLintEntry)) return false;
  if (!('conventions' in o) || !isValidConventions(o.conventions)) return false;
  return true;
}

// ---------------------------------------------------------------------------------------------
// SPEC-DETECT-001: repo scan + five-predicate two-pass detection (PURE, deterministic).
//
// AND/OR SEMANTICS (pinned here, documented per Task-9 DEFER; requiresTags flipped to OR per
// Task-10 Fix Wave 1 — see execution/task-10-review.md §3):
//   * within a `files` list      -> OR (any listed path exists; a DIRECTORY counts as existing)
//   * within a `packageDeps` list -> OR (any listed dep present in any package.json)
//   * within an `extensions` list -> OR (any {ext,minCount} threshold met across the repo,
//     minus optional per-entry excludeFiles)
//   * within a `pythonDeps` list -> OR (any listed name present in the pyproject.toml /
//     requirements*.txt merge, PEP 503 normalized; SPEC-PYDEPS-001)
//   * ACROSS the four populated non-requiresTags predicate types -> OR (any type matching = base hit)
//   * `requiresTags` -> OR gate: AT LEAST ONE required tag must have been emitted by a pass-1 hit
//     (e.g. security:["backend","frontend"] applies to a backend-only OR a frontend-only repo, not
//     only a full-stack one; a11y:["frontend"] and python-ml:["python"] are unaffected since AND
//     and OR coincide on a single-tag list).
//   A stack matches iff (baseMatch) AND (requiresTags is empty OR at least one tag satisfied). A
//   stack whose only populated predicate is requiresTags has baseMatch == true (gated solely by
//   requiresTags). Two passes: pass 1 evaluates non-requiresTags stacks and collects their emitted
//   `tags`; pass 2 evaluates requiresTags-bearing stacks against those tags (e.g. a11y<-frontend,
//   python-ml<-python, security<-backend|frontend). guardrails-core (detect==null) always matches.
// ---------------------------------------------------------------------------------------------

function scanRepo(repoRoot) {
  const fileRelPaths = new Set();
  const dirRelPaths = new Set();
  const fileBasenames = new Set();
  const extCounts = new Map();
  const packageJsons = [];
  const pyprojectTexts = [];
  const requirementsTexts = [];

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
        if (name === 'pyproject.toml') {
          try {
            pyprojectTexts.push(readFileSync(join(abs, name), 'utf8'));
          } catch {
            /* ignore unreadable pyproject.toml */
          }
        }
        if (/^requirements[^/]*\.txt$/.test(name)) {
          try {
            requirementsTexts.push(readFileSync(join(abs, name), 'utf8'));
          } catch {
            /* ignore unreadable requirements file */
          }
        }
      }
    }
  }
  return {
    fileRelPaths, dirRelPaths, fileBasenames, extCounts, packageJsons, pyprojectTexts,
    requirementsTexts,
  };
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

function relBasename(rel) {
  const slash = rel.lastIndexOf('/');
  return slash === -1 ? rel : rel.slice(slash + 1);
}

function relExtension(rel) {
  const name = relBasename(rel);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1) : null;
}

function extensionFileExcluded(rel, excludeFiles) {
  for (const entry of excludeFiles) {
    if (entry.includes('/')) {
      if (rel === entry) return true;
    } else if (relBasename(rel) === entry) {
      return true;
    }
  }
  return false;
}

function matchExtensions(exts, scan) {
  for (const { ext, minCount, excludeFiles } of exts) {
    const excludes = Array.isArray(excludeFiles) ? excludeFiles : [];
    if (excludes.length === 0) {
      if ((scan.extCounts.get(ext) || 0) >= minCount) return true;
      continue;
    }
    let count = 0;
    for (const rel of scan.fileRelPaths) {
      if (relExtension(rel) !== ext) continue;
      if (extensionFileExcluded(rel, excludes)) continue;
      count += 1;
      if (count >= minCount) return true;
    }
  }
  return false;
}

function matchPackageDeps(names, mergedDeps) {
  for (const name of names) if (mergedDeps.has(name)) return true;
  return false;
}

// ---------------------------------------------------------------------------------------------
// SPEC-PYDEPS-001: mergePythonDeps — hand-rolled line state machine (no TOML library; zero-dep
// hard constraint). Mirrors mergeDeps' best-effort, per-text try/catch silent-skip contract.
// ---------------------------------------------------------------------------------------------

function normalizePyName(n) {
  return n.toLowerCase().replace(/[-_.]+/g, '-');
}

function addPyName(s, set) {
  const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(s.trim());
  if (m) set.add(normalizePyName(m[1]));
}

// Removes inline tables (e.g. `{ include-group = "..." }` from PEP 735) so their contents are
// never mistaken for a PEP 508 package-name string.
function stripInlineTables(s) {
  return s.replace(/\{[^}]*\}/g, '');
}

function quotedStringsOf(s) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'/g;
  let m = re.exec(s);
  while (m) {
    out.push(m[1] !== undefined ? m[1] : m[2]);
    m = re.exec(s);
  }
  return out;
}

// Strips quoted-string contents (so a `]` inside e.g. an extras spec `"uvicorn[standard]"` is never
// mistaken for an array terminator).
function stripStrings(s) {
  return s.replace(/"[^"]*"|'[^']*'/g, '');
}

// An array closes only on a `]` that appears outside both quoted strings and inline tables —
// otherwise extras like `"uvicorn[standard]"` on a non-final line of a multi-line array would
// prematurely close it and drop every dependency listed after it.
function closesArray(s) {
  return stripStrings(stripInlineTables(s)).includes(']');
}

// Classifies a `[section]` header into which pyproject.toml parsing mode applies.
function classifyPyprojectSection(section) {
  if (section === '[project]') return 'array'; // only the `dependencies` key is a dep array
  if (section === '[project.optional-dependencies]') return 'array'; // any key
  if (section === '[dependency-groups]') return 'array'; // PEP 735, any key
  if (section === '[tool.poetry.dependencies]') return 'table';
  if (/^\[tool\.poetry\.group\.[^.\]]+\.dependencies\]$/.test(section)) return 'table';
  return 'none';
}

function parsePyproject(text, set) {
  let section = '';
  let mode = 'none';
  let inArray = false;
  for (const raw of text.split(/\r?\n/)) {
    const tr = raw.trim();
    if (inArray) {
      for (const q of quotedStringsOf(stripInlineTables(tr))) addPyName(q, set);
      if (closesArray(tr)) inArray = false;
      continue;
    }
    if (tr.startsWith('[')) {
      section = tr;
      mode = classifyPyprojectSection(section);
      continue;
    }
    if (mode === 'array') {
      const key = tr.split('=')[0].trim();
      if (section === '[project]' && key !== 'dependencies') continue;
      if (!tr.includes('=')) continue;
      const rhs = tr.slice(tr.indexOf('=') + 1).trim();
      if (rhs.startsWith('[')) {
        for (const q of quotedStringsOf(stripInlineTables(rhs))) addPyName(q, set);
        if (!closesArray(rhs)) inArray = true;
      }
    } else if (mode === 'table') {
      const key = tr.split('=')[0].trim();
      if (key && key !== 'python' && !key.startsWith('[')) addPyName(key, set);
    }
  }
}

function parseRequirements(text, set) {
  for (const raw of text.split(/\r?\n/)) {
    const tr = raw.replace(/\s+#.*$/, '').trim(); // strip inline comments first
    if (tr === '' || tr.startsWith('#') || tr.startsWith('-')) continue;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(tr)) continue; // whole-line direct URL reference only
    addPyName(tr, set);
  }
}

function mergePythonDeps(pyprojectTexts, requirementsTexts) {
  const deps = new Set();
  for (const t of pyprojectTexts) {
    try {
      parsePyproject(t, deps);
    } catch {
      /* ignore malformed/unreadable pyproject.toml (best-effort detection) */
    }
  }
  for (const t of requirementsTexts) {
    try {
      parseRequirements(t, deps);
    } catch {
      /* ignore malformed/unreadable requirements file (best-effort detection) */
    }
  }
  return deps;
}

function matchPythonDeps(names, mergedPyDeps) {
  for (const n of names) if (mergedPyDeps.has(n)) return true;
  return false;
}

export function detect(repoRoot, { assetRoot } = {}) {
  const root = repoRoot ?? process.cwd();
  const { stacks } = loadStacks(assetRoot);
  const scan = scanRepo(root);
  const mergedDeps = mergeDeps(scan.packageJsons);
  const mergedPyDeps = mergePythonDeps(scan.pyprojectTexts, scan.requirementsTexts);

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
    if (Array.isArray(det.pythonDeps) && det.pythonDeps.length) {
      results.push(matchPythonDeps(det.pythonDeps, mergedPyDeps));
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
    const reqOk = det.requiresTags.some((t) => emittedTags.has(t));
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
  const safetyChecks = []; // existing paths that must still satisfy fs-safety before reporting
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
    const disk = diskInfo(file);
    if (!rec) {
      if (disk.present) {
        safetyChecks.push({ file, absPath: join(targetDir, file) });
        if (disk.hash === lib.hash) {
          kept.push({ file });
          nextRules.push({ file, sourceVersion: version, sha256: lib.hash });
        } else {
          skipped.push({ file, reason: 'untracked-existing' });
        }
        continue;
      }
      added.push({ file });
      writes.push({ file, absPath: join(targetDir, file), content: lib.content });
      nextRules.push({ file, sourceVersion: version, sha256: lib.hash });
      continue;
    }
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

  return { added, upgraded, removed, skipped, kept, writes, removals, safetyChecks, nextRules, targetDir };
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
  const plannedWritesByPath = new Map(); // absPath -> tool

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
      if (name === 'meta.json') continue; // asset metadata, not a target-repo scaffold file
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
  function anyBaselineTargetExists(files) {
    for (const f of files) {
      if (existsSync(join(repoRoot, f.name))) return true;
    }
    return false;
  }
  function hasExistingConfig(tool) {
    for (const f of LINT_PROBE_FILES[tool] || []) {
      if (existsSync(join(repoRoot, f))) return true;
    }
    const packageFields = LINT_PROBE_PACKAGE_FIELDS[tool] || [];
    if (packageFields.length) {
      const raw = readIfExists(join(repoRoot, 'package.json'));
      if (raw != null) {
        try {
          const pkg = JSON.parse(raw);
          if (
            isPlainObject(pkg) &&
            packageFields.some((field) => Object.prototype.hasOwnProperty.call(pkg, field))
          ) {
            return true;
          }
        } catch {
          /* malformed package.json is not a readable tool config */
        }
      }
    }
    return false;
  }
  function plannedWriteConflict(tool, files) {
    for (const f of files) {
      const absPath = join(repoRoot, f.name);
      const owner = plannedWritesByPath.get(absPath);
      if (owner && owner !== tool) return { file: f.name, conflictingTool: owner };
    }
    return null;
  }
  function scheduleWrite(tool, files) {
    const conflict = plannedWriteConflict(tool, files);
    if (conflict) return conflict;
    for (const f of files) {
      const absPath = join(repoRoot, f.name);
      writes.push({ absPath, content: f.content });
      plannedWritesByPath.set(absPath, tool);
    }
    return null;
  }
  function pathConflictStatus(tool, conflict, armed = false) {
    return {
      tool,
      armed,
      gap: false,
      reason: 'path-conflict',
      conflictFile: conflict.file,
      conflictWith: conflict.conflictingTool,
    };
  }
  function existingConfigStatus(tool, rec = null) {
    return {
      tool,
      armed: Boolean(rec && !rec.optedOut),
      gap: false,
      reason: 'existing-config',
    };
  }

  for (const tool of tools) {
    const baseline = baselineFiles(tool);
    if (!baseline) continue; // no baseline asset available -> not armable (silently skip)
    const assetHash = combinedHash(baseline);
    const rec = lintByTool.get(tool);
    const installCmd = LINT_INSTALL_CMD[tool];

    if (relint === tool && !rec && hasExistingConfig(tool)) {
      statusByTool.set(tool, existingConfigStatus(tool));
      continue;
    }

    if (relint === tool && rec) {
      // Explicit re-arm branch: only managed, unmodified, or fully deleted scaffolds may be
      // refreshed. Foreign configs and user-modified managed scaffolds remain user property.
      const state = rec.optedOut
        ? (anyBaselineTargetExists(baseline) ? 'modified' : 'deleted')
        : diskScaffoldState(baseline, rec.sha256);
      if (state === 'modified') {
        nextLint.push(rec);
        statusByTool.set(tool, {
          tool,
          armed: Boolean(!rec.optedOut),
          gap: false,
          reason: 'user-modified',
        });
        continue;
      }
      if (state === 'deleted' && (anyBaselineTargetExists(baseline) || hasExistingConfig(tool))) {
        nextLint.push(rec);
        statusByTool.set(tool, existingConfigStatus(tool, rec));
        continue;
      }
      const conflict = scheduleWrite(tool, baseline);
      if (conflict) {
        if (rec) nextLint.push(rec);
        statusByTool.set(tool, pathConflictStatus(tool, conflict, Boolean(rec && !rec.optedOut)));
        continue;
      }
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
        const conflict = scheduleWrite(tool, baseline); // version upgrade
        if (conflict) {
          nextLint.push(rec);
          statusByTool.set(tool, pathConflictStatus(tool, conflict, true));
          continue;
        }
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
    const conflict = scheduleWrite(tool, baseline);
    if (conflict) {
      statusByTool.set(tool, pathConflictStatus(tool, conflict));
      continue;
    }
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

// Minimal, hand-rolled `appliesTo` extractor from a rule file's YAML frontmatter (SPEC-RULEFMT-001).
// NOT a general YAML parser: only understands the flat forms rule files actually use — a flow
// array (`appliesTo: ["*.tsx", "*.jsx"]`), a block list (`appliesTo:\n  - "*.tsx"`), or a single
// bare/quoted scalar (`appliesTo: "*.tsx"`). Returns null when absent or unparsable.
function parseAppliesTo(content) {
  if (typeof content !== 'string' || !content.startsWith('---')) return null;
  const end = content.indexOf('\n---', 3);
  if (end === -1) return null;
  const lines = content.slice(3, end).split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^appliesTo:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const inline = m[1].trim();
    if (inline.startsWith('[')) {
      try {
        const arr = JSON.parse(inline.replace(/'/g, '"'));
        return Array.isArray(arr) && arr.length ? arr.map(String) : null;
      } catch {
        return null;
      }
    }
    if (inline) return [inline.replace(/^['"]|['"]$/g, '')];
    const globs = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const bm = /^\s*-\s*(.+)$/.exec(lines[j]);
      if (!bm) break;
      globs.push(bm[1].trim().replace(/^['"]|['"]$/g, ''));
    }
    return globs.length ? globs : null;
  }
  return null;
}

// Reads each unique rule file's `appliesTo` globs directly from the library root, so the host
// block can render SPEC-HOSTFMT-001's trigger-conditioned pointer form. file -> string[]|null.
function loadRuleAppliesTo(libraryDir, files) {
  const map = new Map();
  for (const file of files) {
    const content = readIfExists(join(libraryDir, file));
    map.set(file, content ? parseAppliesTo(content) : null);
  }
  return map;
}

// ruleAppliesTo: Map<file, string[]|null> (SPEC-HOSTFMT-001). When a rule declares globs, render
// "Before editing <glob>[, <glob>...], read .code-guidelines/<file>."; otherwise fall back to the
// generic "Before related edits, ..." phrasing (e.g. guardrails-core, or a rule with no frontmatter
// appliesTo, or an absent/not-yet-installed library file).
function buildPointers(selected, conventionsPresent, ruleAppliesTo = new Map()) {
  const ptrs = [];
  if (conventionsPresent) {
    ptrs.push('- Before any edits, read `.code-guidelines/project-conventions.md` (project conventions).');
  }
  for (const s of selected) {
    for (const r of s.rules) {
      const file = `${r}.md`;
      const globs = ruleAppliesTo.get(file);
      if (globs && globs.length) {
        const globList = globs.map((g) => `\`${g}\``).join(', ');
        ptrs.push(`- Before editing ${globList}, read \`.code-guidelines/${file}\`.`);
      } else {
        ptrs.push(`- Before related edits, read \`.code-guidelines/${file}\`.`);
      }
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
  let manifest;
  try {
    manifest = loadTargetManifest(root) ?? { version: readVersion(), rules: [], lint: [], conventions: null };
  } catch (err) {
    if (err.code === 'ERR_INVALID_TARGET_MANIFEST') {
      return { ok: false, exitCode: 4, reason: 'invalid-manifest', path: err.path, message: err.message };
    }
    throw err;
  }
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
  // Usage validation (exit 2).
  const entryFile = platform ? PLATFORM_ENTRY[platform] : undefined;
  if (!entryFile) {
    return finalize({ exitCode: 2, message: `usage: unknown or missing --platform '${platform ?? ''}'`, json });
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
  let manifest;
  try {
    manifest = loadTargetManifest(repoRoot) ?? {
      version: readVersion(assetRoot),
      rules: [],
      lint: [],
      conventions: null,
    };
  } catch (err) {
    if (err.code === 'ERR_INVALID_TARGET_MANIFEST') {
      return finalize({
        exitCode: 4,
        message: `target manifest 不合法:${err.message},已中止且零写入`,
        json,
      });
    }
    throw err;
  }

  // Step 5: reconcile (never touches conventions or the lint records).
  const rulePlan = reconcile(selected, manifest, { repoRoot, assetRoot });

  // Step 6: host block. conventions pointer if project-conventions.md present on disk.
  const conventionsPresent = existsSync(join(repoRoot, '.code-guidelines', 'project-conventions.md'));
  const ruleAppliesTo = loadRuleAppliesTo(join(assetRoot, 'library'), ruleFilesOf(selected));
  const pointers = buildPointers(selected, conventionsPresent, ruleAppliesTo);
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
    // Lint records belong to `/code-guidelines-lint`; carry them through untouched so a core
    // sync never clears what the lint command armed (mirror of the conventions pass-through).
    lint: Array.isArray(manifest.lint) ? manifest.lint : [],
    conventions: manifest.conventions ?? null,
  };
  const nextManifestStr = serializeManifest(nextManifest);
  const currentManifestStr = readIfExists(join(repoRoot, '.code-guidelines', 'manifest.json'));
  const manifestChanged = nextManifestStr !== currentManifestStr;

  const anyFileWrites =
    rulePlan.writes.length > 0 ||
    rulePlan.removals.length > 0 ||
    hostPlan.writes.length > 0;
  const upToDate = !anyFileWrites && !manifestChanged;

  const status = buildStatus({
    upToDate,
    rulePlan,
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
  const contentWrites = [
    ...rulePlan.writes.map((w) => ({ absPath: w.absPath, content: w.content })),
    ...hostPlan.writes.map((w) => ({ absPath: w.absPath, content: w.content })),
  ];
  const manifestWrite = manifestChanged
    ? { absPath: join(repoRoot, '.code-guidelines', 'manifest.json'), content: nextManifestStr }
    : null;
  const removals = rulePlan.removals.map((r) => ({ absPath: r.absPath }));

  try {
    for (const w of contentWrites) assertSafeTarget(w.absPath, allowedRoots);
    for (const r of removals) assertSafeTarget(r.absPath, allowedRoots);
    for (const c of rulePlan.safetyChecks) assertSafeTarget(c.absPath, allowedRoots);
    if (manifestWrite) assertSafeTarget(manifestWrite.absPath, allowedRoots);
  } catch (err) {
    return finalize({ exitCode: 4, message: `fs-safety 拒绝:${err.message},已中止且零写入`, json });
  }

  // Execute in "new state fully in place, then cleanup, manifest last" order (Task-10 Fix Wave 1 —
  // see execution/task-10-review.md §1): the manifest must never describe a state that isn't fully
  // on disk yet. Any failure here — including a mid-commit removal error — is caught and mapped to
  // a defined exit code instead of throwing uncaught; the manifest write is skipped entirely so a
  // failed removal never gets silently dropped from tracking (no permanent orphan).
  try {
    for (const w of contentWrites) {
      mkdirSync(dirname(w.absPath), { recursive: true });
      atomicWriteFile(w.absPath, w.content);
    }
    for (const r of removals) {
      rmSync(r.absPath, { force: true });
    }
    if (manifestWrite) {
      mkdirSync(dirname(manifestWrite.absPath), { recursive: true });
      atomicWriteFile(manifestWrite.absPath, manifestWrite.content);
    }
  } catch (err) {
    return finalize({
      exitCode: 4,
      message: `sync 提交阶段写入/删除失败:${err.message},已中止;manifest 未回写,避免描述与磁盘不符的状态`,
      json,
    });
  }

  return finalize({ exitCode: 0, status, json });
}

// ---------------------------------------------------------------------------------------------
// SPEC-LINT-001: `/code-guidelines-lint` — detect → arm lint → report. A separate command from the
// core sync: it writes ONLY lint scaffolds + the manifest's `lint` slice, carrying `rules` and
// `conventions` through untouched, and never touches the entry-file managed block (so no precheck,
// no `--platform`, no exit 3). Same pure-planner-then-deferred-commit + zero-write shape as sync().
// ---------------------------------------------------------------------------------------------
export async function syncLint(opts = {}) {
  const repoRoot = opts.repoRoot ?? process.cwd();
  const assetRoot = opts.assetRoot ?? DEFAULT_ASSET_ROOT;
  const dryRun = Boolean(opts.dryRun);
  const json = Boolean(opts.json);
  const relint = opts.relint ?? null;
  const now = opts.now ?? undefined;

  if (relint != null && !LINT_KEYS.has(relint)) {
    return finalizeLint({ exitCode: 2, message: `usage: unknown --relint tool '${relint}'`, json });
  }

  // Detect (same predicate eval as core sync).
  const hits = detect(repoRoot, { assetRoot });

  // Load manifest (invalid target manifest -> exit 4, zero writes).
  let manifest;
  try {
    manifest = loadTargetManifest(repoRoot) ?? {
      version: readVersion(assetRoot),
      rules: [],
      lint: [],
      conventions: null,
    };
  } catch (err) {
    if (err.code === 'ERR_INVALID_TARGET_MANIFEST') {
      return finalizeLint({
        exitCode: 4,
        message: `target manifest 不合法:${err.message},已中止且零写入`,
        json,
      });
    }
    throw err;
  }

  const lintPlan = armLint(hits, manifest, { repoRoot, assetRoot, relint, now });

  // Assemble next manifest: update ONLY the lint slice, preserve rules + conventions verbatim.
  const nextManifest = {
    version: manifest.version ?? readVersion(assetRoot),
    rules: Array.isArray(manifest.rules) ? manifest.rules : [],
    lint: lintPlan.nextLint,
    conventions: manifest.conventions ?? null,
  };
  const nextManifestStr = serializeManifest(nextManifest);
  const currentManifestStr = readIfExists(join(repoRoot, '.code-guidelines', 'manifest.json'));
  const manifestChanged = nextManifestStr !== currentManifestStr;

  // Never materialize an empty `.code-guidelines/manifest.json` just because the lint command ran
  // in a repo that has nothing to arm and no prior manifest — that would be a surprise write.
  // Only persist when there is a scaffold to write, a lint record to keep, or a manifest to update.
  const noManifestYet = currentManifestStr === null;
  const nothingToPersist = lintPlan.writes.length === 0 && lintPlan.nextLint.length === 0 && noManifestYet;
  const upToDate = nothingToPersist || (lintPlan.writes.length === 0 && !manifestChanged);
  const status = buildLintStatus({ upToDate, lintPlan });

  // Zero-write short-circuit / --dry-run: compute + report, no writes.
  if (upToDate) return finalizeLint({ exitCode: 0, status, json, upToDate: true });
  if (dryRun) return finalizeLint({ exitCode: 0, status, json, dryRun: true });

  // Commit phase: safety-check every target first, then write, manifest last.
  const allowedRoots = [repoRoot];
  const contentWrites = lintPlan.writes.map((w) => ({ absPath: w.absPath, content: w.content }));
  const manifestWrite = manifestChanged
    ? { absPath: join(repoRoot, '.code-guidelines', 'manifest.json'), content: nextManifestStr }
    : null;

  try {
    for (const w of contentWrites) assertSafeTarget(w.absPath, allowedRoots);
    if (manifestWrite) assertSafeTarget(manifestWrite.absPath, allowedRoots);
  } catch (err) {
    return finalizeLint({ exitCode: 4, message: `fs-safety 拒绝:${err.message},已中止且零写入`, json });
  }

  try {
    for (const w of contentWrites) {
      mkdirSync(dirname(w.absPath), { recursive: true });
      atomicWriteFile(w.absPath, w.content);
    }
    if (manifestWrite) {
      mkdirSync(dirname(manifestWrite.absPath), { recursive: true });
      atomicWriteFile(manifestWrite.absPath, manifestWrite.content);
    }
  } catch (err) {
    return finalizeLint({
      exitCode: 4,
      message: `lint 提交阶段写入失败:${err.message},已中止;manifest 未回写,避免描述与磁盘不符的状态`,
      json,
    });
  }

  return finalizeLint({ exitCode: 0, status, json });
}

function buildStatus({ upToDate, rulePlan, truncated, conventionsPresent, conventions }) {
  return {
    upToDate,
    added: rulePlan.added.map((a) => a.file),
    removed: rulePlan.removed.map((r) => r.file),
    upgraded: rulePlan.upgraded.map((u) => u.file),
    skipped: rulePlan.skipped.map((s) => ({ file: s.file, reason: s.reason })),
    truncated: truncated.map((t) => (t.rules && t.rules[0] ? `${t.rules[0]}.md` : t.id)),
    conventions: {
      present: conventionsPresent,
      ...(conventions && conventions.distilledAt ? { distilledAt: conventions.distilledAt } : {}),
    },
  };
}

function buildLintStatus({ upToDate, lintPlan }) {
  return {
    upToDate,
    lint: lintPlan.status.map((row) => {
      const out = { tool: row.tool, armed: Boolean(row.armed), gap: Boolean(row.gap) };
      if (row.installCmd) out.installCmd = row.installCmd;
      if (row.optedOut) out.optedOut = true;
      if (row.reason) out.reason = row.reason;
      return out;
    }),
  };
}

function finalize({ exitCode, status, message, json, upToDate, dryRun }) {
  if (json) {
    const obj = status
      ? { ...status, exitCode }
      : { upToDate: false, added: [], removed: [], upgraded: [], skipped: [], truncated: [], conventions: { present: false }, exitCode, message };
    return { exitCode, json: obj, text: null };
  }
  const text = message ?? renderTextReport(status, { upToDate, dryRun });
  return { exitCode, json: null, text, status };
}

// `/code-guidelines-lint` report finalizer — its own JSON/text shape (only `lint`), separate from
// the core sync report above so the two commands never leak each other's fields.
function finalizeLint({ exitCode, status, message, json, upToDate, dryRun }) {
  if (json) {
    const obj = status ? { ...status, exitCode } : { upToDate: false, lint: [], exitCode, message };
    return { exitCode, json: obj, text: null };
  }
  const text = message ?? renderLintReport(status, { upToDate, dryRun });
  return { exitCode, json: null, text, status };
}

// Companion-command discoverability line printed on every core report (the user only ever asked
// for lint/distill by their own commands, so the core report points at them without doing their
// work).
const CORE_HINT = '提示: /code-guidelines-lint 布防 lint 基线,/code-guidelines-distill 蒸馏本仓库约定';

function renderTextReport(status, { upToDate, dryRun } = {}) {
  if (!status) return '';
  const hasRuleNotice = status.skipped.length > 0;
  if (upToDate && !hasRuleNotice) return `已是最新,无变更\n${CORE_HINT}`;
  const lines = [];
  if (upToDate) lines.push('已是最新,无变更');
  if (dryRun) lines.push('[dry-run] 以下为拟改动,未写盘:');
  lines.push(`新增: ${status.added.length ? status.added.join(', ') : '(无)'}`);
  lines.push(`升级: ${status.upgraded.length ? status.upgraded.join(', ') : '(无)'}`);
  lines.push(`移除: ${status.removed.length ? status.removed.join(', ') : '(无)'}`);
  lines.push(
    `跳过: ${status.skipped.length ? status.skipped.map((s) => `${s.file}(${s.reason})`).join(', ') : '(无)'}`,
  );
  if (status.truncated.length) lines.push(`截断(超 12 上限): ${status.truncated.join(', ')}`);
  lines.push(
    `project-conventions.md: ${status.conventions.present ? '存在' : '不存在'}${status.conventions.distilledAt ? ` (蒸馏于 ${status.conventions.distilledAt})` : ''}`,
  );
  lines.push(CORE_HINT);
  return lines.join('\n');
}

function renderLintReport(status, { upToDate, dryRun } = {}) {
  if (!status) return '';
  const hasNotice = status.lint.some((row) => row.optedOut || row.reason);
  if (upToDate && !hasNotice) return '已是最新,无变更';
  const lines = [];
  if (upToDate) lines.push('已是最新,无变更');
  if (dryRun) lines.push('[dry-run] 以下为拟改动,未写盘:');
  if (!status.lint.length) lines.push('未检测到可布防的 lint 工具链');
  for (const row of status.lint) {
    if (row.armed && row.gap) lines.push(`lint ${row.tool}: 已布防,依赖缺口 -> ${row.installCmd}`);
    else if (row.optedOut) lines.push(`lint ${row.tool}: 已退出(用户删除脚手架)`);
    else if (row.reason === 'user-modified') lines.push(`lint ${row.tool}: 已布防,跳过(用户修改脚手架)`);
    else if (row.reason === 'path-conflict') lines.push(`lint ${row.tool}: 跳过(脚手架路径冲突)`);
    else if (row.reason) lines.push(`lint ${row.tool}: 跳过(${row.reason})`);
    else if (row.armed) lines.push(`lint ${row.tool}: 已布防`);
    else lines.push(`lint ${row.tool}: 已有配置,只读推荐`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// CLI entrypoint (only when executed directly).
// ---------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    command: 'sync',
    platform: undefined,
    dryRun: false,
    json: false,
    relint: null,
    distillRecord: null,
    force: false,
  };
  const rest = [...argv];
  // Positional subcommand: `lint` selects `/code-guidelines-lint`. Absent -> the core sync command.
  if (rest[0] === 'lint') {
    opts.command = 'lint';
    rest.shift();
  }
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    switch (arg) {
      case '--platform':
        opts.platform = rest[++i];
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--json':
        opts.json = true;
        break;
      case '--relint':
        opts.relint = rest[++i];
        break;
      case '--distill-record':
        opts.distillRecord = rest[++i];
        opts.command = 'distill-record';
        break;
      case '--force':
        opts.force = true;
        break;
      default:
        return { error: `unknown option: ${arg}` };
    }
  }
  // --relint only arms lint, so it is only valid under the `lint` command.
  if (opts.relint != null && opts.command !== 'lint') {
    return { error: `--relint is only valid with the 'lint' command` };
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
    } else if (res.reason === 'invalid-manifest') {
      process.stderr.write(`distill: ${res.message}\n`);
    }
    process.exit(res.exitCode);
  }

  const result = opts.command === 'lint' ? await syncLint(opts) : await sync(opts);
  if (result.json) process.stdout.write(`${JSON.stringify(result.json, null, 2)}\n`);
  else if (result.text) process.stdout.write(`${result.text}\n`);
  process.exit(result.exitCode);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
