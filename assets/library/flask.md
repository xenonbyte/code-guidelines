---
name: flask
description: Semantic Flask guardrails for request trust, application context, and blueprint organization.
appliesTo: ["**/app.py", "**/views.py", "**/blueprints/**/*.py"]
stacks: ["flask", "backend"]
source: original
---

# Flask

## Hard Constraints (MUST NOT)

- MUST NOT trust `request.args`/`request.form`/`request.json` without validating shape/types before use (a schema library or explicit guards).
- MUST NOT pass user-controlled input to `render_template_string()` or build a Jinja template from request data - this is server-side template injection (SSTI) and leads to RCE.
- MUST NOT store per-request state in module-level globals - Flask serves requests concurrently (threads/greenlets); use `flask.g` or a request-scoped object instead.
- MUST NOT build SQL by string concatenation/formatting of request-derived values - use the ORM or parameterized queries.
- MUST NOT serve a user-controlled path via `send_file()` or save an unsanitized upload filename - use `send_from_directory()`/`secure_filename()` to prevent directory traversal.
- MUST NOT store sensitive data in `session` expecting confidentiality - the session cookie is signed (tamper-proof) but not encrypted, so its contents are client-readable.
- MUST NOT run the built-in development server (`app.run(debug=True)`) in production - it is single-threaded and exposes the debugger's RCE surface.
- MUST NOT leave `SECRET_KEY` or DB credentials hardcoded in source - load them from environment/config.

## Ecosystem Idioms & Conventions

- Organize routes into Blueprints per feature/domain rather than one monolithic `app.py`.
- Use the application factory pattern (`create_app()`) so config and extensions are testable and environment-specific.
- Prefer Flask-SQLAlchemy sessions scoped per-request (auto-managed) over manually opening/closing connections per view.
- Return errors through a centralized error handler (`@app.errorhandler`) rather than ad-hoc `try/except` per view.
- Use `flask.jsonify` for JSON responses instead of hand-building response strings.
