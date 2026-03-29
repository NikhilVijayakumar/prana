# GAP-013 Business Context Registry Alignment

Status: Open
Severity: Critical
Category: Registry business alignment
Scope: src/core/registry + onboarding commit validation + onboarding UI context check

## Summary
The registry currently loads company metadata but does not fully synthesize company and product context into agent profiles, skills, KPIs, workflows, and onboarding approval checks.

## Observed Gaps
1. Missing context-layer hierarchy in loader
- The loader reads one company file and does not explicitly load and validate product details as a first-class context layer.
- Impact: business-specific context is not consistently injected into workflow execution and onboarding checks.

2. Missing dedicated schemas for company/product depth
- No dedicated schema files exist for company-core and product-details under registry schemas.
- Impact: company/product JSON can drift without structural validation.

3. Agent profiles are not explicitly company-aligned
- Agent YAMLs are mostly generic/goal-centric and rely on fallback normalization for core objective/vision.
- Impact: profile-level mission alignment is implicit, not enforced.

4. Skill library lacks product-specific operational skills
- Registry skills are broad and reusable, but product-track skills (education/fractional content governance/distribution packaging) are not explicitly represented.
- Impact: support and execution can remain generic instead of product-effective.

5. KPI library misses non-negotiable enforcement metrics
- Existing KPIs are strong at ops/governance performance but do not directly measure all mandatory non-negotiables.
- Impact: hard requirements like human review gate and education-vs-mature separation are not measurable enough.

6. Workflows do not consistently inject company protocol gates
- Workflow files contain local protocol dependencies, but global non-negotiables are not injected as a universal execution gate.
- Impact: business policy enforcement is inconsistent across workflow families.

7. Onboarding approval alignment check is narrow
- Commit validation checks individual vision alignment, but not full profile field alignment breadth (goal/core objective/non-negotiables/product-track fit).
- Impact: an agent can pass with partial alignment.

8. UI lacks explicit Not Aligned profile field highlighting
- Onboarding profile editor currently does not highlight profile fields that violate company vision/context.
- Impact: users discover misalignment late at commit-time.

9. Product complexity gap: feature onboarding workflow
- Product metadata indicates multi-track (education + fiction + distribution channels), but a dedicated feature-onboarding governance workflow is not represented in registry workflows.
- Impact: information void around onboarding new product features/formats safely.

## Required Remediation
1. Add and enforce company/product schemas.
2. Build loader context-layer overlay: global defaults -> business context injection -> alignment validation.
3. Add product-specific skills and non-negotiable KPIs (additive only).
4. Inject company protocol guardrails into workflow steps/dependencies at load time.
5. Expand onboarding approval checks to profile-wide alignment and product-boundary checks.
6. Add UI context check to mark Not Aligned fields in profile editing.
7. Add a feature-onboarding workflow aligned to company/product governance constraints.

## Acceptance Criteria
- Registry snapshot contains validated company and product context.
- Product-specific skills and non-negotiable KPIs are available in registry and resolvable by agents.
- Workflow snapshots include company protocol guardrails.
- Onboarding commit fails on profile/company misalignment beyond individual vision only.
- Onboarding UI marks misaligned profile fields before final approval.
- Additive-only changes preserve existing generic assets.
