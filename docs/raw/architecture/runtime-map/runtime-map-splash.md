# Runtime Map: Splash System Initialization

> Service Runtime Contract - UI Layer (Bootstrap Visualization)

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/splash/splash-system-initialization.md` |
| Implementation | `src/main/services/startupOrchestratorService.ts` (shared with Startup Orchestrator) |
| Layer | UI - Bootstrap Visualization |
| Status | ✅ Compliant |

---

## 1. Responsibility

Single runtime responsibility:
- **State-Synchronized UI Mirror:** Visual representation of bootstrap lifecycle
- **Readiness Gatekeeper:** Main UI loads only after READY state
- **Failure Surface:** Visible, actionable, blocking failures
- **Transition Manager:** Controlled transition to operational state

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables (UI state)
- [x] Explicit persistence (inherits from Startup Orchestrator)

### Forbidden
- [x] No independent state (delegates to Startup Orchestrator)

---

## 3. Dependency Rules

### Inherits From
- **Startup Orchestrator:** `startupOrchestratorService.ts`

### Allowed Imports
```ts
import { startupOrchestratorService, StartupState } from './startupOrchestratorService';
```

### Forbidden Imports
- ❌ Independent persistence layers

---

## 4. Determinism Requirements

**MUST remain deterministic:**
- State synchronization deterministic
- Failure visibility deterministic
- Transition timing deterministic

---

## 5. Replayability Requirements

- [x] **Yes** - Inherits from Startup Orchestrator

---

## 6. Host Assumptions

- [x] Electron (primary host - UI rendering)
- [ ] Node
- [ ] Browser
- [ ] None

---

## 7. Lifecycle Ownership

**Owns:**
- Visual lifecycle
- User perception lifecycle

**Does NOT own:**
- System lifecycle (delegates to Startup Orchestrator)

---

## 8. Security Boundaries

- [x] IPC (bootstrap state sync)
- [x] UI State (no sensitive data)

---

## 9. System Invariants (From Feature)

1. **Strict Readiness Gate** - Main UI MUST NOT load before READY, no partial rendering
2. **State Synchronization** - UI state mirrors system state machine
3. **Failure Visibility** - Failures are visible and blocking
4. **Zero Implicit Trust** - No assumptions about system state

---

## 10. Key Behaviors

- **State Machine Visualization:** Show bootstrap progress
- **Failure Blocking:** Show errors, block continued access
- **Controlled Transition:** Only transition when fully ready

---

## 11. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ✅ Allowed | Delegates to Startup Orchestrator |
| Determinism | ✅ Requirements | State sync deterministic |
| Replayability | ✅ Yes | Inherits from orchestrator |
| Composability | ✅ | Uses startup orchestrator |

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Phase: UI Layer - Splash*