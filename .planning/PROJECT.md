# Prana

## What This Is
An Electron-based application utilizing the Astra UI framework, focused on securely managing vault knowledge, workflows, and operations.

## Core Value
Secure and deterministic task orchestration across bounded contexts with rich UI constraints.

## Target Audience
Internal operators and administrators.

## Technical Architecture
- Framework: Electron React (Web) + Node (Main)
- Build: Vite
- Storage: Local sqlite (Cold-Vault architecture)
- Dependencies: Astra UI

## Requirements

### Validated
- [x] Upgrade Astra to v1.0.4 and fix strict compilation constraints. — v1.1
- [x] Complete robust error handling & "Fail Fast" initializers. — v1.1
- [x] Audit existing implementations against specs in `docs/features` — v1.2
- [x] Resolve all partial implementations across 11 sub-domains — v1.2
- [x] Identify and fix gaps between current implementation and documentation — v1.2
- [x] Detect and resolve security gaps related to feature implementations (Zod, wrappedFetch, Path Traversal) — v1.2

### Active
- [ ] Implement WhatsApp adapter and agent loop protection for Communication.
- [ ] Design and implement Vector search RAG structures and DB encryption extensions for Storage.
- [ ] Establish dead letter queues, DAG tasks, and adaptive throttling controls for Queue Services.
- [ ] Introduce backpressure handling, binary PII redaction, and Puppeteer PDF generation in pipeline.
- [ ] Develop robust Google Ecosystem Integration (Drive, Docs, Sheets, Slides, Forms) for read/write operations.

### Out of Scope
- Hosted web versions (purely Electron app)
- Developing brand new features outside of existing documentation

## Current Milestone: v1.3 Feature Expansion & Ecosystem Integration

**Goal:** Bridge feature engine deficits by adding advanced communication integrations, expanding storage RAG indexing, resolving deferred queue mechanisms, and deeply integrating with the Google Ecosystem for robust document operations.

**Target features:**
- **Communication:** WhatsApp adapter and agent loop protection.
- **Storage:** Vector search RAG structures and DB encryption extensions.
- **Queue Services:** Dead letter queues, DAG tasks, and adaptive throttling controls.
- **Pipeline Constraints:** Backpressure handling, binary PII redaction, and Puppeteer-driven PDF generation in the Email/Visual pipelines.
- **Google Ecosystem:** Read/write operation integration for Google Drive, Docs, Sheets, Slides, and Forms.

## Key Decisions
| Decision | Rationale | Outcome |
| --- | --- | --- |
| Adopt pure IPC bounded context (Cold-Vault) | Enforce security | ✅ Good |
| Strict Schema Validation (Zod) at IPC boundary | Prevent payload corruption | ✅ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-11 after v1.3 milestone definitions*
