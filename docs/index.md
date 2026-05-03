# Prana — Documentation Index

## Navigation Guide

**Task-based quick reference:**
- **Add runtime service** → src/main/services/
- **Add UI component** → src/ui/common/components/
- **Add feature doc** → docs/features/
- **Update storage contract** → docs/features/storage/governance/
- **Update top-level docs index** → scripts/wiki-steps.json then node scripts/generate-index.cjs
- **Add screen** → src/ui/[screen-family]/
- **Build/config** → package.json, electron.vite.config.ts

**For detailed docs:** See Feature Details section below.

## Global Constants

| Key | Value |
|-----|------|
| Name | prana |
| Version | 1.2.4 |
| License | N/A |

## High-Level Vision

Prana is an Electron desktop runtime library providing orchestration, persistence, context management, security, and UI infrastructure for intelligent agent-driven applications.

## Dependency Stack

| Library | Version |
|---------|---------|
| @electron-toolkit/utils | ^4.0.0 |
| @emotion/react | 11.14.0 |
| @emotion/styled | 11.14.1 |
| @mui/icons-material | 7.3.10 |
| @mui/material | 7.3.10 |
| @whiskeysockets/baileys | ^7.0.0-rc.9 |
| @xenova/transformers | ^2.17.2 |
| agentmail | ^0.5.0 |
| astra | github:NikhilVijayakumar/astra |
| bcryptjs | ^3.0.3 |
| better-sqlite3 | ^12.9.0 |
| cron-parser | ^5.5.0 |
| dompurify | ^3.3.3 |
| drizzle-orm | ^0.45.2 |
| html-to-docx | ^1.8.0 |
| isomorphic-dompurify | ^3.8.0 |
| js-tiktoken | ^1.0.21 |
| mammoth | ^1.12.0 |
| marked | ^17.0.5 |
| react-router-dom | ^7.13.1 |
| sharp | ^0.34.5 |
| sql.js | ^1.14.1 |
| turndown | ^7.2.2 |
| zod | ^4.3.6 |

## System Map

