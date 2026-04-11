# Phase 04: Communication Enhancements — Research

## Architectural Approach
This phase introduces a robust communication layer focusing on WhatsApp connectivity and a channel-agnostic Agent Loop Protection service. 

### 1. WhatsApp Bridge (Baileys) Integration
* **Library**: `@whiskeysockets/baileys` (Web Socket scraping approach).
* **Process Boundary**: Must operate cleanly within the Electron **Main process** (Node), wrapped as a dedicated `whatsappAdapterService.ts`.
* **State Management**: Authentication state (QR code, sessions keys) must be persisted locally in the `.planning` or `vault` data paths to prevent re-authentication.

### 2. LoopProtectionService (Channel-Agnostic Core)
* **Architecture**: A decoupled service injected into `orchestrationManager` or `channelRouterService`, running interceptor patterns over both incoming and outgoing payloads.
* **State Limitation (Max Turns)**: Tracks unique `conversationId` or `taskId` in the `conversation_cache` SQLite table. If `turns > 5`, cuts off.
* **Semantic Loop Protection (Cosine Similarity)**:
  * Uses `@xenova/transformers` running the `BGE-Micro` model locally via ONNX runtime over Node.js.
  * Calculates embedding embeddings for the last 3 messages.
  * Formula verifies Cosine Similarity. If > 0.9, triggers escalation.

### 3. Human-in-The-Loop Escalation
* **UI & Hooks**: Expose an IPC event `app:escalation-required` to push to the Renderer (DirectorInteractionBar).
* **Resolution**: Emits `app:escalation-cleared` upon the authorized operator replying with the keyword (e.g. "Proceed"). 
* **Whitelists**: Check JIDs and Operator numbers strictly against `runtime_config_meta` SQLite representations.

## Validation Architecture
* **Testing BGE-Micro**: Send 3 identical strings and expect similarity > 0.9.
* **Testing Max Turns**: Run a mock loop 6 times and ensure strict truncation on the 6th invocation.
* **Testing Whitelist**: Send a mock payload from an unknown number; verify it falls back to Level 0.
