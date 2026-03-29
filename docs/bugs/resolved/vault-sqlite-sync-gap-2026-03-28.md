# Vault-SQLite Sync Gap Audit (2026-03-28)

## Status (2026-03-28)
Overall: CLOSED for current scope.

Resolution evidence:
1. Startup orchestrator owns governance, vault, and recovery sequencing.
2. Vault stage is a required pre-auth gate.
3. Queue recovery and startup sync status are represented in startup stage messages.

## Purpose
Track synchronization and hydration contract gaps between vault state and local SQLite projection stores at startup.

## Summary
Startup ownership and pre-auth gate policy are unified through startup orchestration, with vault and recovery behavior surfaced in startup diagnostics.

## Verified Current Capabilities
1. Governance repo SSH + clone readiness exists.
2. Vault remote pull and local hydration exists.
3. Remote snapshot integrity checks exist.
4. SQLite sync queue and encrypted registry sync state exists.
5. Interrupted sync tasks recovery exists.

## Gaps

### GAP-SYNC-001: First-install and returning-install flows are not codified as one startup policy
Severity: High

Evidence:
- flow spread across governanceRepoService, vaultService, syncProviderService.

Impact:
- Hard to reason about mandatory stages and failure behavior.

Required fix:
- Adopt startup policy contract with explicit first-install and returning-install branches.

### GAP-SYNC-002: Startup diagnostics do not expose full sync stage outcomes
Severity: Medium

Evidence:
- splash focuses on SSH/model gateway.

Impact:
- Operators cannot distinguish pull failure vs merge skip vs integrity failure quickly.

Required fix:
- Surface startup sync summary (pull, merge, integrity) in pre-auth diagnostics.

### GAP-SYNC-003: Push timer and cron sync jobs may overlap responsibilities
Severity: Medium

Evidence:
- syncProvider has push timer, cronScheduler has sync jobs.

Impact:
- Duplicate trigger paths and possible overlap complexity.

Required fix:
- Define canonical periodic sync strategy and de-duplication guard.

## Acceptance Criteria
1. First-install and returning-install startup branches are explicit and tested.
2. Startup report includes pull/merge/integrity and queue recovery summaries.
3. Periodic sync strategy has clear ownership and overlap prevention.