```
├── main
│   ├── config
│   │   ├── hooks.json
│   ├── index.ts
│   ├── preload.ts
│   ├── services
│   │   ├── adapters
│   │   ├── administrationIntegrationService.test.ts
│   │   ├── administrationIntegrationService.ts
│   │   ├── agentBaseProtocol.ts
│   │   ├── agentExecutionService.ts
│   │   ├── agentRegistryService.ts
│   │   ├── agents
│   │   ├── auditLogService.test.ts
│   │   ├── auditLogService.ts
│   │   ├── authService.test.ts
│   │   ├── authService.ts
│   │   ├── authStoreService.ts
│   │   ├── businessAlignmentService.ts
│   │   ├── businessContextRegistryService.ts
│   │   ├── businessContextStoreService.ts
│   │   ├── businessContextValidationService.ts
│   │   ├── channelRegistryService.ts
│   │   ├── channelRouterService.test.ts
│   │   ├── channelRouterService.ts
│   │   ├── commandRouterService.test.ts
│   │   ├── commandRouterService.ts
│   │   ├── complianceScanService.test.ts
│   │   ├── complianceScanService.ts
│   │   ├── conflictResolver.ts
│   │   ├── contextDigestStoreService.ts
│   │   ├── contextEngineService.test.ts
│   │   ├── contextEngineService.ts
│   │   ├── contextOptimizerService.ts
│   │   ├── conversationStoreService.ts
│   │   ├── coreRegistryService.ts
│   │   ├── cronSchedulerService.test.ts
│   │   ├── cronSchedulerService.ts
│   │   ├── dailyBriefCompilerService.test.ts
│   │   ├── dailyBriefCompilerService.ts
│   │   ├── dataFilterService.ts
│   │   ├── diffEngine.ts
│   │   ├── documentConversionService.test.ts
│   │   ├── documentConversionService.ts
│   │   ├── driveControllerService.test.ts
│   │   ├── driveControllerService.ts
│   │   ├── emailBrowserAgentService.ts
│   │   ├── emailImapService.ts
│   │   ├── emailKnowledgeContextStoreService.ts
│   │   ├── emailOrchestratorService.ts
│   │   ├── emailService.ts
│   │   ├── envService.ts
│   │   ├── feedbackSentimentService.test.ts
│   │   ├── feedbackSentimentService.ts
│   │   ├── fundingDigestService.test.ts
│   │   ├── fundingDigestService.ts
│   │   ├── googleBridgeService.test.ts
│   │   ├── googleBridgeService.ts
│   │   ├── googleOAuthServer.ts
│   │   ├── googleSheetsCacheService.ts
│   │   ├── governanceLifecycleQueueStoreService.test.ts
│   │   ├── governanceLifecycleQueueStoreService.ts
│   │   ├── governanceRepoService.ts
│   │   ├── hiringSimService.test.ts
│   │   ├── hiringSimService.ts
│   │   ├── hookSystemService.test.ts
│   │   ├── hookSystemService.ts
│   │   ├── hostDependencyCapabilityService.ts
│   │   ├── ipcService.ts
│   │   ├── localExecutionProviderService.ts
│   │   ├── loopProtectionService.ts
│   │   ├── meetingNoteActionItemService.test.ts
│   │   ├── meetingNoteActionItemService.ts
│   │   ├── memoryIndexService.test.ts
│   │   ├── memoryIndexService.ts
│   │   ├── memoryQueryService.test.ts
│   │   ├── memoryQueryService.ts
│   │   ├── modelGatewayService.ts
│   │   ├── mountRegistryService.ts
│   │   ├── notificationCentreService.ts
│   │   ├── notificationRateLimiterService.ts
│   │   ├── notificationStoreService.ts
│   │   ├── notificationValidationService.ts
│   │   ├── onboardingStageStoreService.ts
│   │   ├── operationsService.pack1.test.ts
│   │   ├── operationsService.pack2.test.ts
│   │   ├── operationsService.pack3.test.ts
│   │   ├── operationsService.pack4.test.ts
│   │   ├── operationsService.pack5.test.ts
│   │   ├── operationsService.ts
│   │   ├── orchestrationManager.ts
│   │   ├── pdfGeneratorService.ts
│   │   ├── piiRedactionService.ts
│   │   ├── policyOrchestratorService.test.ts
│   │   ├── policyOrchestratorService.ts
│   │   ├── pranaPlatformRuntime.ts
│   │   ├── pranaRuntimeConfig.ts
│   │   ├── processService.ts
│   │   ├── protocolInterceptor.ts
│   │   ├── queueOrchestratorService.ts
│   │   ├── queueService.test.ts
│   │   ├── queueService.ts
│   │   ├── ragOrchestratorService.ts
│   │   ├── recoveryOrchestratorService.ts
│   │   ├── recoveryService.ts
│   │   ├── registryRuntimeService.ts
│   │   ├── registryRuntimeStoreService.ts
│   │   ├── runtimeConfigService.test.ts
│   │   ├── runtimeConfigService.ts
│   │   ├── runtimeDocumentStoreService.ts
│   │   ├── runtimeModelAccessService.test.ts
│   │   ├── runtimeModelAccessService.ts
│   │   ├── skillRegistry.ts
│   │   ├── skillSystemService.ts
│   │   ├── sqliteCacheService.test.ts
│   │   ├── sqliteCacheService.ts
│   │   ├── sqliteConfigStoreService.ts
│   │   ├── sqliteCryptoUtil.ts
│   │   ├── sqliteDataProvider.ts
│   │   ├── startupOrchestratorService.test.ts
│   │   ├── startupOrchestratorService.ts
│   │   ├── subagentService.test.ts
│   │   ├── subagentService.ts
│   │   ├── summarizationAgentService.ts
│   │   ├── syncEngineService.ts
│   │   ├── syncProviderService.test.ts
│   │   ├── syncProviderService.ts
│   │   ├── syncStoreService.ts
│   │   ├── systemHealthService.test.ts
│   │   ├── systemHealthService.ts
│   │   ├── taskRegistryService.ts
│   │   ├── templateService.ts
│   │   ├── tokenManagerService.ts
│   │   ├── toolPolicyService.test.ts
│   │   ├── toolPolicyService.ts
│   │   ├── transactionCoordinator.ts
│   │   ├── types
│   │   ├── vaidyarService.test.ts
│   │   ├── vaidyarService.ts
│   │   ├── vaultLifecycleManager.ts
│   │   ├── vaultMetadataService.ts
│   │   ├── vaultRegistryService.ts
│   │   ├── vaultService.ts
│   │   ├── vectorSearchService.ts
│   │   ├── virtualDriveProvider.ts
│   │   ├── visualAuditService.test.ts
│   │   ├── visualAuditService.ts
│   │   ├── visualIdentityService.ts
│   │   ├── wave1Agents.test.ts
│   │   ├── wave2Agents.test.ts
│   │   ├── wave3Agents.test.ts
│   │   ├── weeklyReviewCompilerService.test.ts
│   │   ├── weeklyReviewCompilerService.ts
│   │   ├── workOrderFlow.test.ts
│   │   ├── workOrderService.ts
│   ├── types
│   │   ├── email.types.ts
│   ├── utils
│   │   ├── network
│   ├── workers
│   │   ├── email_imap_worker.py
├── services
│   ├── ipcResponseFactory.ts
│   ├── ThemeManagerService.ts
│   ├── WorkspaceRendererService.ts
├── ui
│   ├── authentication
│   │   ├── domain
│   │   ├── repo
│   │   ├── state
│   │   ├── view
│   │   ├── viewmodel
│   ├── common
│   │   ├── components
│   │   ├── errors
│   │   ├── PranaErrorBoundary.tsx
│   │   ├── pranaErrorRenderer.ts
│   │   ├── PranaFullPageError.tsx
│   │   ├── PranaModuleErrorBoundary.tsx
│   │   ├── PranaModuleErrorView.tsx
│   ├── components
│   │   ├── AuthGuard.tsx
│   │   ├── AuthGuardAdapter.tsx
│   │   ├── ContextCompactionIndicator.tsx
│   │   ├── ContextDigestReviewPanel.tsx
│   │   ├── ContextEngineDebugPanel.tsx
│   │   ├── ContextSessionRolloverPreview.tsx
│   │   ├── DirectorInteractionBar.tsx
│   │   ├── DynamicProfileRenderer.tsx
│   ├── constants
│   │   ├── employeeDirectory.ts
│   │   ├── manifestBridge.ts
│   │   ├── moduleRegistry.ts
│   │   ├── pranaConfig.test.ts
│   │   ├── pranaConfig.ts
│   │   ├── storageKeys.ts
│   ├── context
│   │   ├── NotificationContext.tsx
│   │   ├── ToastContext.tsx
│   ├── env.d.ts
│   ├── forgot-password
│   │   ├── view
│   ├── hooks
│   │   ├── useOnboardingActionGate.ts
│   │   ├── useToast.ts
│   ├── infrastructure
│   │   ├── cron-management
│   │   ├── repo
│   │   ├── view
│   │   ├── viewmodel
│   ├── infrastructure-layers
│   │   ├── view
│   ├── integration
│   │   ├── view
│   ├── layout
│   │   ├── MainLayout.tsx
│   │   ├── NotificationLayout.tsx
│   │   ├── PreAuthLayout.tsx
│   │   ├── PreAuthLayoutAdapter.tsx
│   ├── login
│   │   ├── view
│   ├── main.tsx
│   ├── mui.d.ts
│   ├── onboarding
│   │   ├── domain
│   │   ├── presentation
│   │   ├── repo
│   │   ├── view
│   │   ├── viewmodel
│   ├── onboarding-channel-configuration
│   │   ├── view
│   ├── onboarding-model-configuration
│   │   ├── view
│   ├── onboarding-registry-approval
│   │   ├── view
│   ├── repo
│   │   ├── api.ts
│   │   ├── modelGateway.ts
│   │   ├── skills.ts
│   ├── reset-password
│   │   ├── view
│   ├── shared-components
│   │   ├── notifications
│   ├── splash
│   │   ├── view
│   │   ├── viewmodel
│   ├── splash-system-initialization
│   │   ├── view
│   ├── state
│   │   ├── LifecycleProvider.tsx
│   │   ├── volatileSessionStore.ts
│   ├── vault
│   │   ├── repo
│   │   ├── view
│   │   ├── viewmodel
│   ├── vault-folder-structure
│   │   ├── view
│   ├── vault-knowledge
│   │   ├── repo
│   │   ├── view
│   │   ├── viewmodel
│   ├── vault-knowledge-repository
│   │   ├── view
│   ├── viewer-markdown
│   │   ├── view
│   ├── viewer-pdf
│   │   ├── view

```

