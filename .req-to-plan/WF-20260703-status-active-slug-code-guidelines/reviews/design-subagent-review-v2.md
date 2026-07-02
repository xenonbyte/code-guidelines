# Design Subagent Review (v2)

## Verdict
Changes Requested — all v1 findings (1 BLOCKER + 2 MAJOR + 4 MINOR + 3 NIT) are genuinely resolved, but the revision left a self-contradiction on the install-commit mechanism: the Design Summary and DES-TEST-001 still say "uninstall-first" while DECISION-006/DES-INSTALL-001 now mandate two-phase stage-then-swap ("从不先删旧文件"). Narrow, wording-level fix; no re-architecture needed.

## v1 findings resolution

- **BLOCKER symlink safety: Resolved.** New component **DES-FSSAFE-001** (design.md:86–87) states one shared invariant governing install engine, `sync.mjs` target writes, and entry-doc editing: lstat the target path *and every parent dir*, reject any symlink (never follow), confine normalized paths to per-operation allowed roots (install: platform skill dir / `~/.code-guidelines/`; sync: repo-root `.code-guidelines/`, root scaffolding config, root entry docs), and always temp-file + atomic-rename. DES-INSTALL-001 (:84), DES-SYNC-001 (:99), and DES-PRECHECK-001 (:111) each reference it (entry-doc edit explicitly lstat's the file itself). Risk table maps `RISK-SAFE-003 → DES-FSSAFE-001(安装 + 同步 + 入口编辑)` (:53). DES-TEST-001 adds "目标侧 symlink 拒绝" under sync alongside the installer's "symlink 拒绝" (:129). Trace has a `DES-FSSAFE-001` row (:214). The half-covered gap is closed.

- **MAJOR rollback: Resolved.** DECISION-006 (:168–173) is well-formed (Question/Options A,B/Selected B/Rationale/Status: selected) and selects two-phase commit: stage all new files to temp, verify, atomic-rename in, and remove no-longer-installed old owned files *only after* the new set is in place; any pre-commit failure discards staging and leaves the prior install untouched. DES-INSTALL-001 (:84), Options Considered (:73), and Rollback (:178) all describe this consistently, and the rationale correctly explains why SHA-256 hashes cannot reconstruct overwritten content (killing option A). This is exactly the v1-recommended fix and is feasible. (Residual wording contradiction elsewhere — see new MINOR — does not undo the mechanism.)

- **MAJOR specificity: Resolved.** DES-RECONCILE-001 (:104–105) declares selection "检测输出的纯确定性函数" and defines the full total order across all 9 categories: 核心 always-selected + pinned + exempt from truncation; priority 核心 > 框架层{前端,移动,后端} > 语言层{语言} > 领域层{数据,测试,DevOps,横切}; intra-tier tiebreak on `stacks.json` registry order; 12-file cap (incl. core); over-cap truncation from lowest priority with truncated items reported. All 9 categories are assigned (1+3+1+4 groupings = 9), so the comparator is now a defined total order — closing the idempotency risk. DES-TEST-001 tests "12 上限+9 类特异度总序截断" (:129).

- **MINOR/NIT items: All resolved.**
  - Ownership ambiguity → DES-INSTALL-001 (:84) states ownership is manifest-tracked (path + SHA-256, non-inline) and defines "无标记文件" = "on-disk path not in the (install/target) manifest". Resolved.
  - install-manifest.json + empty-root cleanup → DES-INSTALL-001 (:84): uninstall removes owned files, "最后移除 install-manifest.json 自身与随之变空的 `~/.code-guidelines/`". Resolved.
  - Malformed/duplicate/orphaned markers → DES-PRECHECK-001 (:111): "遇畸形/重复/孤立(有 begin 无 end、多组标记、嵌套)…中止、零写入、报告,绝不猜测改写" + test "畸形托管标记中止且零写入" (:129). Resolved.
  - distill accept path → DES-DISTILL-001 (:114): `distill --force` or manual removal, both inside the explicit-invocation branch. Resolved.
  - Risk-table imprecision → `RISK-SAFE-003 → DES-FSSAFE-001` (:53) and `RISK-LEGAL-001 → DES-LIB-001 / DES-DOC-001` (:61). Resolved.
  - sync.mjs Node baseline → DES-SYNC-001 (:99) "保守 Node 基线…由 SPEC 定稿" + SPEC Handoff (:204). Resolved as handoff.
  - Per-file version determination → SPEC Handoff (:205) explicitly names the version-determination mechanism (global VERSION / source commit / content-hash) and the "逐文件来源版本" field to avoid a hidden SPEC field. Resolved as handoff.

## Coverage check

- **SCOPE-IN-001..021**: all 21 mapped in the coverage table (:23–45) and cross-consistent with the Trace table (:210–228). Spot-checks pass — CLI five commands (DES-CLI-001), four-platform + opencode command form (DES-PLAT-001), install safety (DES-INSTALL-001 + DES-FSSAFE-001), single-source deterministic build (DES-BUILD-001), asset dir (DES-ASSET-001), negative-guard skill (DES-SKILL-001), sync pipeline + status report (DES-SYNC-001), detect/reconcile/zero-write (DES-DETECT-001/DES-RECONCILE-001), lint first-arm (DES-LINT-001), precheck + hosted block (DES-PRECHECK-001), distill (DES-DISTILL-001), 48-rule library (DES-LIB-001), 11 baselines (DES-BASELINE-001), docs/license (DES-DOC-001), R8 test matrix (DES-TEST-001). No SCOPE-IN clause dropped or weakened.
- **R1–R8**: faithfully covered; DES-TEST-001 reproduces the R8 matrix item-for-item and now adds the target-side symlink and malformed-marker cases.
- **SCOPE-OUT-001..007**: none pulled in. Negative guard held (SKILL, no hook suggestion), lint stays existence-detect + read-only gap report (SCOPE-OUT-002), print-only dep commands (SCOPE-OUT-003), 48 fixed (SCOPE-OUT-004), never-create entry file (SCOPE-OUT-006), local-CLI-only. SCOPE-OUT-005 (no CI edits) not restated but not violated.
- **RISK-* (13)**: all 13 tagged `[ADDRESSED]` in the risk table (:51–63), each to a real component. RISK-SAFE-003 is now fully addressed (both install and target write paths) via DES-FSSAFE-001.
- **DECISION blocks**: DECISION-001..006 all well-formed with Status: selected; DECISION-006 correctly added.

No coverage gaps.

## Findings (new or still-open)

### [BLOCKER] title
None.

### [MAJOR] title
None.

### [MINOR] Residual "uninstall-first" wording contradicts the adopted two-phase commit (DECISION-006) and the frozen SCOPE-IN-003 deviation is not acknowledged
- **What/where**: The revision replaced uninstall-first with two-phase stage-then-swap in DES-INSTALL-001 (:84, "仅在新集全部就位后才移除本次不再安装的旧自有文件"), DECISION-006 (:172, "B 在提交前从不删除或覆盖旧自有文件"), and Rollback (:178, "从不先删旧文件"). But two authoritative-adjacent spots were not updated: the Design Summary (:13) still says `install` is "manifest 驱动、**uninstall-first**、原子写…", and DES-TEST-001 (:129) still lists "**uninstall-first 重置**" as an installer test. Additionally, the frozen requirement SCOPE-IN-003 states `install` "为 uninstall-first(重装先重置旧自有文件、清理不再安装的技能)"; DECISION-006 supersedes that mechanism but the design never explicitly notes the deviation.
- **Why it matters**: (1) It is a direct internal contradiction on a safety-critical mechanism — the Summary asserts "delete-old-first" while DECISION-006 asserts "never delete old before the replacement is staged". A reader relying on the Summary or the test label gets the opposite of the intended (and correct) behavior. (2) SPEC and PLAN inherit both this design *and* the frozen SCOPE-IN-003; leaving "uninstall-first" in three-way tension (Summary vs DECISION-006 vs SCOPE-IN-003) risks SPEC re-introducing the very delete-first ordering the rollback fix removed.
- **Fix**: Update Design Summary (:13) to say two-phase stage-then-swap (not uninstall-first); rename/reword the DES-TEST-001 case (:129) to "reinstall stale-owned-file cleanup" (behavior still valid; only the "uninstall-first" label is stale); and add a one-line note (in DES-INSTALL-001 or DECISION-006) that this intentionally supersedes SCOPE-IN-003's "uninstall-first" wording — or route a lightweight upstream requirement gap. The functional design is correct; this is reconciliation only.

### [NIT] title
- **Category-vocabulary crosswalk is implicit.** DES-DETECT-001 (:102) declares the `stacks.json` `category` field as a 4-value coarse set `{框架/语言/领域/横切}`, while DES-LIB-001 (:116) organizes the library by 9 fine categories `核心/语言/前端/移动/后端/数据/测试/DevOps/横切` and DES-RECONCILE-001 (:104) enumerates those 9 fine categories when defining tiers. The coarse→tier mapping is derivable (框架→框架层, 语言→语言层, 领域/横切→领域层) and internally consistent, but the fine↔coarse crosswalk is never stated, and `核心` (guardrails-core) is absent from the DES-DETECT-001 category enum (handled as always-selected, presumably not a detected stacks.json entry). SPEC should make the category crosswalk explicit and confirm guardrails-core's non-detection handling so no hidden category value is invented.
- **Multi-file commit atomicity is slightly overclaimed.** DES-INSTALL-001 (:84) says "提交后由原子 rename 保证一致". POSIX rename is atomic per file, not across a multi-file set; a crash mid-commit-phase can leave a partial swap. The pre-commit guarantee ("回到操作前状态") is sound; only the post-commit multi-file claim needs tightening (e.g., write the install manifest last as the commit point / define per-file commit ordering). Fold into SPEC.

## Unresolved-ambiguity assessment
All six DECISION blocks are genuinely resolved and internally consistent, including the new DECISION-006. The two v1 "acceptable handoff" ambiguities (exact per-platform install paths/artifact forms via Context7; sync.mjs Node baseline) remain correctly scoped to SPEC and do not block. No hedging-without-a-decision remains in Chosen Design.

Nothing architectural blocks approval: the three v1 items that were true un-made design choices (target-side write safety, rollback strategy, full 9-category selection order) are all now decided. The single blocking-*this-review* item is the MINOR self-contradiction on "uninstall-first" — it is a wording/consistency reconciliation (three spots) plus an explicit deviation note, not a redesign. Once that is reconciled the design is approvable.
