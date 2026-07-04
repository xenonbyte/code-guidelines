---
name: prisma
description: Semantic Prisma ORM guardrails for client lifecycle, migration safety, and raw-query injection risk.
appliesTo: ["**/schema.prisma", "**/prisma/**", "**/*.prisma"]
stacks: ["prisma"]
source: original
---

# Prisma

## Hard Constraints (MUST NOT)

- MUST NOT instantiate `new PrismaClient()` per request/handler in a long-lived server or a reused serverless container — each instance opens its own connection pool, and repeated instantiation exhausts the database's connection limit; instantiate once and reuse a module-level singleton.
- MUST NOT build a `$queryRawUnsafe`/`$executeRawUnsafe` call by concatenating user input into the SQL string — this is a direct SQL-injection vector; use the tagged-template `$queryRaw`/`$executeRaw`, or pass values as separate parameters to the `Unsafe` variants.
- MUST NOT run `prisma migrate dev` or `prisma db push` against a production database — `migrate dev` can prompt a destructive reset and `db push` can silently drop/alter data; production deploys must use `prisma migrate deploy` against committed migrations only.
- MUST NOT fetch a parent list and then query each child relation in a loop (`for (const x of xs) await prisma.child.findMany(...)`) — this is the N+1 pattern; use `include`/`select`, or a single batched query with an `in` filter.
- MUST NOT edit a generated migration file under `prisma/migrations/` after it has been applied anywhere — migrations are an append-only history; make a new migration instead, or the migration table's checksum diverges from the file.
- MUST NOT commit `schema.prisma`'s `datasource` connection string as a literal — read it from `env("DATABASE_URL")` so credentials aren't checked into source control.

## Ecosystem Idioms & Conventions

- Wrap multi-step writes that must succeed or fail together in `prisma.$transaction`, not sequential awaited calls.
- Keep `schema.prisma` as the single source of truth for the data model; generate types/migrations from it rather than hand-editing generated client types.
- Use `select` to fetch only the fields a query needs, especially on wide tables, instead of the default full-row fetch.
- Run `prisma generate` as part of the build/postinstall step so the generated client always matches the committed schema.
- Reach for a connection-pooling adapter (e.g. `@prisma/adapter-pg` with a pooler, or Prisma Accelerate) in serverless/edge deployments where each invocation would otherwise open a fresh connection.
