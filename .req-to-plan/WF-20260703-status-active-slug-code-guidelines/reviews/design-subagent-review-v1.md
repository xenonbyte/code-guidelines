# Design Subagent Review (v1)

## Verdict
Changes Requested — coverage and internal consistency are strong overall (all 21 SCOPE-IN mapped, all 13 RISK entries table-mapped, no SCOPE-OUT pulled in), but one safety risk (RISK-SAFE-003) is only half-covered on the target-write path, and two hard-constraint mechanisms (transactional rollback, deterministic selection/truncation order) are asserted without a feasible/complete mechanism.

## Coverage check
- **SCOPE-IN-001..021**: all 21 have a design component (coverage table + Trace table). Spot-checked each against R1–R8 wording; the CLI surface, single-source build, install-safety enumeration, sync pipeline, precheck/hosted-block, distill, 48-rule library, 11 baselines, docs, and the R8 test matrix are all reproduced faithfully. No SCOPE-IN clause is dropped or weakened at the text level.
- **R1–R8**: faithfully covered. DES-TEST-001 reproduces the R8 matrix item-for-item.
- **SCOPE-OUT-001..007**: none pulled in. Design explicitly holds the negative-guard (SKILL), read-only lint gap report (SCOPE-OUT-002), print-only dep commands (SCOPE-OUT-003), 48-fixed library (SCOPE-OUT-004), never-create-entry-file (SCOPE-OUT-006), local-CLI-only (SCOPE-OUT-007). SCOPE-OUT-005 (no CI edits) is not restated but is not violated by any component.
- **RISK-* (13)**: 12 are addressed by a real design component. **RISK-SAFE-003 is only half-addressed** — see BLOCKER below. Two risks are addressed at the observability/veto level rather than fully machine-enforced (RISK-SEL-001 truncation is reported but its order is under-defined; RISK-QUAL-001 "no私货 / no baseline-duplication" is veto-only, not machine-tested) — acceptable and acknowledged in the design, but noted.

## Findings

