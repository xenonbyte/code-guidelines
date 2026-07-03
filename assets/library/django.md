---
name: django
description: Semantic Django guardrails for the ORM, the request trust boundary, and query performance beyond what ruff/mypy enforce mechanically.
appliesTo: ["**/*.py", "**/models.py", "**/views.py"]
stacks: ["django", "backend"]
source: original
---

# Django

## Hard Constraints (MUST NOT)

- MUST NOT trust `request.GET`/`request.POST`/`request.data` directly in view logic - always validate through a Form/Serializer before use.
- MUST NOT build SQL with `.raw()` or `.extra()` via string formatting/concatenation of request-derived values - use parameterized queries or the ORM.
- MUST NOT iterate a queryset that triggers a related-object lookup per row without `select_related`/`prefetch_related` - this is the classic N+1 in Django.
- MUST NOT disable CSRF protection (`@csrf_exempt`) on a state-changing view without an equivalent auth mechanism (e.g. a verified API token) replacing it.
- MUST NOT store secrets (`SECRET_KEY`, DB passwords, API keys) in `settings.py` as literals - load them from environment.
- MUST NOT assume a `QuerySet` result persists a mutation without calling `.save()`/`.update()` - model field changes do not auto-persist.

## Ecosystem Idioms & Conventions

- Prefer Django REST Framework serializers (or Forms) for all input validation and output shaping, not manual dict building.
- Wrap multi-step writes that must succeed or fail together in `transaction.atomic()`.
- Use `get_object_or_404` instead of a manual try/except around `DoesNotExist`.
- Keep business logic in model methods/managers or a service layer, not sprawled across views ("fat models, thin views").
- Use Django's migration system for every schema change; never hand-edit the database out of band.
