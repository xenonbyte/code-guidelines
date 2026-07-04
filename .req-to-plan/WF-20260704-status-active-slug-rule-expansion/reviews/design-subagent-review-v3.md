# Design Subagent Review (design v3 — delta)

## Verdict
APPROVE — all three prior findings (F1/F2/F3) are resolved correctly, line refs check out against source, and the edits introduce no functional defect (only one cosmetic wording nit in an F3 parenthetical).

## Delta check

- **F1 — RESOLVED, list is COMPLETE and CORRECT.** Re-grepped the repo for literal `48` (excluding `.req-to-plan`/`.xsk`/`generated`/`node_modules`); it returns exactly 16 hits, and DES-PIN-001 v3 (design lines 104–108) enumerates every one:
  - count-red: `library.test.mjs:15` ✓, `:76` ✓; `stacks.test.mjs:59` ✓, `:57` ✓
  - stale-text: `stacks.test.mjs:208` ✓, `:213` ✓; `precheck.test.mjs:68` ✓
  - README bilingual: `README.md:21` ✓, `:52` ✓; `README.zh-CN.md:17` ✓, `:45` ✓
  - other docs: `THIRD-PARTY.md:8` ✓, `:11` ✓; `CLAUDE.md:138` ✓; `AGENTS.md:69` ✓; `AGENTS.md:12` ✓
  - plus `assets/VERSION` (count-pin, not a literal `48`). 16/16 grep hits covered — no rule/stack-count `48` site remains omitted, and no false site was added (every listed line is a genuine rule/stack-count reference; the design does NOT wrongly pull in unrelated numbers). The `AGENTS.md:12` `--test-name-pattern="48"`→`"57"` change is verified consistent: the three renamed count-test names all contain the digits "57" (`…exactly 57 stack entries`, `…57 .md files`, `…one of the 57 stack ids`), so the documented pattern will still match them.

- **F2 — RESOLVED, refs correct.** Verified against source: `assets/sync.mjs:256` = `four-predicate two-pass detection` (→ five-predicate); `assets/sync.mjs:264` = `the three populated non-requiresTags predicate types` (→ four populated); `test/stacks.test.mjs:102` = `well-formed four-predicate detect shape` (→ five-predicate). A `grep predicate|four|three` confirms these are the *only* three stale predicate-count strings. The design correctly leaves untouched the unrelated counters that would be WRONG to change: `four-level total order` (SPEC-SELECT ordering, `sync.mjs:447` + `stacks.test.mjs:11`) and `three-condition gate` (SPEC-LINT arming, `sync.mjs:592`/`:811`). Assertion-text update at `stacks.test.mjs:188-191` (add `pythonDeps` to the enumerated list) remains covered by DES-TEST-001.

- **F3 — ACCURATE & SUFFICIENT.** DES-DETECT-002 v3 (design line 73) now: (i) requires single-line array support — `dependencies = ["fastapi"]` — and states the exact failure mode ("须抽取开括号那一行内的引号串，否则主路径假阴"), which combined with the existing cross-line rule fully covers both array forms; (ii) requires ignoring the PEP 735 `{ include-group = "..." }` inline table; (iii) notes extras are truncated by the name regex (`uvicorn[standard]`→`uvicorn`). This is enough for SPEC. SPEC Handoff items 1/8/9 were also updated in lockstep (single-line + include-group + the easy-to-miss pin sites + the comment/test-name fixes), so nothing downstream is left dangling.

## New issues introduced by the v2→v3 edits

One cosmetic wording nit (nit, non-blocking): in DES-DETECT-002 the parenthetical "（不得误取 `include-group`）" mislabels the token at risk. A naive quoted-string extractor on `{ include-group = "test" }` would grab the quoted VALUE (the referenced group name, e.g. `test`), not the key `include-group`. The governing directive — "内联表…须忽略" (ignore the whole inline table) — is correct and yields the right outcome regardless, so this does not change behavior; it is only an imprecise example. Optional fix: reword to "忽略整个 `{ include-group = ... }` 内联表元素（否则会误取被引用的 group 名）". No other issues; F1/F2/F3 edits are otherwise clean and the rest of the artifact is unchanged.
