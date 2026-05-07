# Runtime Map: Vaidyar (Runtime Integrity Engine)

> Service Runtime Contract - Diagnostics & Health Monitoring

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/vaidyar/vaidyar.md` |
| Implementation | `src/main/services/vaidyarService.ts`, `systemHealthService.ts` |
| Layer | Diagnostics |
| Status | ✅ Compliant |

---

## 1. Responsibility

Single runtime responsibility:
- **Diagnostic Engine:** Runs modular health checks across all runtime layers
- **Structured Reporting:** Produces normalized `VaidyarReport`
- **Health Classification:** Assigns `Healthy`, `Degraded`, or `Blocked` states
- **Startup Gating:** Provides blocking signals to Startup Orchestrator
- **Continuous Monitoring:** Periodic pulse checks via scheduler
- **Event Emission:** Publishes health changes to Notification Centre
- **UI Visualization:** Real-time system health dashboard

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables (health checks, diagnostics)
- [x] Explicit persistence through contracts
- [x] Immutable configuration

### Forbidden
- [x] No mutable class-level state (factory pattern)
- [x] No auto-repair capabilities (read-only diagnostics)

---

## 3. Determinism Requirements

**MUST remain deterministic:**
- Health check results reproducible
- Classification deterministic
- Blocking signals deterministic

---

## 4. Replayability Requirements

- [x] **Partial** - health state can be replayed

---

## 5. Side Effects (Allowed)

- Health check execution
- Event emission to Notification Centre
- Blocking signal to Startup Orchestrator

---

## 6. What It Does NOT Do

- Modify system state or auto-repair failures
- Execute business logic or domain workflows
- Replace audit/history logging systems
- Override security or storage policies

---

## 7. Host Assumptions

- [x] Electron (primary host)
- [ ] Node
- [ ] Browser

---

## 8. Compliance Analysis

### Statelessness Score
Score: **95/100**

### Migration Status
- **Pattern:** Factory pattern
- **State:** Instance-level only

### Detection Heuristics Applied
- ✅ No mutable class properties

---

## 9. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ✅ Allowed | Factory pattern |
| Determinism | ✅ Requirements | Health checks deterministic |
| Replayability | ✅ Partial | State can be replayed |
| Lifecycle Safety | ✅ | Health lifecycle only |
| Policy Neutrality | ✅ | Pure diagnostics |

---

## 10. Health Classification

| State | Meaning |
|-------|---------|
| **Healthy** | All checks passed |
| **Degraded** | Some checks failed, operations continue |
| **Blocked** | Critical failures, blocks unsafe operations |

---

## 11. Diagnostic Layers

- Storage (virtual drive, vault)
- Security (encryption, auth)
- Network (sync, integration)
- Cognitive (context engine)

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Phase: Diagnostics Layer*