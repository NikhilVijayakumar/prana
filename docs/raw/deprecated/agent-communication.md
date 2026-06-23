# 💬 Feature: Agent Communication & Context Intelligence

**Version:** 1.3.0
**Status:** Stable / Core (Communication: Alpha for Group Chat and External Adapters)
**Capability:** Provides multi-modal persistent conversation management across in-app and external channels, backed by a token-aware context memory engine that preserves conversational intelligence across sessions through deterministic compaction and digest persistence.

---

## 1. Tactical Purpose

This feature combines two tightly coupled capabilities:

**Context Engine (Memory Layer)** — maintains high-fidelity conversational intelligence under strict token constraints. Transforms unbounded chat streams into structured, compressed, and reusable memory artifacts without losing reasoning continuity.

**Communication (Conversation Layer)** — manages the lifecycle of conversations across in-app and external channels, routing context to agents and maintaining operator identity across surfaces.

The Context Engine is the memory substrate. The Communication layer is the execution surface. Neither is complete without the other.

---

## 2. System Invariants (Critical)

1. **Context Ownership**
   Conversation context belongs to the Context Engine. The Communication layer consumes it — never defines it.

2. **Token Budget Enforcement**
   No message may be dispatched to an agent without first validating it fits within the model's context window.

3. **Context Compaction Authority**
   Only the Context Engine may trigger compaction. Communication layer does not summarize or truncate directly.

4. **Session Continuity**
   Context state must survive runtime module disposal. All session state externalizes to SQLite before teardown.

5. **Identity Consistency**
   A single operator identity MUST be recognized across all channels (in-app, Telegram, future adapters).

6. **Context Immutability**
   Raw message buffer is immutable. Only digests are produced by compaction — source messages are never modified or deleted.

7. **No Direct Model Invocation**
   Neither layer executes LLM inference. Both route data to agents via the Queue system.

---

## 3. Context Engine — Memory Layer

### 3.1 Purpose

Provides a deterministic, token-aware context lifecycle that preserves long-running conversational intelligence through structured compaction, audit persistence, and cross-session continuity.

### 3.2 Responsibilities

* **Token Budget Enforcement** — continuously tracks token consumption against model-specific context windows
* **Deterministic Compaction** — triggers summarization at predictable thresholds
* **Segmented Context Preservation** — maintains head, digest, and tail structure
* **Recursive Summarization** — supports multi-level compression for very long sessions
* **Cross-Session Continuity** — enables session rollover using persisted digests
* **Audit Persistence** — stores all compaction artifacts in SQLite
* **RAG Integration** — makes digests retrievable via vector search
* **Prompt Assembly** — produces optimized Prompt Packs for model execution

### 3.3 Non-Responsibilities

* Does not execute LLM inference
* Does not modify domain or business data
* Does not control access permissions
* Does not replace long-term knowledge storage (Vault is source of truth for durable artifacts)

### 3.4 Multi-Tier Memory Model

| Tier | Description | Storage | Lifespan |
| ---- | ----------- | ------- | -------- |
| Raw Buffer | Full conversation history | In-memory + SQLite | Session |
| Active Context | Token-bounded prompt window | In-memory | Per request |
| History Digest | Summarized middle segments | SQLite | Persistent |
| RAG Memory | Indexed embeddings of digests | SQLite-VSS | Persistent |

### 3.5 Context Composition

```text
[HEAD] → [DIGEST] → [TAIL]
```

* **HEAD** — System instructions, persona, constraints
* **DIGEST** — Compressed historical reasoning
* **TAIL** — Recent conversational turns

### 3.6 Token Management

**Trigger condition:** Compaction triggers when total token count ≥ floor(contextWindow × highWaterMarkRatio). Default ratio: 0.8. Trigger is deterministic and reproducible.

**Budget allocation:**

| Segment | Allocation |
| ------- | ---------- |
| Head | Fixed |
| Tail | Sliding window |
| Digest | Dynamic |

### 3.7 Compaction Lifecycle

1. **Detection** — Token threshold exceeded
2. **Segmentation** — Split into head / middle / tail
3. **Summarization** — Middle → digest via summarization agent (queued task)
4. **Replacement** — Replace middle with digest
5. **Persistence** — Store digest and metadata in SQLite

**Recursive Compaction:** If digest grows beyond limits, re-summarize previous digests. Enables infinite conversation scaling with bounded memory footprint.

### 3.8 Session States

```text
ACTIVE → COMPACTED → ROLLED_OVER → ARCHIVED
```

**Carryover Protocol:** New session seeded with latest digest and system instructions. Old session marked ARCHIVED and remains queryable via RAG.

### 3.9 Digest Model

Each digest must preserve: intent, decisions, dependencies. Must remove: redundancy, low-signal content.

