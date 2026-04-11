# Phase 04: Communication Enhancements — Plan

## 1. Setup Channel Agnostic Loop Protection Service
**Goal:** Abstract agent cutoff mechanisms to universally protect against infinite loops.
* **Component:** `src/main/services/loopProtectionService.ts`
* **Dependency:** `@xenova/transformers` for executing BGE-Micro locally in the Main process (or via an isolated worker thread avoiding UI blocking).
* **Implementation:**
  * Implement `intercept(conversationId, messages)`.
  * Track `max_turns` limit over a rolling context window (default 5).
  * Run embedding generations on the last 3 messages and compute the Cosine Similarity.
  * Throw specialized `EscalationRequiredError` if limits are exceeded.

## 2. Refactor Channel Router with Sandboxing
**Goal:** Enforce rigid whitelisting rules prior to dispatching intents.
* **Component:** `src/main/services/channelRouterService.ts`
* **Implementation:**
  * Tie `channelRouterService` to the runtime SQLite cache to validate active `groupJids` and `whitelistedNumbers`.
  * Drop or reject payloads from totally unknown group sources.
  * Map known-group but unknown-number payloads securely to a "Level 0" permission context.

## 3. Implement WhatsApp Baileys Adapter
**Goal:** Deploy linked-device WhatsApp integration.
* **Component:** `src/main/services/adapters/whatsappAdapterService.ts`
* **Dependency:** `@whiskeysockets/baileys`
* **Implementation:**
  * Manage Socket Lifecycle (initialize, QR parsing, reconnect).
  * Map incoming Baileys payload schema to `channelRouterService`.
  * Isolate the session persistence rigidly within the Prana Vault configuration path.
  * Interlace `LoopProtectionService` on outbound routing.

## 4. Render Human-in-the-Loop Hooks
**Goal:** Enable users to approve/restart loop-halted instances.
* **Implementation:**
  * Update `orchestrationManager.ts` to trap `EscalationRequiredError` and emit `app:escalation-required` IPC payload.
  * Adjust `DirectorInteractionBar.tsx` (UI) to display the halted loop state and provide a "Proceed" button that remits the `app:escalation-cleared` event to unlock the `conversationId`.
