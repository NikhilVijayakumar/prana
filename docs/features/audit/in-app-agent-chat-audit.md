# In-App Agent Chat Audit

## Findings
- The only in-app interaction surface found is the operator interaction bar.
- That surface submits work orders and can forward Telegram messages, but it is not a persistent chat workspace.
- No dedicated chat service or SQLite chat transcript cache was found in the runtime layer.

## Impact
- Users can route tasks, but they cannot maintain durable in-app conversations with different agents.
- Agent-to-agent messaging and chat transcript retrieval remain undocumented and unimplemented as a first-class feature.

## Evidence
- [DirectorInteractionBar.tsx](../../../src/ui/components/DirectorInteractionBar.tsx)
- [orchestrationManager.ts](../../../src/main/services/orchestrationManager.ts)

## Recommendation
- Introduce a chat session service with durable SQLite history, per-agent threads, and a UI dedicated to conversational routing.