Fields: `digest_id`, `session_id`, `summary_text`, `key_decisions`, `open_tasks`, `risks`, `source_message_range`, `token_count`, `created_at`.

### 3.10 Persistence Domains (SQLite)

| Domain | Purpose |
| ------ | ------- |
| `context_sessions` | Session metadata |
| `context_messages` | Raw message log (immutable) |
| `context_digests` | Compacted summaries |
| `context_events` | Compaction events |

**Persistence rules:**
* All compaction events must be recorded
* Raw messages must remain immutable
* Digests must reference original message ranges
* Must comply with Rule 2 (App-Scoped Storage)

### 3.11 Prompt Assembly Contract

```text
SYSTEM (Head)
+ DIGEST (Compressed Memory)
+ RECENT (Tail)
+ USER INPUT
```

Constraints:
* Must not exceed model context window
* Must preserve logical continuity
* Must maintain deterministic ordering

### 3.12 Context Failure Modes

| Scenario | Behavior |
| -------- | -------- |
| Token miscalculation | Fallback estimation |
| Summarization failure | Retry via queue |
| Digest corruption | Rebuild from raw messages |
| SQLite failure | Block compaction, continue session |
| Overflow without compaction | Hard truncate (last resort — logged with data loss warning) |

### 3.13 Context Architectural Gaps

| Area | Gap | Impact |
| ---- | --- | ------ |
| Multi-Model Tokenization | No per-model tokenizer abstraction | High |
| Semantic Compression | No importance-aware summarization | High |
| Context Graph | No graph linking across sessions | Medium |
| Real-Time Streaming | No incremental compaction during streaming | Medium |
| Memory Tiering | No separation between short/long-term memory | Medium |

---

## 4. Communication — Conversation Layer

### 4.1 Purpose

Acts as the "Switchboard" for the Prana runtime. Manages the lifecycle of conversations, ensuring that whether an operator is talking to one agent (Individual) or a committee of agents (Group), the context remains optimized, identities are verified, and history is persistent.

### 4.2 Responsibilities

* **Individual Chat** — facilitates 1:1 operator-to-agent work orders
* **Group Chat (In-App)** — orchestrates multi-agent environments where agents observe and respond to the same thread
* **Channel Routing** — maps external intents (Telegram) to internal agent personas
* **Identity Reconciliation** — maps a single operator identity across multiple channels
* **Context Delegation** — hands off context management entirely to the Context Engine

### 4.3 Non-Responsibilities

* Does not perform LLM inference — routes data to agents only
* Does not define agent skills — only executes them
* Does not store external credentials
* Does not manage context compaction — that belongs to the Context Engine

### 4.4 Conversation State Model

```text
IDLE → INITIATING → ACTIVE → COMPACTING → ACTIVE
                       ↓
                 ROLLING_OVER → ARCHIVED
                       ↓
                    FAILED
```

| State | Description |
| ----- | ----------- |
| IDLE | No active conversation |
| INITIATING | Operator started session; identity being verified |
| ACTIVE | Conversation in progress; messages being routed |
| COMPACTING | Context Engine triggered compaction; new messages buffered |
| ROLLING_OVER | Session limit reached; new session being seeded from digest |
| ARCHIVED | Session ended; accessible via RAG only |
| FAILED | Unrecoverable routing or context failure |

### 4.5 Communication Models

**Individual (1:1):**
* Direct work-order routing between operator and single agent
* Context isolated to that specific Agent-Operator pair
* Available: In-App and External (Telegram)

**Group (1:N or M:N):**
* Privileged operators summon multiple agents into a single workspace
* Orchestration Manager broadcasts thread history to all participating agents
* External integration limited by channel adapter capability (Telegram group support pending `group_id` tracking)

**Channel Routing:**
* External intents mapped to internal agent personas via channel router
* Operator identity reconciled across channels ("Nikhil on Telegram" == "Nikhil in-app")

### 4.6 Identity Reconciliation Rules

* Each operator has a canonical identity record
* External channel identities (Telegram user_id) are mapped to canonical identity at pipeline entry
* Reconciliation failure MUST block message processing — unverified identities are not routed

### 4.7 Conversation Workflow — Individual Chat

| Step | Action |
| ---- | ------ |
| Trigger | Operator opens chat with agent |
| Precondition | Operator identity verified; agent available |
| 1 | Create or resume session from existing digest |
| 2 | Assemble Prompt Pack from Context Engine |
| 3 | Enqueue model task via Queue system |
| 4 | Receive agent response |
| 5 | Append to Raw Buffer |
| 6 | Check token budget |
| 7 | If threshold exceeded → trigger compaction (async) |
| 8 | Deliver response to operator |
| Completion | Operator ends session OR session rolls over |

