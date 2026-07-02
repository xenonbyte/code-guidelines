# Workflow Run: WF-20260703-status-active-slug-code-guidelines

## Status
closed_at_plan_checkpoint

## Current Stage
closed

## r2p Version
0.7.8

## Tier Lock
base: standard
modifiers: cross_project, dependency, safety, scope_expanding

## Tier Estimate
base: standard
modifiers: cross_project, dependency, safety, scope_expanding

## Approved Checkpoints
| Stage | Artifact | Version | Approved At | Downstream Authorization | Bundle ID |
|---|---|---|---|---|---|
| raw_requirement | 00-raw-requirement.md | 1 | 2026-07-02T19:42:03.374274+00:00 | requirement_brief |  |
| requirement_brief | 03-requirement-brief.md | 1 | 2026-07-02T19:52:36.916198+00:00 | risk_discovery |  |
| risk_discovery | 04-risk-discovery.md | 2 | 2026-07-02T21:12:57.209306+00:00 | design |  |
| design | 05-design.md | 4 | 2026-07-02T21:15:11.559484+00:00 | spec |  |
| spec | 06-spec.md | 3 | 2026-07-02T21:15:46.456395+00:00 | plan |  |
| plan | 07-plan.md | 5 | 2026-07-02T23:27:35.197717+00:00 | close_workflow_run |  |

## Bundle Authorizations
| Bundle ID | Stages | Authorized At | Revoked At | Consumed Stages |
|---|---|---|---|---|

## Active Artifacts
| Stage | Artifact | Version | Status |
|---|---|---|---|
| raw_requirement | 00-raw-requirement.md | 1 | approved |
| requirement_brief | 03-requirement-brief.md | 1 | approved |
| risk_discovery | 04-risk-discovery.md | 2 | approved |
| design | 05-design.md | 4 | approved |
| spec | 06-spec.md | 3 | approved |
| plan | 07-plan.md | 5 | approved |

## Stale / Superseded Artifacts
| Artifact | Reason | Replaced By | Required Action |
|---|---|---|---|
| 04-risk-discovery.md | upstream gap at risk_discovery | (pending re-derivation) | R-1 |
| 05-design.md | upstream gap at risk_discovery | (pending re-derivation) | R-1 |
| 06-spec.md | upstream gap at risk_discovery | (pending re-derivation) | R-1 |

## Open Routes
| Route ID | From Stage | Owner Stage | Required Action | Status |
|---|---|---|---|---|
| R-1 | plan | risk_discovery | Set all 13 RISK Status lines to 'mitigated' (were 'Open — mitigation planned'); all risks are addressed by the approved design (each [ADDRESSED]); required for PLAN trace-closure. | repaired |

## User Confirmations
| Confirmation | Stage | Source | Recorded In |
|---|---|---|---|

## Resume Context
| Field | Value |
|---|---|
| Last Completed Operation | close_at_plan_checkpoint |
| Next Allowed Operation | run_close |
| Active Item | plan |
| Required Reread Targets |  |
| Resume Reason | owner repaired for R-1; resume checkpoint approval |

## Reopen Lineage
(none)
