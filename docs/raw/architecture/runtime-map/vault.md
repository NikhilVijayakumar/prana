# Runtime Map: Vault

## Metadata
| Field | Value |
|-------|-------|
| Feature | Vault |
| Feature Doc | `../../features/vault/index.ts` |
| Implementation | `src/main/features/vault/` |
| Layer | 2: Secure Persistence |
| Status | Compliant |
| Last Generated | 2026-05-23 |
| Last Updated | 2026-05-23 |
| Last Reviewed | 2026-05-23 |

## Responsibility

- **Statelessness**: Vault service itself is stateless; file operations are delegated to filesystem and virtual drive provider
- **Determinism**: File encryption/decryption is deterministic for identical keys and content
- **Replayability**: Vault operations are logged; lifecycle manager tracks state transitions
- **Composability**: Vault composes with Sync (state reconciliation), Governance (hooks, audit), Context (memory index)
- **Dependency Direction**: Vault depends on Governance and Sync; no reverse dependencies
- **Lifecycle Safety**: Vault lifecycle manager handles enrollment, archive, restore, and purge
- **Policy Neutrality**: No hardcoded vault policies; encryption parameters are configurable
- **Storage Neutrality**: Uses virtualDriveProvider and driveControllerService abstractions

## Runtime Classification

| Dimension | Classification |
|-----------|---------------|
| Lifecycle | Singleton |
| Statefulness | Stateless |
| Isolation | Process |
| Scheduling | On-Demand |
| Fault Tolerance | Retry |
| Scaling | None |

## Dependencies

| Dependency | Type | Direction | Criticality |
|------------|------|-----------|-------------|
| driveControllerService | Internal | Outbound | Critical |
| vaultMetadataService | Internal | Outbound | High |
| vaultRegistryService | Internal | Outbound | High |
| virtualDriveProvider | Internal | Outbound | Critical |
| governanceRepoService | Internal | Outbound | High |
| syncStoreService | Internal | Outbound | Medium |
| hookSystemService | Internal | Outbound | Medium |
| memoryIndexService | Internal | Outbound | Low |

## Compliance Checklist

- [x] Stateless by design (no in-memory mutable state between requests)
- [x] Deterministic output for same inputs
- [x] Replay-safe operations
- [x] Composable with other services
- [x] Respects dependency direction (no cycles)
- [x] Lifecycle-aware (startup/shutdown hooks)
- [x] Policy-neutral (no hardcoded policies)
- [ ] Storage-neutral (abstracted persistence)
