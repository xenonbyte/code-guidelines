# SPEC Subagent Review — WF-20260704-status-active-slug-rule-expansion-r1 / 06-spec.md (v2)

**Verdict: APPROVE**

Both Criticals found in v1 are resolved, cleanly and surgically. A full diff of v2 (`06-spec.md`)
against the exact v1 content (`inputs/spec-content.md`, the artifact v1 reviewed) shows the entire
repair is 67 diff lines: a frontmatter version bump, the reinstated `parseRequirements` definition,
and four reversions of the previously-corrupted read-only Design mirror back to verbatim
`05-design.md` text. Nothing else in the document changed. Independent re-tracing of the
`closesArray`/`stripStrings` fix across five scenarios (plus two edge cases) finds it correct, and no
new regression was introduced by the repair itself.

---

## Prior Critical 1 status: RESOLVED

`SPEC-PYDEPS-001` now defines `parseRequirements(text, S)` at `06-spec.md:117-123`, called from
`mergePythonDeps` at `06-spec.md:80` (`for t in requirementsTexts: try { parseRequirements(t, S) } catch {}`).
The definition:

```
parseRequirements(text, S):
  for raw in text.split(/\r?\n/):
    tr = raw.replace(/\s+#.*$/, '').trim()          // strip inline comments first
    if tr == '' || tr.startsWith('#') || tr.startsWith('-'): continue
    if /^[a-z][a-z0-9+.-]*:\/\//i.test(tr): continue   // whole-line URL-scheme only
    addName(tr, S)                                   // `pkg @ https://…` handled by name regex
```

This is byte-identical to what v1's review confirmed was already implemented and tested on disk
(`assets/sync.mjs:492-499`) and to the prior approved (pre-reopen) SPEC. Confirmed:
- Inline-comment stripping requires a preceding whitespace run (`\s+#.*$`); a same-line comment with
  no leading space (e.g. `pkg#note`) is not stripped by this line, but `addName`'s
  `^[A-Za-z0-9][A-Za-z0-9._-]*` regex truncates at `#` anyway, so no name is ever corrupted by this —
  the strip is belt-and-suspenders, not load-bearing, for that sub-case.
- The URL-scheme regex is anchored (`^...`), so `pkg @ https://example.com/pkg.whl` (PEP 508 direct
  reference) is *not* skipped — `tr` starts with `pkg`, not a scheme — and `addName` naturally extracts
  `pkg`. A bare `https://example.com/x.whl` line *is* skipped (starts with the scheme). This exactly
  preserves the design rationale the deleted v1 text had warned about losing (anchored regex vs.
  `includes('://')`).
- `-e ...` / `--index-url ...` / `-r other.txt` option lines are all caught by `tr.startsWith('-')`.

No gap remains; the function is fully specified and matches the already-battle-tested on-disk
implementation.

## Prior Critical 2 status: RESOLVED

Extracted the embedded "Upstream Summary (read-only)" Design mirror from `06-spec.md`
(`## Upstream Summary (read-only)` at line 264 through its `<!-- /r2p-read-only -->` at line 420,
excluding the nested Project Context block) and diffed it against `05-design.md`'s own authored
content (from its `# Design` heading through its own `## Trace` table, i.e. before *its* nested
`## Upstream Summary (read-only)` at line 165) — **the diff is empty (byte-for-byte identical)**.

Concretely, comparing v1 (`inputs/spec-content.md`) to v2 (`06-spec.md`) shows exactly four reversions
inside the mirror, all restoring `05-design.md`'s literal wording:
- `DES-DETECT-002` mirror: "遇数组闭合 `]` 结束——闭合判定须无视引号串内的 `]`" → reverted to "遇 `]` 结束"
  (no quote-exclusion clause) — matches `05-design.md:73`.
- `DES-TEST-001` mirror: "`test/sync.test.mjs`：新增 (a)–(h) 用例...(h) 跨行数组含非末位 extras..." →
  reverted to "新增 (a)–(g) 七例" with no (h) — matches `05-design.md:94`.
- `Observability` mirror: dropped "、跨行 extras 回归 (h)、" from the test-assertion bullet — matches
  `05-design.md:131`.
- `SPEC Handoff` mirror items 1 and 4: dropped "跨行数组闭合无视引号串内 `]`、" and changed
  "(a)–(h) 八个" back to "(a)–(g) 七个" — matches `05-design.md:138,141`.

The fix wording (quote-aware `closesArray`, the 8th case) now appears **only** in the SPEC's own
authored sections — `SPEC-PYDEPS-001` (`06-spec.md:72,124`), `SPEC-SYNCTEST-001` (`06-spec.md:157`),
API/Data/Config Contracts (`06-spec.md:199`), Non-goals (`06-spec.md:236`), External Documentation
Checked (`06-spec.md:209`), Test Matrix (`06-spec.md:223`), and PLAN Handoff (`06-spec.md:242`) — never
in the read-only mirror. `run.md`'s Open Routes table remains empty, which is consistent with the v1
review's remediation option (b) (revert the mirror; let SPEC's own prose carry the correction) rather
than option (a) (open a gap route to DESIGN) — both were offered as acceptable, and (b) was chosen and
executed correctly.

