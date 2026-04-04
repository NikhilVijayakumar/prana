# 🔐 Feature: Authentication Stack — Local Identity & Access (Enhanced)

**Status:** Stable
**Pattern:** Service-Orchestrated MVVM
**Service:** `authStoreService.ts`
**Storage Domain:** `auth_store` (SQLite / Local-Only)
**UI Stack:** `auth/` (Login, Forgot, Reset, Access Denied)
**Capability:** Provides a closed-loop, local-only authentication system to gate access to the Prana runtime and host applications.

---

## 1. Tactical Purpose

The Authentication Stack enforces **operator-level access control** for the Prana runtime using a strictly **local-first identity model**.

Credentials are stored exclusively in a **local SQLite database (System Drive)** and are never propagated to the Vault. This ensures:

* Identity is **device-bound**
* Authentication is **offline-capable**
* Attack surface is reduced to **local compromise vectors only**

Authentication acts as the **first executable trust boundary** before any system-level orchestration is allowed.

---

## 2. System Invariants (Critical)

The following invariants must always hold:

1. **Locality Constraint**

   * Credential data MUST exist only in `auth_store` (SQLite)
   * MUST NEVER be written to Vault or included in sync flows

2. **Pre-Orchestration Gate**

   * `StartupOrchestrator` MUST NOT transition to `READY` without a valid authenticated session

3. **Hash Integrity**

   * All credentials MUST be stored using bcrypt (or stronger)
   * Plaintext passwords MUST NEVER exist beyond transient memory

4. **Session Ephemerality**

   * Session tokens MUST be memory-resident or securely stored with TTL
   * Tokens MUST NOT survive process restart unless explicitly designed

5. **Deterministic Denial**

   * All failed authentication attempts MUST resolve to a known UI state
   * No silent failures or ambiguous outcomes

---

## 3. Architectural Dependencies

| Component         | Role                  | Relationship                                         |
| :---------------- | :-------------------- | :--------------------------------------------------- |
| **Main Process**  | `authStoreService`    | Source of truth for credentials and session issuance |
| **Main Process**  | `driveController`     | Ensures System Drive availability before auth access |
| **Renderer**      | `LoginContainer`      | Initiates auth flow and bridges to orchestrator      |
| **Startup Layer** | `StartupOrchestrator` | Blocks progression until auth success                |
| **Config**        | `PranaRuntimeConfig`  | Provides UI-level branding and policy toggles        |

---

## 4. Runtime Lifecycle

### 4.1 State Model

```
UNINITIALIZED
    ↓
AWAITING_CREDENTIALS
    ↓
AUTHENTICATING
    ↓
[ SUCCESS ] → AUTHENTICATED → SESSION_ACTIVE
[ FAILURE ] → DENIED → AWAITING_CREDENTIALS
```

Optional extended states:

* `LOCKED` (future: brute force protection)
* `RECOVERY_MODE` (Forgot/Reset flow)

---

### 4.2 Auth Flow (Deterministic)

1. **Credential Input**

   * User submits identifier + password via `LoginView`

2. **IPC Bridge**

   * Request sent via `app:auth.login` → Main Process

3. **Verification**

   * `authStoreService`:

     * Fetches user record
     * Performs timing-safe bcrypt comparison
     * Validates account status (active/locked)

4. **Decision Branch**

   * **Success:**

     * Generate session token
     * Emit `AUTH_SUCCESS`
   * **Failure:**

     * Emit `AUTH_FAILURE` with reason code

5. **State Transition**

   * ViewModel updates UI state deterministically

6. **Bootstrap Trigger**

   * On success:

     * `StartupOrchestrator.resume()` is invoked
     * System transitions toward full runtime initialization

---

## 5. Data Contracts

### 5.1 Credential Record (SQLite: `auth_store.users`)

```ts
{
  id: string,
  identifier: string,        // email or username
  password_hash: string,     // bcrypt hash
  created_at: timestamp,
  updated_at: timestamp,
  status: 'active' | 'locked' | 'disabled'
}
```

---

### 5.2 Session Token (In-Memory / Secure Store)

```ts
{
  token: string,
  user_id: string,
  issued_at: timestamp,
  expires_at: timestamp
}
```

---

### 5.3 Auth Response Contract (IPC)

```ts
type AuthResponse =
  | { success: true; token: string }
  | { success: false; reason: 'INVALID_CREDENTIALS' | 'LOCKED' | 'ERROR' }
```

---

## 6. Auth-to-Bootstrap Handshake

1. User submits credentials
2. `authStoreService` verifies identity
3. On success:

   * Session token is issued
   * Renderer receives success response
4. `LoginViewModel` triggers:

   ```
   StartupOrchestrator.resume()
   ```
5. Orchestrator proceeds with:

   * Storage validation
   * Vault readiness
   * Background systems

**Critical Constraint:**
Authentication is a **hard gate**, not a soft signal.

---

## 7. Sub-Feature Inventory (UI Stack)

| Screen              | Responsibility                          |
| :------------------ | :-------------------------------------- |
| **Login**           | Primary entry; initiates authentication |
| **Forgot Password** | Transitions system into recovery state  |
| **Reset Password**  | Validates and updates password locally  |
| **Access Denied**   | Displays deterministic failure states   |

---

## 8. Failure Modes & Recovery

| Failure Type         | Behavior                | Recovery Path           |
| :------------------- | :---------------------- | :---------------------- |
| Invalid Credentials  | Immediate denial        | Retry                   |
| SQLite Unavailable   | Block auth entirely     | Escalate to Vaidyar     |
| Corrupted Auth Store | Enter degraded mode     | Manual repair / restore |
| Session Expired      | Force re-authentication | Return to Login         |
| IPC Failure          | Fail closed             | Retry / restart         |

---

## 9. Security Posture

* **Zero-Trust Local Boundary**

  * No implicit trust between renderer and main process
* **IPC Hardening**

  * All auth IPC channels must validate payload shape
* **Timing Attack Protection**

  * Constant-time hash comparison enforced
* **Memory Hygiene**

  * Password inputs cleared immediately after verification
* **No Credential Propagation**

  * No logs, no Vault writes, no external sync

---

## 10. Known Architectural Gaps (Expanded)

### 10.1 Vault-Auth Coupling (Critical)

* Vault mount is not strictly enforced post-authentication
* Missing invariant:

  * `AUTH_SUCCESS → VAULT_READY` must be atomic before system READY

---

### 10.2 Brute Force Protection (High Priority)

* No rate limiting or lockout mechanism
* Missing:

  * Attempt counter
  * Time-based cooldown
  * Progressive backoff

---

### 10.3 Session Lifecycle Management

* Undefined:

  * Session TTL enforcement
  * Token invalidation on logout
  * Multi-session handling

---

### 10.4 Identity Provisioning Path

* No standardized provisioning pipeline
* Direct DB writes create risk of:

  * Schema drift
  * Invalid states

---


