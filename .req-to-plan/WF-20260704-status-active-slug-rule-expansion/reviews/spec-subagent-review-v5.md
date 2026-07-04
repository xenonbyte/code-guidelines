# Spec Subagent Review (spec v5 — delta)

## Verdict
APPROVE — all three v4 nits are resolved correctly and the edits introduce nothing wrong.

## Delta check

- **F2 (requirements URL guard) — RESOLVED, new regex sound.** `parseRequirements` now does `tr = raw.replace(/\s+#.*$/, '').trim()` first, then skips only whole-line URLs via `/^[a-z][a-z0-9+.-]*:\/\//i` (the broad `includes('://')` is gone). Traced each target:
  - `requests==2.0  # see https://x` → comment-strip `/\s+#.*$/` removes `  # see https://x` → `requests==2.0` → not blank/`#`/`-`, not URL-scheme-prefixed → `addName` name-regex captures `requests`. ✓
  - `pkg @ https://…` → no leading `#`, comment-strip leaves it intact (the `://` is not preceded by ` #`); whole-line URL test fails (line starts with `pkg`, not a scheme) → `addName` name-regex takes `pkg` (stops at the space before `@`). ✓ (matches the inline note on line 120.)
  - `https://host/foo.whl` → whole line starts with `https://` → `/^[a-z][a-z0-9+.-]*:\/\//i` matches → skipped. ✓
  - Regressions checked: `pkg==1.0` (no `#`) → `/\s+#.*$/` finds no ` #`, leaves it untouched → `pkg` captured. ✓ A hashless URL line is still skipped (above). ✓ The comment-strip requires whitespace before `#` (`\s+#`), so a name like `flask==3` with no `#` is never clobbered, and a URL fragment `foo.whl#sha256=…` (no preceding space) is NOT mistaken for a comment — the fragment stays, but such a bare-URL line is skipped anyway by the scheme test, and a `pkg @ url#frag` line keeps `pkg` via the name regex. No edge broken.
  - One benign residual (not a regression, strictly better than v4): a requirement using an env-marker with a URL is out of scope here and unaffected; a line that is *only* an inline comment like `# https://x` is still caught by `tr.startsWith('#')`. ✓

- **F1 (case d) — ACCURATE now.** (d) asserts only `ids.includes('fastapi')`, with an explicit parenthetical (line 151) that the `python`-key exclusion is a `mergePythonDeps` internal invariant unobservable at the `detect()` layer (no stack declares `pythonDeps:["python"]`), and that a pure-function unit test is optional. This exactly matches my F1 finding — correct and precise.

- **F3 (case f) — ACCURATE now.** (f) now states the validated end-goal is "malformed pyproject doesn't affect other detection" (vue still detected, no throw), notes the state machine is robust/non-throwing on most malformed input, and frames the `try/catch` as defensive backstop mirroring the `package.json` precedent, with an optional mock-`readFileSync`-throw test to cover the catch path (line 153). This matches my F3 finding faithfully. (The suggested mock-throw is the right way to actually exercise the catch, since string-level parsing itself does not throw.)

## New issues from v4→v5 edits
None. The edits are confined to `parseRequirements` (comment-strip + narrowed URL skip) and the (d)/(f) test-note prose in SPEC-SYNCTEST-001. The `parsePyproject` state machine, `classify`, `stripInlineTables`, `stacks.json` diffs, CI/release YAML, and the (a)/(b)/(c)/(e)/(g) traces from v4 are unchanged and remain correct. The narrowed URL regex only *widens* what is accepted (a strict superset of correct behavior vs v4), so it cannot regress any previously-correct case.
