# Design Subagent Review (v3)

## Verdict
Approved — the v2 MINOR + 2 NIT items are genuinely fixed with no regression or new contradiction introduced.

## Fix verification

1. **uninstall-first reconciliation: Fixed.**
   - Design Summary (:13) no longer says "uninstall-first"; now reads "两阶段提交(暂存后原子换入、旧自有文件清理后置)". Consistent with the two-phase commit.
   - DES-INSTALL-001 (:84) carries the required explicit note: "本设计将 SCOPE-IN-003 的『uninstall-first』细化为等价而更安全的『清理后置』顺序:重装对旧自有文件与不再安装技能的清理照旧完整,只是在新集提交后执行(见 DECISION-006),以换取可行回滚;SCOPE-IN-003 的其余保证(拒绝覆盖用户改动、回滚)不变。" It refines SCOPE-IN-003's "uninstall-first" into equivalent "cleanup-after-commit" ordering and explicitly preserves all other SCOPE-IN-003 guarantees.
   - DES-INSTALL-001 (:84) two-phase steps are explicit: "(1) 预检并暂存…(2) 提交——以原子 rename 换入新集,仅在新集全部就位后才移除本次不再安装的旧自有文件。"
   - DES-TEST-001 (:129) case relabeled to "两阶段提交重装清理(提交后清理旧自有文件)" — the stale "uninstall-first 重置" label is gone; behavior still valid.
   - Rollback (:178) says "预检 + 全量暂存…(从不先删旧文件);提交为原子 rename,新集就位后才清理旧自有文件" — consistent.
   - No remaining place asserts old files are deleted BEFORE new files are written. The only surviving "uninstall-first" strings are (a) the *rejected* Option A in Options Considered (:73) and DECISION-006 (:170) — correct usage, labeling the discarded design; and (b) lines 237/312, which are inside the frozen read-only Upstream Summary (RISK discovery), not the design's own assertions. All four authoritative spots (Summary, DES-INSTALL-001, DES-TEST-001, Rollback) now agree on stage-then-swap.

2. **category vocabulary: Fixed.**
   - DES-DETECT-001 (:102) now defines the `stacks.json` `category` field with the full 9-category taxonomy: "`category`(9 类之一:核心/语言/前端/移动/后端/数据/测试/DevOps/横切;guardrails-core 为 `核心`、恒选且不依赖谓词)". The old 4-value coarse set {框架/语言/领域/横切} is gone, and guardrails-core is explicitly category 核心, 恒选, not predicate-gated (不依赖谓词).
   - DES-RECONCILE-001 (:104–105) maps the same 9 categories onto the 3 specificity tiers: 框架层={前端,移动,后端}、语言层={语言}、领域层={数据,测试,DevOps,横切}, with 核心(guardrails-core) always-selected/pinned/exempt from truncation. Category counts reconcile: 核心1 + 框架层3 + 语言层1 + 领域层4 = 9.
   - DES-LIB-001 (:117) uses the identical 9-category vocabulary (核心1/语言12/前端9/移动4/后端9/数据3/测试3/DevOps4/横切3). All three components now share one vocabulary; the fine↔tier crosswalk is stated, not implicit.

3. **atomicity overclaim: Fixed.**
   - DES-INSTALL-001 (:84) no longer claims a single cross-file atomic guarantee. It now reads: "提交为逐文件原子 rename,进程若在提交中途中断则由 install-manifest 与下次 `install` 重跑幂等收敛到目标集——可重入恢复,非跨多文件的单一原子". This is exactly per-file atomic rename + reentrant/idempotent recovery via install-manifest + re-run, with the cross-file single-atomic claim explicitly disclaimed ("非跨多文件的单一原子"). The pre-commit "回滚到操作前状态" guarantee is retained and correctly scoped to pre-commit failure.

## Regression scan

- **Coverage (21 SCOPE-IN):** Coverage table (:23–45) maps all of SCOPE-IN-001..021 to real DES components, cross-consistent with the Trace table (:210–228). No clause dropped or weakened.
- **RISK tags (13):** All 13 rows in the risk-coverage table (:51–63) carry [ADDRESSED], each to a live component (RISK-SAFE-001/002/003, RISK-DET-001/002/003, RISK-DETECT-001, RISK-SEL-001, RISK-LINT-001, RISK-QUAL-001, RISK-LEGAL-001, RISK-PLAT-001/002). Count = 13.
- **DECISION-006:** Well-formed (:168–173) — Question / Options A,B / Selected: B / Rationale / Status: selected. Selects two-phase stage-then-swap; rationale intact (SHA-256 cannot reconstruct overwritten content, killing Option A). All six DECISION blocks remain Status: selected.
- **SCOPE-OUT:** None pulled in. Lint stays existence-detect + read-only gap report (SCOPE-OUT-002), print-only dep commands (SCOPE-OUT-003), 48 fixed (SCOPE-OUT-004), never-create entry file (SCOPE-OUT-006), no CI edits, local-CLI-only (SCOPE-OUT-007). Negative-guard skill (DES-SKILL-001) unchanged.
- **Dangling refs:** None. Every referenced ID resolves — DES-FSSAFE-001 (:86–87), DECISION-005/006 (:161–173) referenced from DES-INSTALL-001, all 18 DES-* Trace rows exist in Chosen Design. No new cross-reference introduced by the v3 edits is broken.
- **No new contradiction:** The reconciliation note in DES-INSTALL-001 is internally consistent with DECISION-006, Rollback, the Summary, and DES-TEST-001; the v2-approved architecture (FSSAFE invariant, full 9-category selection order, two-phase rollback) is untouched.

## Findings

### [BLOCKER] title
None.

### [MAJOR] title
None.

### [MINOR] title
None.

### [NIT] title
None. Both v2 NITs (category-vocabulary crosswalk, multi-file atomicity overclaim) are resolved in the design body rather than deferred to SPEC; no new nit surfaced.
