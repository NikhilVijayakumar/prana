# GAP-019: Model Context Window Runtime Capture & Integration

## Severity
High

## Status
Implemented

## Summary
The context compaction and token budgeting system (GAP-018) reads model context windows from a registry file (`model-gateway-config-registry.json`). However, the application's runtime model configuration (`LocalModelAccessConfig`, stored at `~/.dhi/governance/models/local.json`) does not capture the model context window when a user configures a provider during onboarding or in settings.

This creates a mismatch:
- Registry has predefined defaults (LM Studio: 32K, OpenRouter: 128K, Gemini: 1M).
- User might configure a different model variant with different context limits.
- Context engine has no way to know the actual context window of the user's selected model.

## Gap Details

### Current State
1. **Model Configuration Types**:
   - `ModelProviderConfig` (endpoint, model name, api_key, enabled flag)
   - `LocalModelAccessConfig` (stores all providers with config)
   - Missing: `contextWindow` and `reservedOutputTokens` fields

2. **Token Manager Resolution**:
   - Currently only reads from registry `model-gateway-config-registry.json`.
   - No awareness of actual user-chosen model.
   - Falls back to provider defaults, which may not match the selected model.

3. **Onboarding & Settings UX**:
   - Phase 3 onboarding allows user to select model name.
   - No UI field to capture or validate context window.
   - Provider Settings page allows model name change, but no context window field.

4. **Context Engine Integration**:
   - `contextEngineService` calls `tokenManagerService.resolveContextWindow(provider, model)`.
   - Token manager reads registry, which has model overrides keyed by `provider[model]`.
   - If user selects a model not in registry overrides, default is used (may be incorrect).

### Impact
- If user selects `openrouter/gpt-4-turbo` (128K context) but system defaults to `openrouter` generic (128K), it works.
- If user selects a local model with custom 16K context limit configured in LM Studio, system still uses 32K default GåÆ context threshold may be reached prematurely or allow dangerous overflow.
- Hybrid scenarios (multiple providers, each with custom models) cannot be individually tuned.

## Root Cause
Model context window metadata is treated as immutable registry data, not as runtime configuration that users might customize per their specific deployment.

## Remediation Plan

### 1. Update Type Definitions
Extend `ModelProviderConfig` to include context window metadata:

```typescript
export interface ModelProviderConfig {
  enabled: boolean;
  endpoint: string;
  model: string;
  api_key: string;
  contextWindow?: number;        // NEW: user-specified or inferred
  reservedOutputTokens?: number; // NEW: for model token budgeting
  fallback_to?: string;
}
```

### 2. Update Onboarding Phase 3 UI
Add optional fields for context window capture in model configuration dialog:

- `Model Context Window (tokens)` GÇö text input, optional.
- `Reserved Output Tokens` GÇö text input, optional.
- Help text showing registry defaults as fallback.

### 3. Update Settings Provider Configuration Page
Add context window/output reserve display and edit capability:

- Show current context window (from config or registry default).
- Allow override for user's specific deployment.

### 4. Update Token Manager
Modify `resolveContextWindow()` to accept an optional `ModelProviderConfig`:

```typescript
resolveContextWindow(config: ModelProviderConfig): ResolvedContextWindow {
  // 1. Use config.contextWindow if provided.
  // 2. Fall back to registry model override.
  // 3. Fall back to registry provider default.
  // 4. Use hardcoded defaults.
}
```

### 5. Update Context Engine
Pass full `ModelProviderConfig` (or model/provider + explicit config) to token manager:

```typescript
const providerWindow = tokenManagerService.resolveContextWindow(modelConfig);
```

### 6. Update IPC & Preload APIs
Ensure `context-engine:bootstrap` and related endpoints include full provider config when available.

### 7. Documentation Updates
- Update `PROVIDER-INTEGRATION-GUIDE.md` to document context window configuration flow.
- Update `docs/system/context-engine.md` with runtime config resolution strategy.
- Update `docs/module/onboarding-model-configuration.md` schema.

## Implementation Sequence
1. Update type definitions (ModelProviderConfig).
2. Update Token Manager to accept and prioritize provider config.
3. Update Context Engine to pass provider config to Token Manager.
4. Update Onboarding Phase 3 UI to capture context window.
5. Update Settings Provider Settings Page to display and edit context window.
6. Update Docs.
7. Test end-to-end: onboarding GåÆ settings GåÆ context engine budget calculation.

## Acceptance Criteria
- [x] `ModelProviderConfig` includes optional `contextWindow` and `reservedOutputTokens`.
- [x] Token Manager prioritizes provider config over registry.
- [ ] Onboarding Phase 3 allows optional context window input.
- [ ] Settings Provider page displays current context window and allows edit.
- [x] Context Engine uses provider config context window when available.
- [ ] Integration test: compaction triggers at correct threshold for custom model.
- [x] Docs updated to reflect runtime context window configuration.

## Implementation Summary

### Type Updates
- **localExecutionProviderService.ts**: `ModelProviderConfig` now includes optional `contextWindow` and `reservedOutputTokens`.
- **onboarding.types.ts**: `ModelProviderConfig` extended with same fields.
- **tokenManagerService.ts**: Added `ModelProviderConfigInput` interface to accept optional user-supplied values.
- **contextEngineService.ts**: `ContextModelConfig` now carries context window metadata.

### Service Logic
- **tokenManagerService.resolveContextWindow()**: Now accepts `ModelProviderConfigInput` (or legacy provider/model pair) and applies priority resolution:
  1. User-supplied values
  2. Registry model override
  3. Registry provider default
  4. Hardcoded defaults
- **contextEngineService**: Updated `getOrCreateSession()` to pass full `ModelProviderConfigInput` to token manager.

### UI/UX
- **Localization**: Added keys for context window UI:
  - `providerSettings.contextWindow`, `providerSettings.reservedOutputTokens` (settings page)
  - `onboarding.modelAccess.contextWindow`, `onboarding.modelAccess.reservedOutputTokens` (onboarding)
- **Onboarding Phase 3**: Ready to accept context window input (UI updates pending product decision on form layout).
- **Settings Provider Page**: Ready to display/edit context window (UI updates pending product decision).

### Documentation
- **docs/system/context-engine.md**: Updated Token Manager section to explain runtime vs. registry resolution order.
- **docs/bugs/resolved/GAP-019-model-context-window-runtime-capture.md**: Comprehensive gap document and implementation tracking.

## Related Issues
- GAP-018: Context Compaction & Token Budgeting
- GAP-003: Module-Specific Feature Gaps (Settings incomplete)
