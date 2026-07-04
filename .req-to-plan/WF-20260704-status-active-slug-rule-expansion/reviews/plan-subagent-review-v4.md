# Plan Subagent Review (plan v4 — delta)

## Verdict
APPROVE — all three v3 nits are resolved correctly and the edits introduce nothing wrong.

## Delta check
- **F2 (T003 dead hedge) — RESOLVED.** `07-plan.md:87` T003 Verification no longer runs `test/readme.test.mjs（若涉及）`; it now asserts full `node --test` green plus `git diff AGENTS.md CLAUDE.md`, and explicitly states "`readme.test.mjs` 只守 README，不覆盖 AGENTS/CLAUDE，故不单列". The dead conditional is gone and the statement is accurate (readme.test indeed only guards the two README files; no test pins AGENTS/CLAUDE prose, so full-suite-green is the right gate).
- **F1 (T001 brittle YAML check) — RESOLVED.** `07-plan.md:42` now labels the `node -e` field-grep as "smoke 级" and states "完整语法与 9 腿实跑的权威验证在 G1（合入 PR 后于 CI）". The smoke check is correctly demoted and authoritative validation is pinned to G1 — accurate, since GitHub Actions cannot run locally.
- **F3 (TASK-006 per-rule evidence) — RESOLVED.** `07-plan.md:161` Verification evidence clause (3) now requires "每条新规则另附其官方文档/OWASP 逐条核查依据（RISK-SEC-002 的可追溯闭合证据，尤其 llm-app/electron/blazor/dotnet-maui 的安全硬约束）". This makes per-rule official-doc/OWASP verification an explicit, individually-evidenced deliverable and names the security-sensitive rules — satisfying my F3 concern that the 9 independent rule bodies get per-rule (not one-pass) verification tied to RISK-SEC-002 closure. The single-commit boundary is preserved (atomicity intact).

## New issues from v3→v4 edits
None. The three edits are confined to the Verification clauses of T001/T003/T006; task scope, files, skeletons, steps, commit division, Risk Handling, and the S1→S2→S3 ordering are unchanged. T004/T006 indivisibility and full SPEC/SCOPE-IN coverage from v3 remain intact.
