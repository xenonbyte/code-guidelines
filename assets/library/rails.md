---
name: rails
description: Semantic Rails guardrails for strong parameters, ActiveRecord query safety, and callback discipline.
appliesTo: ["**/app/controllers/**/*.rb", "**/app/models/**/*.rb"]
stacks: ["rails", "backend"]
source: original
---

# Ruby on Rails

## Hard Constraints (MUST NOT)

- MUST NOT pass raw `params` to `Model.new`/`update` without going through Strong Parameters (`params.require(...).permit(...)`) - unguarded mass assignment.
- MUST NOT interpolate request-derived values directly into `where("... #{value}")` or other raw SQL fragments - use parameter binding (`where("col = ?", value)` or a hash condition).
- MUST NOT access an association inside a loop without `includes`/`eager_load` - the classic ActiveRecord N+1.
- MUST NOT put side effects with external I/O (network calls, emails) inside an ActiveRecord callback (`before_save`, `after_create`) - a callback that fails or blocks makes model persistence unpredictable and hard to test.
- MUST NOT commit credentials into `config/` in plaintext - use Rails encrypted credentials (`credentials.yml.enc`) or environment variables.
- MUST NOT rely on authentication or `before_action` loading alone to guard mutations - authorize resource access with a policy layer (e.g. Pundit) on every mutation.
- MUST NOT expose sensitive fields (password digests, tokens) through API responses/serializers.

## Ecosystem Idioms & Conventions

- Keep controllers RESTful and thin; push business logic into models, service objects, or concerns.
- Use scopes for reusable query fragments instead of duplicating `where` clauses.
- Prefer background jobs (Active Job) for slow or non-critical work instead of blocking the request cycle.
- Use `ActiveRecord::Base.transaction` for multi-step writes that must be atomic.
- Validate at the model layer (`validates`) so an invalid record can never be saved through any code path.
