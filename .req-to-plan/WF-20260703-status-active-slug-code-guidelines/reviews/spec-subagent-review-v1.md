# SPEC Subagent Review (v1)

## Verdict
Changes Requested — faithful, testable translation of the approved design with all 21 SCOPE-IN covered and platform/lint externals verified accurate; blocked from clean approval only by one determinism-critical selection contradiction (MAJOR) plus a handful of MINOR precision gaps. No BLOCKER.

## Coverage check

- **21 SCOPE-IN:** all present. Trace maps 001→CLI, 002→PLATFORM, 003→INSTALL/MANIFEST, 004→BUILD, 005→INSTALL, 006→TRIGGER, 007/011→SYNC, 008→DETECT/STACKS, 009→SELECT/STACKS, 010→RECONCILE/MANIFEST, 012→LINT/BASELINE, 013→STATUS, 014/015→PRECHECK, 015→HOSTFMT, 016→MANIFEST, 017→DISTILL/RULEFMT, 018→RULEFMT, 019→BASELINE, 020→DOC, 021→TEST. No orphaned SCOPE-IN.
- **R1–R8:** every clause has a concrete contract. R1 (CLI/platforms/install-safety/build/assets), R2 (negative guard + never-suggest-hook), R3 (sync/detect/select/reconcile/zero-write/lint/status/precheck/host-block/target-manifest), R4 (distill), R5 (rule lib), R6 (lint baselines), R7 (docs), R8 (test matrix). No R clause without a contract.
- **SCOPE-OUT-001..007:** none pulled in. Non-goals section explicitly restates all seven (no lint parse/merge, no auto-install, no >48 / no 257-mirror, no CI edits, never create entry file, negative guard only, no registry publish).
- **DECISION-001..006 consistency:** ESM/Node (001) reflected in bin ESM+shebang; node:test (002); hand-written parse (003); SHA-256 (004) — but the "normalized line-ending" clause is dropped (MINOR-3); two-level manifest (005) faithfully in SPEC-MANIFEST-001; two-phase stage-then-swap (006) faithfully in SPEC-INSTALL-001, correctly superseding the brief's literal "uninstall-first". No design decision contradicted.
- **External contracts verified (this reviewer, 2026-07-03):** Claude Code `disable-model-invocation` + explicit invocation + `~/.claude/skills/<dir>/SKILL.md` dir-name-as-invocation — CONFIRMED correct. opencode plural `commands/` canonical + singular alias — CONFIRMED. Gemini CLI TOML/`prompt`/`description`/`{{args}}` — CONFIRMED. Lint 2026 formats (ESLint flat-only, golangci v2 `version:"2"`, ruff `[lint]`, RuboCop `plugins:`, PHPStan level 10, PHP-CS-Fixer `.php-cs-fixer.dist.php`) — all correct.

## Findings

### [BLOCKER] title
None.

### [MAJOR] Intra-layer tie-break: `specificity` field contradicts registry-order rule
- **What/where:** SPEC-STACKS-001 defines `specificity`(int) as "层内决胜辅助" (the intra-layer tie-break helper), but SPEC-SELECT-001's authoritative total order says intra-layer ties are broken "按 `stacks.json` 注册表显式顺序" (registry explicit order). These are two different mechanisms for the same step, and `specificity` has no position in SPEC-SELECT-001's stated total order (核心 > 框架层 > 语言层 > 领域层, then registry order). The Test Matrix row "选择: 9 类特异度总序 … 层内注册表决胜" overloads "特异度" to mean both the 3-tier category grouping and this int field, compounding the ambiguity.
- **Why:** Selection is a determinism-critical contract — it governs which rules get silently dropped at the 12-cap (RISK-SEL-001, AC-IDEM). Under the two readings, different `specificity` assignments vs. registry ordering produce different truncation results, so PLAN cannot derive a single objective pass/fail truncation test. The design (DES-RECONCILE-001) only ever used registry-order ties; SPEC introduced this contradictory role for `specificity` not present in the approved design.
- **Fix:** Pick one and make the schema and SPEC-SELECT-001 agree. Either (a) declare `specificity` documentation-only / not part of ordering and delete the "层内决胜辅助" clause, or (b) give `specificity` an explicit, unambiguous slot in the total order (e.g. layer > specificity-desc > registry-order) and update SPEC-SELECT-001 + the Test Matrix wording accordingly.

### [MINOR] Exit-code scheme leaves two tested abort paths uncoded and does not bind sync.mjs
- **What/where:** SPEC-CLI-001 defines codes 0/2/3/4, but code 3 ("平台前置检查中止") and code 4 ("…安装/同步拒绝") describe sync.mjs behaviors, yet SPEC-SYNC-001 never states sync.mjs uses this scheme. Two aborts that the Test Matrix explicitly tests have no code: symlink rejection (SPEC-INSTALL-001 / SPEC-FSSAFE) and malformed/duplicate/orphan host-block markers (SPEC-PRECHECK-001 / SPEC-HOSTFMT-001) — neither is a usage error (2), precheck (3), nor a user-modification conflict (4).
- **Why:** "assert exit code N on symlink rejection / on malformed markers" and "sync.mjs exits 3 on missing entry file" need pinned codes for objective PLAN tests; SPEC advertises a precise scheme but under-specifies it for the main runtime surface.
- **Fix:** Bind sync.mjs to the shared scheme in SPEC-SYNC-001 and assign a code (existing or new) to fs-safety/symlink rejection and to malformed-host-block aborts.

