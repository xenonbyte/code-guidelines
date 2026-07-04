# SPEC Subagent Review — WF-20260704-status-active-slug-rule-expansion-r1 / 06-spec.md (v1)

**Verdict: CHANGES_REQUESTED**

The `closesArray`/`stripStrings` fix itself is logically correct in every traced scenario (single-line
extras, multi-line non-final extras, PEP 735 inline tables, plain multi-line arrays, poetry table
mode). However the reopen introduced two defects outside the declared repair: (1) `SPEC-PYDEPS-001`
now calls a function (`parseRequirements`) it never defines — a genuine, objective completeness gap,
not a judgment call — and (2) the "read-only" Upstream Summary copy of `05-design.md` embedded in this
document was altered to no longer match the actual approved `05-design.md`, without a gap route to
DESIGN. Both are concrete, evidenced below via direct diff against the prior approved SPEC
(`.req-to-plan/WF-20260704-status-active-slug-rule-expansion/06-spec.md`, r2p_version 5) and against
the standalone `05-design.md` (r2p_version 3, approved, still active/un-reopened).

---

## Fix correctness

Traced the pseudocode at `06-spec.md:74-116` (SPEC-PYDEPS-001) against the five required scenarios.
Helper defs used: `stripInlineTables(s)=s.replace(/\{[^}]*\}/g,'')`,
`stripStrings(s)=s.replace(/"[^"]*"|'[^']*'/g,'')`, `closesArray(s)=stripStrings(stripInlineTables(s)).includes(']')`
(`06-spec.md:112-114`).

1. **Single-line `dependencies = ["uvicorn[standard]", "fastapi"]`** — not `inArray`; `rhs =
   ["uvicorn[standard]", "fastapi"]`; `quotedStrings` yields `uvicorn[standard]`, `fastapi` →
   `addName` truncates at `[` → `{uvicorn, fastapi}`. `closesArray(rhs)`: stripping both quoted
   spans leaves `[, ]`, which `.includes(']')` → `true` → `inArray` stays `false`. **Correct, no
   dangling state.**

2. **Multi-line one-per-line, non-final extras** (`[\n "uvicorn[standard]",\n "fastapi",\n]`):
   open line `dependencies = [` → `rhs="["`, `closesArray("[")` is `false` → `inArray=true`. Line
   `"uvicorn[standard]",`: `quotedStrings` → `uvicorn[standard]` → adds `uvicorn`; `closesArray`
   strips the quoted span leaving `,` → no `]` → `inArray` stays `true` (this is exactly the site
   the old `tr.includes(']')` got wrong — it would have seen the `]` inside `[standard]` and closed
   here, dropping everything after). Line `"fastapi",`: adds `fastapi`; still no bare `]` → stays
   `true`. Line `]`: `closesArray("]")` → `true` → closes. **Final set `{uvicorn, fastapi}` —
   correct, this is the regression the fix targets and it verifiably closes.**

3. **PEP 735 `include-group` inline table**, e.g. `test = ["pytest", {include-group = "dev"}]`:
   `stripInlineTables` removes the `{...}` span *before* `quotedStrings` runs, so `"dev"` is never
   extracted as a package name (only `pytest` is). `closesArray` also runs on the
   inline-table-stripped string, so a `]` appearing only inside a (now-removed) inline table cannot
   accidentally fail to close, and a `]` legitimately following the table is still seen. **Ordering
   (`stripInlineTables` before both `quotedStrings` and `closesArray`) is correct and consistently
   applied at both call sites** (`06-spec.md:88-89`, `98-99`).

4. **Normal multi-line array, no extras** (`[\n "requests",\n "click",\n]`): each element line has
   no `]` at all, so `closesArray` correctly stays `false` until the bare `]` line, which is
   unaffected by the quote-stripping change (no quotes to strip on that line) — behavior identical
   to the old code. **No regression for the common case.**

5. **Poetry table mode** (`[tool.poetry.dependencies]` / `[tool.poetry.group.*.dependencies]`):
   `closesArray`/`quotedStrings`/`stripStrings` are referenced only inside the `if (inArray)` block
   and the `mode == 'array'` branch (`06-spec.md:87-99`); the `mode == 'table'` branch
   (`06-spec.md:100-102`) never calls them. **Table mode is structurally unaffected by the fix.**

I additionally traced two harder cases not explicitly asked for but relevant to "does the fix ever
double-count or drop":
- Extras entry immediately followed by the closing bracket with no comma/space,
  `"uvicorn[standard]"]`: `quotedStrings` still extracts `uvicorn[standard]` → `uvicorn`;
  `closesArray` strips the quoted span leaving a bare `]` → closes correctly.
