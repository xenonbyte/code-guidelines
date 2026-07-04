# PLAN Subagent Review — WF-20260704-status-active-slug-rule-expansion-r1 / 07-plan.md (v2)

**Verdict: APPROVE**

The re-derived PLAN correctly traces to all 13 approved SPEC-* contracts, correctly carries the
`closesArray` quote-aware fix and case (h) into PLAN-TASK-004's Skeleton/Steps/Verification, labels
Change Type consistently with the on-branch working tree, drops no in-scope item, and its S1→S2→S3
commit partition matches SPEC-REL-001 exactly. One Important finding: TASK-001/002/003's Steps and
essentially all of TASK-004's Steps (except the `closesArray` fix + case (h)) describe work that is
**already fully present and passing on the current branch**, and several SPEC line-number anchors the
PLAN echoes verbatim (`assets/sync.mjs:256/:264`, `assets/stacks.json:517/:534/:655/:670/:721`) are
now stale by the amount the prior buggy commit (`a9bd219`) already shifted those files — the PLAN does
not flag this "verify-first" reality anywhere. This is a plan-clarity/efficiency gap, not a target-state
defect (the Skeleton and Verification correctly pin the actual delta), so it does not block approval.
One Minor finding: SPEC-REL-001's prose (inherited verbatim into PLAN's read-only Upstream Summary)
cites a non-existent `SPEC-RULE-002`.

---

## Spec traceability

All 13 SPEC-* IDs defined in 06-spec.md's Behavior Contracts (`SPEC-CI-001`, `SPEC-RELEASE-001`,
`SPEC-SCAN-001`, `SPEC-PYDEPS-001`, `SPEC-PREDICATE-001`, `SPEC-STACKS-001`, `SPEC-STACKSTEST-001`,
`SPEC-SYNCTEST-001`, `SPEC-RULE-001`, `SPEC-AUDIT-001`, `SPEC-PIN-001`, `SPEC-DOC-001`,
`SPEC-REL-001`) are covered by exactly one PLAN-TASK each (several IDs share a task where the SPEC
itself groups them):

| SPEC ID | PLAN-TASK |
|---|---|
| SPEC-CI-001 | TASK-001 |
| SPEC-RELEASE-001 | TASK-002 |
| SPEC-DOC-001 | TASK-003, TASK-005 (two distinct SCOPE-IN items, two commits — correct) |
| SPEC-SCAN-001, SPEC-PYDEPS-001, SPEC-PREDICATE-001, SPEC-STACKS-001, SPEC-STACKSTEST-001, SPEC-SYNCTEST-001 | TASK-004 |
| SPEC-RULE-001, SPEC-PIN-001 | TASK-006 |
| SPEC-AUDIT-001 | TASK-007 |
| SPEC-REL-001 | TASK-008 |

