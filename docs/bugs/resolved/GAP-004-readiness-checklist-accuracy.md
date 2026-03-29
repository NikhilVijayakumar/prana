# GAP-004: Readiness Checklist Claims All Features COMPLETE ΓÇö Actual Status Contradicts

**Severity**: CRITICAL  
**Category**: Process / Documentation Integrity  
**Date**: 2026-03-19  
**Status**: RESOLVED (Checklist corrected on 2026-03-19)  
**File**: `docs/system/openclaw-feature-readiness-checklist.md`

---

## Summary

This gap has been **resolved**. The readiness checklist at `docs/system/openclaw-feature-readiness-checklist.md` previously marked all 8 OpenClaw extraction features (F1ΓÇôF8) as **COMPLETE** with all gates AΓÇôG set to **PASS**. It has now been corrected to reflect actual status:
- F1 and F2 remain COMPLETE
- F3 through F8 are marked PARTIAL
- Gate D is marked FAIL for F3 through F8
- Gate F and Gate G are marked PARTIAL for F3 through F8

## Gate Definitions (from the checklist)

- **Gate A** ΓÇö Contract: TypeScript interfaces and domain types are finalized.
- **Gate B** ΓÇö Runtime: Main process implementation is complete.
- **Gate C** ΓÇö Bridge: IPC handlers and preload bridge types are complete.
- **Gate D** ΓÇö UX: Renderer repository/viewmodel/view wiring is operational for **production path**.
- **Gate E** ΓÇö Governance: Policy, approval, and safety rules are enforced.
- **Gate F** ΓÇö Verification: Diagnostics/tests pass for touched files and critical flows.
- **Gate G** ΓÇö Docs: Module/system docs updated with behavior and operational notes.

## Assessment Per Feature

### F1 Model Gateway with Fallback Chain ΓÇö Mostly Genuine Γ£ô

**Main process** (`modelGatewayService.ts`) has real provider probing, fallback chain, cooldown logic. This is the most complete feature.

**Gap**: Gate D is questionable ΓÇö the queue monitor renders gateway data but the **settings UI cannot configure** the fallback order, API keys, or model selection (documented in `settings.md` ΓåÆ `EngineSelector`).

### F2 Skill System ΓÇö Mostly Genuine Γ£ô

**Main process** (`skillSystemService.ts`) has real skill discovery, eligibility checks. IPC bridge exposes list/execute.

**Gap**: Gate D ΓÇö the suites view uses skill data but the **Executive Suites doesn't have per-agent workspace tabs** that execute skills per agent as documented.

### F3 Context Engine ΓÇö Main Process OK, Gate D Inflated

**Main process** (`contextEngineService.ts`) has session bootstrap, ingest, assemble, compact, token budgets. Tests pass.

**Gap**: Gate D claims "Wire queue monitor and executive suites to context usage metrics" but:
- Queue monitor shows context telemetry (aggregates) ΓÇö Γ£ô partial
- **Executive suites don't show any per-session context usage** ΓÇö the suites view is a generic agent grid, not workspace tabs with context metrics
- **No production path uses context engine** ΓÇö no real agent sessions consume the context lifecycle; only the `ensureDemoSubagents()` seed data touches it

### F4 Subagent System ΓÇö Main Process OK, Gate D Inflated

**Main process** (`subagentService.ts`) has spawn, lifecycle, depth limiting, timeout sweep. Tests pass.

**Gap**: Gate D claims "Render active subagent tree and lifecycle in queue monitor" but:
- The subagent tree rendered in queue monitor is **seeded demo data** (`ensureDemoSubagents()`)
- **No real multi-agent workflow triggers subagent spawning** ΓÇö AryaΓåÆJuliaΓåÆEva delegation chain documented in `executive-suites.md` doesn't exist
- The queue monitor view **may or may not** render the tree data since the view is a single flat component (not the documented `QueueSlotGrid` + `PipelineTracker`)

### F5 Tool Policy & Approval ΓÇö Main Process OK, Gate D Partial

**Main process** (`toolPolicyService.ts`) has ALLOW/DENY/REQUIRE_APPROVAL decisions. Policy matrix covers vault.publish, subagents.spawn, vault.knowledge.*, skills.execute, and loop detection.

**Gap**: 
- Gate D ΓÇö policy telemetry shows in queue monitor, but **governance lab doesn't show policy visibility for approval reasons and blocked actions** as documented
- The generic tool policy pipeline is only triggered from IPC endpoints, not from actual agent tool calls (since no real agent runtime exists)

### F6 Hooks & Lifecycle Events ΓÇö Main Process OK, Gate D Inflated

**Main process** (`hookSystemService.ts`) has event catalog, ordered execution, retry/timeout, telemetry. Config in `hooks.json`.

**Gap**: Gate D claims "Integrate notification center and vault triggers with real hook outputs" but:
- Notification centre merges hook notifications into its feed ΓÇö Γ£ô partial
- **No hook actually does anything meaningful** ΓÇö the 7 registered hooks are event reactions with no real subscriber logic (no Telegram broadcast, no actual daily brief trigger, no scheduled task execution)
- Gate G ΓÇö the hooks event catalog is defined but **no module doc was updated** to reference the hook system

### F7 Cron Scheduler ΓÇö Main Process OK, Gate D Partial

**Main process** (`cronSchedulerService.ts`) has register/upsert, list, pause, resume, run-now, tick, telemetry.

**Gap**: Gate D claims "Integrate settings UI and daily/weekly modules with runtime schedules" but:
- **Daily brief doesn't auto-execute at 8AM** ΓÇö the cron can be configured but no actual Mira compilation runs
- **Weekly review doesn't auto-execute on Friday** ΓÇö same issue
- Settings scheduler management may exist but the **settings view is a flat component** with no documented `EngineSelector` or scheduler management panels

### F8 Memory System ΓÇö Main Process OK, Gate D Partial  

**Main process** (`memoryIndexService.ts`, `memoryQueryService.ts`) has local chunk indexing, deterministic embeddings, blended search.

**Gap**: Gate D claims "Integrate vault knowledge and triage search UX with real queries" but:
- Triage repo calls `memory.query` via IPC ΓÇö Γ£ô exists
- Vault knowledge repo calls memory APIs ΓÇö Γ£ô exists
- However: the **embedding vectors are deterministic hashes**, not real semantic embeddings from an embedding model (no Ollama, no LM Studio embedding integration)
- Search quality is keyword-based with synthetic scores, not actual semantic similarity

## Systemic Issue: Gate D Inflation

The fundamental problem is that **Gate D (UX: Renderer wiring operational for production path)** has been passed for all features despite the renderer consisting of minimal scaffolding. The readiness checklist's "evidence anchors" point to the correct files, but the files themselves are thin wrappers calling IPC endpoints and rendering flat displays ΓÇö not the production-quality UX described in the module specifications.

**Gate D should be re-evaluated as PARTIAL or FAIL for F3ΓÇôF8** because:
1. No renderer module implements the documented specialized components
2. Most data flows through `operationsService.ts` mock aggregation
3. No real agent workflow exercises these features end-to-end

## Resolution Applied

1. Gate D evaluations were re-assessed against documented module requirements.
2. Gate F and Gate G were downgraded to PARTIAL where evidence is incomplete.
3. The readiness checklist snapshot was updated to honest status (F3-F8 PARTIAL).
4. Feature sections now include explicit status banners and detailed gate-level explanations.

## Residual Risk

The process/documentation integrity issue is fixed, but implementation gaps in GAP-001, GAP-002, GAP-003, and GAP-005 remain open.