- Extras on the **open** line that does *not* close there, `dependencies = ["uvicorn[standard]",`
  (continues on subsequent lines): `rhs=["uvicorn[standard]",`; `closesArray(rhs)` strips the quoted
  span leaving `[,` → no `]` → `!closesArray(rhs)` → `inArray=true`. This is the open-line-branch
  analogue of the same bug (the old `rhs.includes(']')` would have seen `[standard]`'s `]` and
  wrongly treated the array as already closed after one element) — **also fixed correctly.**

I found **no case where the pseudocode drops or double-counts a dependency**, and no ordering bug
between `closesArray`/`quotedStrings`/`stripInlineTables`. I also compared the pseudocode's shape
against the actual (still-unpatched, pre-fix) implementation on disk at `assets/sync.mjs:460-490`
(`parsePyproject`, still using the buggy `tr.includes(']')` / `!rhs.includes(']')` at lines 468/483)
to sanity-check feasibility: the existing helper names/shapes (`addPyName`, `normalizePyName`,
`stripInlineTables`, `quotedStringsOf`, `classifyPyprojectSection`) already match the SPEC's
pseudocode almost 1:1, so introducing `stripStrings`/`closesArray` and swapping the two `.includes(']')`
sites is a minimal, low-risk, clearly-scoped patch consistent with existing code style. Feasible as
written.

## Completeness

- Both `.includes(']')` sites converted: **yes** — continuation branch (`06-spec.md:89`, `if
  closesArray(tr): inArray = false`) and array-open branch (`06-spec.md:99`, `if !closesArray(rhs):
  inArray = true`).
- Helper definitions present: **yes** — `stripStrings`/`closesArray` added at `06-spec.md:113-114`,
  alongside pre-existing `stripInlineTables`/`quotedStrings`.
- Case (h) present in `SPEC-SYNCTEST-001` (`06-spec.md:150`), in the Test Matrix
  (`06-spec.md:216`), **and** in the embedded DES-TEST-001 "mirror" (`06-spec.md:343`) — technically
  present in all three places asked for, **but** see Regression safety below: the DES-TEST-001
  "mirror" match only exists because the frozen Upstream Summary copy was edited to add it, not
  because it was independently authored twice.
- API/Data/Config Contracts note updated: **yes** (`06-spec.md:192`, "数组闭合检测无视引号串/内联表内的
  `]`").

**Gap not on the audit's completeness checklist but found while verifying it:** `SPEC-PYDEPS-001`'s
`mergePythonDeps` pseudocode (`06-spec.md:80`) still calls `parseRequirements(t, S)`, but
**`parseRequirements` is never defined anywhere in this document.** See Critical Finding 1.

## Regression safety

I diff'd `06-spec.md` against the **prior approved SPEC** used for the original PLAN-TASK-004 run
(`.req-to-plan/WF-20260704-status-active-slug-rule-expansion/06-spec.md`, r2p_version 5, approved
2026-07-04T07:03:53Z) to isolate exactly what the reopen changed. Outside SPEC-PYDEPS-001/SPEC-SYNCTEST-001/
the derived API-Data-Config/External-Docs/Test-Matrix/Non-goals/PLAN-Handoff lines that legitimately
belong to the declared fix, **every other SPEC-* section is byte-identical** (SPEC-CI-001,
SPEC-RELEASE-001, SPEC-SCAN-001, SPEC-PREDICATE-001, SPEC-STACKS-001, SPEC-STACKSTEST-001,
SPEC-RULE-001, SPEC-AUDIT-001, SPEC-PIN-001, SPEC-DOC-001, SPEC-REL-001, the Trace table, and the
Requirements Coverage / Options Considered / most of Chosen Design in the embedded upstream). Cases
(a)-(g) in SPEC-SYNCTEST-001 are untouched verbatim. Project Context blocks (both the top-level one at
`06-spec.md:415-426` and the one nested inside the design embed) are byte-identical to
`02-project-context.md`. **Good news: the blast radius of the reopen is otherwise exactly as narrow as
claimed.**

However, two real regressions were found:

**1) `parseRequirements` pseudocode silently deleted (Critical).** The prior approved SPEC defined it
in full, immediately after the helper defs:
```
parseRequirements(text, S):
  for raw in text.split(/\r?\n/):
    tr = raw.replace(/\s+#.*$/, '').trim()          // strip inline comments first
    if tr == '' || tr.startsWith('#') || tr.startsWith('-'): continue
    if /^[a-z][a-z0-9+.-]*:\/\//i.test(tr): continue   // only skip whole-line URL-scheme direct refs;
                                                        // not includes('://') (avoids hurting `pkg @ url`)
    addName(tr, S)
```
This exact logic is what is **already implemented and tested** on disk today at
`assets/sync.mjs:492-499` (`parseRequirements`, byte-for-byte matching comments included). The
reopened `06-spec.md` deletes this whole block and also reverts the accompanying prose at
`06-spec.md:117` ("`[project]` 的 `keywords`/`classifiers`/`requires-python` 等非 `dependencies` 键跳过...")
to drop any mention of the requirements-line contract; the only remaining description of
requirements-line parsing is the generic DES-DETECT-002 mirror sentence at `06-spec.md:326`
("跳过空行、`#` 注释行、`-` 开头选项行、URL 行"), which is silent on *how* a "URL line" is detected. This
matters: the deleted comment explicitly documents that the anchored regex was chosen over
`includes('://')` specifically to avoid mis-skipping PEP 508 direct references like `pkg @
https://...` (an `includes('://')`-anywhere check would treat that whole line as a bare URL and drop
`pkg`). Nothing in the current document pins that decision anymore, and `SPEC-SYNCTEST-001` has no
`pkg @ url` or inline-comment test case to catch a regression here. This has nothing to do with the
declared array-closure defect and is not "carried forward unchanged."

