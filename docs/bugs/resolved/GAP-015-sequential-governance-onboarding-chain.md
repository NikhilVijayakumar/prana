# GAP-015: Sequential Governance Onboarding Chain

## Summary
The onboarding implementation diverged from the required dependency-locked enterprise flow.

## Gaps Identified
1. Flow mismatch: runtime onboarding used a 6-step model instead of a 7-phase dependency chain.
2. Missing product phase: no dedicated Product Contextualization phase existed between company context and global approvals.
3. Missing workflow approval phase: no dedicated phase to approve agent-specific workflows before infrastructure setup.
4. State semantics mismatch: tracker status did not expose explicit LOCKED or IN-PROGRESS states.
5. Recursive verification gap: edits to early context did not deterministically flag downstream phases for re-verification.
6. Contract mismatch risk: backend onboarding commit validation expected legacy step IDs and field ownership.
7. Navigation guardrail gap: onboarding screen lacked an explicit Home action alongside Back navigation.

## Remediation Implemented
1. Refactored onboarding flow to a 7-phase sequence:
   - company-core
   - product-context
   - global-assets
   - global-guardrails
   - agent-profile-persona
   - agent-workflows
   - infrastructure-finalization
2. Added dependency locks and phase tracker states:
   - LOCKED
   - IN_PROGRESS
   - APPROVED
3. Added downstream re-verification propagation when upstream phases are edited.
4. Updated onboarding schema/default registries to support new step IDs and required fields.
5. Updated commit payload schema and backend operations validation to enforce new step IDs.
6. Added Home navigation action in onboarding UI and preserved Back behavior.
7. Added final gate behavior so Director Approve All remains disabled until phase 7 is approved.

## Residual Notes
1. Legacy onboarding keys remain in registry onboarding schema/defaults for backward compatibility and non-breaking migration.
2. Existing generated onboarding schema type files may still contain historical IDs and can be regenerated in a follow-up cleanup pass.
