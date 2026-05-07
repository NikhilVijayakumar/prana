Here is your **enhanced, production-grade specification** of the *Cognitive Memory & Context Engine*. This version deepens the architectural clarity, formalizes lifecycle behavior, aligns tightly with SQLite + RAG + Queue + Token systems, and strengthens determinism, auditability, and extensibility.

---

````md id="c7xk29"
# Feature: Cognitive Memory & Context Engine

**Version:** 1.3.0  
**Status:** Stable / Core  
**Service:** `contextEngineService.ts` · `tokenManagerService.ts` · `contextDigestStoreService.ts`  
**Pattern:** Recursive Summarization · Token-Budget Enforcement · Multi-Tier Persistence  
**Capability:** Provides a deterministic, token-aware context lifecycle that preserves long-running conversational intelligence through structured compaction, audit persistence, and cross-session continuity.

---

## 1. Tactical Purpose

The **Cognitive Memory & Context Engine** is responsible for maintaining **high-fidelity conversational intelligence under strict token constraints**. It transforms unbounded chat streams into structured, compressed, and reusable memory artifacts without losing critical reasoning continuity.

It ensures:
- bounded token usage per model
- continuity across long sessions
- auditability of reasoning history
- compatibility with local and hybrid LLMs

---

### 1.1 "It Does" (Scope)

* **Token Budget Enforcement:** Continuously tracks token consumption against model-specific context windows
* **Deterministic Compaction:** Triggers summarization at predictable thresholds
* **Segmented Context Preservation:** Maintains head, digest, and tail structure
* **Recursive Summarization:** Supports multi-level compression for very long sessions
* **Cross-Session Continuity:** Enables session rollover using persisted digests
* **Audit Persistence:** Stores all compaction artifacts in SQLite
* **RAG Integration:** Makes digests retrievable via vector search
* **Prompt Assembly:** Produces optimized "Prompt Packs" for model execution

---

### 1.2 "It Does Not" (Boundaries)

* Execute LLM inference
* Modify domain/business data
* Control access permissions
* Replace long-term knowledge storage (Vault remains source of truth)

---

## 2. Context Architecture

### 2.1 Multi-Tier Memory Model

| Tier | Description | Storage | Lifespan |
|------|------------|--------|----------|
| Raw Buffer | Full conversation history | In-memory + SQLite | Session |
| Active Context | Token-bounded prompt window | In-memory | Per request |
| History Digest | Summarized middle segments | SQLite | Persistent |
| RAG Memory | Indexed embeddings of digests | SQLite-VSS | Persistent |

---

### 2.2 Context Composition

```text
[HEAD] → [DIGEST] → [TAIL]
````

* **HEAD:** System instructions, persona, constraints
* **DIGEST:** Compressed historical reasoning
* **TAIL:** Recent conversational turns

---

## 3. Token Management Model

### 3.1 Token Accounting

* Primary encoder: `js-tiktoken (o200k_base)`
* Fallback: character-based estimation
* Per-message token attribution required

---

### 3.2 Trigger Condition

\text{totalTokens} \ge \lfloor \text{contextWindow} \times \text{highWaterMarkRatio} \rfloor

* Default `highWaterMarkRatio`: 0.8
* Trigger must be deterministic and reproducible

---

### 3.3 Budget Allocation

| Segment | Allocation     |
| ------- | -------------- |
| Head    | Fixed          |
| Tail    | Sliding window |
| Digest  | Dynamic        |

---

## 4. Compaction Lifecycle

### 4.1 Compaction Phases

1. **Detection**

   * Token threshold exceeded
2. **Segmentation**

   * Split into head / middle / tail
3. **Summarization**

   * Middle → digest via summarization agent
4. **Replacement**

   * Replace middle with digest
5. **Persistence**

   * Store digest and metadata in SQLite

---

### 4.2 Recursive Compaction

* If digest grows beyond limits:

  * re-summarize previous digests
* Enables:

  * infinite conversation scaling
  * bounded memory footprint

---

## 5. Digest Model

### 5.1 Digest Structure

Each digest must contain:

* `digest_id`
* `session_id`
* `summary_text`
* `key_decisions`
* `open_tasks`
* `risks`
* `source_message_range`
* `token_count`
* `created_at`

---

### 5.2 Digest Semantics

* Must preserve:

  * intent
  * decisions
  * dependencies
* Must remove:

  * redundancy
  * low-signal content

---

## 6. Persistence Layer (SQLite)

### 6.1 Storage Domains

| Domain           | Purpose             |
| ---------------- | ------------------- |
| context_sessions | Session metadata    |
| context_messages | Raw message log     |
| context_digests  | Compacted summaries |
| context_events   | Compaction events   |

---

### 6.2 Persistence Rules

* All compaction events must be recorded
* Raw messages must remain immutable
* Digests must reference original message ranges
* Must comply with **Rule 2 (App-Scoped Storage)**

---

## 7. Prompt Assembly Contract

### 7.1 Prompt Pack Structure

```text
SYSTEM (Head)
+ DIGEST (Compressed Memory)
+ RECENT (Tail)
+ USER INPUT
```

---

### 7.2 Constraints

* Must not exceed model context window
* Must preserve logical continuity
* Must maintain deterministic ordering

---

## 8. Session Lifecycle

### 8.1 Session States

```text
ACTIVE → COMPACTED → ROLLED_OVER → ARCHIVED
```

---

### 8.2 Carryover Protocol

* New session seeded with:

  * latest digest
  * system instructions
* Old session:

  * marked archived
  * remains queryable via RAG

---

## 9. Integration Points

### 9.1 With RAG System

* Digests are:

  * embedded into vector store
  * retrievable for semantic recall

---

### 9.2 With Queue System

* Summarization runs as:

  * Model Lane task
* Must:

  * respect concurrency limits
  * not block user interaction

---

### 9.3 With Token Manager

* Provides:

  * token counts
  * model limits
* Enforces:

  * hard cutoffs

---

## 10. Failure Modes & Recovery

| Scenario                    | Behavior                           |
| --------------------------- | ---------------------------------- |
| Token miscalculation        | Fallback estimation                |
| Summarization failure       | Retry via queue                    |
| Digest corruption           | Rebuild from raw messages          |
| SQLite failure              | Block compaction, continue session |
| Overflow without compaction | Hard truncate (last resort)        |

---

## 11. Observability & Telemetry

System must expose:

* token usage per session
* compaction frequency
* digest sizes
* summarization latency
* context overflow incidents

---

### UI Integration

* Compaction indicators
* Digest review panel
* Source trace mapping
* Session rollover preview

---

## 12. Known Architectural Gaps (Roadmap)

| Area                     | Gap                                          | Impact |
| ------------------------ | -------------------------------------------- | ------ |
| Multi-Model Tokenization | No per-model tokenizer abstraction           | High   |
| Semantic Compression     | No importance-aware summarization            | High   |
| Context Graph            | No graph linking across sessions             | Medium |
| Real-Time Streaming      | No incremental compaction during streaming   | Medium |
| Memory Tiering           | No separation between short/long-term memory | Medium |

---


