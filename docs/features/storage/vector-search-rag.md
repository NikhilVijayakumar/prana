

# 🧠 Vector Search & RAG — Enhanced

```md id="5n8r2k"
# Feature: Vector Search & RAG (Retrieval-Augmented Generation)

**Version:** 1.1.0  
**Status:** In-Development / Core  
**Engine:** SQLite-VSS / SQLCipher  
**Service:** `vectorSearchService.ts` · `ragOrchestratorService.ts`  
**Capability:** Provides a deterministic, local-first semantic retrieval pipeline integrated with the SQLite Cache and governed by Storage and Security Protocols.

---

## 1. Operational Purpose

The **Vector Search & RAG system** enables agents to perform **context-aware reasoning** over large datasets without exposing raw data externally.

It ensures:
- sensitive data remains local and encrypted
- retrieval is deterministic and reproducible
- LLM responses are grounded in verified context

---

## 2. RAG Lifecycle (Deterministic Pipeline)

```text
USER QUERY
   ↓
INTENT EXTRACTION
   ↓
EMBEDDING GENERATION
   ↓
VECTOR SEARCH (KNN)
   ↓
CONTEXT ASSEMBLY
   ↓
LLM AUGMENTED RESPONSE
````

---

## 3. Pipeline Contracts

### 3.1 Intent Extraction

* Normalizes user query
* Determines:

  * domain scope
  * retrieval requirements

---

### 3.2 Embedding Generation

* Converts input into vector space
* Must:

  * use consistent model per app
  * maintain dimensional integrity

---

### 3.3 Semantic Retrieval

* Executes KNN search on vector store
* Must be:

  * deterministic (same query → same results)
  * scoped by `app_id`

---

### 3.4 Context Assembly

* Performs:

  * ranking
  * pruning
  * token-budget fitting

---

### 3.5 Augmented Generation

* Injects context into LLM prompt
* LLM must:

  * rely only on provided context
  * not hallucinate external data (policy-controlled)

---

## 4. Data Architecture

### 4.1 Core Tables

* **embeddings**

  * vector (BLOB)
  * app_id
  * reference_id

* **chunks**

  * text content
  * metadata
  * app_id

* **semantic_cache**

  * query hash
  * result set

* **trace_logs**

  * query → chunks → response mapping

---

### 4.2 Data Rules

* All records must include `app_id`
* Embeddings must:

  * match model dimensionality
* Chunks must:

  * be immutable once embedded

---

## 5. Consistency & Governance

* Fully adheres to:

  * Rule 2 (SQLite ownership)
* Must not:

  * write directly to Vault
* Optional:

  * derived summaries may be persisted via sync pipeline

---

## 6. Concurrency Model

* Vector search:

  * read-heavy, concurrent-safe
* Embedding writes:

  * must be serialized per dataset
* Index updates:

  * must not block read queries

---

## 7. Performance Model

* Supports:

  * approximate nearest neighbor (ANN)
* Requires:

  * periodic index optimization
* Large datasets must:

  * use partitioning or sharding (future)

---

## 8. Security Model

* All data stored in SQLCipher-encrypted DB
* Embeddings treated as sensitive data
* No external vector DB allowed

---

## 9. Failure Modes & Recovery

| Scenario           | Behavior        | Recovery         |
| ------------------ | --------------- | ---------------- |
| Missing embeddings | Skip retrieval  | Trigger re-index |
| Model mismatch     | Reject query    | Re-embed dataset |
| Corrupt index      | Disable search  | Rebuild index    |
| Empty results      | Return fallback | Notify agent     |

---

### 9.1 Recovery Strategy

* Rebuild embeddings from chunk store
* Re-index vector tables periodically
* Maintain integrity checks for dimensions

---

## 10. Observability

* query latency
* retrieval accuracy signals
* cache hit rate
* embedding failures
* index health

---

## 11. Known Architectural Gaps (Roadmap)

| Area                | Gap                                | Impact |
| ------------------- | ---------------------------------- | ------ |
| Quantization        | No compression for large vectors   | High   |
| Reranking           | No cross-encoder layer             | High   |
| Context Packing     | Basic token fitting only           | Medium |
| Multi-Model Support | Single embedding model assumption  | Medium |
| Dataset Versioning  | No version tracking for embeddings | Medium |

---