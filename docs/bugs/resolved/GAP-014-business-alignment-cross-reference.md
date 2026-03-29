# GAP-014 Business Alignment Cross-Reference

Status: Open
Severity: Critical
Tags: Business Alignment, Registry Audit
Scope: src/core/registry

## Audit Basis
- Source of truth reviewed:
  - src/core/registry/company/company-core.json
  - src/core/registry/company/product-details.json
- Cross-referenced sections:
  - src/core/registry/kpis
  - src/core/registry/protocols
  - src/core/registry/data-inputs
  - src/core/registry/skills
  - src/core/registry/workflows

## Confirmed Universal Assets (Keep As-Is)
- Generic engineering and operations assets are valid as universal capabilities and remain unchanged.
- Examples: clean-architecture and telemetry/latency controls, generic governance and security gates.

## Misalignments Flagged
1. KPI coverage gap for creative-control/value-gate enforcement
- Non-negotiable: company creative-control layer requires 3-of-6 BAVANS value checks with no violations.
- Gap: no dedicated KPI quantifies this rule.
- Required fix: add a value-gate pass-rate KPI.

2. Protocol coverage gap for voice/identity consent
- Non-negotiable: no external voice or identity replication without explicit consent.
- Gap: no dedicated protocol enforcing consent-boundary checks.
- Required fix: add voice-identity consent protocol.

3. Protocol coverage gap for mandatory persona documentation before activation
- Non-negotiable: persona documents are mandatory before activation.
- Gap: no dedicated activation gate protocol for persona documentation completeness.
- Required fix: add mandatory persona documentation protocol.

4. Skill coverage gap for AI/Human value boundaries
- Non-negotiable: AI assists Art/Aesthetic/Narrative/Story, human-only for Belief/Vision.
- Gap: no explicit skill for value-boundary enforcement.
- Required fix: add BAVANS value-boundary enforcement skill.

5. Skill coverage gap for origin attribution execution
- Non-negotiable: track origin of every idea (human vs AI-assisted).
- Gap: no dedicated skill for origin attribution workflow.
- Required fix: add idea-origin attribution tracking skill.

6. Data-input gap for idea origin ledger
- Non-negotiable: origin traceability for all outputs.
- Gap: no dedicated registry data-input for idea-origin records.
- Required fix: add idea-origin-ledger data input.

7. Data-input gap for voice consent registry
- Non-negotiable: explicit consent for voice/identity usage.
- Gap: no dedicated consent registry data-input.
- Required fix: add voice-identity-consent-registry data input.

8. Data-input gap for content approval ledger
- Non-negotiable: no publication without human review.
- Gap: no dedicated content approval sign-off ledger data-input.
- Required fix: add content-approval-ledger data input.

9. Workflow gap for creative publication gate
- Non-negotiable: human review mandatory before publication, with age/track separation checks.
- Gap: no centralized workflow in registry for creative publication gating.
- Required fix: add creative-content-approval-gate workflow and bind to business protocols.

## Auto-Correction Proposal Summary
- Additive-only update set (no deletions) under src/core/registry:
  - 1 KPI file for BAVANS value-gate pass rate
  - 2 protocol files (voice consent, persona documentation)
  - 2 skill files (value-boundary enforcement, origin attribution)
  - 3 data-input definition files (origin ledger, consent registry, approval ledger)
  - 1 workflow file (creative-content-approval-gate)
- Ensure these new assets are bindable by loader without hard-failing general assets.
