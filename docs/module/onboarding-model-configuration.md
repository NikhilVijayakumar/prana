# Onboarding: Model Configuration - Infrastructure Stage Specification

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Partial

## Current State
- Model provider approval rules are documented in onboarding infrastructure stage.
- Baseline validation and storage constraints are present.

## Target State
- Runtime model metadata capture and context-window alignment must be fully enforced through onboarding and settings parity.
- Provider-level approvals must be auditable with deterministic gating behavior.

## Gap Notes
- Runtime context-window capture and full configuration parity remain under roadmap tracking.

## Dependencies
- docs/module/onboarding-registry-approval.md
- docs/module/master-spec.md
- docs/bugs/feature-implementation-plans.md

## Acceptance Criteria
1. Provider configuration approvals are dependency-gated and auditable.
2. Required model fields block final commit if invalid.
3. Runtime model metadata needed by context budgeting is captured and persisted.

## Immediate Roadmap
1. Complete FP-007 integration for context-window capture and runtime propagation.
2. Align onboarding and settings model configuration behavior.

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

## 6. Chat Scenarios
- Internal chat can receive validation logs for failed provider checks.
- No external channel dispatch is required for endpoint setup.

## 7. Navigation Guarantee
- Users can navigate back to Global Assets from this stage without losing in-progress drafts.
