# Runtime Map: Authentication

> Service Runtime Contract - Layer 0 (Prerequisite)

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/auth/authentication.md` |
| Implementation | `src/main/services/authService.ts`, `authStoreService.ts` |
| Layer | 0 - Authentication (Prerequisite) |
| Status | ✅ Compliant |

---

## 1. Responsibility

Single runtime responsibility:
- **Local-First Identity Model:** Device-bound authentication
- **Access Control:** Gate access to Prana runtime
- **Session Management:** Memory-resident or TTL-based tokens
- **Password Reset:** Forgot/reset workflow
- **Pre-Orchestration Gate:** Valid session required before bootstrap

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables (login attempts, session tokens)
- [x] Explicit persistence through contracts (authStoreService - better-sqlite3)
- [x] Immutable configuration

### Forbidden
- [x] No credential storage in Vault
- [x] No credentials in sync flows
- [x] Plaintext passwords beyond transient memory

---

## 3. Persistence Rules

### Storage Interface
- **Auth Store:** `authStoreService` - better-sqlite3
- **Storage Domain:** `auth_store` (SQLite only, local-only)

### Current Implementation
- **Pattern:** Service with external store
- **Persistence:** better-sqlite3 (NOT in Vault)

---

## 4. Determinism Requirements

**MUST remain deterministic:**
- Credential verification deterministic
- Session token generation deterministic
- Password hashing deterministic (bcrypt)

---

## 5. Replayability Requirements

- [x] **Partial** - auth store can be replayed
- Session tokens are ephemeral

---

## 6. Side Effects

**Allowed side effects:**
- Credential verification
- Session token creation/validation
- Password reset email

---

## 7. Dependency Rules

### Allowed Imports
```ts
import { authStoreService, AuthStoreRecord } from './authStoreService';
import { emailService } from './emailService';
```

### Forbidden Imports
- ❌ Vault storage (credentials must be local only)
- ❌ Sync flows

---

## 8. Host Assumptions

- [x] Electron (primary host)
- [ ] Node
- [ ] Browser
- [ ] None (pure library)

---

## 9. Lifecycle Ownership

**Owns:**
- Authentication lifecycle
- Session lifecycle
- Credential lifecycle

**Does NOT own:**
- Vault lifecycle
- Sync lifecycle

---

## 10. Capability Contracts

| Capability | Interface | Source |
|------------|-----------|--------|
| Auth Store | `IAuthStoreService` | `authStoreService` |
| Email | `IEmailService` | `emailService` |

---

## 11. Extension Surface

**Clients may override:**
- Custom credential validation
- Session token strategies

---

## 12. Security Boundaries

- [x] IPC (auth operations)
- [x] Storage (auth_store SQLite)
- [x] Auth (credential verification)
- [ ] None

---

## 13. Compliance Analysis

### Statelessness Score
Score: **95/100**

### Detection Heuristics Applied
- ✅ No mutable class properties
- ✅ No Vault storage (by design)
- ✅ Credentials local-only

---

## 14. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ✅ Allowed | Accepts state from store |
| Determinism | ✅ Requirements | Credential verification deterministic |
| Replayability | ✅ Partial | Auth store replayable |
| Composability | ✅ | Uses store + email services |
| Lifecycle Safety | ✅ | Auth lifecycle only |
| Policy Neutrality | ✅ | Pure authentication |
| Storage Neutrality | ✅ | SQLite only, no Vault |

---

## 15. System Invariants (From Feature)

1. **Locality Constraint** - Credentials ONLY in auth_store (SQLite), NEVER in Vault or sync
2. **Pre-Orchestration Gate** - StartupOrchestrator requires valid session
3. **Hash Integrity** - bcrypt storage, no plaintext beyond transient memory
4. **Session Ephemerality** - Memory-resident or TTL-based tokens
5. **Deterministic Denial** - Consistent auth failure handling

---

## 16. Key Behaviors

- **Device-Bound:** Local SQLite only
- **Offline-Capable:** No network required for auth
- **Reduced Attack Surface:** Local compromise vectors only

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Phase: Layer 0 - Authentication*