### 4.8 Conversation Workflow — External Channel (Telegram)

| Step | Action |
| ---- | ------ |
| Trigger | Message received from external adapter |
| Precondition | Channel router active; identity record exists for sender |
| 1 | Channel router receives external message |
| 2 | Validate sender identity via reconciliation |
| 3 | Map to internal agent persona |
| 4 | Load or create session context |
| 5 | Assemble Prompt Pack |
| 6 | Enqueue Channel lane task in Queue system |
| 7 | Agent response delivered back through channel adapter |
| Completion | No explicit session end; session times out or rolls over |

### 4.8 Group Chat Constraints (Current Limitations)

* No agent loop prevention policy currently defined — agents responding to each other indefinitely is an open gap
* External group chat requires `group_id` tracking alongside `user_id` in the channel router
* Group sessions share a `ConversationEntity` in SQLite — in-app reply can push to Telegram group via channel router when this is implemented

### 4.9 Failure Modes

| Scenario | Behavior | Recovery |
| -------- | -------- | -------- |
| External adapter unavailable | Queue message; retry on reconnect | Channel Lane retry policy |
| Identity reconciliation failure | Block message; notify operator | Operator must re-verify identity |
| Context Engine compaction failure | Buffer new messages; retry compaction | Queue retry |
| Context Engine SQLite failure | Block new sessions; active sessions continue in-memory | Restore from last persisted digest |
| Agent unresponsive | Queue timeout; mark task FAILED | Retry per Queue policy |
| Channel router failure | Block external messages; in-app unaffected | Restart channel router |
| Session rollover failure | Attempt rollover with partial digest | Fall back to fresh session with error notification |
| Group agent loop | No current mitigation | Open gap — see Known Gaps |

### 4.10 Edge Cases

* **Simultaneous messages from same operator across channels** — both messages enter the queue; ordering within session determined by queue priority
* **Agent response delayed beyond session timeout** — response delivered to archive; operator notified of delayed delivery
* **Empty context (fresh session, no prior digests)** — Prompt Pack uses HEAD only; no DIGEST segment
* **Context digest corruption** — rebuild from raw messages (Context Engine recovery path)
* **Group Chat: agent addresses another agent** — no current safeguard; agent loop is an open gap

---

## 5. Integration Points

### 5.1 Context Engine With Queue System

* Summarization agent runs as Model Lane task
* Must respect concurrency limits
* Must not block user interaction

### 5.2 Context Engine With Token Manager

* Provides token counts and model limits
* Enforces hard cutoffs

### 5.3 Communication With Queue System

* Individual chat → Model Lane
* External channel messages → Channel Lane
* Both lanes respect Queue priority and concurrency limits

### 5.4 Context Engine With RAG System

* Digests are embedded into vector store
* Retrievable for semantic recall across sessions

### 5.5 Communication With Storage

* Session and message data stored in SQLite (`context_sessions`, `context_messages`)
* Digests stored in SQLite (`context_digests`)
* No direct Vault access — durable artifacts (if needed) go through Sync Engine

---

## 6. Observability

**Context Engine exposes:**
* token usage per session
* compaction frequency
* digest sizes
* summarization latency
* context overflow incidents
* RAG indexing rate

**Communication exposes:**
* active sessions per channel
* message routing latency per lane
* identity reconciliation success/failure rate
* external adapter availability
* agent response latency
* channel error rates

**UI Integration:**
* Compaction indicators
* Digest review panel
* Source trace mapping
* Session rollover preview

---

## 7. Known Architectural Gaps

| Area | Gap | Impact |
| ---- | --- | ------ |
| First-Class Chat Store | Conversation history currently ephemeral across app restarts (needs SQLite `conversations` table) | High |
| Group Chat Agent Loop Prevention | No policy to prevent agents replying to each other indefinitely | High |
| WhatsApp Bridge | No adapter for WhatsApp transport | Medium |
| Threading | No "Reply-to" threading in channel router | Low |
| Multi-Model Tokenization | No per-model tokenizer abstraction in Context Engine | High |
| Semantic Compression | No importance-aware summarization | High |
| External Group Chat | Requires `group_id` tracking alongside `user_id` | Medium |
| Group Chat Room Mapping | No unified "Room" → `ConversationEntity` mapping across in-app and external channels | Medium |

---

## 8. Security Enforcement

| Enforcement | Mechanism | Status |
| ----------- | --------- | ------ |
| Sender Validation | Channel routing validates sender identity before pipeline entry | Enforced |
| IPC Validation | All IPC handlers accept typed payloads | Enforced |
| wrappedFetch | All HTTP operations enforce timeout | Enforced |
| Context Isolation | Session context isolated to Agent-Operator pair | Enforced |