## Fix correctness (traced cases, independent re-verification)

Re-traced `parsePyproject`/`closesArray`/`stripStrings`/`stripInlineTables`/`quotedStrings`
(`06-spec.md:83-115`), which are unchanged from v1 (only `parseRequirements` was appended after them):

1. **Single-line extras array** `dependencies = ["uvicorn[standard]", "fastapi"]`: open-line branch,
   `rhs` quotedStrings yields both names (`addName` truncates `uvicorn[standard]`→`uvicorn`);
   `closesArray(rhs)` strips both quoted spans leaving `[, ]` → contains `]` → true → `inArray` never
   set. Correct, single pass.
2. **Multi-line, non-final extras** (`[\n "uvicorn[standard]",\n "fastapi",\n]`): open line sets
   `inArray=true` (rhs=`[`, no `]` outside quotes). Extras line adds `uvicorn`, `closesArray` strips
   the quoted span leaving `,` → no bare `]` → stays open (this is exactly the site the old
   `tr.includes(']')` broke). Next line adds `fastapi`, still open. Closing `]` line closes. Result
   `{uvicorn, fastapi}` — both captured, the regression is fixed.
3. **PEP 735 include-group inline table** (`test = ["pytest", {include-group = "dev"}]`):
   `stripInlineTables` removes the `{...}` span before both `quotedStrings` and `closesArray` run, so
   `dev` is never captured as a package name and a `]` inside a table (none here, but in general) can't
   be miscounted. Ordering is applied consistently at both call sites (open-line `06-spec.md:98-99` and
   continuation `06-spec.md:88-89`).
4. **Plain multi-line array, no extras** (`[\n "requests",\n "click",\n]`): no quoted-bracket
   interaction at all; behavior identical to pre-fix code. No regression.
5. **Poetry table mode**: `closesArray`/`quotedStrings`/`stripStrings` are referenced only inside the
   `if (inArray)` block and the `mode == 'array'` branch; `mode == 'table'` (`06-spec.md:100-102`)
   never touches them — structurally unaffected.

Also re-checked two boundary cases: extras token immediately followed by the closing bracket with no
separator (`"uvicorn[standard]"]`) still closes correctly (quoted span stripped leaves a bare `]`), and
extras on the *opening* line that doesn't close there (`dependencies = ["uvicorn[standard]",`) is
correctly kept open. No case was found where the pseudocode drops or double-counts a dependency.

**Case (h)** (`06-spec.md:157`) is present and correctly specified: fixture
`[project]\ndependencies = [\n  "uvicorn[standard]",\n  "fastapi",\n]\n`, assertion
`ids.includes('fastapi')`. It is also correctly reflected in the authored Test Matrix
(`06-spec.md:223`) and API/Data/Config Contracts (`06-spec.md:199`), while the read-only DESIGN mirror
correctly stays at (a)–(g) (verified above) — the authored/mirror split is consistent throughout the
document.

## New-regression check

Diffed v2 against the exact pre-repair content (`inputs/spec-content.md`) line-for-line: the entire
change set is the frontmatter bump, the `parseRequirements` addition, and the four mirror reversions
listed above — nothing else moved. No SPEC-* contract other than SPEC-PYDEPS-001's own authored text
was touched; SPEC-CI-001, SPEC-RELEASE-001, SPEC-SCAN-001, SPEC-PREDICATE-001, SPEC-STACKS-001,
SPEC-STACKSTEST-001, SPEC-RULE-001, SPEC-AUDIT-001, SPEC-PIN-001, SPEC-DOC-001, SPEC-REL-001, and the
Trace table are untouched. `parseRequirements`'s reinstatement introduces no interaction with the
`closesArray` fix (they're independent code paths — pyproject array parsing vs. requirements.txt line
parsing) and no double-definition or naming collision was found. The repair is exactly as narrow as it
should be.

## Unresolved ambiguity

- Pre-existing, not introduced by this repair: case (f)'s "畸形 pyproject" fixture content is left to
  executor discretion (`06-spec.md:155` explicitly says triggering the `try/catch` path specifically is
  "非必须"). This is an intentional, stated scope boundary (the state machine is documented as robust
  against most malformed input without needing the catch clause) rather than a hedge — acceptable as
  written, and unchanged from what v1 already carried forward without objection.
- The Non-goals disclaimer on `closesArray`'s simple quote-stripping regex (no TOML escaped-quote /
  triple-quoted-string handling, `06-spec.md:236`) is a stated, bounded limitation consistent with the
  pre-existing `quotedStrings` regex's own limitation — not new, not hedging.
- No `TBD`/undecided language found anywhere in SPEC-PYDEPS-001, SPEC-SYNCTEST-001, or the four
  reverted mirror passages.

## Findings

None. Both prior Criticals are verified fixed with direct byte-level evidence, the fix logic traces
correctly through all required scenarios plus two additional boundary cases, and the repair introduced
no new defects or scope creep.