## Feature Details

### Core Storage Contracts

- **Virtual Drive** ([docs/features/storage/virtual-drive.md](docs/features/storage/virtual-drive.md))
  - Services: driveControllerService, mountRegistryService, virtualDriveProvider
- **Vault** ([docs/features/storage/vault.md](docs/features/storage/vault.md))
  - Services: vaultService, vaultLifecycleManager, vaultRegistryService
- **SQLite Cache** ([docs/features/storage/sqlite-cache.md](docs/features/storage/sqlite-cache.md))
  - Services: runtimeDocumentStoreService, sqliteConfigStoreService, sqliteCryptoUtil
- **Data Integrity** ([docs/features/storage/data-integrity-protocol.md](docs/features/storage/data-integrity-protocol.md))
  - Services: dataFilterService
- **Sync Engine** ([docs/features/storage/sync-engine.md](docs/features/storage/sync-engine.md))
  - Services: syncEngineService, syncProviderService, syncStoreService, conflictResolver
- **Storage Governance** ([docs/features/storage/governance/index.md](docs/features/storage/governance/index.md))
  - Services: governanceRepoService

### Runtime Systems

- **Startup** ([docs/features/boot/startup-orchestrator.md](docs/features/boot/startup-orchestrator.md))
  - Services: startupOrchestratorService, hostDependencyCapabilityService, runtimeConfigService
