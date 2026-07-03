---
name: spring-boot
description: Semantic Spring Boot guardrails for dependency injection, transaction boundaries, and request validation.
appliesTo: ["**/controller/**/*.java", "**/service/**/*.java", "**/repository/**/*.java"]
stacks: ["spring-boot", "backend"]
source: original
---

# Spring Boot

## Hard Constraints (MUST NOT)

- MUST NOT use field injection (`@Autowired` on a field) for required dependencies - use constructor injection so dependencies are immutable and testable without reflection.
- MUST NOT accept a request body/DTO into a `@RestController` method without `@Valid`/`@Validated` plus Bean Validation constraints.
- MUST NOT put `@Transactional` on a private method or call it via `this.` - Spring's proxy-based AOP cannot intercept the self-invocation, so the transaction silently never starts.
- MUST NOT catch and swallow `DataAccessException`/`SQLException` without translating it into a meaningful domain error or rethrowing it.
- MUST NOT expose JPA entities directly as API response bodies - map to a DTO to avoid leaking persistence internals and lazy-loading exceptions.
- MUST NOT trigger lazy-loaded associations outside an open persistence context (view/controller layer) - fetch what is needed in the service layer.

## Ecosystem Idioms & Conventions

- Keep controllers thin: delegate to a `@Service` layer for business logic, keep persistence in `@Repository`.
- Use Spring Data JPA query derivation or `@Query` instead of hand-rolled JDBC where possible.
- Externalize configuration via `application.yml`/`@ConfigurationProperties` instead of scattered `@Value` string keys.
- Use `@ControllerAdvice`/`@ExceptionHandler` for centralized error-to-HTTP-status mapping.
- Prefer profile-specific configuration (`application-{profile}.yml`) over conditional code branches for environment differences.
