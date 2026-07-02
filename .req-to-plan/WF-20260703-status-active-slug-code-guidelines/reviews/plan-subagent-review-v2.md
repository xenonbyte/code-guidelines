# PLAN Subagent Review (v2)

## Verdict
Changes Requested — inventory and SPEC-ID coverage are complete, but distill's manifest/override mechanism has no implementing task and several per-task Verifications depend on artifacts created only in later tasks.

## Coverage check
- **SPEC consumption: 20/20.** Every SPEC-* contract is referenced by ≥1 task's `Spec References`. Map: CLI-001→{001,002,005}; INSTALL-001→{003,005}; BUILD-001→{006,008}; TRIGGER-001→{007,008,022}; SYNC-001→{007,010}; DETECT-001→{009,010}; SELECT-001→{009,010}; RECONCILE-001→{010}; LINT-001→{010,012,017,018}; PRECHECK-001→{007,010,011}; DISTILL-001→{007,019,022}; STATUS-001→{010}; DOC-001→{020}; TEST-001→{001,021,022}; STACKS-001→{009,021}; MANIFEST-001→{004,005,010}; PLATFORM-001→{008}; RULEFMT-001→{013,014,015,016,019,021}; BASELINE-001→{012,017,018}; HOSTFMT-001→{010,011}.
- **SCOPE-IN: 21/21** transitively covered via the Trace table; every SCOPE-IN-001..021 maps to at least one task.
- **48 rules: 48/48.** 013(core 1 + language 12 = 13) + 014(frontend 9 + mobile 4 = 13) + 015(backend 9 + data 3 + test 3 = 15) + 016(devops 4 + cross 3 = 7) = 48. Matches the design category split exactly.
- **11 baselines: 11/11 (filenames correct).** 017{js-ts, python, go, rust} + 018{java, kotlin, swift, csharp, php, ruby, cpp}. All 2026-correct config filenames (flat `eslint.config.js` not eslintrc; golangci `version:"2"`; ruff `[lint]`; `.php-cs-fixer.dist.php`; rubocop `plugins:`; SwiftLint `only_rules`; C# `Directory.Build.props`). Gemini TOML + Claude `disable-model-invocation` present.
- **SCOPE-OUT: no violations.** No task parses/merges user lint config, auto-installs deps, mirrors 257 rules, touches CI, creates entry files, adds intent/hook triggers, or publishes to a registry.

## Findings

### [BLOCKER] distill manifest recording + override protection has no implementing task; manifest.json co-ownership is unspecified
- **What/where:** SPEC-DISTILL-001 requires "manifest 记录内容哈希 + 蒸馏日期;重蒸馏哈希不符则拒绝覆盖 + --force". PLAN-TASK-022's `distill.test.mjs` asserts machine behavior "manifest 记录与覆盖保护逻辑(哈希不符拒覆盖、--force 覆盖)". But no task's Files/Steps create the code that (a) writes the `conventions:{sha256,distilledAt}` field into `<repo>/.code-guidelines/manifest.json`, or (b) enforces the hash-mismatch reject / `--force` gate. TASK-019 only creates templates; distill is defined as agent-driven/non-script (DES-DISTILL-001); TASK-010 (sync.mjs) owns manifest writes for rules/lint but its Steps never mention the `conventions` field.
- **Why:** (1) A machine test (TASK-022) has no deterministic code to exercise → the task cannot pass as written. (2) `manifest.json` is co-owned — sync.mjs (TASK-010) rewrites it for rules/lint while distill must populate `conventions`. Nothing specifies that sync preserves an existing `conventions` field, so a normal `sync` run risks clobbering distill output (data loss), and nothing specifies who writes `conventions` in the first place.
- **Fix:** Add a deterministic code seam (e.g. a `sync.mjs --distill-record`/helper, or a small `src/` module) that writes+guards the `conventions` field and honors `--force`; assign it to a task and reference SPEC-DISTILL-001/SPEC-MANIFEST-001. Explicitly state in TASK-010 that sync merges/preserves the `conventions` field on every manifest write. Point TASK-022's assertions at that seam.

### [MAJOR] PLAN-TASK-006 Verification depends on artifacts created only in TASK-007 and TASK-008
- **What/where:** TASK-006 (build.mjs/registry.mjs) Verification is `node src/build/build.mjs --check` exit 0 and `node --test test/build.test.mjs` green. But `--check` compares `generated/` against a fresh build; `generated/*` is committed only in TASK-008, the per-platform emitters (`platforms.mjs`) are created only in TASK-008, and the `fragments/*` the build reads are created only in TASK-007.
- **Why:** At TASK-006's position the build has no emitters, no fragments, and nothing to diff against → both Verification commands fail. The task cannot be verified in place.
- **Fix:** Reorder (fragments 007 + emit/golden 008 before the self-conformance gate), or narrow TASK-006's Verification to unit-test the deterministic primitives (stable key sort, `\n` normalization, no-timestamp) and move the `--check`/byte-equal gate into TASK-008 (where it already appears).

### [MAJOR] PLAN-TASK-009 detect.test.mjs depends on detect/select logic that lives in sync.mjs (TASK-010)
- **What/where:** TASK-009 Verification is `node --test test/detect.test.mjs` green, and its skeleton has that test assert "检出集 + 四级选择总序 + 12 上限 + monorepo 聚合/排除". Per SPEC-SYNC-001/DES-SYNC-001 the detection and selection functions live inside the single-file `assets/sync.mjs`, which is created only in TASK-010.
- **Why:** detect.test.mjs has nothing to import at TASK-009 time → its Verification cannot pass until TASK-010. (Note the analogous precheck/lint tests are correctly ordered *after* TASK-010; only detect.test is mis-ordered.)
- **Fix:** Keep the fixtures + stacks.json in TASK-009 but move `detect.test.mjs` to after TASK-010, or split a testable detect/select module out of sync.mjs and create it before its test.

### [MAJOR] PLAN-TASK-010 scope is too large to implement/verify as one unit (9 SPECs, whole pipeline)
- **What/where:** TASK-010 creates the entire `assets/sync.mjs` covering SYNC + DETECT + SELECT + RECONCILE + PRECHECK + HOSTFMT + LINT + STATUS + MANIFEST: detection, 4-level total-order selection + 12-cap, full reconcile + user-override protection, zero-write determination, 3-condition lint arming + `--relint`, host-block regenerate/malformed-marker abort/fs-safety, `--json` shape, exit codes 0/2/3/4 — in one file with one `sync.test.mjs`.
- **Why:** This is far more than one reviewable/testable unit; a single failing green gate gives no isolation, and it concentrates the highest-risk determinism/safety logic behind one verification. (The plan already splits *tests* into 011/012 but leaves all *logic* in 010.)
- **Fix:** Split into cohesive sub-tasks against the single-file target, e.g. (a) detect+select, (b) reconcile+zero-write, (c) lint arming + `--relint`, (d) precheck + host-block, (e) report/`--json` + exit codes — each with its own fixtures and green gate.

### [MAJOR] PLAN-TASK-018 omits `meta` for 7 of 11 baselines; SPEC-BASELINE-001 requires meta per set
- **What/where:** SPEC-BASELINE-001/DES-BASELINE-001 require each of the 11 baselines to ship a `meta` (强制约束清单). TASK-017 lists `meta.json` for its 4 baselines, but TASK-018's Files list contains no meta for java/kotlin/swift/csharp/php/ruby/cpp; its skeleton only hedges "各栈另附 meta(可并入现有目录)", and its Verification checks none of them.
- **Why:** 7/11 baselines have no concrete meta deliverable and no verification, so the meta contract (used by DES-LIB-001 to decide "duplicate → externalize from prose") is silently unmet for the majority of baselines.
- **Fix:** Add the 7 `meta.json` files to TASK-018 Files and extend its Verification to assert each exists; keep the format consistent with TASK-017.

### [MINOR] Per-platform install destination paths (SPEC-PLATFORM-001) are not concretely owned by any task's Steps
- **What/where:** SPEC-PLATFORM-001 fixes 4 install paths (`~/.claude/skills/code-guidelines/SKILL.md`, `~/.codex/prompts/…`, `~/.config/opencode/commands/…` with XDG/Windows resolution, `~/.gemini/commands/…`). TASK-008 references SPEC-PLATFORM-001 but only *emits* to `generated/`; TASK-005 does the actual placement but references only INSTALL/CLI/MANIFEST and merely says "各平台技能目录" without enumerating them or the opencode XDG/env resolution.
- **Why:** The path-mapping half of SPEC-PLATFORM-001 is nominally referenced (by the emit task) but not implemented by the task that installs → risk of hardcoded/incorrect roots, especially opencode XDG/Windows.
- **Fix:** Have TASK-005 reference SPEC-PLATFORM-001 and enumerate the 4 install roots + opencode `XDG_CONFIG_HOME` resolution as explicit Steps.

### [MINOR] PLAN-TASK-002 cli.mjs dispatches to command modules created only in TASK-005
- **What/where:** TASK-002 `main()` switches to `install/uninstall/status`, but those command modules are created in TASK-005. If cli.mjs statically imports them, `node bin/code-guidelines version` (TASK-002 Verification) fails at module load with ERR_MODULE_NOT_FOUND.
- **Why:** TASK-002's version/help Verification cannot pass in isolation.
- **Fix:** Use dynamic `import()` inside the switch (only load the selected command), or create thin stub command modules in TASK-002.

### [MINOR] No structural test for the 11 lint baseline sets (filenames + meta), and stacks.json `lint` keys are unverified
- **What/where:** TASK-021 pins "exactly 48 rules" and asserts stacks.json `rules` point to existing library files, but there is no analogous test asserting the 11 baseline sets exist with the SPEC-correct filenames + meta, and no test that stacks.json `lint` keys resolve to existing baseline dirs. TASK-012 only tests arming behavior via fixtures.
- **Why:** SPEC-TEST-001 requires every data contract to have an executable test; SPEC-BASELINE-001 is a data contract left without a structural pin.
- **Fix:** Extend TASK-021 (or add a baseline.test) to assert the 11 sets/filenames/meta and that every stacks.json `lint` key points to an existing baseline.

### [MINOR] sync.mjs must inline fs-safety/hash rather than import src/install/fsutil.mjs — not stated
- **What/where:** DECISION/SPEC-SYNC-001 make `sync.mjs` a "零依赖单文件" shipped standalone in `assets/` and run in target repos without the installer. The shared invariants (sha256-normalized, lstat symlink rejection, atomic write) live in `src/install/fsutil.mjs` (TASK-003). TASK-010 mentions "fs-safety" but never states sync.mjs must re-implement it inline.
- **Why:** The decomposition tempts an implementer to `import` from `src/`, which would break the single-file/zero-dependency guarantee (src/ is not installed into the target repo).
- **Fix:** State explicitly in TASK-010 that sync.mjs inlines its own fs-safety + hashing (no `src/` imports); optionally add a test asserting sync.mjs has no relative imports.

### [MINOR] SPEC-STATUS-001 `status`-command reporting is not cross-referenced by the task that implements it
- **What/where:** SPEC-STATUS-001 covers both the sync status report (→ TASK-010, referenced) and the `status` command's "汇报已装技能/资产/平台" (→ TASK-005 `status.mjs`, which references only INSTALL/CLI/MANIFEST). TASK-005's Steps mention only "status 形状校验(退出 2)" (the SPEC-CLI-001 shape check), not the SPEC-STATUS-001 reporting content.
- **Why:** The status-command reporting half of SPEC-STATUS-001 is not explicitly assigned/verified.
- **Fix:** Add SPEC-STATUS-001 to TASK-005 and a Step/Verification for reporting installed skills/assets/platforms.

### [NIT] Per-platform (all four) negative-guard assertion should be explicit
- **What/where:** The Test Matrix requires "各平台 description 含负向守卫". TASK-022 skill.test asserts "技能产物 description 含显式触发禁令" (ambiguous whether all four platform artifacts are checked); TASK-008 platform.test does not clearly assert the negative guard per platform.
- **Fix:** Make one test assert the negative-guard string in all four generated artifacts (Claude/Codex/opencode/Gemini), plus `disable-model-invocation` only in Claude.

### [NIT] No explicit test that the no-arg path does not trigger distill / excludes conventions from the expected set
- **What/where:** RISK-DET-003 mitigation (design) names "测试断言无参路径不触发蒸馏", and SPEC-RECONCILE-001 excludes `project-conventions.md` from the expected set. No task's Verification pins this negative assertion.
- **Fix:** Add an assertion in TASK-010's sync.test that a no-arg run neither writes nor references `project-conventions.md` (conventions excluded from reconcile).

## Unresolved-ambiguity assessment
The three explicitly-deferred items — Codex slash prefix / deprecated status, sync.mjs conservative Node baseline, and lint version drift — are legitimate impl-time Context7 re-pins and do NOT block execution (correctly acceptable per the workflow).

One ambiguity is execution-blocking and is captured above as the BLOCKER: distill is described as "agent 驱动、非脚本," yet SPEC-DISTILL-001 and TASK-022 demand a machine-testable manifest-record + override-protection mechanism, and `manifest.json` ownership is split between sync.mjs and distill with no coordination rule. This must be resolved (assign a deterministic code seam + specify conventions-field preservation) before the plan is executable. The remaining findings are ordering/completeness issues that stall specific per-task green gates but do not require re-deciding scope.
