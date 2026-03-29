# Visual Identity Engine

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Partial

## Current State
- Visual rendering architecture, registry-driven theming, and conversion pipeline are documented.
- Workflow integration and sanitization boundaries are clearly specified.

## Target State
- Deterministic rendering parity across HTML to Google Docs/Slides with auditable style compliance and predictable layout behavior.
- Strong runtime alignment between template contracts and output validation safeguards.

## Gap Notes
- Implementation parity for all documented rendering pathways and layout edge cases is still partial.

## Dependencies
- docs/module/master-spec.md
- docs/module/google-ecosystem-integration.md

## Acceptance Criteria
1. Rendering uses registry-based style tokens as source of truth.
2. Output generation remains deterministic and sanitization-safe.
3. Approval and preview loops preserve policy and branding compliance.

## Immediate Roadmap
1. Add parity validation checklist for Docs/Slides conversion edge cases.
2. Align renderer observability and failure diagnostics with master-spec contract.

The Visual Identity Engine is a high-fidelity renderer designed to bridge web-based design systems (HTML/CSS) with Google Workspace (Docs/Slides) output capabilities. It ensures that virtual employees (like the Secretary and Analyst) can generate strictly styled documents adhering to the "Director's Office" corporate aesthetic.

## 1. Core Principles

The engine is built around three core principles:
1. **Single Source of Truth**: All branding (colors, typography, spacing) lives in JSON configuration files within `/src/core/registry/branding/`.
2. **Template Driven**: Documents are defined as HTML/CSS templates. Virtual employees inject data into these templates rather than generating Google API requests directly.
3. **Deterministic Rendering**: The translation from HTML to Google API structural elements must be calculable and deterministic, handling spacing and alignment perfectly to avoid an "auto-generated" appearance.

## 2. Architecture

### 2.1 The Visual Identity Registry

Located at `/src/core/registry/branding/`, this registry holds:
- `theme.json`: Defines semantic colors, primary/secondary colors, and spacing constants.
- `typography.json`: Defines font families (Google Fonts), scalar ratios, line heights, and letter spacing behaviors.
- `templates/`: A collection of specific HTML templates (e.g., Policy Memo, Strategy Slide, Weekly Status).

### 2.2 ThemeManager Service

The `ThemeManager` (`/src/core/services/ThemeManager.ts`) is responsible for:
- Ingesting `theme.json` and `typography.json` on startup.
- Providing a parsed "Style Provider" to the system, exposing helper functions like `getColor(semanticName)` or `getFontScale(headingLevel)`.

### 2.3 WorkspaceRenderer

The `WorkspaceRenderer` (`/src/core/services/WorkspaceRenderer.ts`) is the core conversion engine. Its duties include:
1. **HTML Parsing**: Traversing the injected HTML string.
2. **Sanitization & CSS inline matching**: Matching CSS variables against the `ThemeManager` tokens to compute exact font sizes and colors.
3. **Workspace API Construction**: Transforming the parsed nodes into Google API `BatchUpdate` requests.

## 3. The Bi-Directional Conversion Pipeline

### 3.1 HTML to Google Docs

- **Mapping**: HTML tags like `<div>`, `<h1>`, `<ul>` map directly to Docs Structural Elements (`Paragraph`, `List`).
- **Styling**: Inline CSS or matched template CSS maps to `TextStyle` and `ParagraphStyle`.
- **Handling Gaps**: Since Docs doesn't support margin collapsing, `WorkspaceRenderer` explicitly calculates `spaceAbove` and `spaceBelow` based on the element type and previous sibling. Padding is handled by converting block elements with backgrounds/borders into single-cell tables.

### 3.2 HTML to Google Slides

- **Layout Mapping**: Semantic sections (e.g., `<article>` or `<section>`) in the HTML map to individual Slides.
- **Object Injection**: Due to the absolute positioning nature of Slides, the engine uses CSS flexbox-like logic internally to compute bounding boxes (`PageElement` transforms).
- **Typography Scale**: The engine scales fonts linearly based on `typography.json` tokens, mapping them to `TextStyle` objects within individual shape text nodes.

## 4. Agentic Workflow Integration

- **The Secretary**: When drafting a policy, the agent calls the "Policy Template" by key. The output content is injected into the `<main>` tag of the template.
- **The Analyst**: Uses the "Strategy Slide" template to generate multi-slide presentations using data blocks mapped to slide sections.
- **Review Loop**: Both agents stage the HTML output locally first. The Director can preview the render in the UI. If approved, the agent invokes the `WorkspaceRenderer` to commit via the Google Bridge.

## 5. Security and Sanitization

- The engine strictly sanitizes HTML input.
- `script` and `iframe` tags are stripped entirely.
- CSS is restricted to predefined visual tokens (colors and sizes) recognized by `ThemeManager` to prevent arbitrary style injections that break brand compliance.
