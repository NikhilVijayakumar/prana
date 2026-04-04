# 🎨 Feature: Visual Identity Engine — Design & Asset Orchestration (Enhanced)

**Status:** Proposed / Integration
**Pattern:** Token-Driven Rendering Pipeline · Deterministic Asset Generation
**Services:** `visualIdentityService.ts` · `templateService.ts` · `googleBridgeService.ts`
**Registry:** `Astra UI Library` (Tokens & Components)
**Capability:** Transforms design tokens and structured data into high-fidelity, multi-format branded assets (Docs, Slides, PDFs, Posters) through a deterministic HTML-based rendering pipeline.

---

## 1. Tactical Purpose

The Visual Identity Engine is the **design-to-output orchestration layer** of the Prana runtime.

It ensures that:

* All generated assets are **visually consistent with system identity**
* Design tokens are **enforced across all output formats**
* Documents are **deterministic, reproducible, and auditable**
* Designers and developers share a **common rendering contract**

It operates as:

* A **token synchronization engine**
* A **template composition system**
* A **format transformation pipeline**
* A **brand-consistency enforcement layer**

---

## 2. System Invariants (Critical)

1. **Token Authority**

   * All visual properties MUST originate from Astra tokens
   * No hardcoded styles allowed in templates

2. **Deterministic Rendering**

   * Same input (tokens + data + template) MUST produce identical output

3. **One-Way Generation**

   * Output assets are immutable snapshots
   * No reverse sync from external systems (Docs, Slides)

4. **Template Integrity**

   * Templates MUST be versioned and validated before use

5. **Format Consistency**

   * Cross-format outputs MUST preserve semantic structure

---

## 3. Architectural Components

| Component               | Role                  | Responsibility                    |
| :---------------------- | :-------------------- | :-------------------------------- |
| `visualIdentityService` | Token Engine          | Loads and normalizes Astra tokens |
| `templateService`       | Composition Engine    | Applies data to templates         |
| `googleBridgeService`   | Transformation Bridge | Converts HTML → Google formats    |
| `puppeteerRenderer`     | Render Engine         | HTML → PDF/Image output           |
| `Vault`                 | Asset Archive         | Stores generated outputs          |

---

## 4. Token System Contract

### 4.1 Token Categories

```json
{
  "color": {},
  "typography": {},
  "spacing": {},
  "layout": {}
}
```

---

### 4.2 Token Resolution Rules

* Tokens MUST:

  * be resolved before template rendering
  * not be overridden at runtime

* Fallback:

  * MUST use Astra defaults
  * MUST log missing tokens

---

### 4.3 Token Versioning (New)

```ts
{
  version: string,
  source: 'astra',
  checksum: string
}
```

**Constraint:**

* Every generated asset MUST record token version

---

## 5. Template System (Formalized)

### 5.1 Template Structure

```html
<div class="report">
  <h1>{{title}}</h1>
  <p>{{summary}}</p>
</div>
```

---

### 5.2 Template Types

| Type         | Purpose           |
| :----------- | :---------------- |
| Document     | Reports, research |
| Presentation | Slides            |
| Poster       | Visual layouts    |
| Table        | Sheets/Audit      |

---

### 5.3 Template Registry (New — Critical)

```ts
{
  template_id: string,
  version: string,
  type: string,
  supported_formats: string[],
  checksum: string
}
```

---

### 5.4 Validation Rules

* Templates MUST:

  * pass syntax validation
  * declare required variables
  * be format-compatible

---

## 6. Data Injection Contract

### 6.1 Variable Binding

```ts
{
  data: Record<string, any>,
  schema?: Record<string, string>
}
```

---

### 6.2 Constraints

* Missing variables MUST:

  * fail rendering OR use explicit fallback

* Unsafe values MUST:

  * be sanitized before injection

---

## 7. Rendering Pipeline (Deterministic)

```text
TOKENS → TEMPLATE → DATA INJECTION → HTML OUTPUT → FORMAT TRANSFORM → FINAL ASSET
```

---

### 7.1 Stage Breakdown

#### 1. Extract

* Load Astra tokens

#### 2. Compose

* Bind tokens + data into template

#### 3. Validate

* Check HTML + variables

#### 4. Render

* Produce final HTML

#### 5. Transform

* Convert to target format

#### 6. Persist

* Store in Vault / Google

---

## 8. Format Transformation Layer

### 8.1 Google Docs / Slides

* Map:

  * `<h1>` → HEADING_1
  * `<p>` → PARAGRAPH
  * `<ul>` → BULLET_LIST

---

### 8.2 PDF / Poster

* Use:

  * Puppeteer
* Constraints:

  * fixed viewport
  * high DPI rendering

---

### 8.3 Sheets

* Map:

  * tables → rows/columns
  * styles → cell formatting

---

## 9. Asset Metadata (New)

Every generated asset MUST include:

```ts
{
  asset_id: string,
  template_id: string,
  template_version: string,
  token_version: string,
  generated_at: timestamp,
  source_data_hash: string
}
```

---

## 10. Storage Governance

### 10.1 Vault Storage

* Location:

```
/vault/assets/<type>/<asset_id>
```

---

### 10.2 SQLite Mirror

* Tracks:

  * asset metadata
  * generation status

---

### 10.3 Mirror Constraint

* Every Vault asset MUST:

  * have corresponding SQLite metadata entry

---

## 11. Integration Points

### 11.1 With Google Bridge

* Handles:

  * upload
  * document creation

---

### 11.2 With Email Pipeline

* Uses:

  * templates for draft generation

---

### 11.3 With Notification Centre

* Emits:

  * asset generation success/failure

---

### 11.4 With Viewer Engine

* Enables:

  * preview before distribution

---

## 12. Failure Modes & Handling

| Scenario           | Behavior            |
| :----------------- | :------------------ |
| Missing token      | Fail or fallback    |
| Template error     | Block rendering     |
| Variable mismatch  | Validation failure  |
| Google API failure | Retry or queue      |
| Puppeteer crash    | Retry with fallback |

---

## 13. Observability

System MUST track:

* template usage frequency
* render time per format
* failure rates per stage
* token mismatch incidents
* asset generation volume

---

## 14. Deterministic Guarantees

* Same tokens + template + data → identical output
* No runtime styling overrides
* Assets are immutable snapshots
* All outputs are traceable via metadata
* Rendering is format-consistent

---

## 15. Known Architectural Gaps (Expanded)

| Area                  | Gap                              | Impact   |
| :-------------------- | :------------------------------- | :------- |
| HTML → Google Mapping | Complex layouts unsupported      | High     |
| Template Registry     | Not implemented                  | Critical |
| Variable Injection    | No strict schema enforcement     | High     |
| Live Preview          | No real-time preview pipeline    | Medium   |
| Versioning UI         | No interface to manage templates | Medium   |
| Multi-Locale Support  | No i18n system                   | Low      |

---

## 16. Cross-Module Contracts

* **Astra UI**

  * MUST provide token consistency

* **Template Service**

  * MUST validate templates before render

* **Google Bridge**

  * MUST ensure format mapping integrity

* **Vault**

  * MUST store immutable assets

---

## 17. Deterministic Boundaries

### Token Boundary

```text
ASTRA TOKENS → RESOLVED TOKENS
```

---

### Template Boundary

```text
TEMPLATE + DATA → HTML OUTPUT
```

---

### Transformation Boundary

```text
HTML → TARGET FORMAT
```

---

### Storage Boundary

```text
FINAL ASSET → VAULT + METADATA (SQLITE)
```

---

## 18. System Role (Final Positioning)

This module is:

* The **design execution engine** of Prana
* The **bridge between UI and external artifacts**
* The **standardization layer for all generated documents**

---

## 19. Strategic Role in Architecture

It connects:

* **AI / Agents** → content generation
* **Google Bridge** → external collaboration
* **Vault** → permanent storage
* **Viewer** → inspection before distribution

---

### Critical Observation

This module upgrades your system from:

> “AI that generates text”

to:

> “AI that produces **production-ready, branded deliverables**”

---


