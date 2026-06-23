# 👁️ Feature: Markdown Viewer Engine

**Version:** 2.0.0
**Status:** Stable
**Service:** `markdownViewerEngine`
**Capability:** Provides a secure, read-only pipeline for loading, validating, sanitizing, and rendering Markdown documents from runtime and vault sources.

---

## 1. Tactical Purpose

The Markdown Viewer Engine is the rendering pipeline for Markdown content within the Prana runtime.

It operates as:

* A **source resolution layer** — locates documents from runtime store or vault
* A **validation layer** — enforces format, encoding, and size constraints before processing
* A **sanitization pipeline** — strips unsafe content before any rendering occurs
* A **deterministic rendering engine** — produces consistent HTML output from validated Markdown input

---

## 2. System Invariants (Critical)

1. **Read-Only Enforcement**

   * Engine MUST NOT mutate any document state
   * All operations MUST be non-destructive

2. **Sanitization Guarantee**

   * All content MUST pass through the full sanitization pipeline before rendering
   * No script execution or unsafe HTML permitted

3. **Source Integrity**

   * Engine MUST render content exactly as stored
   * No transformation that alters semantic meaning

4. **Deterministic Rendering**

   * Same input MUST always produce identical output
   * Rendering MUST NOT depend on external state

5. **Secure Isolation**

   * Renderer MUST treat all content as untrusted
   * No content reaches the render stage without passing sanitization

---

## 3. Architectural Dependencies

| Component        | Role                      | Relationship                                |
| :--------------- | :------------------------ | :------------------------------------------ |
| **Main Process** | `runtimeDocumentStore`    | Source for active (hot) documents           |
| **Main Process** | `vaultService`            | Source for archived (cold) documents        |
| **Engine**       | ViewModel layer           | Orchestrates loading, parsing, sanitization |
| **Engine**       | Sanitization pipeline     | Enforces safe markdown rendering            |

---

## 4. Document State Model

### 4.1 Loading Lifecycle

```text
IDLE → LOADING → VALIDATING → PARSING → SANITIZING → RENDERED
```

---

### 4.2 Failure States

```text
LOAD_FAILED
VALIDATION_FAILED
SANITIZATION_FAILED
UNSUPPORTED_FORMAT
```

---

### 4.3 State Rules

* Each stage MUST:

  * complete before next begins
  * emit structured state

* Failures MUST:

  * halt the pipeline
  * emit an ERROR state with a structured failure reason

---

## 5. Data Flow Pipeline

### 5.1 Source Resolution

**Precondition:** the engine requires both `source` and `path` to initiate resolution. A request with `source` but no `path` MUST fail immediately with `LOAD_FAILED`. A `path` alone (without `source`) is valid only when resolving from `runtimeDocumentStore` — the engine will not fall back to `vaultService` without an explicit `source: 'vault'` declaration.

* Input:

  * document path OR runtime document ID

* Resolution order:

  1. `runtimeDocumentStore` (hot cache)
  2. `vaultService` (cold archive)

* If both sources fail to resolve the document, the engine MUST emit `LOAD_FAILED` with the failure reason from each source.

---

### 5.2 Content Loading

* Fetch raw buffer
* Validate:

  * file type is `text/markdown` or `.md` extension
  * encoding is UTF-8 — non-UTF-8 content MUST fail with `VALIDATION_FAILED`
  * content size does not exceed the configured maximum (default: 10MB)

**Size limit:** the 10MB limit is exclusive — content of exactly 10MB is rejected. Content that was within size limits at load time is not re-validated if the source is updated externally during the loading phase.

---

### 5.3 Validation

* Confirm content is parseable Markdown
* Reject binary content, null bytes, or malformed encoding
* Failure transitions to `VALIDATION_FAILED`

---

### 5.4 Parsing

* Parse Markdown deterministically using GFM (GitHub Flavored Markdown)
* Normalize heading and list structure
* Preserve semantic meaning
* Raw HTML blocks in Markdown source MUST be flagged for sanitization in §5.5 — they are not passed through directly

---

### 5.5 Sanitization

* Strip all content not on the allowlist before rendering

**Tag allowlist:**

```text
p, h1, h2, h3, h4, h5, h6
ul, ol, li, blockquote
code, pre
a, strong, em, del
table, thead, tbody, tr, td, th
img
```

**Attribute allowlist:**

```text
href — http:// and https:// only. javascript:, data:, and all other protocols MUST be stripped.
src  — https:// only. data: URIs MUST be stripped.
alt, title
```

**Additional rules:**

```text
All event handler attributes (onclick, onerror, onload, etc.) MUST be stripped
All <style> tags and style= attributes MUST be stripped
All data-* attributes MUST be stripped
Inline script URLs in any attribute MUST be stripped
```

Sanitization failure MUST transition to `SANITIZATION_FAILED`. The engine MUST NOT partially render unsanitized content.

---

### 5.6 Rendering

* Sanitized AST → HTML
* GFM-compliant rendering

**Enabled GFM extensions:**

```text
Tables
Task lists (checkboxes rendered as static — not interactive)
Strikethrough
Autolinks
Fenced code blocks with syntax class passthrough
```

**Disabled:**

```text
Raw HTML passthrough — all raw HTML has already been stripped at §5.5
```

