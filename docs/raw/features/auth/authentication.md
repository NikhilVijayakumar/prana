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

### 5.1 Credential Record (SQLite: `auth_store.auth_meta`)

Current implementation stores a single director record as JSON:

```ts
{
  directorName: string;
  email: string;
  passwordHash: string;                    // bcrypt hash
  tempPasswordHash: string | null;         // Temporary reset password (10-min TTL)
  tempPasswordExpiresAt: number | null;    // Expiry timestamp
  lastPasswordResetAt: string;             // ISO timestamp
  attemptCount?: number;                   // Brute force: failed attempts counter
  attemptLockUntil?: number;               // Brute force: lockout expiry timestamp
}
```

**Brute Force Thresholds:**
* `attemptCount >= 3`: Soft lockout for 60 seconds
* `attemptCount >= 10`: Hard lockout for 300 seconds

---

### 5.2 Session Token (In-Memory / Volatile Store)

Session tokens are stored in-memory in `volatileSessionStore`:

```ts
{
  sessionToken: string;                    // Format: prana_session_${UUID}
  sessionTokenExpiresAt: string;           // ISO timestamp (1 hour TTL by default)
}
```

**Token Lifecycle:**
* Generated on successful `auth:login`
* Transmitted to renderer in `LoginResult`
* Stored in `volatileSessionStore` (in-memory only)
* Validated by checking expiry timestamp
* Cleared on logout or app restart

---

### 5.3 Auth Response Contracts (IPC)

**`auth:login` Response:**

```ts
type LoginResult = {
  success: boolean;
  reason?: 'invalid_credentials' | 'email_mismatch'; // Only on failure
  directorName: string | null;
  email: string | null;
  isFirstInstall: boolean;
  sessionToken: string | null;
  sessionTokenExpiresAt?: string;           // ISO timestamp, included on success
  vaultDriveMounted?: boolean;
  vaultDriveMessage?: string;
}
```

**`auth:forgot-password` Response:**

```ts
type ForgotPasswordResult = {
  success: boolean;
  reason?: 'ssh_unavailable' | 'email_mismatch';  // Only on failure
  tempPassword: string | null;
}
```

**`auth:reset-password` Response:**

```ts
type ResetPasswordResult = {
  success: boolean;
  reason?: 'no_temp_password' | 'temp_password_expired' | 'invalid_password';  // Only on failure
}
```

**`auth:logout` Response:**

```ts
type LogoutResult = {
  success: boolean;
}
```

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

| Failure Type              | Behavior                          | Recovery Path                                 |
| :------------------------ | :-------------------------------- | :-------------------------------------------- |
| Invalid Credentials       | Immediate denial, attempt logged  | Retry (with soft lockout if 3+ attempts)      |
| Email Mismatch            | Immediate denial                  | Retry with correct email                      |
| Brute Force (Soft)        | Locked for 60 seconds             | Wait or reset via forgot-password              |
| Brute Force (Hard)        | Locked for 300 seconds            | Wait or reset via forgot-password              |
| SQLite Unavailable        | Block auth entirely               | Escalate to Vaidyar                          |
| Corrupted Auth Store      | Enter degraded mode               | Manual repair / restore                       |
| Session Expired           | Force re-authentication           | Return to Login                               |
| IPC Failure               | Fail closed                       | Retry / restart                               |
| Temp Password Expired     | Reset flow fails                  | Re-initiate forgot-password (new 10-min TTL)  |

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

## 10. Known Architectural Gaps (Expanded & Implementation Status)

### 10.1 Vault-Auth Coupling (Critical) — ✅ IMPLEMENTED

* **Status:** Startup Orchestrator now validates governance repo readiness (SSH verification) before transitioning to READY
* **Implementation:** `startupOrchestratorService.ts` - governance stage acts as auth pre-gate
* **Details:** SSH repository access requires authenticated user; failing governance stage blocks all downstream stages

---

### 10.2 Brute Force Protection (High Priority) — ✅ IMPLEMENTED

* **Status:** Server-side brute force protection with progressive lockouts
* **Implementation:** `authService.ts` + `authStoreService.ts`
* **Details:**
  * Tracks failed attempt count in auth record (`attemptCount` field)
  * Soft lockout: 3 failed attempts → 60-second cooldown (`attemptLockUntil`)
  * Hard lockout: 10 failed attempts → 300-second cooldown
  * Counter resets on successful authentication
  * Counter resets on successful password recovery (forgot/reset password)

---

### 10.3 Session Lifecycle Management (High Priority) — ✅ IMPLEMENTED

* **Status:** Session TTL enforcement and logout flow added
* **Implementation:** `volatileSessionStore.ts` + `authService.ts` + `ipcService.ts`
* **Details:**
  * Session tokens now include expiry timestamp (`sessionTokenExpiresAt`)
  * Default TTL: 1 hour (configurable)
  * `isSessionExpired()` method validates token expiry before use
  * `auth:logout` IPC handler for explicit session invalidation
  * Client-side logout via `volatileSessionStore.clear()`
  * Tokens are memory-only; no persistence across app restart

---

### 10.4 Identity Provisioning Path

* Status: Out of scope for current implementation
* Future: Standardized provisioning pipeline via config-driven setup

---

### 10.5 Multi-Provider Auth (OAuth/OIDC/LDAP/SAML)

* Status: Not implemented; local-first design is intentional
* Future: Extension hooks to support enterprise authentication