# Runtime Map: Onboarding Pipeline Orchestrator

> Service Runtime Contract - Governance Layer

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/Onboarding/onboarding-pipeline-orchestrator.md` |
| Implementation | `onboardingStageStoreService.ts` |
| Layer | Governance |
| Status | ✅ Compliant |

---

## 1. Responsibility

Single runtime responsibility:
- **Governance Gatekeeper:** Enforce MVG (Minimum Viable Governance) before runtime activation
- **Deterministic State Machine:** Step-gated, dependency-driven approval sequence
- **Persistent Pipeline:** Resumable onboarding with snapshot metadata
- **System Capability Validation:** Validate required capabilities before activation

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables (stage execution)
- [x] Explicit persistence through contracts (onboardingStageStoreService - better-sqlite3)
- [x] Immutable configuration

### Forbidden
- [x] No mutable class-level state
- [x] No runtime cache without governance

---

## 3. Persistence Rules

### Storage Interface
- **Onboarding Registry:** `onboardingStageStoreService` - better-sqlite3
- **Storage Domain:** `onboarding_registry`

### Current Implementation
- **Pattern:** Store service with external persistence
- **State:** All onboarding state in SQLite

---

## 4. Determinism Requirements

**MUST remain deterministic:**
- Step-gated sequence deterministic
- Commit requires all required steps approved
- Snapshot persistence authoritative and resumable

---

## 5. Replayability Requirements

- [x] **Yes** - fully deterministic
- Onboarding state replayable from SQLite

---

## 6. System Invariants (From Feature)

1. **Deterministic Commit Contract** - Step-gated, dependency-driven
2. **MVG Enforcement** - All required steps approved before commit
3. **Resumable** - Stage snapshot persists flow stage + consent + timestamp

---

## 7. UX Stages Added

- Welcome/Orientation entry screen
- Phase-level policy/consent checkpoint
- Final Review/Confirm before commit
- Completion handoff screen

---

## 8. Host Assumptions

- [x] Electron (primary host)
- [ ] Node
- [ ] Browser

---

## 9. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ✅ Allowed | Store accepts state from host |
| Determinism | ✅ Requirements | Step-gated sequence |
| Replayability | ✅ Yes | SQLite replayable |
| Lifecycle Safety | ✅ | Onboarding lifecycle only |

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Phase: Governance Layer*