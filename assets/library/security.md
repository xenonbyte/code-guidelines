---
name: security
description: Cross-cutting OWASP-aligned security guardrails for input handling, authorization, and secrets, independent of any one stack.
appliesTo: ["**/*"]
stacks: ["security", "backend", "frontend"]
source: original
---

# Security

## Hard Constraints (MUST NOT)

- MUST NOT trust external input (query params, body, headers, cookies, file uploads) without validating and sanitizing it before use.
- MUST NOT build SQL, NoSQL, shell, or LDAP queries/commands via string concatenation with user input; use parameterized queries or a proper escaping API.
- MUST NOT log secrets, passwords, tokens, or PII (emails, national IDs, card numbers) in plaintext logs or error messages.
- MUST NOT skip an authorization check on any mutating endpoint even after authentication succeeds; authentication proves identity, not permission.
- MUST NOT store passwords with reversible encryption or a fast hash (MD5, SHA-1, plain SHA-256); use a slow adaptive hash (bcrypt, argon2, scrypt) with a per-user salt.
- MUST NOT roll a custom cryptographic primitive or session-token scheme; use vetted libraries and standard, current algorithms.
- MUST NOT disable TLS certificate verification or fall back to plaintext transport for any credential-bearing request, including internal service-to-service calls.

## Ecosystem Idioms & Conventions

- Apply least privilege to service accounts, API keys, and database roles; scope each to only what it needs.
- Set security headers (Content-Security-Policy, `X-Content-Type-Options`, `Strict-Transport-Security`) at the edge or gateway.
- Rotate secrets and credentials on a schedule, and immediately after any suspected exposure.
- Rate-limit authentication and other abuse-prone endpoints.
- Keep dependencies patched and track known CVEs across direct and transitive dependencies.
