# Email DraftSync — Atomic Feature Specification

Status: FUTURE SCOPE (specification complete, runtime service implementation pending)

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Pipeline

## Current State
- Draft review and attribution UX contract is fully specified.
- Runtime implementation for full DraftSync behavior remains pending.

## Target State
- Deliver complete Director review experience with deterministic attribution, versioning, and save/discard controls.
- Preserve strict read-and-draft-only posture with no outbound send behavior.

## Gap Notes
- Full UI integration, contribution history parity, and runtime persistence behaviors require implementation completion.

## Dependencies
- docs/module/email-management.md
- docs/module/email-orchestrator-service.md
- docs/module/master-spec.md

## Acceptance Criteria
1. Contribution sections retain deterministic ordering and attribution.
2. Director controls enforce review-before-save governance.
3. Draft persistence and navigation guarantees prevent data loss.

## Immediate Roadmap
1. Implement DraftSync surface and contribution history pipeline.
2. Align behavior with feature plan item FP-010 and email workflow gates.

## 1. Single Reason to Change (SRP)
This document handles updates **exclusively** related to the visualization, interaction, and management of multi-agent collaborative email draft contributions within the Director's review interface.

## 2. Input Data Required
- **SharedDraft:** Draft entry from `email_drafts` SQLite table.
- **DraftContributions:** Per-agent sections from `email_draft_contributions` table.
- **Original Email:** Source email metadata and body for reply context (null for new compositions).
- **Agent Directory:** Agent names, roles, and display colors for attribution badges.

## 3. Registry Sub-Component Integration
- **Agents:** All contributing agents (via Agent Directory lookup).
- **Skills:** Not directly used — this is a UI-facing component.
- **Workflows:** Consumes output from `mira/email-collaborative-draft`.
- **Protocols:** Not directly used.
- **KPIs:** `draft-cycle-time` (time from Director selection to draft approval).
- **Data Inputs:** Not applicable.

## 4. Triple-Engine Extraction Model
- **OpenCLAW:** Not directly used.
- **Goose:** Not directly used.
- **NemoClaw:** Binds to draft review UI anchors: contribution sections, inline editor, approval buttons, copy-to-clipboard action.

## 5. UI Component Features

### Reply Draft View
- **Left panel:** Original email (sender, subject, date, body).
- **Right panel:** Composed response with agent-attributed sections.

### New Composition Draft View
- **Full-width editor** with agent-contributed sections (no original email reference).

### Contributor Attribution
- Each section displays a color-coded agent badge (agent name + role).
- Summary card at top: "3 agents contributed: Mira (framing), Nora (financial data), Eva (compliance check)."
- Contribution timestamps shown per section.

### Director Controls
- **Inline Edit:** Director can edit any section directly.
- **Approve & Save:** Saves final draft to Vault. Never sends.
- **Copy to Clipboard:** Director copies approved draft text for pasting into their email client.
- **Discard:** Discards draft and resets ActionItem status.
- **Version History:** View previous versions of the draft.

## 6. Hybrid DB & State Storage Flow

### SQLite (High-Performance)
- `email_draft_contributions`: `contribution_id`, `draft_id`, `agent_id`, `section_index`, `content`, `contributed_at`, `version`.
- Merge strategy: sections ordered by `section_index`; Mira's framing sections (intro/outro) always wrap specialist sections.

### Vault (Secure Commit State)
- Approved drafts committed as markdown: `/org/administration/email/drafts/<draftId>.md`.
- Includes metadata header: subject, recipient, contributing agents, approval timestamp.

## 7. Chat Scenarios
- **Internal Chat:** Mira notifies Director when all agent contributions are collected and draft is ready for review.
- **External Chat:** None. The app never sends emails.

## 8. Navigation Guarantee
- Users can return to Triage Summary from draft review at any time without draft loss (draft auto-saves on navigation).
- No-Dead-End: Back to triage summary + Home to workspace root.
