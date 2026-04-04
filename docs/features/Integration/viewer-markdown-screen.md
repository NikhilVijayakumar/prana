# 👁️ Feature: Document Preview & Inspection Engine (Enhanced)

**Status:** Stable
**Pattern:** MVVM (Container → ViewModel → View)
**UI Stack:** `ui/viewers/` (Markdown & PDF)
**Capability:** Provides a secure, read-only environment for inspecting structured runtime documents, knowledge artifacts, and system logs.

---

## 1. Tactical Purpose

The Inspection Engine is the **final human verification interface** within the Prana runtime. It ensures that all system-generated or externally ingested content can be **safely reviewed, validated, and audited** before any irreversible action (e.g., Vault commit, external handoff).

It operates as:

* A **secure rendering boundary** (untrusted → sanitized output)
* A **format abstraction layer** (Markdown, PDF, JSON → unified view)
* A **context-aware inspection surface** (linked to system workflows)
* An **audit interface** for operator decision-making

---

## 2. System Invariants (Critical)

1. **Read-Only Enforcement**

   * Viewer MUST NOT mutate any document state
   * All interactions MUST be non-destructive

2. **Sanitization Guarantee**

   * All rendered content MUST pass through a sanitization pipeline
   * No script execution or unsafe HTML allowed

3. **Source Integrity**

   * Viewer MUST display content exactly as stored
   * No transformation that alters semantic meaning

4. **Deterministic Rendering**

   * Same input MUST always produce identical output
   * Rendering must not depend on external state

5. **Secure Isolation**

   * Renderer MUST treat all content as untrusted
   * No direct DOM injection without sanitization

---

## 3. Architectural Dependencies

| Component        | Role                      | Relationship                                |
| :--------------- | :------------------------ | :------------------------------------------ |
| **Main Process** | `runtimeDocumentStore`    | Source for active (hot) documents           |
| **Main Process** | `vaultService`            | Source for archived (cold) documents        |
| **Renderer**     | `ViewerMarkdownViewModel` | Orchestrates loading, parsing, sanitization |
| **Renderer**     | `ViewerPdfViewModel`      | Handles PDF rendering lifecycle             |
| **Feature**      | `VisualIdentityEngine`    | Provides consistent UI styling tokens       |

---

## 4. Document State Model

### 4.1 Loading Lifecycle

```text id="q1x7mz"
IDLE → LOADING → SANITIZING → RENDER_READY → DISPLAYED
```

---

### 4.2 Failure States

```text id="b4k9fp"
LOAD_FAILED
SANITIZATION_FAILED
UNSUPPORTED_FORMAT
```

---

### 4.3 State Rules

* Each stage MUST:

  * complete before next begins
  * emit structured state

* Failures MUST:

  * halt rendering
  * display safe fallback UI

---

## 5. Data Flow Pipeline

### 5.1 Source Resolution

* Input:

  * document path OR runtime ID

* Resolution order:

  1. `runtimeDocumentStore` (hot cache)
  2. `vaultService` (cold archive)

---

### 5.2 Content Loading

* Fetch raw buffer
* Validate:

  * file type
  * encoding

---

### 5.3 Sanitization

* Markdown:

  * strip unsafe HTML
  * normalize links
* HTML (if any):

  * strict whitelist-based sanitization

---

### 5.4 Rendering

* Markdown → HTML (GFM-compliant)
* PDF → canvas/embedded renderer

---

### 5.5 Presentation

* Apply:

  * typography
  * spacing
  * theming (via `VisualIdentityEngine`)

---

## 6. Supported Formats

| Format          | Handling                          |
| :-------------- | :-------------------------------- |
| Markdown        | Parsed → sanitized → rendered     |
| PDF             | Rendered via `pdf.js` or native   |
| JSON (implicit) | Pretty-printed (future extension) |

---

## 7. Data Contracts

### 7.1 Viewer Input

```ts id="r3k8vz"
{
  source: 'runtime' | 'vault',
  path: string,
  format: 'markdown' | 'pdf' | 'json',
  ownerType?: string
}
```

---

### 7.2 Viewer State

```ts id="m8v2lp"
{
  status: 'IDLE' | 'LOADING' | 'READY' | 'ERROR',
  content?: string,
  error?: string
}
```

