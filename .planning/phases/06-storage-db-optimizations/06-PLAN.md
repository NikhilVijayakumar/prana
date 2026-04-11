---
plan_id: 06-storage-db-optimizations
wave: 1
depends_on: []
files_modified:
  - src/main/services/sqliteCryptoUtil.ts
  - src/main/services/taskRegistryService.ts
  - src/main/services/registryRuntimeStoreService.ts
  - src/main/services/contextDigestStoreService.ts
  - src/main/services/conversationStoreService.ts
  - src/main/services/sqliteConfigStoreService.ts
  - src/main/services/vectorSearchService.ts
autonomous: true
---

# Phase 6: Storage & DB Optimizations - Execution Plan

## Goal
Embed vector RAG structures and encryption features securely into `.sqlite` storage boundaries. Maintain ephemeral caching constraints for generative memory vectors, and strictly roll AES-256-GCM encryption wrappers around legacy SQLite buffer streams.

## Tasks

<task>
<id>create-crypto-wrapper</id>
<title>Create AES-256-GCM SQLite Crypto Utilities</title>
<read_first>
- src/main/services/vaultService.ts
</read_first>
<action>
1. Create `src/main/services/sqliteCryptoUtil.ts`.
2. Extract the `getRuntimeVaultConfig` methodology from `vaultService.ts` to construct a function `getDbKey(): Buffer` utilizing `pbkdf2Sync` to format a 32-byte key using `archivePassword` and `archiveSalt`.
3. Export `async encryptSqliteBuffer(buffer: Uint8Array): Promise<Buffer>` which spawns `randomBytes(12)` for an IV, creates a cipher using `aes-256-gcm` and the 32-byte key, encrypts the buffer, and returns a concatenized `Buffer.concat([iv, authTag, encrypted])`.
4. Export `async decryptSqliteBuffer(protectedBuffer: Buffer): Promise<Uint8Array>` which splices out the first 12 bytes (`iv`), the next 16 bytes (`authTag`), initializes a `createDecipheriv`, flags `.setAuthTag(authTag)`, and returns the raw decrypted `Uint8Array`.
</action>
<acceptance_criteria>
- File `src/main/services/sqliteCryptoUtil.ts` exports `encryptSqliteBuffer` and `decryptSqliteBuffer`.
- `encryptSqliteBuffer` applies `aes-256-gcm`.
</acceptance_criteria>
</task>

<task>
<id>wrap-sqlite-persistence</id>
<title>Wrap SQLite IO With Crypto Module</title>
<read_first>
- src/main/services/sqliteCryptoUtil.ts
- src/main/services/taskRegistryService.ts
- src/main/services/registryRuntimeStoreService.ts
- src/main/services/contextDigestStoreService.ts
- src/main/services/conversationStoreService.ts
- src/main/services/sqliteConfigStoreService.ts
</read_first>
<action>
1. In all listed `Store` & `Registry` services, locate the `persistDatabase` equivalent functions containing `await writeFile(...)`.
2. Swap `await writeFile(..., Buffer.from(bytes))` with `await writeFile(..., await encryptSqliteBuffer(bytes))`.
3. Locate `initializeDatabase` equivalences containing `const raw = await readFile(...)`.
4. Replace `database = new sqlRuntime.Database(new Uint8Array(raw));` with a `try/catch` fallback. Inside `try`: `const decrypted = await decryptSqliteBuffer(raw); database = new sqlRuntime.Database(decrypted);`. In the `catch`: assume legacy plaintext, instantiate the `Database(new Uint8Array(raw))`, and trigger `await persistDatabase(database);` lazily to enforce migration.
</action>
<acceptance_criteria>
- `taskRegistryService.ts` imports `encryptSqliteBuffer` and invokes it on write.
- Legacy text reading falls back correctly on tag mismatch.
- `registryRuntimeStoreService.ts` correctly overrides `writeFile` buffers.
</acceptance_criteria>
</task>

<task>
<id>implement-vector-service</id>
<title>Implement Ephemeral Vector Search Service</title>
<read_first>
- src/main/services/loopProtectionService.ts
</read_first>
<action>
1. Create `src/main/services/vectorSearchService.ts`.
2. Import pipeline from `@xenova/transformers` (`BGE-Micro`).
3. Instantiate an ephemeral Map: `const semanticCache = new Map<string, { text: string; vector: number[] }>();`.
4. Expose `async indexDocument(docId: string, text: string)` generating the float array mapping via `await extractor(...)`.
5. Expose `async search(query: string, k: number)` utilizing the `cosineSimilarity` mathematical algorithm against all keys in `semanticCache` and sorting descending.
6. Provide `clear()` to destroy the Map natively without triggering persistence overheads.
</action>
<acceptance_criteria>
- `vectorSearchService.ts` exposes `indexDocument()` mapping to `BGE-Micro`.
- Ephemeral map logic destroys constraints appropriately via `clear()`.
- Search routine yields arrays of `[{ docId, score }]`.
</acceptance_criteria>
</task>

## Verification Strategy
- Generate a new SQLite table payload. Read the raw output bytes physically via `fs.readFile` testing that 'SQLite format 3' magic string does NOT natively exist within the encrypted cipher stream.
- Insert array of mock strings regarding specific domains into `vectorSearchService.indexDocument()`. Trigger `search()` with synonymous phrases checking positive bounding results > 0.82 similarity correctly fetch targeting text snippets.

## Must Haves
- Pure Typescript cosine similarity maps implemented.
- Automatic legacy downgrade mapping correctly captures plaintext tables during cold-start.
- Seamless encryption overlays for existing Database persist routines.
