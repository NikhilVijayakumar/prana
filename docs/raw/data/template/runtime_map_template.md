# Service Runtime Contract

> Runtime governance contract for a single runtime service.
> Part of:
> features → invariants → runtime-map → audit-governance

---

# Metadata

| Field                  | Value                                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Service                | `{service-name}`                                                                                                                        |
| Feature Doc            | `docs/raw/features/{feature-path}.md`                                                                                                   |
| Implementation         | `src/main/services/{service}.ts`                                                                                                        |
| Runtime Map            | `docs/raw/architecture/runtime-map/{service-name}.md`                                                                                   |
| Layer                  | `1-5`                                                                                                                                   |
| Runtime Classification | `Orchestrator / Coordinator / Capability Adapter / Persistence Boundary / Lifecycle Manager / Runtime Gateway / Infrastructure Adapter` |
| Status                 | `✅ Compliant / ⚠️ Transitional / ❌ Violation`                                                                                           |
| Last Reviewed          | `YYYY-MM-DD`                                                                                                                            |
| Audit Suites Applied   | `runtime_purity / architectural_integrity / platform_neutrality / runtime_extensibility / runtime_security`                             |

---

# 1. Responsibility

Single runtime responsibility.

One reason to change.

Describe ONLY:

* orchestration responsibility
* coordination responsibility
* execution boundary responsibility

Do NOT describe:

* feature walkthroughs
* UI behavior
* product functionality

---

# 2. Runtime Classification

Select all applicable classifications.

* [ ] Orchestrator
* [ ] Coordinator
* [ ] Capability Adapter
* [ ] Persistence Boundary
* [ ] Execution Boundary
* [ ] Lifecycle Manager
* [ ] Runtime Gateway
* [ ] Infrastructure Adapter

---

# 3. Ownership Classification

| Ownership Type           | Status                         | Notes |
| ------------------------ | ------------------------------ | ----- |
| State Ownership          | None / Transitional / Present  |       |
| Lifecycle Ownership      | None / Explicit / Hidden       |       |
| Infrastructure Ownership | None / Adapter / Direct        |       |
| Policy Ownership         | None / Transitional / Embedded |       |
| Execution Ownership      | Scoped / Long-Lived            |       |
| Persistence Ownership    | None / Contract / Direct       |       |

---

# 4. State Ownership

## Allowed

* [ ] Request-scoped ephemeral variables
* [ ] Immutable configuration
* [ ] Externalized persistence through contracts
* [ ] Deterministic execution context
* [ ] Explicit replay-safe execution metadata

## Forbidden

* [ ] Mutable class-level state
* [ ] Static mutable fields
* [ ] Cross-request memory accumulation
* [ ] Hidden runtime caches
* [ ] Session retention
* [ ] Workflow ownership state
* [ ] Runtime-owned mutable registries
* [ ] In-memory orchestration history

---

# 5. Persistence Rules

## Persistence Boundary

Describe:

* allowed persistence contracts
* persistence ownership restrictions
* storage neutrality expectations

---

## Allowed Persistence

* [ ] Persistence through capability contracts
* [ ] Externalized storage ownership
* [ ] Replay-safe persistence
* [ ] Deterministic persistence sequencing

---

## Forbidden Persistence

* [ ] Direct infrastructure ownership
* [ ] Hardcoded filesystem paths
* [ ] Vendor-specific persistence logic
* [ ] Hidden storage mutation
* [ ] Runtime-owned storage topology

---

## Current Persistence Implementation

| Category         | Value                                       |
| ---------------- | ------------------------------------------- |
| Persistence Type | `External / better-sqlite3 / sql.js / None` |
| Adapter Layer    |                                             |
| Migration Status |                                             |
| Replay Safe      | Yes / Partial / No                          |

---

# 6. Dependency Rules

## Allowed Dependencies

* [ ] Capability contracts
* [ ] Deterministic utilities
* [ ] Explicit orchestration abstractions
* [ ] Same-layer services ONLY through contracts
* [ ] Infrastructure adapters through interfaces

---

## Forbidden Dependencies

* [ ] UI framework imports
* [ ] Renderer ownership
* [ ] Direct infrastructure vendors
* [ ] Service locator patterns
* [ ] Stateful singletons
* [ ] Mutable global registries
* [ ] Cross-layer internal implementation imports
* [ ] Electron ownership inside runtime core

---

## Dependency Direction

