# Vector Search and RAG - Atomic Universal Specification

## A. Operational Intent
Implement SQLite-backed vector retrieval and prompt augmentation pipeline for context-enriched reasoning without violating data-tier controls.

## B. Registry Dependency
- Agent Profiles: maya, arya, mira
- Skills: latency-optimization-strategy, contextual-intent-mapping, automated-policy-validation
- Protocols: context-injection-protocol, privacy-by-design-protocol, compliance-gate-protocol
- Workflows: mira/contextual-self-healing, maya/seed-autonomous-alignment

## C. The Triple-Engine Extraction Logic
### OpenCLAW
Decide retrieval strategy, rerank candidates, and generate context packs for downstream reasoning.

### Goose
Extract query intent and construct retrieval task sequence: embed -> search -> rerank -> compose context.

### NemoClaw
Present retrieval diagnostics, source trace panel, and context acceptance controls.

## D. Hybrid Data Lifecycle
### SQLite (High-Performance)
Store embeddings, vector index, chunk metadata, prompt cache, and retrieval telemetry for low-latency RAG.

### Vault (Secure Commit State)
Commit approved canonical knowledge chunks, sensitive retrieval exceptions, and audit-ready query provenance.

## E. Channel and Execution
- Cronjobs: Nightly re-embedding, index compaction, and stale-chunk pruning.
- Internal Chat: RAG tuning and retrieval-quality channel.
- External Channels: No default external channel.
- Dynamic UI Contract: System and module screens must be schema-driven by registry YAML/JSON definitions.
- No-Dead-End Navigation: Every screen must expose Back and Home controls for Electron no-URL execution.
- Manual Override: Show Current State and Proposed Improvement before every registry-impacting commit.
