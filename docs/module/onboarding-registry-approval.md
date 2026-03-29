# Onboarding: Registry Approval - Hierarchical Governance Specification

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Partial

## Current State
- Dependency-chain approval contract is documented and serves as strict sequencing baseline.
- Runtime persistence exists for stage snapshots, approved runtime projection, and backend-only business-context storage support.

## Target State
- Enforce complete dependency sequencing with deterministic validation and approval gating.
- Ensure all approval transitions are durable, auditable, and consistently applied.

## Gap Notes
- Core staged persistence exists, but enforcement depth is still partial for entity-by-entity approval storage and review surfaces.

## Dependencies
- docs/module/onboarding-hybrid-explorer-governance-lifecycle.md
- docs/module/master-spec.md

## Acceptance Criteria
1. Company core and global assets gate downstream approvals deterministically.
2. Approval transitions are durable and auditable.
3. Master commit only occurs after dependency-complete approval states.
4. Approved onboarding state is projected into runtime SQLite services before Vault sync publication.

## Immediate Roadmap
1. Complete staged persistence parity across all approval entities.
2. Align validation diagnostics with schema-driven feedback.
3. Extend backend approval persistence for FP-004 and FP-005 consumers without bypassing review flow.

## 1. Single Reason to Change (SRP)
This module defines the dependency-based approval pipeline for onboarding. No agent can be finalized until Company Core and Global Asset approvals are completed.

## 2. Dependency Tree (Unlock Rules)
1. **Company Core**
  - Registry source: `src/core/registry/company/company-core.json`
  - Required fields: company vision, context, core values, global non-negotiables.
  - Unlock condition: step status is `APPROVED`.
2. **Global Asset Approval**
  - Required approvals: Skills, KPIs, Protocols, Data Inputs.
  - Unlock condition: Company Core is `APPROVED`.
3. **Agent Deep-Dive**
  - Required persona extension per agent: `core_objective`, `individual_vision`, `role_non_negotiable_requirements`.
  - Composite check per agent: mapped approved Skills + approved Protocols + approved KPIs + workflows.
  - Unlock condition: Company Core and Global Assets are `APPROVED`.
4. **Infrastructure & Access**
  - Channel ACL approval: provider, allowed channels, and agent->channel access rules.
  - Model endpoint approval: validated model provider configuration.
  - Unlock condition: previous three stages are `APPROVED`.
5. **Master Commit**
  - Final commit writes approved payload to Vault and marks onboarding complete.

## 3. UI Pattern: Drill-Down Dashboard
- Replace linear-only progression with a Master Status Dashboard.
- Every step shows `PENDING`, `DRAFT`, or `APPROVED`.
- Users can open detail pages from any step card and return to Global Assets without losing draft state.
- `Continue` navigation remains locked unless the current step is explicitly approved.

## 4. Validation Guardrails
- Company fields are mandatory and validated for depth.
- Global asset selections are treated as approval allowlists.
- Agent mappings are checked against approved allowlists.
- Agent `individual_vision` is validated against company vision through a basic LLM alignment check with deterministic fallback.

## 5. Persistence Model
- Step-level statuses and drafts persist as durable onboarding state.
- Individual entity approvals are stored before final master commit.
- Final master commit packages approved state and projects to Vault.
- Approved runtime state is also projected into SQLite runtime services for downstream no-props/no-direct-vault consumers.

## 6. Open Implementation Note
- Current runtime persists through onboarding stage SQLite, approved runtime SQLite projection, and vault projections.
- Full entity-level SQLite staging/review tables are still a remaining migration task.

## 7. Hybrid Explorer Extension
- This specification is the strict approval baseline and remains authoritative for dependency unlock rules.
- Non-linear preview navigation, conditional Home access, and preview-vs-active behavior are defined in:
  - `docs/module/onboarding-hybrid-explorer-governance-lifecycle.md`
- When both documents overlap, this file governs dependency sequencing and the Hybrid Explorer document governs navigation and gating experience states.