| Rule                   | Status                   |
| ---------------------- | ------------------------ |
| Dependency Inversion   | ✅ / ⚠️ / ❌               |
| Cyclic Dependency Risk | None / Partial / Present |
| Infrastructure Leakage | None / Partial / Present |
| Framework Leakage      | None / Partial / Present |

---

# 7. Determinism Requirements

Describe:

* ordering guarantees
* concurrency restrictions
* deterministic orchestration requirements
* replay consistency expectations

---

## Forbidden Nondeterminism

* [ ] Direct `Date.now()`
* [ ] Direct randomness
* [ ] Unstable async ordering
* [ ] Environment branching in orchestration
* [ ] Hidden mutable execution state
* [ ] Timing-sensitive orchestration

---

# 8. Replayability Requirements

## Replay Classification

* [ ] Fully Replayable
* [ ] Replayable with External State
* [ ] Partial Replayability
* [ ] Non-Replayable

---

## Replay Requirements

Describe:

* event reconstruction expectations
* replay-safe side effects
* serialization boundaries
* deterministic replay guarantees

---

## Replay Risks

* [ ] Hidden execution state
* [ ] Untracked side effects
* [ ] Non-serializable execution context
* [ ] Missing event recording
* [ ] Environment-coupled execution

---

# 9. Lifecycle Ownership

## Allowed Lifecycle Ownership

* [ ] Request-scoped execution
* [ ] Explicit startup/shutdown contracts
* [ ] Managed worker ownership
* [ ] Managed scheduler ownership
* [ ] Explicit cleanup/disposal

---

## Forbidden Lifecycle Ownership

* [ ] Hidden background execution
* [ ] Orphaned timers
* [ ] Unmanaged workers
* [ ] Fire-and-forget orchestration
* [ ] Unbounded retries
* [ ] Hidden listeners/subscriptions

---

## Lifecycle Classification

| Lifecycle Area       | Status |
| -------------------- | ------ |
| Startup Ownership    |        |
| Shutdown Governance  |        |
| Cleanup Guarantees   |        |
| Cancellation Support |        |
| Worker Governance    |        |
| Timer Governance     |        |

---

# 10. Side Effects

## Allowed Side Effects

* [ ] IPC emission
* [ ] Capability invocation
* [ ] Explicit persistence through contracts
* [ ] Deterministic orchestration events
* [ ] Explicitly governed execution dispatch

---

## Forbidden Side Effects

* [ ] Direct filesystem mutation
* [ ] Unmanaged async execution
* [ ] Arbitrary process spawning
* [ ] Infrastructure mutation
* [ ] Hidden orchestration execution
* [ ] Unbounded network ownership

---

# 11. Host Assumptions

## Runtime Host Compatibility

* [ ] Pure Library
* [ ] Node Compatible
* [ ] Electron Compatible
* [ ] Browser Compatible
* [ ] Host Agnostic

---

## Forbidden Host Coupling

* [ ] Electron-owned orchestration
* [ ] DOM usage inside runtime core
* [ ] OS-specific orchestration branching
* [ ] Direct host lifecycle ownership

---

# 12. Capability Contracts

## Required Capabilities

List ONLY explicit contracts.

| Capability | Purpose | Required |
| ---------- | ------- | -------- |
|            |         |          |

---

## Forbidden Capability Behavior

* [ ] Direct implementation imports
* [ ] Hidden capability ownership
* [ ] Capability mutation leakage
* [ ] Internal adapter bypassing

---

# 13. Extension Surface

## Allowed Extension Points

Describe:

* injectable capabilities
* overridable orchestration points
* adapter replacement boundaries

---

## Extension Restrictions

* [ ] No runtime mutation
* [ ] No infrastructure ownership escalation
* [ ] No unrestricted execution
* [ ] No lifecycle bypassing

---

# 14. Security Boundaries

## Security Surface

* [ ] IPC Boundary
* [ ] Storage Boundary
* [ ] Auth Boundary
* [ ] Extension Boundary
* [ ] Execution Boundary
* [ ] Network Boundary

---

## Security Restrictions

* [ ] Input validation required
* [ ] Least privilege enforced
* [ ] Capability isolation enforced
* [ ] No plaintext secret ownership
* [ ] No unrestricted execution

---

# 15. Compliance Analysis

> Populated from runtime-map analysis.

---

## Runtime Purity

