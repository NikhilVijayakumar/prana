# Persistence Gaps Audit

## Purpose
Track code paths that still violate or partially violate the target persistence architecture where SQLite is the mandatory runtime read layer and Vault is cold storage.

## Status
Overall: OPEN

## Active Gaps

### PG-001 Direct Runtime Props Still Read In Main Services
Severity: High

Evidence:
- `src/main/services/googleBridgeService.ts`
- `src/main/services/modelGatewayService.ts`
- `src/main/services/skillSystemService.ts`
- `src/main/index.ts`

Impact:
- These services can bypass SQLite-backed runtime reads and keep the app dependent on raw runtime props.

Required fix:
- Route these consumers through `sqliteDataProvider` and local SQLite config snapshot services.

### PG-002 Hot Vault Working-Root Reads Still Exist
Severity: High

Evidence:
- `src/main/services/vaultService.ts`
- `src/main/services/operationsService.ts`
- `src/main/services/administrationIntegrationService.ts`
- `src/main/services/syncProviderService.ts`

Impact:
- Full locked-by-default Vault posture cannot be enforced yet without breaking runtime features.

Required fix:
- Replace runtime reads from vault working directories with SQLite-backed projections and explicit unlock flows.

### PG-003 Runtime Environment Access Still Exists Outside Bootstrap-Only Scope
Severity: Medium

Evidence:
- `src/main/index.ts`
- `src/main/services/governanceRepoService.ts`
- `src/main/services/recoveryService.ts`

Impact:
- Some code still uses process environment directly instead of central SQLite/bootstrap providers.

Required fix:
- Restrict direct environment access to bootstrap/platform runtime only and document exceptions.

### PG-004 Vault Lifecycle Lock Status Is Scaffolded But Not Fully Enforced
Severity: Medium

Evidence:
- `src/main/services/vaultLifecycleManager.ts`
- Current runtime still depends on vault workspace availability.

Impact:
- Lifecycle state is now trackable, but actual relock after startup sync is not universally safe yet.

Required fix:
- Complete SQLite migration for hot-vault consumers, then enforce post-sync relock.

### PG-005 Atomic Sync-Pending Write-Back Needs Explicit Entity-Level Contract
Severity: Medium

Evidence:
- SQLite queue durability exists for sync tasks, but not all domain mutations currently expose explicit `sync_pending` semantics.

Impact:
- Some write-through cache rules remain architectural intent rather than uniformly enforced implementation.

Required fix:
- Add domain-level pending-state persistence rules for policy/agent mutations before Vault commit flows.

## Recent Progress
1. Startup sync now records explicit install-mode, pull, merge, and integrity decisions.
2. Local runtime config SQLite seed scaffolding is now present.
3. A dedicated SQLite data provider abstraction now exists for migration work.

## Exit Criteria
1. No runtime business service reads raw runtime props directly.
2. No standard UI route requires live vault working-root reads.
3. Vault lock/unlock state is both tracked and actually enforced.
4. Pending SQLite changes remain pending whenever Vault commit or push fails.
