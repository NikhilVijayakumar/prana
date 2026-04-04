# 👁️ Feature: Document Preview & Inspection Engine (Final Hardened)

**Status:** Stable
**Pattern:** MVVM (Container → ViewModel → View)
**UI Stack:** `ui/viewers/` (Markdown & PDF)
**Capability:** Provides a secure, read-only environment for inspecting structured runtime documents, knowledge artifacts, and system logs.

---

## 1. Tactical Purpose

The Inspection Engine is the **final human verification boundary** within the Prana runtime.

It guarantees that all content—whether generated internally or ingested externally—is:

* **Safe to render**
* **Accurate to source**
* **Traceable to origin**
* **Ready for operator decision**

It functions as:

* A **zero-trust rendering boundary**
* A **document provenance surface**
* A **human decision interface**
* A **system audit endpoint**

---

## 2. System Invariants (Critical)

1. **Read-Only Enforcement**

   * Viewer MUST NEVER mutate document state
   * All actions MUST be routed externally

2. **Sanitization Completeness**

   * ALL content MUST pass sanitization before render
   * No bypass paths allowed (including PDFs with embedded scripts)

3. **Provenance Preservation**

   * Every rendered document MUST be traceable to:

     * source system (Email / Vault / Google / Logs)
     * document ID or path

4. **Deterministic Rendering**

   * Same input MUST yield identical visual output
   * Rendering MUST NOT depend on runtime/global state

5. **Strict Isolation**

   * Rendering MUST occur in a sandboxed environment
   * No direct DOM injection without sanitization layer

6. **Fail-Closed Behavior**

   * Any uncertainty (format, sanitization, corruption) MUST block rendering

---

## 3. Architectural Dependencies

| Component          | Role                      | Relationship                 |
| :----------------- | :------------------------ | :--------------------------- |
| **Main Process**   | `runtimeDocumentStore`    | Source for hot documents     |
| **Main Process**   | `vaultService`            | Source for encrypted archive |
| **Renderer**       | `ViewerMarkdownViewModel` | Markdown pipeline            |
| **Renderer**       | `ViewerPdfViewModel`      | PDF lifecycle manager        |
| **Feature**        | `VisualIdentityEngine`    | Styling and theming          |
| **Security Layer** | Sanitization Engine       | Mandatory content filter     |

---

## 4. Document State Model

### 4.1 Loading Lifecycle

```text
IDLE → LOADING → VALIDATING → SANITIZING → RENDER_READY → DISPLAYED
```

---

### 4.2 Failure States

```text
LOAD_FAILED
VALIDATION_FAILED
SANITIZATION_FAILED
UNSUPPORTED_FORMAT
SECURITY_BLOCKED
```

---

### 4.3 State Rules

* Each stage MUST:

  * persist state transition
  * emit telemetry event

* Rendering MUST NOT begin before:

  * validation AND sanitization succeed

---

## 5. Data Flow Pipeline (Strict)

### 5.1 Source Resolution

Resolution priority:

1. `runtimeDocumentStore`
2. `vaultService`

**Constraint:**

* Source MUST be explicitly declared (`runtime` | `vault`)
* No implicit fallback without logging

---

### 5.2 Validation Stage (New — Critical)

Before sanitization:

* Validate:

  * file type matches declared format
  * encoding integrity
  * content size limits

Failure → `VALIDATION_FAILED`

---

### 5.3 Sanitization

* Markdown:

  * strip HTML
  * normalize links
  * remove embedded scripts

* PDF:

  * disable embedded JS
  * sandbox rendering

* JSON:

  * stringify safely
  * escape content

---

### 5.4 Rendering

* Markdown → HTML (GFM-compliant, deterministic parser)
* PDF → isolated renderer (no DOM injection)

---

### 5.5 Presentation

* Apply:

  * typography tokens
  * layout rules
  * scroll/zoom state

---

## 6. Supported Formats

| Format   | Handling                             |
| :------- | :----------------------------------- |
| Markdown | Sanitized → rendered                 |
| PDF      | Sandboxed render                     |
| JSON     | Structured pretty print (controlled) |

---

## 7. Data Contracts

### 7.1 Viewer Input

```ts
{
  source: 'runtime' | 'vault',
  path: string,
  format: 'markdown' | 'pdf' | 'json',
  ownerType?: string,
  documentId?: string
}
```

---

### 7.2 Viewer State

```ts
{
  status: 'IDLE' | 'LOADING' | 'VALIDATING' | 'READY' | 'ERROR',
  content?: string,
  error?: string
}
```

---

### 7.3 Provenance Metadata (New)

