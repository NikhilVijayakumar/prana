# Phase 04: Communication Enhancements — Validation Strategy

## Goal
Verify that the `LoopProtectionService` strictly enforces limits (Counter + Cosine Similarity) across channels, and that the Baileys-based WhatsApp bridge properly integrates under strict whitelisting guidelines.

## Verification Scenarios

### V1. Baileys Adapter Startup & Persistence
1. Initialize Main process with `whatsappAdapterService`.
2. Inspect log output confirming web socket connection request.
3. Validate session credentials are saved securely inside the Vault configuration folder.

### V2. Sandboxing & Whitelisting 
1. Emit an IPC request impersonating an un-whitelisted Group JID.
2. Assert that `channelRouterService` rejects or ignores the payload entirely.
3. Emit an IPC request from an authorized Group but an unknown number.
4. Assert that the request is tagged as "Level 0 - General Info only" within the orchestrator context.

### V3. Max Turns Loop Protection
1. Invoke the `LoopProtectionService.intercept()` method with a mock `conversationHistory` measuring 5 interactions.
2. Assert that the 6th interaction throws/returns an `EscalationRequiredError`.

### V4. Semantic Similarity Hard-Stop
1. Provide 3 identical mock string blocks to the `BGE-Micro` embedding pipeline via `@xenova/transformers`.
2. Assert that the Cosine Similarity yields precisely > 0.90.
3. Assert that the service correctly emits `app:escalation-required` to the renderer.
