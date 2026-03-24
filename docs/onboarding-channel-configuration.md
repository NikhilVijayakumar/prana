# Onboarding: Channel Configuration - Channel ACL Specification

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
