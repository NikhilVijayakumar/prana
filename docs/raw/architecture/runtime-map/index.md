# Runtime Map Index
**Purpose:** Connect features → invariants → code implementations

> This map verifies that code implementations comply with the 8 architecture invariants.

---

## Mental Model

| Layer | Equivalent |
|-------|------------|
| `features/` | Product specification |
| `architecture/invariants/` | Constitutional law |
| `runtime-map/` | Service governance contracts |
| `prompts/` | Automated auditors |

---

## All Runtime Maps (19 Total)

### Layer 0: Authentication
| Runtime Map | Feature Doc | Implementation |
|-------------|-------------|----------------|
| [runtime-map-authentication.md](runtime-map-authentication.md) | [auth/authentication.md](../../features/auth/authentication.md) | `authService.ts`, `authStoreService.ts` |

### Layer 1: Bootstrap & Foundation
| Runtime Map | Feature Doc | Implementation |
|-------------|-------------|----------------|
| [runtime-map-startup-orchestrator.md](runtime-map-startup-orchestrator.md) | [boot/startup-orchestrator.md](../../features/boot/startup-orchestrator.md) | `startupOrchestratorService.ts` |
| [runtime-map-notification-centre.md](runtime-map-notification-centre.md) | [notification/notification-centre.md](../../features/notification/notification-centre.md) | `notificationCentreService.ts` |
| [runtime-map-splash.md](runtime-map-splash.md) | [splash/splash-system-initialization.md](../../features/splash/splash-system-initialization.md) | `startupOrchestratorService.ts` |

### Layer 2: Secure Persistence
| Runtime Map | Feature Doc | Implementation |
|-------------|-------------|----------------|
| [runtime-map-sqlite-cache.md](runtime-map-sqlite-cache.md) | [storage/sqlite-cache.md](../../features/storage/sqlite-cache.md) | `sqliteCacheService.ts` |
| [runtime-map-virtual-drive.md](runtime-map-virtual-drive.md) | [storage/virtual-drive.md](../../features/storage/virtual-drive.md) | `driveControllerService.ts` |
| [runtime-map-vault.md](runtime-map-vault.md) | [storage/vault.md](../../features/storage/vault.md) | `vaultService.ts` |
| [runtime-map-data-integrity.md](runtime-map-data-integrity.md) | [storage/data-integrity-protocol.md](../../features/storage/data-integrity-protocol.md) | `vaultService.ts`, `syncEngineService.ts` |
| [runtime-map-vector-search-rag.md](runtime-map-vector-search-rag.md) ⚠️ | [storage/vector-search-rag.md](../../features/storage/vector-search-rag.md) | `vectorSearchService.ts` |

### Layer 3: Data Lifecycle & Sync
| Runtime Map | Feature Doc | Implementation |
|-------------|-------------|----------------|
| [runtime-map-sync-engine.md](runtime-map-sync-engine.md) | [storage/sync-engine.md](../../features/storage/sync-engine.md) | `syncEngineService.ts` |
| [runtime-map-cron.md](runtime-map-cron.md) | [cron/cron.md](../../features/cron/cron.md) | `cronSchedulerService.ts` |

### Layer 4: Intelligence & Integration
| Runtime Map | Feature Doc | Implementation |
|-------------|-------------|----------------|
| [runtime-map-context-engine.md](runtime-map-context-engine.md) | [context/context-engine.md](../../features/context/context-engine.md) | `contextEngineService.ts` |
| [runtime-map-channel-integration.md](runtime-map-channel-integration.md) | [chat/communication.md](../../features/chat/communication.md) | `channelRouterService.ts` |
| [runtime-map-email.md](runtime-map-email.md) | [email/email.md](../../features/email/email.md) | `emailService.ts` |
| [runtime-map-google-ecosystem.md](runtime-map-google-ecosystem.md) | [Integration/google-ecosystem-integration.md](../../features/Integration/google-ecosystem-integration.md) | `googleBridgeService.ts` |
| [runtime-map-queue-scheduling.md](runtime-map-queue-scheduling.md) | [queue-scheduling/queue-scheduling.md](../../features/queue-scheduling/queue-scheduling.md) | `queueOrchestratorService.ts` |

### Governance & Diagnostics
| Runtime Map | Feature Doc | Implementation |
|-------------|-------------|----------------|
| [runtime-map-onboarding.md](runtime-map-onboarding.md) | [Onboarding/onboarding-pipeline-orchestrator.md](../../features/Onboarding/onboarding-pipeline-orchestrator.md) | `onboardingStageStoreService.ts` |
| [runtime-map-vaidyar.md](runtime-map-vaidyar.md) | [vaidyar/vaidyar.md](../../features/vaidyar/vaidyar.md) | `vaidyarService.ts`, `systemHealthService.ts` |
| [runtime-map-visual-identity.md](runtime-map-visual-identity.md) | [visual/visual-identity-engine.md](../../features/visual/visual-identity-engine.md) | `visualIdentityService.ts`, `templateService.ts` |

---

## Analysis Reports

| Report | Content |
|--------|---------|
| [persistence-layer.md](persistence-layer.md) | SQL.js → better-sqlite3 migration (20 services) |
| [services-stateless-compliance.md](services-stateless-compliance.md) | 26 services compliance status |

---

## Verification Status

| Invariant | Compliance Score |
|-----------|-------------------|
| Statelessness | 94/100 (1 P1 violation in vectorSearchService) |
| Determinism | ✅ |
| Replayability | ✅ |
| Composability | ✅ |
| Dependency Direction | ✅ |
| Lifecycle Safety | ✅ |
| Policy Neutrality | ✅ |
| Storage Neutrality | ✅ |

---

## Key Metrics

- **Runtime Maps Created:** 19
- **Services Converted:** 26 (factory pattern)
- **SQLite Stores Migrated:** 20 (sql.js → better-sqlite3)
- **Template Version:** v1.1 (enhanced with compliance analysis)
- **Known Violations:** 1 (vectorSearchService - semanticCache Map)

---

## Phase Summary

| Phase | Layers | Count |
|-------|--------|-------|
| Phase 1 | Layer 1 (Bootstrap) | 2 maps |
| Phase 2 | Layer 2 (Persistence) | 5 maps |
| Phase 3 | Layer 3 (Sync) | 2 maps |
| Phase 4 | Layer 4 (Intelligence) | 5 maps |
| Phase 5 | Governance/Diagnostics | 5 maps |

---

*Last Updated: 2026-05-07*
*Template: v1.1*