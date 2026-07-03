---
name: terraform
description: Semantic Terraform guardrails for state safety, credential handling, and safe apply workflows.
appliesTo: ["**/*.tf", "**/*.tfvars"]
stacks: ["terraform"]
source: original
---

# Terraform

## Hard Constraints (MUST NOT)

- MUST NOT commit `.tfstate` files or `.tfvars` files containing secrets to version control; state can contain plaintext secrets and must live in a remote, encrypted, access-controlled backend.
- MUST NOT hardcode credentials (access keys, tokens, passwords) in `.tf` files; source them from environment variables, a secrets manager, or the provider's native credential chain.
- MUST NOT leave provider version constraints unpinned (missing `required_providers` or unbounded `~>` ranges); pin explicit versions and commit `.terraform.lock.hcl`.
- MUST NOT run `terraform apply -auto-approve` against shared or production state without a prior `plan` reviewed by a human or gated in CI.
- MUST NOT manage the same resource from more than one state file/workspace without an explicit `import`/`moved` strategy; this causes drift and accidental destroys.
- MUST NOT declare a variable or output that holds sensitive data without `sensitive = true`; unmarked values are printed in plain text in `plan`/`apply` output and CI logs.

## Ecosystem Idioms & Conventions

- Use a remote backend (e.g. S3 with DynamoDB locking, Terraform Cloud) with state locking enabled for any team-shared configuration.
- Structure code into reusable modules with explicit `variable`/`output` contracts instead of copy-pasted resource blocks.
- Run `terraform plan` in CI on every change and require review of the diff before `apply`.
- Tag or label all resources consistently (environment, owner, cost center) for cost attribution and safe cleanup.
- Prefer `data` sources to reference existing infrastructure over hardcoding IDs or ARNs.
