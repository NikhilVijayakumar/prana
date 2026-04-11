# Phase 09: Comprehensive Documentation Sync — Context

## Goal
Synchronize the codebase implementation details from Milestone v1.3 (Phases 4-8) with the external documentation tree. Ensure that the "Hardened" security posture and native ecosystem integrations are accurately reflected.

## Decisions (Recommended Defaults)

1. **Audience Depth: Technical-First**
   Documents in `docs/integration_guide` will prioritize technical implementation details (IPC schemas, REST protocols, Zod validation) over business-level flows, reflecting Prana's nature as a developer-facing library.

2. **Architectural Visuals: Meridian Diagrams Integrated**
   New Mermaid diagrams will be added to `README.md` and relevant feature docs to visualize:
   - The **SQLite Crypto Wrap** (AES-256-GCM logic).
   - The **Queue Circuit Breaker** (Failure-based lane throttling).
   - The **Google REST Auth Flow** (Ephemeral OAuth server loop).

3. **WhatsApp Visibility: Restricted to Internal Specs**
   WhatsApp adapter details will remain in `docs/features/chat/channel-integration.md`. They will **not** be bubbled up to the public Integration Guide yet, to maintain a thin integration boundary for "plugin-style" adapters.

4. **Queue Lifecycle: Automated Recovery**
   Throttling/Circuit breaker documentation will emphasize automated recovery (resetting when lane failure count drops). Manual DLQ clearing will be documented as a "break-glass" operation via the Task Registry.

## Target Files
- `README.md`: Structural update (v1.3.0) + Security/Vaidyar visuals.
- `docs/integration_guide/library-integration-guide.md`: Google REST & Advanced Queueing.
- `docs/features/Integration/google-ecosystem-integration.md`: Native REST vs IMAP.
- `docs/features/queue-scheduling/queue-scheduling.md`: DLQ/DAG/Throttling logic.
- `docs/features/storage/sqlite-cache.md`: AES-256-GCM encryption.
- `docs/features/email/email-orchestrator-service.md`: Backpressure & PII Redaction.

## Canonical Refs
- `src/main/services/googleBridgeService.ts`
- `src/main/services/taskRegistryService.ts`
- `src/main/services/sqliteCryptoUtil.ts`
- `src/main/services/piiRedactionService.ts`
- `src/main/services/pdfGeneratorService.ts`
- `src/main/services/loopProtectionService.ts`