The PLAN's own `## Trace` table (lines 222–233) and the mirrored SPEC `## Trace` table (lines
473–489) both list all 13 IDs with `[ADDRESSED]`/`ADDRESSED` and agree with each PLAN-TASK's `Spec
References:` field verbatim — no drift between the two tables. No PLAN-TASK cites a SPEC ID that
doesn't exist; no SPEC behavior contract is left unclaimed by any task.

## Fix-carried-into-plan (TASK-004)

Confirmed present and consistent:
- Skeleton (lines 100–107) defines `stripStrings`, `closesArray` (`stripStrings(stripInlineTables(s)).includes(']')`) exactly matching SPEC-PYDEPS-001's pseudocode (06-spec.md:113–115), and shows `mergePythonDeps`/`matchPythonDeps` wired the same way as the SPEC contract.
- Steps bullet 1 explicitly says "先写 `test/sync.test.mjs` 的 (a)–(h) 八例（含 (h) 跨行数组非末位 extras 假阴回归...)" — eight cases, not seven, with (h) named and described correctly.
- Steps bullet 3 explicitly calls out "跨行数组闭合以 `closesArray`（引号串/内联表外的 `]`）判定——extras 内 `]` 不提前闭合" as the SPEC-PYDEPS-001 contract detail.
- Verification (1) explicitly requires "(h) 跨行 extras 假阴回归" to pass, and Verification (4) requires a scratch-repo dogfood example for the same multi-line-extras case.
- The PLAN's own Test Matrix (lines 439–455) and the embedded SPEC-SYNCTEST-001 section (lines 375–384) both list (a)–(h), matching.

No case is silently dropped back to (a)–(g); the fix is unambiguously the target end-state.

## Change-Type correctness

Verified against `git log` and the current working tree:
- TASK-001 (`ci.yml`) / TASK-002 (`release.yml`): both files already exist on-branch (commits `ced32e9`, `6296d5c`) — `Change Type: modify` is correct, not `create`.
- TASK-003 (`AGENTS.md`/`CLAUDE.md` CI sentence): already committed (`f3ac999`, `b35ef8a`) — `modify` correct.
- TASK-004 (`assets/sync.mjs`, `assets/stacks.json`, `test/sync.test.mjs`, `test/stacks.test.mjs`): all four files already carry the prior buggy pythonDeps implementation (commit `a9bd219`) — `modify` correct.
- TASK-005 (`CLAUDE.md`/`AGENTS.md` predicate list): existing files — `modify` correct.
- TASK-006: primary artifact is 9 *new* `assets/library/*.md` files — `create` is the right label even though the task also touches existing files (`stacks.json`, `VERSION`, test files, README/THIRD-PARTY/AGENTS/CLAUDE) for the 48→57 linkage; this mixed-artifact labeling-by-primary-deliverable is consistent with how TASK-004 (labeled `modify` despite the Files list including test files with new cases) is handled, so it isn't a double standard.
- TASK-007 (existing library files, conditional edits) / TASK-008 (`package.json`): both `modify`, correct.

No task mislabels its Change Type against the working tree.

## Coverage / no-dropped-scope

All 14 `SCOPE-IN-001`..`014` items trace through Design → SPEC → PLAN without loss:

- SCOPE-IN-001→SPEC-CI-001→TASK-001; SCOPE-IN-002→SPEC-RELEASE-001→TASK-002; SCOPE-IN-003→SPEC-DOC-001→TASK-003; SCOPE-IN-004..008→{SPEC-SCAN/PYDEPS/PREDICATE/STACKS/STACKSTEST/SYNCTEST}→TASK-004; SCOPE-IN-009→SPEC-DOC-001→TASK-005; SCOPE-IN-010→SPEC-RULE-001→TASK-006; SCOPE-IN-011→SPEC-AUDIT-001→TASK-007; SCOPE-IN-012→SPEC-PIN-001→TASK-006; SCOPE-IN-013/014→SPEC-REL-001→TASK-008 (structurally also enforced by the S1/S2/S3 task grouping itself, not just TASK-008's content).

Risk Handling table (07-plan.md:209–220) lists all 9 risks from 04-risk-discovery.md
(`RISK-SEC-001/002`, `RISK-COMPAT-001`, `RISK-DETECT-001/002`, `RISK-REGR-001`, `RISK-REL-001`,
`RISK-AUDIT-001`, `RISK-PIN-001`) each mapped to a handling task with `[ADDRESSED]` — no risk from
upstream is missing or silently downgraded.

## Consistency

- Delivery order S1→S2→S3 and the commit partition (① TASK-001/002/003, ② TASK-004/005, ③
  TASK-006, ④ TASK-007 conditional, then TASK-008+G4) match SPEC-REL-001's prose exactly, both in
  the PLAN's intro paragraph (line 11) and Execution Readiness (line 203).
- TASK-004's "S2 不可分单元" note and TASK-006's "数量耦合不可分" note are consistent with
  DES-PIN-001/RISK-REGR-001's rationale that the 48→57 count and its 16 linked doc positions must
  land in one commit, and that TASK-004's SPEC-SCAN/PYDEPS/PREDICATE/STACKS/STACKSTEST/SYNCTEST
  contracts are mutually test-coupled.
- No task's Verification contradicts another's; the dogfood-ban-on-this-repo rule is repeated
  consistently in the PLAN intro, Execution Readiness, TASK-004 Verification, and TASK-006
  Verification.

## Unresolved ambiguity

- None found that would let an executor legitimately choose between two different target
  end-states — Execution Readiness explicitly states "无未决歧义" and the three Open Questions
  from the requirement brief (Windows-leg escalation, trusted-publisher timing, audit scope) are
  each given an explicit, non-hedged resolution path (see TASK-001/004 and TASK-002/008 notes).
- Case (d)/(f)'s "非必须" (not required) language in SPEC-SYNCTEST-001, echoed into the PLAN's
  Upstream Summary, is a stated scope boundary, not a hedge — it tells the executor explicitly
  which extra coverage is optional, not ambiguous.
- The one place an executor *could* be misled (not a two-way ambiguity, but a scope-size
  miscalibration) is TASK-004's Steps reading as a from-scratch build list when ~90% of that
  described work is already on disk — see Findings, Important.

## Findings

### Important — TASK-001/002/003/004 Steps restate already-completed work; several SPEC line anchors are stale against the current tree

**File**: `.req-to-plan/WF-20260704-status-active-slug-rule-expansion-r1/07-plan.md` (PLAN-TASK-004, lines 89–115; also PLAN-TASK-001/002/003)

**Summary**: TASK-004's Steps list ("先写...八例", "scanRepo：...", "实现 mergePythonDeps", "接入
matchPythonDeps...", "assets/stacks.json：六处 detect...") reads as full greenfield work, but direct
inspection of the current working tree shows all of it is already present and green except the
`closesArray` quote-awareness fix and test case (h):
- `assets/sync.mjs` already has `EXCLUDED_DIRS` with `.venv`/`venv`/`__pycache__`, the
  `pyprojectTexts`/`requirementsTexts` collection, `mergePythonDeps`/`matchPythonDeps`, the `detect`/
  `baseMatch` wiring, and the "five-predicate"/"four populated" comment text — all already migrated
  by commit `a9bd219`. The only defect is the two `.includes(']')` checks (currently raw, not
  quote-stripped) in `parsePyproject`.
- `assets/stacks.json` is already at `"version": "1.1.0"` with all six `pythonDeps` detect blocks
  (fastapi/flask/django/pytest/python-ml/mongodb) in place.
- `test/stacks.test.mjs` already has the `pythonDeps` validator branch, the "five-predicate" test
  name, and the updated assertion text.
- `test/sync.test.mjs` already has cases (a)–(g) passing against the current (buggy) implementation;
  only case (h) is new (and is the one case that will fail red against the current code, proving the
  bug, until `closesArray` lands).
- SPEC-SCAN-001 (`:43`), SPEC-DETECT-003 comment sync (`:256`/`:264`), and SPEC-STACKS-001
  (`:500`/`:517`/`:534`/`:655`/`:670`/`:721`) — all echoed verbatim into the PLAN — are line-number
  anchors computed against the pre-`a9bd219` tree. The current tree's actual positions are
  `:258`/`:268` for the comment block and `:520`/`:537`/`:658`/`:677`/`:736` for
  fastapi/flask/mongodb/python-ml/pytest respectively (confirmed by direct `grep -n`). TASK-001's
  `ci.yml` and TASK-002's `release.yml` and TASK-003's CI-gate sentence are, similarly, byte-for-byte
  already what their Steps describe adding.

**Failure scenario**: An executor subagent that treats the PLAN's Steps and the SPEC's line-number
citations as a literal to-do list (rather than first diffing current-state-vs-target) could either
(a) waste the task budget re-deriving/re-writing code that's already correct, risking an
inadvertent regression if the rewrite isn't byte-identical to the already-tested version, or (b) get
confused when a cited line number doesn't contain the described content in the current file. The
Verification gate (full `node --test` + `npm run check` + dogfood) would catch a resulting behavioral
regression before the task is marked done, so this is not a silent-wrong-final-state risk — it's an
execution-efficiency and confusion risk, which is why this is Important rather than Critical.

**Recommendation** (non-blocking): add one line to TASK-004's (and optionally 001/002/003's) Steps,
e.g. "Files already carry TASK-004's prior (buggy) implementation from commit `a9bd219`; diff current
state against this contract first — the only expected code delta is the `closesArray`/`stripStrings`
quote-awareness fix in `parsePyproject` plus the new case (h) test (and its (a)→(a)-(h) header
update)." This does not change the target end-state and can be applied as a plan patch without a full
re-derivation.

### Minor — SPEC-REL-001 prose cites a non-existent `SPEC-RULE-002`

**File**: `.req-to-plan/WF-20260704-status-active-slug-rule-expansion-r1/07-plan.md:421` (and identically inherited from `06-spec.md:194`)

**Summary**: SPEC-REL-001's commit-partition prose reads "③ S3-feat（`SPEC-RULE-001/002` +
`SPEC-PIN-001`）", but only `SPEC-RULE-001` exists among the 13 approved Behavior Contracts (grep
confirms no `SPEC-RULE-002` header anywhere in `06-spec.md`). This is a dangling reference, likely a
leftover from an earlier draft where new-rules and version-audit were split into two RULE IDs before
being consolidated into `SPEC-RULE-001` + `SPEC-AUDIT-001`.

**Failure scenario**: Low — no PLAN-TASK's own `Spec References:` field cites `SPEC-RULE-002` (only
the free-text prose inside the SPEC-REL-001 section does, which the PLAN dutifully mirrors
read-only), so no task is built against a phantom contract. An executor reading only the
Trace table and each task's `Spec References:` would never encounter this string. It is a
documentation-hygiene defect inherited unmodified from the already-approved SPEC, not something the
PLAN re-derivation introduced or could have fixed within its own scope (SPEC-REL-001's authored text
belongs to the SPEC stage). Flagged here for completeness; does not block PLAN approval.