### [MINOR] SHA-256 line-ending normalization dropped from the hash contract
- **What/where:** DECISION-004 (approved) computes SHA-256 "对规范化行尾后的内容". SPEC-INSTALL-001 and SPEC-MANIFEST-001 say only "SHA-256" with no normalization clause.
- **Why:** Normalization is what prevents CRLF/LF differences from being misdetected as user modifications (the whole install/reconcile safety hinges on it). A test "same bytes with different EOLs is not a user-mod conflict" has no SPEC anchor.
- **Fix:** State in SPEC-MANIFEST-001 (or SPEC-INSTALL-001) that all `sha256` values are computed over line-ending-normalized content, per DECISION-004.

### [MINOR] "Upgrade" version-determination mechanism soft-deferred despite design tasking SPEC to pin it
- **What/where:** SPEC-MANIFEST-001 declares `sourceVersion` and says upgrade is decided "以 sourceVersion + 内容哈希差异共同决定;精确机制由 PLAN 定". The design SPEC-Handoff explicitly assigned the SPEC to define this mechanism ("避免 SPEC 隐式新增字段").
- **Why:** The field is declared (so the "implicit new field" worry is handled), but "jointly by sourceVersion + hash-diff" is directional, not an algorithm — is it AND/OR, which wins on disagreement? Reconcile's "升级库中更新且磁盘哈希==manifest 项" needs a deterministic rule to test.
- **Fix:** Specify the exact comparison (e.g. "upgrade iff disk==manifest AND library-content-hash != manifest.sha256; `sourceVersion` recorded for provenance only"). Legitimate to leave the global `VERSION`/commit-pin detail to PLAN, but the decision rule itself should be closed here.

### [MINOR] `--json` output structure is not specified
- **What/where:** SPEC-SYNC-001 ("--json 机器可读结果") and SPEC-STATUS-001 ("--json 输出等价结构化对象") name the flag but define no object shape.
- **Why:** Observability lists `--json` for agent parsing/assertion; a PLAN test asserting the JSON shape (added/removed/upgraded/skipped/lint/conventions) has no contract to check against.
- **Fix:** Give the `--json` object a minimal field schema (mirror the status-report sections).

### [NIT] External-doc version labels over-asserted as CONFIRMED
- **What/where:** The External Documentation table marks "mypy 2.x" and "Checkstyle 13.4.0" CONFIRMED; as of 2026-07 mypy has not shipped 2.0 (still 1.x) and Checkstyle is on the 10.x line. The config *formats* asserted (`mypy.ini` `strict=true`; `checkstyle.xml` DTD Configuration 1.3) are correct and stable.
- **Why:** Formats are what the baseline depends on and are right; only the version currency is over-claimed. Per the audit's own guidance, lint version drift is an acceptable PLAN re-pin — flagged here only for label honesty.
- **Fix:** Downgrade uncertain version cells to a hedged/UNCONFIRMED note (as already done for SwiftLint/Codex), keeping the format assertions.

### [NIT] opencode Windows quirk mischaracterized; hardcoded config roots ignore env overrides
- **What/where:** SPEC-PLATFORM-001 calls the Windows issue a "单数怪癖" (singular-directory quirk). Verified: the plural-canonical/singular-alias statement is correct, but the actual Windows quirk is XDG base-dir resolution (opencode uses `%USERPROFILE%\.config\opencode\commands\`, not `%APPDATA%`), unrelated to singular/plural. Separately, the SPEC hardcodes `~/.config/opencode`, `~/.claude`, `~/.codex`, `~/.gemini` without honoring `XDG_CONFIG_HOME` / `OPENCODE_CONFIG_DIR`.
- **Why:** The mischaracterization is cosmetic; the env-override omission is an edge case (V1 requirement never mentions XDG). Install path is correct on default macOS/Linux and on default Windows (opencode also resolves homedir/.config).
- **Fix:** Correct the quirk description; optionally note env-override resolution as a PLAN implementation detail.

### [NIT] Two design details not carried into SPEC
- **What/where:** (a) SPEC-DETECT-001 does not spell out the multi-pass evaluation order that `tags`/`requiresTags` require (detect base stacks → collect tags → evaluate tag-dependent predicates); detection being fixture-pinned mitigates this. (b) DES-INSTALL-001's mid-commit-interruption reentrant-recovery ("下次 install 重跑幂等收敛") is dropped from SPEC-INSTALL-001, which only covers pre-commit failure.
- **Why:** Both are low-risk (fixtures pin detection; mid-commit interruption is hard to test deterministically), but each was explicit upstream.
- **Fix:** One sentence each in SPEC-DETECT-001 and SPEC-INSTALL-001.

## Unresolved-ambiguity assessment

Nothing hard-blocks PLAN. The legitimate stage handoffs — Codex exact slash prefix + deprecated-custom-prompt status (with a stated skills-form fallback that preserves the negative guard), the conservative sync.mjs Node baseline, and lint version drift — are correctly deferred with recheck notes and must not be treated as defects; the SPEC handles all three appropriately. The one item PLAN genuinely cannot resolve on its own is the MAJOR: the `specificity`-vs-registry-order tie-break is an internal contradiction in a determinism-critical contract, so the selection/truncation algorithm is under-specified until the SPEC picks one mechanism. The four MINORs are precision gaps (uncoded aborts, hash-normalization, upgrade rule, `--json` shape) that PLAN could paper over but should have pinned at SPEC. Fix the MAJOR and, ideally, the four MINORs, and this SPEC is ready for PLAN.