| Invariant     | Status | Score |
| ------------- | ------ | ----- |
| Statelessness |        |       |
| Determinism   |        |       |
| Replayability |        |       |

---

## Architectural Integrity

| Invariant            | Status | Score |
| -------------------- | ------ | ----- |
| Boundary Integrity   |        |       |
| Dependency Direction |        |       |
| Lifecycle Safety     |        |       |

---

## Platform Neutrality

| Invariant          | Status | Score |
| ------------------ | ------ | ----- |
| Host Agnosticism   |        |       |
| Storage Neutrality |        |       |
| Policy Neutrality  |        |       |

---

## Runtime Extensibility

| Invariant                     | Status | Score |
| ----------------------------- | ------ | ----- |
| Composability                 |        |       |
| Capability Contract Integrity |        |       |
| Extension Safety              |        |       |

---

## Runtime Security

| Security Area            | Status | Score |
| ------------------------ | ------ | ----- |
| Trust Boundary Integrity |        |       |
| Capability Isolation     |        |       |
| IPC Security             |        |       |
| Storage Security         |        |       |
| Extension Security       |        |       |

---

# 16. Detection Heuristics Applied

## Statelessness Checks

* [ ] No mutable class-level collections
* [ ] No static mutable state
* [ ] No hidden caches
* [ ] No cross-request accumulation

---

## Determinism Checks

* [ ] No `Date.now()`
* [ ] No randomness
* [ ] Stable ordering enforced
* [ ] No timing-sensitive orchestration

---

## Lifecycle Checks

* [ ] No unmanaged timers
* [ ] No orphaned listeners
* [ ] Explicit cleanup paths exist
* [ ] Cancellation supported

---

## Dependency Checks

* [ ] No infrastructure imports in runtime core
* [ ] No UI framework leakage
* [ ] No cyclic dependencies
* [ ] Dependency inversion enforced

---

## Security Checks

* [ ] IPC validation enforced
* [ ] No unrestricted execution
* [ ] No plaintext secrets
* [ ] Capability isolation enforced

---

# 17. Architecture Drift

Areas trending toward:

* [ ] State accumulation
* [ ] Infrastructure lock-in
* [ ] Orchestration monolith behavior
* [ ] Replayability degradation
* [ ] Lifecycle leakage
* [ ] Host coupling
* [ ] Policy contamination
* [ ] Capability collapse

---

# 18. Transitional Violations

Known technical debt.

| Violation | Impact | Migration Direction | Removal Target |
| --------- | ------ | ------------------- | -------------- |
|           |        |                     |                |

---

# 19. Planned Deprecations

Future removals and migrations.

| Area | Deprecation | Planned Version |
| ---- | ----------- | --------------- |
|      |             |                 |

---

# 20. Verification Commands

## Statelessness Verification

```bash
grep -r "private.*=" src/main/services/{service}.ts | grep -v "readonly"
```

```bash
grep -r "new Map\|new Set\|\[\]" src/main/services/{service}.ts
```

---

## Determinism Verification

```bash
grep -r "Date.now\|Math.random\|randomUUID" src/main/services/{service}.ts
```

---

## Lifecycle Verification

```bash
grep -r "setInterval\|setTimeout" src/main/services/{service}.ts
```

```bash
grep -r "void .*Promise\|void .*async" src/main/services/{service}.ts
```

---

## Dependency Verification

```bash
grep -r "better-sqlite3\|electron\|react" src/main/services/{service}.ts
```

---

## Security Verification

```bash
grep -r "eval\|exec\|spawn\|child_process" src/main/services/{service}.ts
```

---

# 21. Confidence

* [ ] High
* [ ] Medium
* [ ] Low

Confidence reflects:

* implementation clarity
* architectural evidence quality
* runtime ownership visibility

---

# 22. Audit Traceability

| Audit Suite             | Latest Report |
| ----------------------- | ------------- |
| runtime_purity          |               |
| architectural_integrity |               |
| platform_neutrality     |               |
| runtime_extensibility   |               |
| runtime_security        |               |

---

# Template Metadata

| Field              | Value                                        |
| ------------------ | -------------------------------------------- |
| Template Version   | `2.0`                                        |
| Generated From     | `runtime-map governance system`              |
| Last Updated       | `2026-05-07`                                 |
| Architecture Model | `Stateless Deterministic Capability Runtime` |

```
```
template is available in docs\raw\data\template\runtime_map_template.md