---

## 8. Context-Aware Rendering (Owner Binding)

### 8.1 Owner Types (Extended Contract)

```text id="s6j3qw"
EMAIL_DRAFT
VAULT_DOCUMENT
SYSTEM_LOG
AUDIT_REPORT
```

---

### 8.2 Contextual Action Bar

* Based on `ownerType`, viewer MAY render:

| Owner Type     | Actions                |
| :------------- | :--------------------- |
| EMAIL_DRAFT    | Open in Gmail, Approve |
| VAULT_DOCUMENT | View Metadata          |
| SYSTEM_LOG     | Export                 |
| AUDIT_REPORT   | Archive                |

---

### 8.3 Constraints

* Actions MUST:

  * be non-mutating OR explicitly routed to owning module
  * not bypass feature-level ViewModels

---

## 9. Security Model

### 9.1 Sanitization Pipeline

* MUST:

  * remove scripts
  * block inline JS
  * sanitize links

---

### 9.2 Sandbox Isolation

* Rendering SHOULD:

  * use isolated container or iframe (if required)
  * prevent DOM escape

---

### 9.3 Content Trust Levels

| Source                  | Trust Level |
| :---------------------- | :---------- |
| Runtime Store           | Medium      |
| Vault                   | High        |
| External (Email/Google) | Low         |

---

## 10. Integration Points

### 10.1 With Email Intelligence

* Displays:

  * draft proposals
* Enables:

  * human review before send

---

### 10.2 With Vault System

* Displays:

  * committed knowledge artifacts
* Must:

  * preserve exact content integrity

---

### 10.3 With Vaidyar

* Displays:

  * diagnostic reports
* Must:

  * handle large logs efficiently

---

### 10.4 With Storage Governance

* Displays:

  * audit logs
* Must:

  * support long-form inspection

---

## 11. Failure Modes & Handling

| Scenario             | Behavior          |
| :------------------- | :---------------- |
| File not found       | Show error state  |
| Unsupported format   | Show fallback UI  |
| Corrupted content    | Block rendering   |
| Sanitization failure | Fail closed       |
| PDF load error       | Retry or fallback |

---

## 12. Observability

System SHOULD track:

* document load time
* render latency
* failure rates by format
* large document performance
* user interaction (scroll depth, time spent)

---

## 13. Deterministic Guarantees

* Rendering is strictly read-only
* Content is always sanitized before display
* No mutation occurs within viewer layer
* Output is consistent for identical input
* Viewer does not depend on external systems

---

## 14. Known Architectural Gaps (Expanded Roadmap)

| Area                | Gap                                         | Impact |
| :------------------ | :------------------------------------------ | :----- |
| Doc-Owner Coupling  | No standardized owner binding contract      | High   |
| Export/Print        | No native export or print support           | Medium |
| Search/Highlight    | No in-document search capability            | Medium |
| Large File Handling | No pagination/virtualization for large docs | High   |
| JSON Viewer         | No structured JSON rendering mode           | Medium |
| Access Control      | No per-document permission filtering        | Medium |

---

## 15. Cross-Module Contracts (Explicit)

* **RuntimeDocumentStore**

  * MUST provide consistent document access API

* **Vault Service**

  * MUST return decrypted, validated content

* **Email Module**

  * MUST provide owner context for drafts

* **Vaidyar**

  * SHOULD provide structured logs compatible with viewer

---

## 16. Deterministic Boundaries

* **Rendering Boundary:**

  ```
  SANITIZED_CONTENT → DISPLAYED_OUTPUT
  ```

  No unsafe content crosses this boundary

* **Mutation Boundary:**

  * Viewer MUST NEVER modify source

* **Context Boundary:**

  * Viewer MAY trigger actions but MUST NOT execute them directly

---

This module is now fully aligned with:

* Zero-trust rendering
* Human-in-the-loop enforcement
* Vault auditability
* Cross-module inspection consistency

---

### Strategic Observation

This engine becomes **critical glue** between:

* Email (review before send)
* Vault (audit before commit)
* Google Bridge (inspect ingested docs)
* Vaidyar (inspect system health)

---


