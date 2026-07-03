---
name: kubernetes
description: Semantic Kubernetes manifest guardrails for reliability, security, and safe rollouts.
appliesTo: ["**/k8s/**", "**/manifests/**", "**/kustomization.yaml", "**/charts/**/templates/**", "**/*deployment*.yaml", "**/*service*.yaml", "**/*ingress*.yaml", "**/*configmap*.yaml"]
stacks: ["kubernetes"]
source: original
---

# Kubernetes

## Hard Constraints (MUST NOT)

- MUST NOT omit `resources.requests`/`resources.limits` on containers; unbounded pods can starve neighbors, get OOM-killed unpredictably, and defeat the scheduler.
- MUST NOT use the `:latest` image tag in a Deployment/StatefulSet/DaemonSet spec; pin an explicit version so rollouts are reproducible and rollbacks are meaningful.
- MUST NOT store secret values as plaintext in a `ConfigMap` or as literal strings in a manifest; use a `Secret` object, and prefer an external secret manager or CSI driver over relying on base64 as protection.
- MUST NOT run a container as `privileged: true` or without a `securityContext` that drops unnecessary Linux capabilities and disables privilege escalation.
- MUST NOT ship a service that takes meaningful time to become ready without `readinessProbe`/`livenessProbe`; without them, traffic reaches unready pods and deadlocks go undetected.
- MUST NOT hardcode cluster- or environment-specific values (namespace, hostname, replica count) directly in a manifest meant to run in multiple environments.

## Ecosystem Idioms & Conventions

- Prefer Kustomize overlays or Helm charts over hand-duplicated YAML across environments.
- Set a `PodDisruptionBudget` for services that must remain available during voluntary node drains or upgrades.
- Keep `readinessProbe` and `livenessProbe` cheap and side-effect free so they reflect true health without adding load.
- Scope `Role`/`RoleBinding` to a namespace instead of granting a `ClusterRole` unless cluster-wide access is genuinely required.
- Apply default-deny `NetworkPolicy` per namespace and explicitly allow only the pod-to-pod traffic that is needed.
