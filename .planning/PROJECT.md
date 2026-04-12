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
- [x] **v1.3**: Communication (WhatsApp/Loops), Storage (Vector/AES-256-GCM), Queue (DLQ/DAG/Throttling), Pipeline (Backpressure/PDF), Google Ecosystem (REST).
- [x] **v1.2**: Security (Zod/wrappedFetch/Path Traversal), Domain Audit (11 domains), Documentation Reconcilation.
- [x] **v1.1**: Error Handling (Fail Fast), Initialization Architecture, Astra v1.0.4 Upgrade.

### Active
[x] **v1.4**: Dependency Hygiene (npm install warning cleanup, MUI typography variant compatibility).

### Out of Scope
- Hosted web versions (purely Electron app)
- Developing brand new features outside of existing documentation

## Current State: v1.4 Shipped (2026-04-11)

**Key Accomplishments:**
- Hardened persistence with **AES-256-GCM** encryption.
- Zero-dependency **Google REST Ecosystem** integration (Port 3111 OAuth).
- Universal Queue with **DAG-based task dependencies** and **Dead Letter Queues**.
- Ingestion Pipeline with **Backpressure (200 threshold)** and **PII Redaction**.

## Next Milestone Goals (v1.4)
- [ ] **Automated Workflows**: Orchestrate multi-step task chains utilizing the new DAG engine.
- [ ] **Visual Redaction**: Implement binary PII redaction (OCR + Blur) for document assets.
- [ ] **Unified Agent Interface**: Streamline the interaction between Communication Adapters and the Knowledge Vault.
- [ ] **Dependency Hygiene**: Remove npm install peer dependency override warnings by reconciling React, MUI, and type package versions.

## Key Decisions
| Decision | Rationale | Outcome |
| --- | --- | --- |
| Adopt pure IPC bounded context (Cold-Vault) | Enforce security | ✅ Good |
| Strict Schema Validation (Zod) at IPC boundary | Prevent payload corruption | ✅ Good |
| Native REST for Google Integration | Eliminate heavy SDK dependencies and reduce bundle size | ✅ Good |

## Evolution
This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-04-11 after v1.3 milestone archival*
