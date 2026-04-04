# Chat Context Rotation Audit

## Findings
- The context engine already supports token budgets, compaction, and hard-limit handling.
- The optimizer separates pinned, summarizable, and active-tail messages.
- No chat-specific rotation workflow or lifecycle policy was found.

## Impact
- The base context services can prevent overflow, but they do not yet define how a chat session should rollover across agents or channels.
- Chat transcript retention and channel-aware compaction remain separate work items.

## Evidence
- [contextEngineService.ts](../../../src/main/services/contextEngineService.ts)
- [contextOptimizerService.ts](../../../src/main/services/contextOptimizerService.ts)

## Recommendation
- Add a chat-session rotation contract that maps compaction events to conversation rollover, archive, and resume rules.