---
name: sql
description: Semantic SQL guardrails for injection safety, transaction correctness, and index-aware query design.
appliesTo: ["**/*.sql"]
stacks: ["sql"]
source: original
---

# SQL

## Hard Constraints (MUST NOT)

- MUST NOT build a query by concatenating or string-interpolating user/request-derived values into SQL text - always use parameterized queries/prepared statements.
- MUST NOT rely on `SELECT *` in application-facing queries that assume a specific column set - an added column silently changes behavior downstream.
- MUST NOT perform a multi-statement write that must be all-or-nothing outside an explicit transaction (`BEGIN`/`COMMIT`/`ROLLBACK`).
- MUST NOT run an unbounded `UPDATE`/`DELETE` without a `WHERE` clause scoping it to the intended rows.
- MUST NOT add a foreign key or unique constraint to a large existing table without considering its lock/validation cost, or skip it entirely because it "should" be enforced only in application code.
- MUST NOT connect the application under a DBA/admin/superuser database account - grant each app account only the privileges it needs.
- MUST NOT assume wrapping writes in a transaction alone prevents lost updates - choose an isolation level or explicit locking (`SELECT ... FOR UPDATE`) sufficient for the invariant.
- MUST NOT issue a query per row inside an application loop when one set-based join/batch query suffices (the N+1 antipattern).
- MUST NOT compare against `NULL` with `=`/`!=`/`NOT IN` expecting normal boolean results - use `IS NULL`/`IS NOT NULL`/`COALESCE` (NULL is three-valued `unknown`).
- MUST NOT rely on row-return order without an explicit `ORDER BY` - SQL specifies no default ordering.

## Ecosystem Idioms & Conventions

- Add an index for columns used in frequent `WHERE`/`JOIN`/`ORDER BY` predicates on large tables; verify with `EXPLAIN`/`EXPLAIN ANALYZE` before assuming a fix worked.
- Prefer `EXISTS` over `COUNT(*) > 0` when only presence needs checking.
- Normalize schema design (avoid duplicated/derivable columns) unless a measured read pattern justifies deliberate denormalization.
- Name constraints and indexes explicitly rather than relying on database-generated names, so migrations remain reviewable.
- Keep migrations additive and backward-compatible (add, backfill, then drop) so deploys can roll forward without a hard cutover.
