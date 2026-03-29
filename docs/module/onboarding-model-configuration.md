# Onboarding: Model Configuration - Infrastructure Stage Specification

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Partial

## Current State
- Model provider approval rules are documented in onboarding infrastructure stage.
- Runtime model access is normalized and persisted into approved SQLite runtime state during onboarding commit.
- Context-window and reserved-output metadata are resolved against provider/model defaults for runtime token budgeting.

## Target State
- Runtime model metadata capture and context-window alignment must stay enforced through onboarding and settings parity.
- Provider-level approvals must be auditable with deterministic gating behavior.

## Gap Notes
- Backend/runtime propagation is implemented, but onboarding/settings UI parity for explicit context-window editing is still incomplete.

## Dependencies
- docs/module/onboarding-registry-approval.md
- docs/module/master-spec.md
- docs/bugs/feature-implementation-plans.md

## Acceptance Criteria
1. Provider configuration approvals are dependency-gated and auditable.
2. Required model fields block final commit if invalid.
3. Runtime model metadata needed by context budgeting is captured and persisted.
4. Context bootstrap can resolve runtime provider defaults from persisted approved model access.

## Immediate Roadmap
1. Align onboarding and settings editing surfaces with the runtime-normalized model metadata contract.
2. Add integration coverage for end-to-end custom model context-window behavior.

## 1. Single Reason to Change (SRP)
This module governs model endpoint approval as part of Step 4 (Infrastructure & Access) in onboarding.

## 2. Input Data Required
- Endpoint URIs and model names for each provider.
- API keys/tokens (runtime-local and excluded from Vault payload).
- Provider enablement flags.

## 3. Pipeline Dependency
- This step unlocks only after Company Core, Global Assets, Agent Deep-Dive, and Channel Access are approved.
- Final master commit is blocked until model config step is approved.

## 4. Validation
- At least one enabled provider with non-empty endpoint and model is required.
- Provider config approval is explicit (`APPROVED`) and independent from draft state.

## 5. Storage Rules
- Model credentials remain runtime-local and are excluded from final Vault onboarding payload.
- Approval status is persisted with onboarding state to satisfy dependency checks.
- Approved runtime model access is normalized into SQLite runtime state with explicit `contextWindow` and `reservedOutputTokens` values per provider.
- Token-budget consumers must resolve model limits from the persisted runtime model config before falling back to registry defaults.

## 6. Chat Scenarios
- Internal chat can receive validation logs for failed provider checks.
- No external channel dispatch is required for endpoint setup.

## 7. Navigation Guarantee
- Users can navigate back to Global Assets from this stage without losing in-progress drafts.
