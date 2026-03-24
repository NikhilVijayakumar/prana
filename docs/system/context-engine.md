# Context Engine

## Objective
Implement a token-aware context management lifecycle for local and hybrid model providers that:

- Tracks context growth in real time.
- Triggers compaction at the high-water mark.
- Preserves critical context while summarizing the middle history.
- Supports reviewable transition into a fresh session with carried state.
- Persists history digests into local SQLite for audit and recall.

## Runtime Components

### 1. Token Manager
Path: `src/main/services/tokenManagerService.ts`

Responsibilities:

- Uses `js-tiktoken` (`o200k_base`) for deterministic token counting.
- Falls back to a deterministic character-based estimator when tokenization fails.
- Resolves model context window and thresholds from registry model config **or** from runtime provider configuration.
- Supports providers: `lmstudio`, `openrouter`, `gemini`, and `custom`.

Registry source (fallback):

- `src/core/registry/data-inputs/model-gateway-config-registry.json`
- Field: `model_config.model_context_windows`

**Runtime provider configuration (priority)** — can include optional user-supplied context window:

- `ModelProviderConfig.contextWindow` — user-configured context window in tokens
- `ModelProviderConfig.reservedOutputTokens` — user-configured reserved output in tokens
- Captured during onboarding (Phase 3) and in settings (Provider Settings page)

Resolution order (priority):

1. User-supplied `contextWindow` / `reservedOutputTokens` (from provider config)
2. Model override (`model_overrides[provider][model]`)
3. Provider default (`providers[provider]`)
4. Global fallback (`default_context_window`, service defaults)

### 2. Context Engine
Path: `src/main/services/contextEngineService.ts`

Responsibilities:

- Maintains session message buffer and token budget state.
- Tracks model configuration (`provider`, `model`) per session.
- Emits lifecycle events:
  - `threshold_reached`
  - `compaction_started`
  - `compaction_completed`
  - `new_context_prepared`
  - `new_context_started`
- Triggers compaction automatically when total tokens cross the high-water mark.

### 3. Summarization Agent
Path: `src/main/services/summarizationAgentService.ts`

Responsibilities:

- Uses a specialized internal prompt for compact history digests.
- Attempts summarization through enabled fast providers (`lm-studio`, `openrouter`, `gemini-cli` in priority order).
- Falls back to deterministic extraction when model execution is unavailable.

Summary structure:

- Decisions
- Extracted Data
- Unresolved Tasks
- Risks
- Next-Step Intent

### 4. Digest Persistence (SQLite)
Path: `src/main/services/contextDigestStoreService.ts`

Responsibilities:

- Stores compaction digests in `context-history.sqlite` under app data root.
- Preserves:
  - Session id
  - Digest id
  - Summary
  - Metadata JSON
  - Before/after token counts
  - Removed message count
  - Compaction timestamp

## Compaction Strategy

### Trigger
Compaction starts when:

$$
\text{totalTokens} \ge \text{compactThresholdTokens}
$$

Where:

$$
\text{compactThresholdTokens} = \lfloor \text{contextWindow} \times \text{highWaterMarkRatio} \rfloor
$$

Default high-water ratio is `0.8`.

### Recursive Summarization
When compaction triggers:

1. Preserve critical context:
   - Initial instruction (`first system message`)
   - Current goal (`latest user message`)
   - Core metadata (company/product context from registry)
2. Summarize middle 60% of conversation into a History Digest.
3. Inject digest into the compacted buffer as a system carryover message.
4. Keep a short recent tail for immediate continuity.
5. Persist digest into SQLite.

## New Context Transition

### Review Mode
Renderer can request a review preview before starting a new session:

- IPC: `context-engine:prepare-new-context`
- Returns `summary`, source session, and suggested new session id.

### Start New with Context
User can start a fresh session with carried summary:

- IPC: `context-engine:start-new-with-context`
- Seeds new session with:
  - Initial instruction
  - History Digest carryover
  - Current goal carryover

## Transparency in UI

Queue Monitor consumes context telemetry and event stream to show:

- Compaction status notifications.
- Review summary panel.
- Manual `Start New with Context` action.

Renderer paths:

- `src/renderer/src/features/queue-monitor/viewmodel/useQueueMonitorViewModel.ts`
- `src/renderer/src/features/queue-monitor/view/QueueMonitorView.tsx`

## IPC Surface

Added endpoints:

- `context-engine:prepare-new-context`
- `context-engine:start-new-with-context`
- `context-engine:get-latest-digest`
- `context-engine:list-digests`

Extended endpoint:

- `context-engine:bootstrap` now accepts `modelConfig` and `highWaterMarkRatio` in budget.

## Safety Notes

- If summarizer model execution fails, deterministic summarization guarantees compaction completion.
- If tokenization fails, fallback estimator prevents hard failure.
- Digests are persisted locally for audit and retrieval even when active chat context is compacted.

## Implementation Status

- Token manager service is present and wired into `contextEngineService` token estimation and budget initialization.
- Node typecheck verification: `npm run typecheck:node` (pass).
