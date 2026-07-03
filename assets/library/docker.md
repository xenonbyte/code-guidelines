---
name: docker
description: Semantic Docker/Dockerfile guardrails for image security, layering, and reproducibility.
appliesTo: ["**/Dockerfile", "**/Dockerfile.*", "**/docker-compose*.yml"]
stacks: ["docker"]
source: original
---

# Docker

## Hard Constraints (MUST NOT)

- MUST NOT run the container process as root; create a dedicated non-root `USER` and switch to it before `CMD`/`ENTRYPOINT`.
- MUST NOT bake secrets, API keys, or credentials into image layers via `ARG`/`ENV`/`COPY`; use BuildKit secret mounts (`--mount=type=secret`) or runtime injection instead.
- MUST NOT pin the base image to a floating tag like `latest`; pin an explicit version and, for release builds, a content digest (`image@sha256:...`).
- MUST NOT `COPY . .` without a `.dockerignore` that excludes `.git`, local env files, and dependency caches - the entire build context becomes part of the build.
- MUST NOT carry build-only toolchains (compilers, package managers) into the final runtime image; use a multi-stage build to separate build and runtime layers.
- MUST NOT hardcode environment-specific values (hostnames, ports meant to vary) inside the image; inject them at runtime via env vars or config mounts.
- MUST NOT leave default Linux capabilities attached or the root filesystem writable when the runtime doesn't need it; drop unneeded capabilities (`cap_drop`) and set `read_only: true` where feasible.

## Ecosystem Idioms & Conventions

- Use multi-stage builds: a `builder` stage with the full toolchain, and a minimal final stage containing only runtime dependencies and build artifacts.
- Prefer minimal or distroless base images for the runtime stage to reduce attack surface and image size.
- Order instructions from least to most frequently changing (copy manifests and install dependencies before copying source) to maximize layer cache reuse.
- Define a `HEALTHCHECK` for long-running services so orchestrators can detect an unresponsive container.
- Use `COPY --chown=` to set file ownership in the same layer instead of a separate `RUN chown` pass.
- Let the orchestration layer (Compose, Kubernetes) own resource limits and restart policy rather than encoding them in the image.