Rendering MUST be synchronous and produce a complete HTML string before the engine emits `RENDERED` state.

---

## 6. Supported Formats

| Format   | Handling                      |
| :------- | :---------------------------- |
| Markdown | Parsed → sanitized → rendered |

---

## 7. Data Contracts

### 7.1 Engine Input

```ts
{
  source: 'runtime' | 'vault',
  path: string,
  format: 'markdown',
  ownerType?: string
}
```

---

### 7.2 Engine State

```ts
{
  status: 'IDLE' | 'LOADING' | 'VALIDATING' | 'PARSING' | 'SANITIZING' | 'RENDERED' | 'ERROR',
  content?: string,
  error?: string
}
```

`content` is populated only when `status` is `'RENDERED'`. It contains the sanitized HTML string.

`error` is populated only when `status` is `'ERROR'`. It contains a structured failure reason.

---

## 8. Context-Aware Rendering (Owner Binding)

### 8.1 Owner Types

```text
VAULT_DOCUMENT
SYSTEM_LOG
AUDIT_REPORT
GOOGLE_DOC
```

`ownerType` informs the engine's trust level for the source content. It does not alter sanitization rules — all content passes the full sanitization pipeline regardless of owner type.

The doc-owner binding contract (`ownerType` → trust level mapping) is currently advisory only. The `ownerType` field is validated against known types, and unknown types are treated as lowest trust, but no per-document permission filtering is enforced. Access control enforcement is a known functional gap (see §14).

---

### 8.2 Constraints

* `ownerType` MUST be validated against known types before use
* Unknown `ownerType` values MUST be treated as the lowest trust level

---

## 9. Security Model

### 9.1 Sanitization Pipeline

The engine MUST enforce the following before any render output is produced:

```text
Strip all <script> tags and inline script content
Block javascript: and data: protocols in href and src attributes
Strip all CSS — <style> tags and style= attributes
Strip all event handler attributes (on*)
Enforce href/src protocol allowlist (http:, https: only)
Strip data-* attributes
Strip raw HTML blocks not on the tag allowlist
```

Sanitization failure at any rule MUST block rendering entirely.

---

### 9.2 Sandbox Isolation

* Rendering MUST use an isolated rendering container
* Rendered HTML MUST NOT be injected into the DOM without sandboxing
* The rendered output boundary MUST prevent DOM escape

---

### 9.3 Content Trust Levels

| Source            | Trust Level |
| :---------------- | :---------- |
| Runtime Store     | Medium      |
| Vault             | High        |
| External (Google) | Low         |

Trust level affects validation strictness and observability tagging. It does not bypass the sanitization pipeline.

---

## 10. Integration Points

### 10.1 With Vault System

* Renders committed documents from vault storage
* MUST preserve exact content integrity

---

### 10.2 With Storage Governance

* Renders audit logs
* MUST support long-form document rendering

---

### 10.3 With Google Ecosystem Integration

* Renders Google Docs content projected into Markdown form
* MUST treat all externally sourced content as low-trust

---

## 11. Failure Modes & Handling

| Scenario             | Behavior                              |
| :------------------- | :------------------------------------ |
| File not found       | Emit LOAD_FAILED                      |
| Unsupported format   | Emit VALIDATION_FAILED                |
| Corrupted content    | Block rendering, emit VALIDATION_FAILED |
| Sanitization failure | Emit SANITIZATION_FAILED, fail closed |
| Parse failure        | Block rendering, emit VALIDATION_FAILED |

---

## 12. Observability

Engine MUST track:

```text
Document load latency (ms)
Render latency (ms)
Sanitizer rejection count (per session)
Parser failure rate
Load failure rate by source (runtime vs vault)
```

---

## 13. Deterministic Guarantees

* Rendering is strictly read-only
* Content is always sanitized before rendering
* No mutation occurs within the engine
* Output is consistent for identical input
* Engine does not depend on external systems at render time

---

## 14. Known Architectural Gaps

| Area                | Gap                                         | Impact |
| :------------------ | :------------------------------------------ | :----- |
| Doc-Owner Coupling  | No standardized owner binding contract      | High   |
| Large File Handling | No pagination or virtualization for large documents | High   |
| Export              | No native export support                    | Medium |
| Access Control      | No per-document permission filtering        | Medium |

---

## 15. Cross-Module Contracts

* **RuntimeDocumentStore**

  * MUST provide consistent document access API

* **Vault Service**

  * MUST return decrypted, validated content

* **Google Bridge**

  * MUST provide Markdown projection with source provenance metadata

---

## 16. Deterministic Boundaries

* **Rendering Boundary:**

  ```
  SANITIZED_CONTENT → RENDERED_OUTPUT
  ```

  No unsanitized content crosses this boundary.

* **Mutation Boundary:**

  * Engine MUST NEVER modify source documents

* **Context Boundary:**

  * Engine MAY surface context metadata but MUST NOT execute actions

---

## 17. Completion Status

The Markdown Viewer Engine is the secure document rendering pipeline for Markdown content in the Prana runtime.

It provides:

```text
Source Resolution
Content Loading and Validation
Sanitization
Deterministic Rendering
Engine State Management
```

while explicitly excluding:

```text
Presentation and Styling
UI Action Handling
Document Mutation
External System Dependencies at Render Time
```