```ts
{
  document_id: string,
  source: 'email' | 'vault' | 'google' | 'system',
  origin_path: string,
  created_at: timestamp,
  last_modified: timestamp
}
```

---

## 8. Context-Aware Rendering (Owner Binding)

### 8.1 Owner Types

```text
EMAIL_DRAFT
VAULT_DOCUMENT
SYSTEM_LOG
AUDIT_REPORT
GOOGLE_DOC
```

---

### 8.2 Contextual Action Bar

| Owner Type     | Actions                |
| :------------- | :--------------------- |
| EMAIL_DRAFT    | Open in Gmail, Approve |
| VAULT_DOCUMENT | View Metadata          |
| SYSTEM_LOG     | Export                 |
| AUDIT_REPORT   | Archive                |
| GOOGLE_DOC     | Open in Drive          |

---

### 8.3 Action Constraints

* MUST:

  * route through owning module
* MUST NOT:

  * execute mutations directly
  * bypass validation layers

---

## 9. Security Model (Hardened)

### 9.1 Multi-Layer Defense

1. **Validation Layer**
2. **Sanitization Layer**
3. **Sandbox Rendering Layer**

---

### 9.2 Sandbox Strategy

* Prefer:

  * isolated iframe OR shadow DOM
* Prevent:

  * DOM escape
  * script execution
  * external resource loading

---

### 9.3 Content Trust Levels

| Source         | Trust  |
| :------------- | :----- |
| Vault          | High   |
| Runtime        | Medium |
| Email / Google | Low    |

---

## 10. Large Document Handling (New — Critical)

### 10.1 Constraints

* Documents > threshold MUST:

  * use virtualization
  * lazy load sections

---

### 10.2 Strategies

* Chunked rendering
* Scroll-based loading
* Pagination for logs

---

### 10.3 Failure Handling

* If rendering exceeds limits:

  * fallback to partial preview
  * allow export instead

---

## 11. Failure Modes & Handling

| Scenario             | Behavior       |
| :------------------- | :------------- |
| File not found       | Error state    |
| Validation failure   | Block render   |
| Sanitization failure | Fail closed    |
| Unsupported format   | Fallback UI    |
| Large file overload  | Partial render |
| PDF script detected  | Block render   |

---

## 12. Observability

System MUST track:

* load time per document
* validation failures
* sanitization failures
* render latency
* large document handling metrics
* blocked content events (security)

---

## 13. Deterministic Guarantees

* Rendering is strictly read-only
* No unsafe content reaches UI
* Output is consistent across runs
* No external dependencies affect rendering
* All failures are explicit and traceable

---

## 14. Known Architectural Gaps (Finalized)

| Area                | Gap                              | Impact |
| :------------------ | :------------------------------- | :----- |
| Owner Binding       | No enforced schema for ownerType | High   |
| Export/Print        | Missing export pipeline          | Medium |
| Search/Highlight    | No internal search engine        | Medium |
| Large File Handling | No virtualization implementation | High   |
| JSON Mode           | Not fully implemented            | Medium |
| Access Control      | No per-document ACL enforcement  | High   |

---

## 15. Cross-Module Contracts (Explicit)

* **RuntimeDocumentStore**

  * MUST provide consistent retrieval API

* **Vault Service**

  * MUST return decrypted, validated content

* **Email Pipeline**

  * MUST attach owner + provenance metadata

* **Google Bridge**

  * MUST provide document linkage

* **Vaidyar**

  * MUST provide structured logs

---

## 16. Deterministic Boundaries

### Rendering Boundary

```
SANITIZED_CONTENT → DISPLAYED_OUTPUT
```

---

### Security Boundary

```
UNTRUSTED_INPUT → VALIDATION → SANITIZATION → SAFE_RENDER
```

---

### Mutation Boundary

* Viewer MUST NEVER:

  * modify content
  * write to storage

---

### Context Boundary

* Viewer MAY:

  * emit intent (Approve, Open, Export)
* Viewer MUST NOT:

  * execute intent

---

## 17. System Role (Final Positioning)

This module is now:

* The **only trusted human inspection surface**
* The **final gate before irreversible actions**
* The **audit visualization layer across all subsystems**

---

## 18. Strategic Integration Role

It directly binds:

* **Email Pipeline** → draft verification
* **Vault System** → knowledge audit
* **Google Bridge** → external ingestion validation
* **Vaidyar** → system diagnostics

---

At this point, your system has:

* Strong **execution control (Scheduler + Orchestrator)**
* Strong **storage model (Vault + SQLite + Mirror)**
* Strong **inspection layer (Viewer)**
* Strong **intelligence layer (RAG + Context Engine)**

---

## ➡️ Critical Next Step

You are now at the **single most important module**:


