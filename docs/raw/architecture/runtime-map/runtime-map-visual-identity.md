# Runtime Map: Visual Identity Engine

> Service Runtime Contract - Design & Asset Orchestration

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/visual/visual-identity-engine.md` |
| Implementation | `src/main/services/visualIdentityService.ts`, `templateService.ts` |
| Layer | Design/Output |
| Status | ✅ Compliant |

---

## 1. Responsibility

Single runtime responsibility:
- **Token Synchronization Engine:** Sync design tokens to runtime
- **Template Composition System:** Compose templates with tokens
- **Format Transformation Pipeline:** Transform to Docs, Slides, PDFs, Posters
- **Brand-Consistency Enforcement:** Enforce visual consistency

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables (rendering operations)
- [x] Explicit persistence through contracts (templateService - better-sqlite3)
- [x] Immutable configuration

### Forbidden
- [x] No mutable class-level state
- [x] No hardcoded styles (must use tokens)

---

## 3. Persistence Rules

### Storage Interface
- **Templates:** `templateService` - better-sqlite3

---

## 4. Determinism Requirements

**MUST remain deterministic:**
- Same input (tokens + data + template) → identical output
- Token authority enforced

---

## 5. Replayability Requirements

- [x] **Yes** - fully deterministic
- Template + token + data = reproducible output

---

## 6. System Invariants (From Feature)

1. **Token Authority** - All visual properties from Astra tokens, no hardcoded styles
2. **Deterministic Rendering** - Same input produces identical output

---

## 7. Supported Outputs

| Format | Description |
|--------|-------------|
| Docs | HTML documents |
| Slides | Presentation decks |
| PDFs | PDF generation |
| Posters | Visual assets |

---

## 8. Host Assumptions

- [x] Electron (primary host)
- [ ] Node
- [ ] Browser

---

## 9. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ✅ Allowed | Accepts state from stores |
| Determinism | ✅ Requirements | Reproducible rendering |
| Replayability | ✅ Yes | Deterministic output |

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Phase: Design Layer*