- **Cron** ([docs/features/cron/cron.md](docs/features/cron/cron.md))
  - Services: cronSchedulerService, queueService
- **Queue Scheduling** ([docs/features/queue-scheduling/queue-scheduling.md](docs/features/queue-scheduling/queue-scheduling.md))
  - Services: queueOrchestratorService, taskRegistryService
- **Context Engine** ([docs/features/context/context-engine.md](docs/features/context/context-engine.md))
  - Services: contextEngineService, contextOptimizerService, contextDigestStoreService
- **Authentication** ([docs/features/auth/authentication.md](docs/features/auth/authentication.md))
  - Services: authService, authStoreService
- **Splash** ([docs/features/splash/splash-system-initialization.md](docs/features/splash/splash-system-initialization.md))
  - Services: ipcService, envService

### Onboarding & Registry

- **Pipeline** ([docs/features/Onboarding/onboarding-pipeline-orchestrator.md](docs/features/Onboarding/onboarding-pipeline-orchestrator.md))
  - Services: businessContextRegistryService, businessAlignmentService
- **Model Config** ([docs/features/Onboarding/onboarding-model-configuration.md](docs/features/Onboarding/onboarding-model-configuration.md))
  - Services: runtimeModelAccessService
- **Channel Config** ([docs/features/Onboarding/onboarding-channel-configuration.md](docs/features/Onboarding/onboarding-channel-configuration.md))
  - Services: channelRegistryService
