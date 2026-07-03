---
name: mongodb
description: Semantic MongoDB guardrails for query injection safety, schema design, and index-aware access patterns.
appliesTo: ["**/models/**/*.js", "**/models/**/*.ts", "**/schemas/**/*.js", "**/schemas/**/*.ts", "**/repositories/**", "**/*.repository.*", "**/db/**", "**/dao/**"]
stacks: ["mongodb"]
source: original
---

# MongoDB

## Hard Constraints (MUST NOT)

- MUST NOT pass unsanitized request input directly as a query filter object (e.g. a field whose value the client fully controls as an operator) - this enables NoSQL/operator injection.
- MUST NOT perform an unbounded `find()`/aggregation across a large collection without a filter, projection, and a `limit()` - this loads far more into memory/network than needed.
- MUST NOT use `$where` or JavaScript-evaluated expressions with request-derived strings - they execute arbitrary logic server-side.
- MUST NOT rely on multi-document writes being atomic without an explicit multi-document transaction when the operation must be all-or-nothing.
- MUST NOT grow an array field unbounded inside a single document (e.g. appending every event forever) - documents have a 16MB size limit and unbounded arrays degrade update performance well before that.
- MUST NOT connect the application under an admin/root Mongo user - assign each app user only the roles it needs.
- MUST NOT pass user-controlled input into `$expr`, `$function`, `$accumulator`, or `mapReduce` - like `$where`, these evaluate logic server-side and widen the injection surface.
- MUST NOT rely on default read/write concern where read-after-write or cross-node consistency matters - use `majority` read and write concern for those operations.

## Ecosystem Idioms & Conventions

- Design the schema around the application's read/access patterns (embed for one-to-few/read-together data, reference for one-to-many/independently-accessed data).
- Create indexes that match actual query filters and sort orders; verify with `explain()`.
- Use a schema validation layer (an ODM schema or MongoDB's `$jsonSchema` validator) so shape mistakes fail fast instead of silently storing malformed documents.
- Use projections to fetch only the fields a query needs instead of full documents.
- Paginate large result sets with a range-based cursor rather than a large `skip()` offset.
