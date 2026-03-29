# Onboarding: Channel Configuration - Channel ACL Specification

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Partial

## Current State
- Channel ACL approval contract and dependency position are documented in onboarding.
- Validation and storage boundaries for channel metadata are defined.

## Target State
- Full deterministic channel governance with durable approval tracing and action-level enforcement.
- Strong parity between onboarding ACL approval and runtime channel execution permissions.

## Gap Notes
- End-to-end parity between onboarding ACL approval and downstream execution guards needs ongoing validation.

## Dependencies
- docs/module/onboarding-registry-approval.md
- docs/module/onboarding-model-configuration.md
- docs/module/master-spec.md

## Acceptance Criteria
1. Channel ACL approval is mandatory before downstream infrastructure completion.
2. Secret channel credentials remain excluded from vault payload.
3. Approved channel rules are enforceable by runtime governance checks.

## Immediate Roadmap
1. Align channel ACL approval state with runtime policy enforcement surfaces.
2. Add parity checks for channel rule diagnostics in governance flows.

## 1. Single Reason to Change (SRP)
This module defines Step 4A onboarding governance for channels and agent access-control rules.

## 2. Input Data Required
- Channel provider.
- Approved/allowlisted channel destinations.
- Explicit `agent -> channel` access rules.

## 3. Pipeline Dependency
- Unlocks only after Company Core, Global Assets, and Agent Deep-Dive are approved.
- Must be approved before Model Config and Master Commit can proceed.

## 4. Validation
- `channel_provider`, `allowed_channels`, and `channel_access_rules` are mandatory.
- Access rules are validated as part of final commit guardrails.

## 5. Storage Rules
- Channel credentials remain runtime-local and excluded from Vault payload.
- Channel ACL approvals and non-secret routing metadata are included in onboarding commit context.

## 6. Chat Scenarios
- Internal chat receives channel validation diagnostics when checks fail.
- External channel activation is outside this commit path and can be executed after onboarding.

## 7. Navigation Guarantee
- Users can return to Global Assets from channel setup at any time without draft loss.
