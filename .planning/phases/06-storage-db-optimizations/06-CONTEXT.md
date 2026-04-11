# Phase 6: Storage & DB Optimizations - Context

## Domain
Hardening database persistence through encrypted boundaries and implementing high-performance local Vector RAG indexing for semantic retrieval.

## Canonical Refs
- `src/main/services/taskRegistryService.ts`
- `src/main/services/registryRuntimeStoreService.ts`
- `src/main/services/contextDigestStoreService.ts`
- `src/main/services/conversationStoreService.ts`
- `src/main/services/sqliteConfigStoreService.ts`

## Decisions
The following implementations have been explicitly approved by the operator:

1. **Vector Indexing Engine**
   We will utilize a pure-TypeScript semantic similarity search implementation. Embedded vectors are mapped internally without relying on heavy C++ or Python native extensions (e.g. no ChromaDB or sqlite-vss bindings). This ensures standard build outputs within Electron's packaging constraints.
   
2. **Encryption-At-Rest Implementation**
   Rather than substituting `sql.js`, the core SQLite Uint8Array binary files will be wrapped universally during `fs.writeFile` routines using NodeJS native `crypto` libraries (`AES-256-GCM`). 

3. **Vector Vectorization Storage Governance**
   Vector indexing states will be placed under **Ephemeral (Cache)** structures. By discarding semantic index matrices across major session restarts, we limit excessive encryption loads and preserve the purely deterministic aspects of generative memory.

## Deferred Ideas
None at this time.
