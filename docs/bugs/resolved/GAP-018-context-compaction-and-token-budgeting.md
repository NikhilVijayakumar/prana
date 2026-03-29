# GAP-018: Context Compaction & Token Budgeting

## Severity
Critical

## Status
Implemented

## Summary
Dhi previously had an in-memory context buffer with approximate token estimation and message-count-based compaction, but lacked model-specific context limits, high-water-mark compaction orchestration, reviewable new-context transition, and persistent digest history.

## Evidence From Repository Audit

### Dhi (Current Workspace)
- `src/main/services/contextEngineService.ts` (pre-change): fixed defaults and naive token estimate (`length/4`), no model-specific registry-based context windows.
- `src/main/services/contextEngineService.ts` (pre-change): compaction based mainly on message cap, not recursive middle-history summarization.
- `src/main/services/contextEngineService.ts` (pre-change): no persisted digest storage, no review/start-new flow.

### OpenClaw
- `openclaw-main/src/memory/manager.ts`: mature memory index lifecycle and sync orchestration.
- `openclaw-main/src/memory/sqlite.ts`: explicit SQLite memory integration.
- `openclaw-main/src/memory/temporal-decay.ts`: recency-aware memory scoring.

### Goose
- `goose-main/crates/goose/src/token_counter.rs`: explicit tokenizer-backed token counting (`tiktoken-rs`) with cache.
- `goose-main/documentation/docs/guides/sessions/smart-context-management.md`: documented 80% auto-compaction strategy and manual summarize/start controls.

### NemoClaw
- `NemoClaw-main/README.md`: orchestration-focused wrapper around OpenClaw/OpenShell.
- No clear standalone NemoClaw-native token compaction engine or hybrid semantic memory module found in this workspace subtree.

## Gap Details

1. Missing model-aware context budgeting (LM Studio/OpenRouter/Gemini) from registry.
2. Missing high-water-mark trigger integrated into message ingest lifecycle.
3. Missing recursive summarization that preserves initial instruction, current goal, and metadata while compressing middle history.
4. Missing UI review mode and user-visible transition controls for "Start New with Context".
5. Missing SQLite persistence for digest history.

## Remediation Implemented

- Added token manager service:
  - `src/main/services/tokenManagerService.ts`
- Added summarization agent service:
  - `src/main/services/summarizationAgentService.ts`
- Added digest SQLite persistence:
  - `src/main/services/contextDigestStoreService.ts`
- Upgraded context engine lifecycle:
  - `src/main/services/contextEngineService.ts`
- Exposed new IPC/preload APIs:
  - `src/main/services/ipcService.ts`
  - `src/preload/index.ts`
  - `src/preload/index.d.ts`
- Added queue monitor transparency and manual transition UI:
  - `src/renderer/src/features/queue-monitor/viewmodel/useQueueMonitorViewModel.ts`
  - `src/renderer/src/features/queue-monitor/view/QueueMonitorView.tsx`
  - `src/renderer/src/localization/i18n.ts`
- Added registry model context window config:
  - `src/core/registry/data-inputs/model-gateway-config-registry.json`

## Remaining Risks

- Token counting still uses a single tokenizer baseline (`o200k_base`) and may not perfectly mirror every provider tokenizer.
- Summarization quality depends on provider availability; deterministic fallback is safe but less semantically rich.
- Existing chat-specific UI modules may need direct integration beyond Queue Monitor if/when a dedicated chat surface is introduced.

## Verification

- Node typecheck: `npm run typecheck:node` (pass after restoring and validating `tokenManagerService`).
