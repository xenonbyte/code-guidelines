# project-conventions.md — Fixed Output Template

This is the fixed template used to render `.code-guidelines/project-conventions.md`.
Only entries that survived sampling, the evidence gate (`template.md`), and
`veto-checklist.md` may appear here.

## Hard constraints

- The rendered file MUST be at most 80 lines total, frontmatter included. If
  more survivors exist than fit, keep the entries with the strongest (most,
  most independent) evidence and drop the rest — never truncate an entry
  mid-line.
- Every line item MUST be phrased as a guardrail: a negative constraint
  ("MUST NOT ...") or a mandatory action ("MUST ..."), never as neutral
  advice or a soft suggestion ("consider ...", "it's nice to ...").
- Every line item MUST cite at least two repository-relative file paths as
  evidence, inline at the end of the line. An item with zero or one path
  MUST NOT appear in the rendered file — it should already have been dropped
  at the evidence gate; this is the last checkpoint before writing.
- No item may restate general best practice already covered by the shared
  rule library, or a constraint already enforced by a lint baseline — both
  are out of scope for a project-conventions file by definition (see
  `template.md` step 3, "Discard rules").

## Skeleton

```
---
name: project-conventions
description: Project-specific conventions distilled from this repository's own code; not general best practice.
source: distilled
---

# Project Conventions

## Guardrails

- MUST[ NOT] <specific, checkable constraint observed in this repository>. (Evidence: `<path/one>`, `<path/two>`[, `<path/three>`])
- ...
```

## Worked example

```
- MUST NOT return a Prisma model instance directly from a route handler; map it to a plain response DTO first. (Evidence: `src/routes/users.ts`, `src/routes/orders.ts`)
- MUST place integration tests under `test/integration/<feature>.test.ts`, never alongside unit tests in `test/unit/`. (Evidence: `test/integration/checkout.test.ts`, `test/integration/auth.test.ts`)
```

Each example line is phrased as a guardrail, captures something this specific
repository actually does rather than advice that would apply to any project,
and cites at least two independent repository-relative paths as evidence.
