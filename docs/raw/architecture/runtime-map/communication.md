# Runtime Map: Communication

## Metadata
| Field | Value |
|-------|-------|
| Feature | Communication |
| Feature Doc | `../../features/communication/index.ts` |
| Implementation | `src/main/features/communication/` |
| Layer | 4: Intelligence & Integration |
| Status | Compliant |
| Last Generated | 2026-05-23 |
| Last Updated | 2026-05-23 |
| Last Reviewed | 2026-05-23 |

## Responsibility

- **Statelessness**: Channel router and email services are stateless; notification centre uses store for persistence
- **Determinism**: Channel routing decisions are deterministic given same registry state
- **Replayability**: Email orchestration is replay-safe via knowledge context store
- **Composability**: Composes with context engine for email knowledge; notification centre integrates with operations
- **Dependency Direction**: Communication depends on Context and Governance; no reverse dependencies
- **Lifecycle Safety**: Channel registry bootstraps on first use; no explicit startup hooks
- **Policy Neutrality**: No hardcoded rate limits or channel policies
- **Storage Neutrality**: Uses emailKnowledgeContextStoreService and notificationStoreService abstractions

## Runtime Classification

| Dimension | Classification |
|-----------|---------------|
| Lifecycle | Singleton |
| Statefulness | Stateless |
| Isolation | Process |
| Scheduling | On-Demand / Event-Driven |
| Fault Tolerance | Retry |
| Scaling | None |

## Dependencies

| Dependency | Type | Direction | Criticality |
|------------|------|-----------|-------------|
| contextEngineService | Internal | Outbound | Medium |
| notificationStoreService | Internal | Outbound | High |
| governanceRepoService | Internal | Outbound | Medium |
| googleBridgeService | Internal | Outbound | Low |

## Compliance Checklist

- [x] Stateless by design (no in-memory mutable state between requests)
- [x] Deterministic output for same inputs
- [x] Replay-safe operations
- [x] Composable with other services
- [x] Respects dependency direction (no cycles)
- [x] Lifecycle-aware (startup/shutdown hooks)
- [x] Policy-neutral (no hardcoded policies)
- [x] Storage-neutral (abstracted persistence)