### [BLOCKER] Target-side (sync.mjs + entry-doc) symlink / path-traversal safety is absent; RISK-SAFE-003 only half-covered
- **What/where**: The install-safety model (lstat symlink rejection incl. parent dirs, path normalization confined to allowed roots, atomic temp+rename) is specified only for the global install engine in DES-INSTALL-001. DES-SYNC-001 and DES-RECONCILE-001 (the `sync.mjs` writes into a target repo's `.code-guidelines/` and root-level lint scaffolding) and DES-PRECHECK-001 (editing `CLAUDE.md`/`AGENTS.md`/`GEMINI.md`) say nothing about symlink rejection, path confinement, or atomic write. The risk-coverage table maps RISK-SAFE-003 to `DES-INSTALL-001` only, silently dropping the "目标落盘" half — yet the approved risk and its mitigation explicitly say "显式拒绝 symlink(安装器与目标落盘),路径规范化并限定在资产目录/仓库根内". DES-TEST-001 likewise lists "symlink 拒绝" only under the installer, not under sync.
- **Why it matters**: `sync.mjs` is a separate zero-dependency file that runs in arbitrary user repos and edits high-value files (`CLAUDE.md` etc.). If a target `.code-guidelines/`, an entry doc, or a scaffolding path is a symlink, writes escape the repo root — exactly the RISK-SAFE-003 scenario, on the code path most exposed to hostile/odd repos. The design currently claims this risk is ADDRESSED while leaving the target path unprotected.
- **Suggested fix**: Restate the symlink-rejection + path-normalization (+ atomic write) safety model as a shared invariant that also governs `sync.mjs` target writes and entry-doc editing (lstat the entry file and every write target/parent). Update the risk-coverage table to map RISK-SAFE-003 to DES-INSTALL-001 **and** DES-SYNC-001/DES-PRECHECK-001, and add a sync-side symlink-rejection test to DES-TEST-001.

### [MAJOR] Transactional rollback "回滚到操作前状态" is infeasible with the described mechanism
- **What/where**: DES-INSTALL-001 + Rollback section promise "写前校验、失败即回滚到操作前状态(依据安装 manifest 恢复或删除本次改动),不留半成品", while `install` is uninstall-first ("先按旧 manifest 重置自有文件"). The only named mechanisms are temp+rename and the install manifest (which records **hashes, not content**). Once uninstall-first has deleted/overwritten prior owned files, a mid-transaction failure cannot restore them: you cannot reconstruct file content from a SHA-256, and the prior package version is not retained.
- **Why it matters**: The promise "回滚到操作前状态,不留半成品" is a hard safety claim (RISK-SAFE-001 mitigation depends on "事务回滚"). As written it holds only for the newly-created-in-greenfield case (rollback = delete); for reinstall/upgrade it leaves the system in a half-torn state with old files gone and new writes incomplete. (User *data* is still protected by the pre-flight hash-mismatch abort, so this is cleanliness/consistency rather than user-data loss — hence MAJOR not BLOCKER.)
- **Suggested fix**: Make the rollback strategy an explicit decision. Preferred: two-phase commit — stage all new files (temp), verify the full set, then swap/rename; never delete or overwrite an old owned file until its replacement is fully staged, so a failure leaves the prior install intact. Alternatively specify a backup/journal of overwritten content. Scope the "回滚到操作前状态" wording to what the mechanism can actually guarantee.

### [MAJOR] Selection specificity model does not cover the 9-category taxonomy; truncation order (and thus idempotency) is under-defined
- **What/where**: DES-RECONCILE-001 (and SCOPE-IN-009) sort the hit set by specificity "框架 > 语言 > 领域" with a 12-file cap and "稳定排序". But the rule library is 9 categories (核心/语言/前端/移动/后端/数据/测试/DevOps/横切). Only 语言 maps cleanly; 前端/移动/后端/数据/测试/DevOps/横切 are not assigned to any of the three tiers, so the sort key is undefined for most rules, and no intra-tier tiebreak (e.g., stacks.json registry order) is stated.
- **Why it matters**: The surviving 12-file set is the reconcile "期望集". If the comparator isn't a fully-defined deterministic total order, the expected set can vary, breaking zero-write/idempotency (SCOPE-IN-011, RISK-DET-002) and making RISK-SEL-001 truncation nondeterministic. This is a design-completeness gap, not merely a SPEC value: the tier assignment for 7 of 9 categories is a design choice that hasn't been made.
- **Suggested fix**: Define the full specificity ordering across all 9 categories (or collapse them into the 3 tiers explicitly) and specify the intra-tier tiebreak (e.g., stable on explicit stacks.json registry order). Assert selection is a pure deterministic function of detection output.

### [MINOR] "所有权标记" concept is ambiguous (inline marker vs manifest entry) and infeasible inline for some artifacts
- **What/where**: DES-INSTALL-001 records "所有权标记" per file and aborts on "无标记文件". It's unclear whether ownership is an inline marker in each file or purely a manifest entry. Several installed artifacts cannot carry an inline marker cleanly (JSON lint configs, strict `tsconfig.json`, `.prettierrc` JSON).
- **Why it matters**: If read as an inline marker, the model is unimplementable for JSON scaffolding; if manifest-based, "无标记文件" just means "path present on disk but not in manifest", which should be stated. Ambiguity here directly affects the user-modified-file / foreign-file detection that RISK-SAFE-001 hinges on.
- **Suggested fix**: State explicitly that ownership is manifest-tracked (path+hash), and define "unmarked" as "on-disk path not recorded in the (install/target) manifest". Drop or redefine any implied inline marker.

### [MINOR] Uninstall of `install-manifest.json` itself and cleanup of `~/.code-guidelines/` is undefined
- **What/where**: DES-INSTALL-001 stores the install manifest at `~/.code-guidelines/install-manifest.json` and says uninstall "仅移除 manifest 记录的自有文件与随之变空的目录". A manifest normally does not record itself, so uninstall would leave `install-manifest.json` (and thus a non-empty `~/.code-guidelines/`) behind.
- **Suggested fix**: Specify explicit removal of the install manifest as the final uninstall step, then remove the now-empty asset root.

### [MINOR] Malformed / duplicate / orphaned hosted-block markers have no defined behavior
- **What/where**: DES-PRECHECK-001 describes single-block regenerate-in-place with "块外一字不动", and the risk table cites "begin/end 标记幂等解析", but the design body never defines what happens when a begin exists without an end, when markers are duplicated, or when they are nested — precisely the RISK-SAFE-002 triggers ("标记缺失或重复").
- **Why it matters**: Getting this wrong corrupts high-value `CLAUDE.md`/`AGENTS.md`/`GEMINI.md`. The safe default (abort + report, write nothing) should be an explicit decision, not left to implementation.
- **Suggested fix**: Specify: on malformed/duplicate/orphaned markers, abort with zero writes and report; add a fixture/test.

### [MINOR] distill re-run conflict resolution has no defined mechanism
- **What/where**: DES-DISTILL-001 says on re-distill hash-mismatch it "拒绝覆盖并输出新旧对比报告由用户选择", but unlike lint's `--relint`, there is no defined command/flag for the user to actually accept the new distillation after reviewing the diff.
- **Suggested fix**: Define the accept path (e.g., a `distill --force` or an explicit confirm branch analogous to `--relint`), or state that the user manually removes the file to re-distill.

### [NIT] Risk-coverage table imprecision
- RISK-SAFE-003 → listed only under DES-INSTALL-001 (drops the target-write half — see BLOCKER). RISK-LEGAL-001 → listed only under DES-DOC-001, though the body correctly says DES-LIB-001 also 处置 RISK-LEGAL-001 (the `source` frontmatter is the primary traceability mechanism). Tighten the table.

### [NIT] `sync.mjs` Node baseline unspecified
- DECISION-001 sets the installer at Node ≥ 20, but `sync.mjs` runs in arbitrary target environments. Its own required Node baseline (and the precise condition that triggers the "no-node manual algorithm" fallback) is unstated. A zero-dep single file distributed to unknown machines should target a conservative baseline. Note for SPEC.

### [NIT] Per-file "来源版本" upgrade determination is unstated
- DES-RECONCILE-001 "升级库中新版且哈希一致项" and the manifest's "逐文件来源版本" imply a per-rule version, but the rule frontmatter schema (`name/description/appliesTo/stacks/source`) has no version field. How "new version" is determined (global VERSION, per-file source commit, or content-hash diff) is left to the SPEC manifest schema — acceptable as a handoff, but call it out so SPEC doesn't invent a hidden field.

## Unresolved-ambiguity assessment
The 5 DECISION blocks (language/runtime, test framework, arg-parsing, hash algorithm, two-tier manifest) are all genuinely resolved and internally consistent.

The specific point the task asked about — "各平台确切安装路径由 SPEC 依据官方文档定稿" — is an **acceptable stage handoff, not a blocking undecided decision**: exact per-platform paths and artifact file forms are platform-contract facts that legitimately belong to SPEC's Context7 verification, and the requirement froze the four platforms and the explicit-invocation assumption. One advisory: RISK-PLAT-001's only feasibility gate is a *terminal* verification; SPEC should verify per-platform explicit-skill/command feasibility (not just paths) early via Context7, since discovering at terminal-verify that a platform cannot host a user-installed explicit skill would invalidate DES-PLAT-001's shape. This is advisory, not a defect.

The genuinely-undecided architectural points that should block approval are **not** hand-off items but real un-made design choices: (a) the target-side write-safety model (BLOCKER), (b) the rollback strategy (MAJOR), and (c) the full specificity/truncation total-order across the 9 categories (MAJOR). These three must be resolved in "Chosen Design" (or captured as decisions) before approval; the MINOR/NIT items can be folded into the SPEC handoff.
