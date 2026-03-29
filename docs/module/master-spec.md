# Prana Master Specification

## Purpose
This document is the source of truth for Prana capability contracts. It defines what the engine must do, what is currently active, and what is in the implementation pipeline.

## Scope
This specification covers:
- Runtime architecture and module boundaries.
- Capability contracts for core subsystems.
- Cross-repo dependencies for Director (Dhi) and Admin (Vidhan).
- Data boundary rules between SQLite and Vault.
- Security, startup, and observability guarantees.
- Status taxonomy used by all module specifications.

## Canonical Source Precedence
When sources overlap, apply this precedence:
1. docs/module/master-spec.md
2. docs/module/*
3. docs/system/system.md and docs/system/Big Picture.md
4. docs/reference/module/*
5. docs/bugs/*

Reference documents are historical intent anchors. Module documents are implementation-facing contracts.

## Architecture Principles
1. Single responsibility per module contract.
2. Deterministic startup and recovery before protected navigation.
3. Vault for durable approved state, SQLite for operational high-frequency state.
4. Policy and auditability before automation side effects.
5. Human approval at key governance boundaries.
6. Secrets never exposed via diagnostics.
7. Backward compatibility is explicit, time-boxed, and removable.

## Status Taxonomy
Use these labels in all module docs.

- Active: Implemented and verified in runtime/test surfaces.
- Partial: Core exists but contract coverage is incomplete.
- Pipeline: Specified and planned but not fully implemented.

## Capability Matrix

| Capability | Status | Primary Contract | Notes |
|:--|:--|:--|:--|
| Startup Orchestration | Active | docs/module/startup-orchestrator.md | Stage gating and diagnostics are active. |
| Vault and Hydration | Active | docs/module/vault-knowledge-repository.md | Durable knowledge pipeline and classification are present. |
| Vault-SQLite Sync | Partial | docs/module/vault-sync-contract.md | Core sync active, parity and migration details still tightening. |
| Cron Recovery | Partial | docs/module/cron-recovery-contract.md | Recovery semantics defined, deeper parity checks in roadmap. |
| Authentication | Active | docs/module/login.md | Login and reset flows available. |
| Email Management | Pipeline | docs/module/email-management.md | Rich contract exists; runtime integration is pending. |
| Email Orchestrator | Pipeline | docs/module/email-orchestrator-service.md | Multi-agent draft contract exists; service wiring pending. |
| Email Heartbeat | Pipeline | docs/module/email-cron-heartbeat.md | Schedule contract exists; runtime jobs pending. |
| Governance Onboarding | Partial | docs/module/onboarding-registry-approval.md | Contract strengthened; full enforcement roadmap remains. |
| Hybrid Explorer Lifecycle | Partial | docs/module/onboarding-hybrid-explorer-governance-lifecycle.md | Navigation model exists; parity tracking ongoing. |
| Infrastructure Layers | Active | docs/module/infrastructure-layers.md | Runtime health and orchestration surfaces present. |
| Google Ecosystem Integration | Partial | docs/module/google-ecosystem-integration.md | Core services present; expansion in roadmap. |
| Context Compaction and Budgeting | Partial | docs/bugs/resolved/GAP-018-context-compaction-and-token-budgeting.md | Baseline exists; provider parity and UX hardening continue. |
| Collaboration Handshake | Partial | docs/bugs/resolved/GAP-020-global-collaboration-handshake-and-agent-directory.md | Contract clarified; persistence and UI parity pending. |

## Cross-Repo Dependency Contracts

### Director Dependency Contract (Dhi)
Prana must expose stable contracts used by Director-facing workflows:
- Startup integrity summaries.
- Approval-gated governance transitions.
- Draft-first collaboration and review surfaces.
- Model configuration compatibility where Director-selected providers affect runtime behavior.

### Admin Dependency Contract (Vidhan)
Prana must preserve Admin-facing governance operations:
- Registry and policy lifecycle management.
- Compliance and audit continuity.
- Operational channels and escalation pathways.
- Approval metadata and reviewer traceability.

## Data Boundary Contract

### SQLite
Use SQLite for:
- Queue and orchestration runtime state.
- Read cursors and high-frequency workflow progression.
- Local transient diagnostics and projection caches.

### Vault
Use Vault for:
- Approved durable artifacts.
- Compliance records and immutable historical states.
- Shared governance snapshots and authoritative archives.

### Synchronization Rule
Startup and approved transitions must preserve pull-before-push safety where configured, and must never leak secrets in diagnostics.

## Security and Compliance Rules
1. Diagnostics expose status, not credential values.
2. Outbound effects require policy and approval checks where contracts require them.
3. Recovery operations are idempotent.
4. Compatibility shims are documented with sunset timeline.

## Startup and Recovery Guarantees
Startup must publish stage-level and overall status before protected routes proceed. Required gates are:
1. Integration contract check.
2. Governance repository readiness.
3. Vault initialization and hydration.

Degraded components are permitted only when contract policy explicitly allows continuation.

## Observability Contract
Every critical subsystem must provide:
- State snapshot endpoint or equivalent diagnostic surface.
- Error class and impact metadata.
- Recovery and retry outcome visibility.
- Redacted pre-auth diagnostics.

## Module Document Contract Template
Every module specification in docs/module must include:
1. Purpose
2. Current State
3. Target State
4. Gap Notes
5. Dependencies
6. Acceptance Criteria
7. Immediate Roadmap

## Immediate Phase 1 Cleanup Targets
1. Move feature-gap narratives out of docs/bugs and into module contracts.
2. Keep docs/bugs focused on true defects and process-quality findings.
3. Maintain migration links from bug history to module contracts and feature plans.
4. Keep this file updated first, then propagate to module-specific docs.

## Prana Integrity Report Snapshot (2026-03-29)
- Active: startup gating, vault core, core auth, major runtime service surfaces.
- Partial: sync parity, onboarding enforcement depth, collaboration persistence.
- Pipeline: end-to-end email desk workflow and heartbeat operations.

This snapshot is the executive summary baseline for implementation planning waves.