**2) Read-only Upstream Summary (design.md embed) does not match the actual approved `05-design.md`
(Critical, see Design fidelity below for the routing implication).**

## Design fidelity

`DES-DETECT-002` as actually approved in the standalone `05-design.md:73` (r2p_version 3, approved
2026-07-04T06:31:30Z, **never reopened**) says only: "...与跨行数组（逐行抽取引号内串，遇 `]` 结束）" — i.e.
"closes on `]`," full stop, with no notion of ignoring brackets inside quoted strings. `DES-TEST-001`
at `05-design.md:94` enumerates exactly 7 cases, (a)-(g).

The copy of this same content embedded as "Upstream Summary (read-only)" inside `06-spec.md` (lines
258-413) does **not** match:
- `06-spec.md:322` reads "...遇数组闭合 `]` 结束——闭合判定须无视引号串内的 `]`）" — the quote-exclusion
  clause was added.
- `06-spec.md:343` reads "(a)–(h)" and describes an 8th case — added.
- `06-spec.md:380` (Observability) and `06-spec.md:387,390` (SPEC Handoff) — both carry
  derivative mentions of the same additions.

I verified this is a genuine content divergence and not a copy artifact by diffing
`06-spec.md`'s embedded block against the standalone `05-design.md`'s own content (stripping each
document's frontmatter/nested-upstream sections first): the *only* differences are exactly these
closure-rule and case-count additions, plus a pre-existing, unrelated `Status:` casing-normalization
pattern that also appears between `04-risk-discovery.md` and its embed inside `05-design.md` (e.g.
`mitigated`→`Mitigated`) — that normalization is not attributable to this reopen and is not a
substantive-content change, so it is not flagged as a finding here.

**This is exactly the scenario `r2p-gap-open`/`r2p-gap-resolve` exist for.** `run.md`'s Reopen
Lineage explicitly names "Owning IDs SPEC-PYDEPS-001 / DES-DETECT-002," acknowledging DES-DETECT-002
is implicated — yet `run.md`'s "Open Routes" table is empty: no gap was opened back to DESIGN, and
DES-DETECT-002/DES-TEST-001 were never re-approved with the new closure rule / 8th case. Instead, the
frozen record of what DESIGN approved was edited in place inside the downstream SPEC document. Net
effect: the document now falsely represents DESIGN as having already specified quote-aware array
closure and an 8-case test matrix, when the actually-approved DESIGN did not. Per the audit brief's
own framing, this is a design-level decision that changed without being routed through DESIGN, and it
should be flagged rather than silently accepted.

Two acceptable remediations, either is fine: (a) open a gap route to DESIGN so DES-DETECT-002/
DES-TEST-001 formally absorb the closure-rule correction and the 8th case, then regenerate the
Upstream Summary as a true fresh copy; or (b) revert the embedded Upstream Summary to verbatim match
the current `05-design.md`, and let `SPEC-PYDEPS-001`'s own (legitimately SPEC-owned) text carry the
full explanation that it is *correcting* an under-specified/incorrect DESIGN clause — which is exactly
what `SPEC-PYDEPS-001`'s own prose at `06-spec.md:72,117` already does well, so option (b) costs
nothing but deleting the improper edits to the frozen block.

Substantively, is the refinement itself "within design intent"? Borderline-yes for a first read
("closes on `]`" is silent on quoting, and the fix is a reasonable disambiguation, not a reversal),
but the discovered defect (dropping all subsequent deps) shows the literal design text was actually
*wrong*, not merely ambiguous — which is precisely why this should have been routed rather than
patched in place.

Note for context, not exculpation: this same drift pattern (SPEC enriching the frozen design copy
beyond `05-design.md`'s literal text) is also present, independently, in the **original approved**
SPEC (r2p_version 5) for the requirements-line "URL 行" nuance — suggesting this may be a systemic
habit of this pipeline rather than something unique to the r1 reopen. That does not make it
acceptable; it suggests the read-only-embed mechanism needs a harness-level fix (e.g. a diff check
against the source stage document before SPEC is marked `ready`), not just a one-off correction here.

## Unresolved ambiguity

- The declared Non-goal at `06-spec.md:229` ("`closesArray` 的引号串剥离用简单正则...不处理 TOML 转义引号/
  多行三引号串...") is judged **acceptable, bounded**: dependency names never contain quote characters,
  the limitation is identical in kind to the pre-existing `quotedStrings` regex's own limitation (not
  a new weakness introduced by this fix), and it is stated plainly rather than hedged.
- No `TBD`/hedging language found in SPEC-PYDEPS-001 or SPEC-SYNCTEST-001 proper.
- The `parseRequirements` gap (Critical Finding 1) *is* an unresolved-ambiguity problem in practice,
  even though it wasn't phrased as a hedge: an executor has no pinned contract for "how is a URL line
  detected" and could reasonably reintroduce the `includes('://')` bug the deleted comment warned
  against. Flagged there rather than duplicated here.

## Executable precision

`SPEC-PYDEPS-001`'s `parsePyproject`/`closesArray`/`stripStrings`/`stripInlineTables`/`quotedStrings`
pseudocode is precise and implementable without guessing — every branch and helper composition was
traceable to a single, unambiguous outcome across all scenarios tested above. **However, the
document as a whole is not fully executable as written**: `mergePythonDeps` invokes
`parseRequirements(t, S)` (`06-spec.md:80`) with zero definition anywhere in the document (Critical
Finding 1). An executor would have to either dig up the already-committed implementation on disk (not
guaranteed, and contrary to "faithful transcription" discipline that triggered the original defect) or
guess, which reopens exactly the kind of transcription risk this reopened run exists to close.

## Findings

1. **[Critical] `SPEC-PYDEPS-001` calls an undefined function `parseRequirements`.**
   File: `.req-to-plan/WF-20260704-status-active-slug-rule-expansion-r1/06-spec.md`, line 80 (call
   site); the definition that should sit near line 115 is entirely absent, and it was present in the
   prior approved SPEC.
   Failure scenario: an executor implementing `mergePythonDeps` faithfully from this SPEC has no
   contract for requirements.txt line parsing beyond the vague DES-DETECT-002 mirror sentence ("URL
   行"); a plausible-but-wrong implementation (`tr.includes('://')` instead of an anchored
   line-start regex) would silently drop PEP 508 direct references (`pkg @ https://...`), and no case
   in SPEC-SYNCTEST-001 (a)-(h) would catch it. Unrelated to the declared array-closure defect;
   violates the "everything else carried forward unchanged" premise of this reopen.

2. **[Critical] Read-only Upstream Summary (design.md embed) diverges from the actual approved
   `05-design.md`, with no gap route opened to DESIGN.**
   File: `.req-to-plan/WF-20260704-status-active-slug-rule-expansion-r1/06-spec.md`, lines 322, 343,
   380, 387, 390 (embedded DES-DETECT-002/DES-TEST-001/Observability/SPEC-Handoff text); compare
   `05-design.md` lines 73, 94 (standalone, still-approved, r2p_version 3) and `run.md`'s empty "Open
   Routes" table.
   Failure scenario: a later reader (or an automated R3 trace-closure check) trusts the "read-only"
   block as DESIGN's true approved position and concludes DES-DETECT-002 already specified
   quote-aware array closure and an 8-case test matrix — masking that this is actually an
   unrouted, in-place correction of a DESIGN clause that (per the discovered bug) was not merely
   ambiguous but factually wrong as approved.

No further findings beyond these two; the fix's own logic (the part the reopen was chartered to
repair) is correct and complete.
