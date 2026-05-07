# Runtime Map: Email

> Service Runtime Contract - Layer 4: Intelligence & Integration

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/email/email.md` |
| Implementation | `src/main/services/emailService.ts`, `emailOrchestratorService.ts`, `emailKnowledgeContextStoreService.ts` |
| Layer | 4 - Intelligence & Integration |
| Status | ✅ Compliant |

---

## 1. Responsibility

Single runtime responsibility:
- **Continuous Ingestion Pipeline:** Scheduler-driven email intake
- **Semantic Processing:** Context extraction + agent reasoning
- **Draft Orchestration:** Multi-agent synthesis
- **Controlled Handoff:** Human-validated send (Human-in-the-Loop)
- **Knowledge System:** Transform emails to queryable knowledge

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables (email processing)
- [x] Explicit persistence through contracts (emailKnowledgeContextStoreService - better-sqlite3)
- [x] Immutable configuration

### Forbidden
- [x] No mutable class-level state (factory pattern)
- [x] No automated send capability (explicit operator action required)

---

## 3. Persistence Rules

### Storage Interface
- **Email Artifacts:** `emailKnowledgeContextStoreService` - better-sqlite3
- **Knowledge Documents:** Vault (encrypted)
- **Storage Domain:** `email_artifacts`, `knowledge_documents`

### Current Implementation
- **Pattern:** Factory pattern (`createEmailService`)
- **State:** Instance-level only

---

## 4. Determinism Requirements

**MUST remain deterministic:**
- Pipeline stages must follow defined lifecycle
- UID idempotency (each email processed exactly once)
- No stage skipping or implicit transitions

---

## 5. Replayability Requirements

- [x] **Partial** - with external email store
- Email processing can be replayed from store

---

## 6. Side Effects

**Allowed side effects:**
- Email ingestion (IMAP)
- Draft assembly
- Knowledge extraction
- **No automated send** (Human-in-the-Loop)

---

## 7. Dependency Rules

### Allowed Imports
```ts
import { emailOrchestratorService } from './emailOrchestratorService';
import { emailKnowledgeContextStoreService } from './emailKnowledgeContextStoreService';
import { emailImapService } from './emailImapService';
```

### Forbidden Imports
- ❌ Automated send capability
- ❌ Mutable state

---

## 8. Host Assumptions

- [x] Electron (primary host)
- [ ] Node
- [ ] Browser
- [ ] None (pure library)

---

## 9. Lifecycle Ownership

**Owns:**
- Email ingestion lifecycle
- Draft assembly lifecycle
- Knowledge extraction lifecycle

**Does NOT own:**
- Send decision lifecycle (human operator)
- Agent inference lifecycle

---

## 10. Capability Contracts

| Capability | Interface | Source |
|------------|-----------|--------|
| Orchestrator | `IEmailOrchestratorService` | `emailOrchestratorService` |
| Knowledge Store | `IEmailKnowledgeContextStoreService` | `emailKnowledgeContextStoreService` |
| IMAP | `IEmailImapService` | `emailImapService` |

---

## 11. Extension Surface

**Clients may override:**
- Custom email processing pipelines
- Knowledge extraction strategies
- Draft assembly logic

---

## 12. Security Boundaries

- [x] IPC (email operations)
- [x] Storage (email + knowledge persistence)
- [x] Auth (credential isolation)

---

## 13. Compliance Analysis

### Statelessness Score
Score: **95/100**

### Migration Status
- **Pattern:** Factory (`createEmailService`)
- **State:** Instance-level only

### Detection Heuristics Applied
- ✅ No mutable class properties
- ✅ No automated send capability (by design)

---

## 14. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ✅ Allowed | Factory pattern |
| Determinism | ✅ Requirements | Pipeline stages deterministic |
| Replayability | ✅ Partial | With email store |
| Composability | ✅ | Uses orchestrator, store services |
| Lifecycle Safety | ✅ | Email lifecycle only |
| Policy Neutrality | ✅ | Pure email orchestration |
| Storage Neutrality | ✅ | SQLite + Vault |

---

## 15. System Invariants (From Feature)

1. **Human-in-the-Loop Enforcement** - No automated send, explicit operator action required
2. **UID Idempotency** - Each email processed exactly once
3. **Cache ↔ Vault Mirror** - Vault write requires prior cache persistence
4. **Pipeline Determinism** - Defined lifecycle stages, no skipping
5. **Executor Isolation** - Only Scheduler or explicit user-triggered

---

## 16. Key Behaviors

- **Continuous Ingestion:** Scheduler-driven
- **Semantic Processing:** Context extraction + reasoning
- **Draft Synthesis:** Multi-agent assembly
- **Human Control:** Operator validates before send

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Phase: Layer 4 - Intelligence & Integration*