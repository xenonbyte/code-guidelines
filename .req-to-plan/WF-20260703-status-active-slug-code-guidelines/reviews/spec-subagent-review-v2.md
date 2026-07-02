# SPEC Subagent Review (v2)

## Verdict
Approved — all 1 MAJOR + 4 MINOR + 4 NIT from v1 are genuinely fixed, no regression or new contradiction introduced, and the SPEC is ready for PLAN.

## Fix verification

1. **selection tie-break (MAJOR): Fixed.** SPEC-SELECT-001 now states a single unambiguous four-level total order (降序=保留优先级): (1) 核心 guardrails-core 恒选置顶、永不截断; (2) 层序 框架层>语言层>领域层 (category→层映射); (3) 同层内 `specificity` 数值降序; (4) `specificity` 相等时 `stacks.json` 注册表索引升序作最终决胜. This exactly matches the expected 核心 pinned > layer > specificity desc > registry index asc. SPEC-STACKS-001 now describes `specificity` as "层内主排序键,数值越大越特异…见 SPEC-SELECT-001" (was the contradictory "层内决胜辅助") — the two contracts now agree, and `specificity` has an explicit slot with registry index as the terminal tiebreak. Test Matrix "选择" row now reads "四级总序(核心>层序>specificity 降序>注册表索引)" — matches. No remaining contradiction. This is resolution option (b) the v1 review explicitly sanctioned; it refines (does not contradict) design DES-RECONCILE-001, whose `specificity` field already existed in the stacks.json schema and whose registry-order tie remains the final key.

2. **exit codes (MINOR): Fixed.** SPEC-CLI-001 header now says the scheme is shared by `install` 与 `sync.mjs`, and code 4 ("冲突/安全中止") now explicitly enumerates 用户改动 + fs-safety/symlink 拒绝 + 畸形/重复/孤立托管块标记 — the two previously-uncoded tested abort paths. SPEC-SYNC-001 now binds the runtime surface explicitly: "`sync.mjs` 与 CLI 共用 SPEC-CLI-001 的退出码方案(0/2/3/4)". Code 3 (missing entry file, via the sync pipeline's platform-precheck step) and code 2 (usage / manifest-shape) remain consistent.

3. **hash normalization (MINOR): Fixed.** SPEC-MANIFEST-001 now states "全部 `sha256` 均对规范化行尾(统一 `\n`)后的内容计算(DECISION-004),以免 CRLF/LF 差异被误判为用户改动" — cites the decision and gives the rationale. Provides an anchor for the "same bytes, different EOLs is not a user-mod" test.

4. **upgrade rule (MINOR): Fixed.** SPEC-MANIFEST-001 now gives the concrete deterministic rule: upgrade iff 磁盘内容哈希 == `manifest.sha256` (未改动) AND 库中该文件内容哈希 != `manifest.sha256` (库有新版) → replace with library version and update `sha256`/`sourceVersion`; `sourceVersion` is provenance-only, not part of the decision, with its exact source left to PLAN "不新增字段". Consistent with SPEC-RECONCILE-001's "升级库中更新且磁盘哈希==manifest 项".

5. **--json shape (MINOR): Fixed.** SPEC-STATUS-001 now defines the object: `{ upToDate, added[], removed[], upgraded[], skipped[{file,reason}], lint[{tool,armed,gap,installCmd?,optedOut?}], conventions{present,distilledAt?}, exitCode }` — mirrors the status-report sections and the shared exit-code scheme. SPEC-SYNC-001's `--json` mention is consistent (names flag; shape defined in STATUS-001).

6. **NIT external-doc versions: Fixed.** ruff+mypy row downgraded to "mypy (current; exact version UNCONFIRMED)… Formats CONFIRMED; pin exact versions at impl"; Checkstyle row downgraded to "current 10.x line (exact version UNCONFIRMED)… Format CONFIRMED; watch check renames…". Both keep the format assertions while hedging the version cell (the earlier over-claimed "mypy 2.x" / "Checkstyle 13.4.0" are gone).

7. **NIT opencode Windows quirk: Fixed.** SPEC-PLATFORM-001 opencode entry now separates the two concerns: 复数 `commands/` 规范 / 单数 `command/` 兼容别名, AND install path "按 `XDG_CONFIG_HOME`(缺省 `~/.config`)解析,精确 env 覆盖(含 Windows homedir/`.config` 解析)留 PLAN 实现细节". The quirk is now correctly XDG/homedir resolution, no longer conflated with singular/plural. (The External-Doc table cell lists "plural canonical, singular alias + Windows quirk" as three separate items — terse but consistent with the corrected body.)

8. **NIT two dropped design details: Fixed.** (a) SPEC-DETECT-001 now states "标签依赖两趟求值:先判定基础栈、收集其检出标签,再判定依赖标签的谓词(如任一前端框架检出→a11y 适用)". (b) SPEC-INSTALL-001 now states "若进程在提交中途中断,下次 `install` 重跑依 manifest 与磁盘状态幂等收敛到目标集(可重入恢复)".

## Regression scan

- **21 SCOPE-IN coverage:** intact. The SPEC Trace maps all of 001–021 (collected across the 20 SPEC IDs: 001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020, 021). No orphan, none dropped by the edits.
- **External Documentation Checked:** still a valid, non-empty inventory — 16-row table, all dated 2026-07-03, with per-row conclusions; the two hedged cells (mypy, Checkstyle) remain CONFIRMED on format.
- **SCOPE-OUT:** none pulled in. Non-goals still restate SCOPE-OUT-001..007; every fix is a precision refinement of an in-scope contract, adding no new behavior surface.
- **Internal contradictions:** none found. Cross-checked the touched contracts pairwise — SELECT-001↔STACKS-001↔Test Matrix (total order), CLI-001↔SYNC-001↔PRECHECK-001↔INSTALL-001 (exit codes 0/2/3/4 across usage, missing-entry, symlink, malformed-marker, user-mod), MANIFEST-001↔RECONCILE-001 (upgrade rule and hash normalization), STATUS-001↔SYNC-001 (`--json` shape and `exitCode` field) — all consistent.
- **PLAN readiness:** the selection/truncation algorithm is now objectively testable; the legitimate deferrals (Codex exact slash prefix + deprecated status, conservative sync.mjs Node baseline, lint version drift) remain correctly parked with recheck notes and are not defects. Nothing blocks PLAN.

## Findings (new or still-open)

None.
