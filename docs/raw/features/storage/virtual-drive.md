# Feature: Virtual Drive — Storage Abstraction Layer

**Version:** 1.3.0  
**Status:** Stable / Core  
**Service:** `driveControllerService.ts` · `mountRegistryService.ts`  
**Storage Domain:** `mount_registry` (Memory/SQLite)  
**Capability:** Provides deterministic management of encrypted and local storage volumes, specifically the **System Drive** (Hot Cache) and the **Vault Drive** (Cold Archive).

---

## 1. Tactical Purpose

The **Virtual Drive** layer ensures that sensitive data—such as AI context, email drafts, and business registries—is never directly exposed on the host filesystem. It introduces a controlled abstraction over physical storage by enforcing mount-based access, ensuring that data is only accessible when the runtime is active, authenticated, and in a valid operational state.

This layer acts as the **storage gatekeeper** of the runtime, guaranteeing that all downstream storage systems (SQLite, Vault, runtime documents) operate only through resolved and validated mount points.

---

### 1.1 "It Does" (Scope)

* **System Drive Management:** Initializes and maintains the "Hot Cache" root used for SQLite databases and transient runtime files.
* **Vault Drive Orchestration:** Manages on-demand mounting/unmounting of the encrypted **Vault** for sync and write-back operations.
* **Path Resolution Layer:** Provides deterministic, abstracted mount paths so no service depends on physical filesystem locations.
* **Lifecycle Tracking:** Maintains a real-time `mountRegistry` including mount state, timestamps, failures, and resolution metadata.
* **Security Posture Enforcement:** Differentiates between encrypted mount and fallback modes and exposes posture status to the runtime.
* **Fallback Resolution:** Supports controlled fallback to local filesystem paths when encrypted mounts are unavailable, with explicit downgrade signaling.
* **Health Visibility:** Exposes mount health signals for diagnostic systems (e.g., Runtime Doctor / Vaidyar).
* **Provider Abstraction:** Resolves mount execution through a provider contract so the core depends on a mount protocol rather than a single implementation detail.
* **Fail-Closed Policy:** Allows hosts to block startup instead of silently downgrading when encrypted storage is unavailable.

---

### 1.2 "It Does Not" (Boundaries)

* **Encrypt Data:** Encryption/decryption is owned by the **Vault Service** and broader **Security Stack**.
* **Define Data Policy:** It does not decide what data is written or synced.
* **Execute Storage Logic:** It does not perform SQL queries or file operations beyond mount orchestration.
* **Manage Sync Timing:** It does not independently trigger sync workflows.

---

## 2. Architectural Dependencies

| Component | Role | Relationship |
| :--- | :--- | :--- |
| **Main Process** | `driveControllerService` | Executes OS-level mount/unmount operations |
| **Provider Contract** | `virtualDriveProvider.ts` | Adapts provider-specific mount/unmount implementations |
| **Registry** | `mountRegistryService` | Tracks mount state, failures, and metadata |
| **Feature** | **Vaidyar (Runtime Doctor)** | Validates mount health and posture |
| **Service** | `vaultService` | Coordinates encrypted archive access |
| **Service** | `startupOrchestrator` | Initializes system drive during boot |
| **Service Consumers** | SQLite / Sync / Email / Context | Depend on resolved mount paths |

---

## 3. Drive Types & Responsibilities

### 3.1 System Drive (Hot Cache)

- Automatically mounted during bootstrap
- Hosts:
  - SQLite databases
  - runtime cache files
  - operational state artifacts
- Expected to be **always available** during runtime
- Can operate in fallback mode if encrypted mount fails

---

### 3.2 Vault Drive (Cold Archive)

- Mounted **on-demand only**
- Hosts:
  - encrypted vault archives
  - temporary decrypted workspace (if applicable)
- Must be explicitly mounted before any vault operation
- Must be unmounted after operations complete (or on inactivity)

---

## 4. Mount Lifecycle

### 4.1 Lifecycle Stages

