# Context Optimization

## Objective
Keep runtime chat sessions inside model-specific context limits without dropping critical working memory.

## Lifecycle
1. `WARNING` at 70% of `maxTokens`.
2. `COMPACTION_REQUIRED` at 85% of `maxTokens`.
3. `HARD_LIMIT` reset at 95% of `maxTokens`.

## Runtime Rules
- SQLite stores the full raw message stream in `chat_history_raw`.
- SQLite stores the actively-sendable prompt buffer in `chat_context_active`.
- Session lifecycle state is tracked in `context_session_state`.
- Compaction digests continue to be stored in `history_digests`.
- Messages removed from the active window are mirrored into the local embedding index namespace `context-archive:<sessionId>`.

## Optimization Strategy
- Tier 1: Preserve pinned context such as the first system instruction, prior digest carryovers, core metadata, and current-goal carryovers.
- Tier 2: Summarize the middle history into a compact digest via `summarizationAgentService`.
- Tier 3: Evict tool/thought/intermediate trace messages from the active tail before preserving recent actionable context.

## Fresh Start
- `context-engine:prepare-new-context` produces a reviewable summary.
- `context-engine:start-new-with-context` archives the source session and seeds a fresh session with carryover summary.

## Current Scope
- Main-process runtime behavior and persistence are implemented.
- UI warning surfaces can consume `warning_state` and `hard_limit_reset` events from context telemetry.
- Automated Playwright overflow coverage is still pending.
