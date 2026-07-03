# Veto Checklist

Apply every item below to a candidate entry — a rule-library file in
`~/.code-guidelines/library/`, or a single guardrail line destined for
`.code-guidelines/project-conventions.md` — before it is allowed into the
output. Each item is a pass/fail gate: a single FAIL drops the whole
candidate; never "fix up" a failing entry, discard it.

1. **Template section order** — PASS only if hard constraints / guardrails
   come before ecosystem-idiom / advisory content, in that order, with no
   other section interleaved. A rule-library file: `Hard Constraints (MUST
   NOT)` before `Ecosystem Idioms & Conventions`. A `project-conventions.md`
   entry: guardrail phrasing only (see `conventions-template.md`) — there is
   no advisory section to interleave. FAIL if the order is reversed or
   sections are mixed.

2. **No persona** — PASS only if the text contains no first-person voice, no
   author introduction, no "as an AI" / "in my experience" framing, and no
   address to "you" standing in for a persona. FAIL on any persona language.

3. **No private paths** — PASS only if the text contains no machine-specific
   absolute paths (e.g. `/Users/...`, `/home/...`, `C:\Users\...`), no
   personal usernames, and no credentials or secrets. Repository-relative
   evidence paths (e.g. `src/routes/users.ts`) are the one permitted
   exception and must remain relative. FAIL on any absolute/personal path or
   secret.

4. **No private goods** — PASS only if every statement is grounded in
   observed repository evidence or, for library rules, established
   ecosystem practice — never a personal preference, unrelated agenda, or
   promotional content smuggled in under the guise of a convention. FAIL on
   any ungrounded personal opinion.

5. **Line cap** — PASS only if the rendered file stays within its cap:
   rule-library file ≤100 lines; `project-conventions.md` ≤80 lines, both
   counts including frontmatter. FAIL if over cap — trim by dropping the
   weakest-evidence entries, never by deleting evidence paths from a kept
   entry.

6. **Complete frontmatter** — PASS only if required frontmatter is present
   and well-formed: a rule-library file has `name`, `description`,
   `appliesTo`, `stacks`, `source`; `project-conventions.md` has `name`,
   `description`, `source`. FAIL on any missing or malformed key.

7. **No lint-baseline duplication** — PASS only if the constraint is not
   already mechanically enforced by one of the 11 lint baselines
   (`~/.code-guidelines/lint/<lang>/`) for a detected stack — e.g.
   formatting, import order, or anything the linter already fails the build
   on. FAIL if the constraint is redundant with an active lint rule; move it
   to the baseline's `meta` instead of keeping it in prose.

8. **Evidence threshold (distill only)** — PASS only if the entry cites at
   least two real, independent, repository-relative file paths as evidence.
   FAIL if it cites zero or one path, or if the two paths are the same file
   cited twice — discard the entry; never weaken it to "usually" or
   "sometimes" to excuse missing evidence.
