---
name: python-ml
description: Semantic guardrails for Python data-science/ML notebooks and pipelines around reproducibility and data leakage.
appliesTo: ["**/*.ipynb", "**/train.py", "**/pipeline.py"]
stacks: ["python-ml"]
source: original
---

# Python ML / Data Science

## Hard Constraints (MUST NOT)

- MUST NOT fit a scaler/encoder/imputer (or any transform with learned statistics) on the full dataset before the train/test split - this leaks test-set information into training and inflates reported metrics.
- MUST NOT evaluate a model on data that overlaps with what it was trained on (duplicate/near-duplicate rows, a target-derived feature) and report that as generalization performance.
- MUST NOT leave random seeds unset for a stochastic step (train/test split, model init, shuffling) in code meant to produce reproducible or comparable results.
- MUST NOT keep the only copy of a preprocessing step inline in a notebook cell that is not also captured in a versioned pipeline/script used at inference time - training/serving skew follows.
- MUST NOT commit large datasets, model checkpoints, or data-source credentials into the source repository.

## Ecosystem Idioms & Conventions

- Fit all transforms on the training fold only, inside a `Pipeline` (or equivalent), and apply the same fitted transform to validation/test/inference data.
- Track experiments (parameters, metrics, data version) so results are comparable and reproducible across runs.
- Keep notebooks for exploration; move the finalized pipeline into versioned, tested scripts/modules before it drives production inference.
- Use cross-validation (or a held-out validation set) sized appropriately for the dataset instead of a single arbitrary split.
- Log data schema/statistics checks (row counts, null rates, distribution) so a silent upstream data change is caught before it corrupts a model.
