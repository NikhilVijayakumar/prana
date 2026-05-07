# Runtime Map: Channel Integration

> Service Runtime Contract - Layer 4: Intelligence & Integration

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/chat/communication.md` |
| Implementation | `src/main/services/channelRouterService.ts`, `channelRegistryService.ts` |
| Layer | 4 - Intelligence & Integration |
| Status | ✅ Compliant |

---

## 1. Responsibility

Single runtime responsibility:
- **Switchboard:** Lifecycle management of conversations
- **Individual Chat:** 1:1 operator-to-agent work orders
- **Group Chat:** Multi-agent environments (observe + respond)
- **Channel Routing:** Map external intents (Telegram) to internal agent personas
- **Context Rotation:** Compact long histories for token limits
- **Identity Reconciliation:** Map operator across multiple channels

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables (routing decisions, message routing)
- [x] Explicit persistence through contracts
- [x] Immutable configuration

### Forbidden
- [x] No mutable class-level state (factory pattern)
- [x] No runtime cache without governance

---

## 3. Persistence Rules

### Storage Interface
- **Conversation Store:** `conversationStoreService` - better-sqlite3
- **Channel Registry:** `channelRegistryService` - better-sqlite3

### Current Implementation
- **Pattern:** Factory pattern (`createChannelRouter`)
- **State:** Instance-level only

---

## 4. Determinism Requirements

**MUST remain deterministic:**
- Channel routing must be reproducible
- Identity reconciliation must be deterministic

---

## 5. Replayability Requirements

- [x] **Partial** - with external conversation store

---

## 6. Side Effects

**Allowed side effects:**
- Message routing to agents
- Context retrieval
- Channel state updates

---

## 7. Dependency Rules

### Allowed Imports
```ts
import { channelRegistryService } from './channelRegistryService';
import { contextEngineService } from './contextEngineService';
import { conversationStoreService } from './conversationStoreService';
```

### Forbidden Imports
- ❌ Mutable in-memory registries
- ❌ LLM inference (not its responsibility)

---

## 8. Host Assumptions

- [x] Electron (primary host)
- [ ] Node
- [ ] Browser
- [ ] None (pure library)

---

## 9. Lifecycle Ownership

**Owns:**
- Conversation lifecycle
- Routing lifecycle
- Channel registration lifecycle

**Does NOT own:**
- Agent inference lifecycle
- Business data lifecycle

---

## 10. Capability Contracts

| Capability | Interface | Source |
|------------|-----------|--------|
| Channel Registry | `IChannelRegistryService` | `channelRegistryService` |
| Context Engine | `IContextEngineService` | `contextEngineService` |
| Conversation Store | `IConversationStoreService` | `conversationStoreService` |

---

## 11. Extension Surface

**Clients may override:**
- Channel adapters (Telegram, future WhatsApp)
- Routing strategies
- Identity reconciliation logic

---

## 12. Security Boundaries

- [x] IPC (message routing)
- [x] Storage (conversation persistence)
- [x] Auth (identity verification)

---

## 13. Compliance Analysis

### Statelessness Score
Score: **95/100**

### Migration Status
- **Pattern:** Factory (`createChannelRouter`)
- **State:** Instance-level only

### Detection Heuristics Applied
- ✅ No mutable class properties
- ✅ No static mutable fields

---

## 14. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ✅ Allowed | Factory pattern |
| Determinism | ✅ Requirements | Routing reproducible |
| Replayability | ✅ Partial | With conversation store |
| Composability | ✅ | Uses context, store services |
| Lifecycle Safety | ✅ | Conversation lifecycle only |
| Storage Neutrality | ✅ | Uses external stores |

---

## 15. Communication Models

| Model | Description |
|-------|-------------|
| **Individual (1:1)** | Direct work-order, isolated context |
| **Group (1:N or M:N)** | Multi-agent broadcast thread |

---

## 16. Key Behaviors

- **External Adapter Gateway:** channelRouterService routes external intents
- **Identity Reconciliation:** Map "Nikhil on Telegram" == "Nikhil in-app"
- **Context Optimization:** Compact histories for token limits

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Phase: Layer 4 - Intelligence & Integration*