- **Registry Approval** ([docs/features/Onboarding/onboarding-registry-approval.md](docs/features/Onboarding/onboarding-registry-approval.md))
  - Services: businessContextValidationService

### Integrations

- **Email** ([docs/features/email/email.md](docs/features/email/email.md))
  - Services: emailOrchestratorService, emailImapService, emailBrowserAgentService
- **Channel Router** ([docs/features/chat/communication.md](docs/features/chat/communication.md))
  - Services: channelRouterService, orchestrationManager
- **Google** ([docs/features/Integration/google-ecosystem-integration.md](docs/features/Integration/google-ecosystem-integration.md))
  - Services: googleBridgeService, googleOAuthServer
- **PDF Viewer** ([docs/features/Integration/viewer-pdf-screen.md](docs/features/Integration/viewer-pdf-screen.md))
  - Services: pdfGeneratorService
- **Markdown Viewer** ([docs/features/Integration/viewer-markdown-screen.md](docs/features/Integration/viewer-markdown-screen.md))
  - Services: documentConversionService

### Diagnostics & Audit

- **Vaidyar** ([docs/features/vaidyar/vaidyar.md](docs/features/vaidyar/vaidyar.md))
  - Services: vaidyarService, systemHealthService, auditLogService
- **Notifications** ([docs/features/notification/notification-centre.md](docs/features/notification/notification-centre.md))
  - Services: notificationCentreService, hookSystemService, notificationStoreService
- **Visual Audit** ([docs/features/visual/visual-identity-engine.md](docs/features/visual/visual-identity-engine.md))
  - Services: visualIdentityService, visualAuditService


## Concept Mapping

| Concept | Implementation | Location |
|--------|---------------|----------|
| Startup Orchestrator | startupOrchestratorService | src/main/services/startupOrchestratorService.ts |
| Host Dependency Capability | hostDependencyCapabilityService | src/main/services/hostDependencyCapabilityService.ts |
| Virtual Drive | driveControllerService | src/main/services/driveControllerService.ts |
| Vault | vaultService | src/main/services/vaultService.ts |
| SQLite Cache | sqliteConfigStoreService | src/main/services/sqliteConfigStoreService.ts |
| Context Engine | contextEngineService | src/main/services/contextEngineService.ts |
| Sync Engine | syncEngineService | src/main/services/syncEngineService.ts |
| Cron Scheduler | cronSchedulerService | src/main/services/cronSchedulerService.ts |
| Queue Orchestrator | queueOrchestratorService | src/main/services/queueOrchestratorService.ts |
| Vaidyar (Health) | vaidyarService | src/main/services/vaidyarService.ts |
| Email | emailOrchestratorService | src/main/services/emailOrchestratorService.ts |
| Channel Router | channelRouterService | src/main/services/channelRouterService.ts |
| Notifications | notificationCentreService | src/main/services/notificationCentreService.ts |
| Runtime Config | runtimeConfigService | src/main/services/runtimeConfigService.ts |
| UI Components | Astra | src/ui/common/components/ |

## Edit Map

| Task | Location |
|------|---------|
| Add runtime service | src/main/services/ |
| Add UI component | src/ui/common/components/ |
| Add feature doc | docs/features/ |
| Update storage contract | docs/features/storage/governance/ |
| Add screen | src/ui/[screen-family]/ |

## Critical Flows

### Add runtime service
Create docs/features/[feature].md → Define service contract → Implement in src/main/services/ → Add IPC handler in preload.ts → Update scripts/wiki-steps.json if mappings changed → Run node scripts/generate-index.cjs

### Add UI screen
Create docs/features/splash/[screen].md → Create Container → ViewModel → View → Export in src/ui/common/components/index.ts → Update scripts/wiki-steps.json if mappings changed → Run node scripts/generate-index.cjs

### Add feature doc
Create docs/features/[domain]/[feature].md → Add to wiki-steps.json conceptMap → Run generate:index

## Documentation Manifest

