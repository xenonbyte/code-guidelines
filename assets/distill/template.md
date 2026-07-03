# Distill Procedure Template

This is the detailed reference for the agent-driven `distill` procedure that
samples a target repository and produces `.code-guidelines/project-conventions.md`.
It expands on the compact steps already carried in the generated skill/command
text (see the `distill` argument section of the skill behavior); this file is
authoritative for HOW to sample and extract, `conventions-template.md` is
authoritative for the exact shape of the OUTPUT, and `veto-checklist.md` is the
final gate before anything is written.

## 1. Sampling

For each stack detected in the target repository (per `~/.code-guidelines/stacks.json`):

- Sample at least 10 source files belonging to that stack (files matched by
  the stack's detection predicates or its typical file extensions).
- When a stack has more than 10 candidate files, prefer files that are (a)
  most recently modified, and (b) most referenced from elsewhere in the
  repository (import/require count, call-site count) — weigh both signals
  together rather than picking one exclusively.
- When a stack has fewer than 10 source files in total, sample all of them;
  never pad the sample with unrelated files just to reach 10.
- Sampling is read-only: never modify, move, rename, or execute a sampled file.

## 2. Extraction targets

While reading sampled files, look only for conventions that are genuinely
specific to THIS repository, in these categories:

- Naming patterns actually observed (files, symbols, modules, endpoints).
- Directory / module organization actually used by this repository.
- Error-handling idioms actually used (how errors are surfaced, wrapped, logged).
- Technology / library choices this repository standardized on, when
  alternatives existed.
- Testing patterns actually used (test structure, naming, fixtures, mocks).

## 3. Discard rules

Discard a candidate convention, before it ever reaches the evidence gate, when:

- It is general best practice already covered by the shared rule library
  (`~/.code-guidelines/library/*.md`) rather than something specific to this
  repository.
- It is phrased as generic advice ("write clean code", "handle errors
  properly") rather than a concrete, checkable statement.
- It restates something a lint baseline already enforces mechanically
  (`~/.code-guidelines/lint/<lang>/`) — mechanical constraints belong to lint
  config, not prose.
- It is inferred from a single file, a comment, or a commit message rather
  than observed as a recurring pattern across the sample.

## 4. Evidence gate

A convention survives only with at least two real, repository-relative file
paths that each independently demonstrate the pattern:

- Both paths must exist in the sampled repository at extraction time; never
  fabricate, approximate, or guess a path.
- The two paths must be genuinely independent occurrences of the same
  pattern, not the same file cited twice and not two files that only
  coincidentally share a name.
- Fewer than two qualifying paths (zero or one) — discard the entry
  outright; never weaken the wording to "usually" or "sometimes" to
  compensate for missing evidence.

## 5. Handoff

Entries that survive sampling, extraction, the discard rules, and the
evidence gate are then checked one by one against `veto-checklist.md`, and
only the survivors of that checklist are rendered using the fixed skeleton in
`conventions-template.md`.