```text
UNMOUNTED
   ↓
MOUNTING
   ↓
MOUNTED
   ↓
ACTIVE
   ↓
UNMOUNTING
   ↓
UNMOUNTED
````

### 4.2 Failure States

```text
FAILED_MOUNT
FAILED_UNMOUNT
DEGRADED (fallback mode)
```

---

### 4.3 Lifecycle Flow

1. **Bootstrap Phase**

   * `startupOrchestrator` calls `initializeSystemDrive()`
   * System Drive is resolved (encrypted or fallback)

2. **Authentication Phase**

   * Upon successful auth, Vault mount becomes eligible

3. **Operational Phase**

   * Services request mount paths via controller
   * Vault mounts occur on-demand

4. **Idle / Rotation Phase**

   * Vault may be unmounted after inactivity threshold

5. **Shutdown Phase**

   * `driveControllerService.dispose()` attempts forced unmount of all drives

---

## 5. Mount Operation Contract

### 5.1 Idempotency

* `mountVaultDrive()` must be **idempotent**

  * If already mounted → return existing mount reference
* `unmountVaultDrive()` must safely handle already-unmounted state

---

### 5.2 Blocking Behavior

* Mount operations are **blocking at the service level**
* Downstream services must not proceed until mount is confirmed

---

### 5.3 Timeout & Retry

* Mount attempts must include:

  * timeout threshold
  * retry policy (bounded attempts)
* Failures must be recorded in `mountRegistry`

---

### 5.4 Path Validity Guarantee

* Returned mount paths are guaranteed:

  * writable (if mount succeeds)
  * isolated per runtime instance
* Services must **not cache mount paths indefinitely**

---

## 6. Concurrency & Isolation

* Mount operations are **single-flight controlled**

  * Concurrent mount requests resolve to a single execution
* Vault cannot be:

  * mounted twice
  * unmounted while active operations are in progress

### 6.1 Locking Expectations

* Mount/unmount operations require:

  * internal mutex or execution guard
* Sync, Vault, and Email services must coordinate via mount availability signals
* Vault session-scoped operations must increment active session count before mount use and release it before unmount

---

## 7. Data Ownership & Access Contract

| Resource       | Owner         | Access Pattern                 |
| -------------- | ------------- | ------------------------------ |
| Mount Path     | Virtual Drive | Provided via API only          |
| SQLite Files   | SQLite Layer  | Uses System Drive path         |
| Vault Archive  | Vault Service | Requires Vault mount           |
| Registry State | mountRegistry | Internal + diagnostic exposure |

---

### Rules

* No service may directly resolve OS filesystem paths
* All storage access must go through Virtual Drive resolution
* Mount paths are **ephemeral references**, not permanent identifiers

---

## 7.1 Client-Owned Policy Contract

Prana runtime owns **mount mechanics**. Host applications own **drive policy**.

### Runtime Core Responsibilities (Prana)

* Mount/open and unmount/eject execution
* Provider abstraction and diagnostics snapshots
* Lifecycle hooks and fail-closed posture defaults
* Session-safe vault mount orchestration

### Host Application Responsibilities (Client-Owned Policy)

* Drive schema/folder structure decisions
* Artifact placement strategy (what goes to drive)
* Encryption-policy selection and key-source flow
* Optional lifecycle ownership flags (for example client-managed mount timing)

### Compatibility Rules

* Default behavior remains runtime-managed when no host policy override is configured
* Client-managed policy must not require Chakra-specific logic in Prana core
* Vault encryption baseline remains active and is not removed by policy decoupling

### Runtime Effects of Client-Managed Policy

* Startup orchestrator may skip runtime-owned storage mirror validation stages when policy ownership is delegated to the host.
* Vaidyar storage posture checks remain non-blocking for delegated policy checks and report ownership as host-managed.
* Mount/unmount runtime mechanics remain in Prana even when policy ownership is delegated.

---

## 8. Security Posture Model

| Mode            | Description            | Risk Level |
| --------------- | ---------------------- | ---------- |
| **SECURE**      | Encrypted mount active | Low        |
| **DEGRADED**    | Local fallback path    | Medium     |
| **UNAVAILABLE** | Mount failed entirely  | High       |

---

### 8.1 Posture Behavior

* Runtime must be aware of posture state
* Sensitive operations may:

  * degrade functionality
  * block execution
  * emit warnings

---

## 9. Failure Modes & Recovery

| Scenario           | Behavior            | Recovery                            |
| ------------------ | ------------------- | ----------------------------------- |
| Mount fails        | Enter FAILED_MOUNT  | Retry with backoff                  |
| Permission denied  | Fail mount          | Surface error to Runtime Doctor     |
| Disk unavailable   | Fallback to local   | Mark DEGRADED                       |
| Unmount fails      | Mark FAILED_UNMOUNT | Retry during shutdown               |
| Crash during mount | Unknown state       | Reconcile via registry on next boot |

---

### 9.1 Recovery Strategy

* On startup:

  * reconcile mountRegistry with actual filesystem state
* On failure:

  * retry within bounded attempts
* On persistent failure:

  * escalate to Runtime Doctor

---

## 10. Observability & Diagnostics

The `mountRegistry` must capture:

* mount state
* timestamps (mount/unmount)
* failure reasons
* retry counts
* posture state
* provider id
* resolved runtime path
* active vault session count

---

### Diagnostic Integration

* Exposed to:

  * Runtime Doctor
  * Infrastructure UI
* Supports:

  * health checks
  * degraded mode warnings

---

## 11. Integration Constraints

* Sync Engine must not operate without Vault mount
* SQLite must not initialize without System Drive
* Email / Context services must rely on resolved paths only
* Shutdown must attempt deterministic cleanup

---

## 12. Implementation References

* **Controller:** `src/main/services/driveControllerService.ts`
* **Registry:** `src/main/services/mountRegistryService.ts`
* **Vault Logic:** `docs/features/vault.md`

---

## 13. Known Architectural Gaps (Roadmap)

| Area                    | Gap                                          | Impact |
| ----------------------- | -------------------------------------------- | ------ |
| Mount Orchestration     | Vault mount not auto-triggered by sync/cron  | Medium |
| Shutdown Enforcement    | No guaranteed unmount on all OS paths        | High   |
| Fallback Security       | Local fallback lacks encryption guarantees   | Medium |
| Concurrency Enforcement | Locking model not fully implemented          | High   |
| Mount Recovery          | No full reconciliation on crash recovery     | Medium |
| Telemetry Depth         | Limited mount health and performance metrics | Low    |

---

## 14. Reason For Change

* Mount execution was previously tied directly to an `rclone` process with Prana-specific remote names, which leaked implementation details into the core runtime.
* Storage startup did not expose mount posture as first-class diagnostics, making degraded or blocked storage easy to miss.
* Vault sync and workspace flows relied on ad hoc mount usage instead of an explicit session contract, which made deterministic unmounting unreliable.


---

## Security Enforcement (v1.2)

| Enforcement | Mechanism | Status |
|---|---|---|
| **Path Traversal Prevention** | `virtualDriveProvider.ts` enforces `resolvedPath.startsWith(vaultRoot)` for all filesystem operations | Enforced |
| **Mount Isolation** | Mount registry ensures segregated vault/system drives | Enforced |
| **IPC Validation** | Storage IPC handlers accept typed payloads | Enforced |

> **v1.2 Change:** Path traversal gating prevents any filesystem operation from accessing files outside defined vault directories.