- **audit/compliance-report.md** → Prana-Dharma Architectural Compliance Report Role : Principal Systems Architect & Lead Security Auditor
- **core/hooks.md** → Hooks Documentation useDataState
- **core/localization.md** → Localization (i18n) Astra provides a lightweight, Context-based localization solution. It is designed to be simple and fully typed, allowing instant switching of languages and mana
- **core/mvvm-clean-architecture.md** → MVVM Clean Architecture Guide This guide provides step-by-step instructions for implementing the Model-View-ViewModel (MVVM) Clean Architecture in your application using the astra 
- **core/repository-layer.md** → Repository & API Layer The repository layer abstracts all network interactions, ensuring consistent error handling and response formatting across the application. It is built on to
- **core/state.md** → State Management Documentation AppState
- **core/theming.md** → Theming, UI & Tokens (Drishti Architecture) Astra leverages Material UI (MUI) for its component library, augmented by a strictly enforced custom token system. It provides a robust 
- **features/audit/v1.2/communication-audit-report.md** → Communication Feature Audit Report Audit Scope
- **features/audit/v1.2/cron-audit-report.md** → Cron Feature Audit Report Audit Scope
- **features/audit/v1.2/email-audit-report.md** → Email Feature Audit Report Audit Scope
- **features/audit/v1.2/index.md** → v1.2 Feature Audit Reports Milestone: v1.2 — Feature Auditing & Security Hardening
- **features/audit/v1.2/Integration-audit-report.md** → Integration Feature Audit Report Audit Scope
- **features/audit/v1.2/notification-audit-report.md** → Notification Feature Audit Report Audit Scope
- **features/audit/v1.2/Onboarding-audit-report.md** → Onboarding Feature Audit Report Audit Scope
- **features/audit/v1.2/queue-scheduling-audit-report.md** → Queue & Scheduling Feature Audit Report Audit Scope
- **features/audit/v1.2/splash-audit-report.md** → Splash Feature Audit Report Audit Scope
- **features/audit/v1.2/storage-audit-report.md** → Storage Feature Audit Report Audit Scope
- **features/audit/v1.2/vaidyar-audit-report.md** → Vaidyar Feature Audit Report Audit Scope
- **features/audit/v1.2/visual-audit-report.md** → Visual Feature Audit Report Audit Scope
- **features/auth/authentication.md** → Feature: Authentication Stack — Local Identity & Access (Enhanced) Status: Stable
- **features/boot/startup-orchestrator.md** → This is already a strong core module. The enhancement below focuses on tightening determinism, clarifying cross-module contracts, formalizing invariants, and exposing hidden failur
- **features/chat/communication.md** → Feature: Agent Communication & Channel Orchestration Status: Alpha / In-Development
- **features/context/context-engine.md** → Here is your enhanced, production-grade specification of the Cognitive Memory & Context Engine . This version deepens the architectural clarity, formalizes lifecycle behavior, alig
- **features/cron/cron.md** → ⏱️ Feature: Job Orchestration & Cron Scheduler (Enhanced) Status: Beta
- **features/email/email.md** → Feature: Email Intelligence & Orchestration Pipeline (Enhanced) Status: Stable / Hardened (v1.3)
- **features/index.md** → Prana Atomic Documentation Index Version: 1.2.0 Principle: One runtime responsibility, one reason to change.
- **features/Integration/google-ecosystem-integration.md** → Feature: Google Ecosystem Integration — Workspace Bridge (Enhanced) Status: Stable / Production
- **features/Integration/viewer-markdown-screen.md** → ️ Feature: Markdown Viewer Screen (Enhanced) Status: Stable
- **features/Integration/viewer-pdf-screen.md** → ️ Feature: PDF Viewer Screen (Final Hardened) Status: Stable
- **features/notification/notification-centre.md** → Feature: Event Registry & Notification Centre (Enhanced) Version: 1.2.0
- **features/Onboarding/onboarding-channel-configuration.md** → This module is critical—it defines how your runtime interfaces with the outside world . The enhancement below formalizes it into a deterministic communication contract layer , ensu
- **features/Onboarding/onboarding-hybrid-explorer-governance-lifecycle.md** → This is strong, system-level documentation—already very close to production-grade. I’ll enhance the last module (“Hybrid Explorer Governance Lifecycle”) in the same format and dept
- **features/Onboarding/onboarding-model-configuration.md** → Feature: Onboarding — Model & Context Configuration (Enhanced) Version: 1.2.0
- **features/Onboarding/onboarding-pipeline-orchestrator.md** → Feature: Onboarding Pipeline Orchestrator (Enhanced) Version: 1.2.0
- **features/Onboarding/onboarding-registry-approval.md** → This module is already conceptually strong—it sits at a critical semantic boundary before your graph-based governance kicks in. The enhancement below focuses on: Formalizing valida
- **features/queue-scheduling/queue-scheduling.md** → Feature: Task Scheduler & Universal Queue System Version: 1.3.0
- **features/splash/splash-system-initialization.md** → This module is already structurally aligned with your Startup Orchestrator , but it can be elevated into a first-class deterministic UX boundary between system state and user perce
- **features/storage/data-integrity-protocol.md** → Feature: Data Security & Sync Protocol Version: 1.3.0
- **features/storage/governance/cache/prana.md** → Cache Storage Contract: Prana Scope
- **features/storage/governance/index.md** → Storage Contract Index Purpose
- **features/storage/governance/rule.md** → Storage Rules Purpose
- **features/storage/governance/vault/prana.md** → Vault Storage Contract: Prana Scope
- **features/storage/sqlite-cache.md** → SQLite Cache — Stateless ORM Caching Layer Version: 2.0.0
- **features/storage/sync-engine.md** → This is already a high-quality core module —arguably the most important in your system. The enhancement below pushes it to production-grade rigor by tightening: deterministic guara
- **features/storage/vault.md** → Feature: Global Vault Registry & Metadata Protocol Version: 1.5.0
- **features/storage/vector-search-rag.md** → Vector Search & RAG — Enhanced
- **features/storage/virtual-drive.md** → Feature: Virtual Drive — Storage Abstraction Layer Version: 1.3.0
- **features/vaidyar/vaidyar.md** → Feature: Vaidyar — Runtime Integrity Engine & Dashboard Version: 1.3.0
- **features/visual/visual-identity-engine.md** → Feature: Visual Identity Engine — Design & Asset Orchestration (Enhanced) Status: Proposed / Integration
- **index.md** → Prana — Documentation Index Navigation Guide
- **integration_guide/library-integration-guide.md** → Prana Library Integration Guide (Client App Edition) This document is for client applications that integrate Prana as a runtime library.
- **pr/astra/request/01-Atomic-Elements.md** → 01 Atomic Elements > Historical request snapshot (2026-03-28).
- **pr/astra/request/02-Molecular-Layouts.md** → 02 Molecular Layouts Goal
- **pr/astra/request/03-Organism-Complex-UI.md** → 03 Organism Complex UI > Historical request snapshot (2026-03-28).
- **pr/astra/request/Component-Inventory.md** → Component Inventory (Prana -> Astra) > Historical request snapshot (2026-03-28).
- **pr/astra/request/Handover-Contract.md** → Handover Contract (Prana -> Astra) Purpose
- **pr/astra/request/Mapping-Template.md** → Prana -> Astra Mapping Template Fill one row per candidate returned by Astra.
- **pr/astra/response/HANDOVER_CONTRACT.md** → Prana <- Astra Handover Contract (Response) Date: 2026-03-28
- **pr/astra/response/INDEX.md** → Prana Response Index Delivered: 2026-03-28
- **pr/astra/response/INTEGRATION_SUMMARY.md** → Prana Response Integration Summary Generated: 2026-03-28
- **pr/astra/response/Mapping-Prana.md** → Prana -> Astra Mapping (Response) Status: Completed
- **pr/astra/response/plan.md** → Astra Plan and Deep Analysis (Prana Request) Date: 2026-03-28
- **pr/astra/response/README.md** → Prana <- Astra PR Response Status: Ready for Prana consumption
- **pr/chakra/client-configurable-sqlite-root-path.md** → Prana PR: Client-Configurable SQLite Root Path Status: Implemented — sqliteRoot field in PranaRuntimeConfig; all store services use mkdirSafe via getSqliteRoot()
- **pr/chakra/drive-decoupling-client-owned-policy-proposal.md** → PR Request for Prana: Decouple Virtual Drive Policy to Client App Status: Proposal only
- **pr/chakra/drive-layout-config-root-move.md** → Prana Clarification: drive-layout.json Is Now at the Project Root Status: Informational / path update required
- **pr/chakra/drive-root-directory-collision.md** → Prana Clarification: Intended Drive Root Layout (S:\) Status: Clarification / design intent
- **pr/chakra/general-email-api.md** → Prana PR: General Purpose Email Sending API PR Title
- **pr/chakra/google-bridge-spreadsheet-id-hardcoded-empty.md** → Bug: GoogleBridgeService hardcodes empty spreadsheetId — env var ignored File
- **pr/chakra/otp-hash-verification.md** → Prana PR: OTP Hash + Verification for Forgot Password Flow PR Title
- **pr/chakra/otp-verification.md** → Prana PR: OTP Verification for Forgot Password Flow PR Title
- **pr/chakra/rclone-password-must-be-obscured.md** → Prana Bug: rclone crypt password must be obscured before passing to env vars Status: Bug — drive does not mount; silent fallback to unencrypted local storage
- **pr/chakra/splash-dependency-precheck-proposal.md** → PR Request for Prana: Reusable Host Dependency Capability Service Status: Proposal only (do not implement in Chakra)
- **pr/chakra/sqlite-store-mkdir-eperm-fix.md** → Prana Bug: SQLite Store Services EPERM on Windows Drive Root Status: Fixed
- **pr/chakra/virtual-drive-security-enforcement.md** → Prana PR: Virtual Drive Security Enforcement Status: Proposal
- **pr/chakra/windows-drive-root-mkdir-eperm.md** → Prana Bug Report: Windows EPERM on mkdir at WinFsp drive root Summary
- **pr/chakra/windows-virtual-drive-spawn-readiness-bug.md** → Prana Bug Report: Windows virtual drive spawn readiness can break auth startup Summary
- **pr/dhi/01-fix-startup-orchestrator-module-evaluation.md** → Fix: Early Module Evaluation Crash in StartupOrchestratorService Context
- **pr/dhi/circular-sqlite-crypto-dependency.md** → Bug Report: Circular Dependency in SQLite Crypto ↔ Config Store Issue Description
- **pr/dhi/client-controlled-drive-mounting.md** → Feature Request: Client-Controlled Virtual Drive Mounting Repository: prana
- **pr/dhi/rclone-missing-crash.md** → Bug Report: Application Crashes When RClone / WinFsp Are Not Installed Repository: prana
- **pr/dhi/syncProviderService-unhandled-rejection.md** → PR Document: Fix Unhandled Promise Rejection in syncProviderService Repository: prana

## Rules

- Atomic docs first - one document, one runtime responsibility
- Service-oriented main process - all state flows through structured IPC
- MVVM renderer - Container → ViewModel → View pattern
- Never use process.env directly - flow config through IPC
- Use Zod validation on all IPC handlers
- All components use theme tokens - never hardcode colors
- docs/index.md is generated output - update scripts/wiki-steps.json and run node scripts/generate-index.cjs

## API Surface

See: src/main/services/ for all runtime services.
See: src/ui/common/components/index.ts for UI component exports.

## Maintenance

- Config: scripts/wiki-steps.json
- Generated: 2026-05-03
- Version: 1.2.4
