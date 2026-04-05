import { beforeEach, describe, expect, it } from 'vitest';
import { channelRouterService } from './channelRouterService';
import { InterceptionAction } from './types/orchestrationTypes';

describe('channelRouterService', () => {
  beforeEach(async () => {
    await channelRouterService.__resetStateForTesting();
    channelRouterService.__resetDependenciesForTesting();
    channelRouterService.__setDependenciesForTesting({
      getRuntimeChannelDetails: async () => null,
    });
  });

  it('rejects empty telegram messages', async () => {
    const result = await channelRouterService.routeTelegramMessage({
      message: '   ',
      senderId: 'director@prana.local',
      isDirector: true,
    });

    expect(result.accepted).toBe(false);
    expect(result.status).toBe('rejected');
  });

  it('rejects unauthorized telegram sender', async () => {
    channelRouterService.__setDependenciesForTesting({
      getRuntimeConfig: () => ({
        directorName: 'Director',
        directorEmail: 'director@prana.local',
        governanceRepoUrl: 'repo',
        governanceRepoPath: 'path',
        vaultSpecVersion: 'v1',
        vaultTempZipExtension: '.zip',
        vaultOutputPrefix: 'vault_',
        vaultKdfIterations: 210000,
        vaultKeepTempOnClose: false,
        channels: {},
        sync: {
          pushIntervalMs: 120000,
          cronEnabled: true,
          pushCronExpression: '*/10 * * * *',
          pullCronExpression: '*/15 * * * *',
        },
        branding: {
          appBrandName: 'Prana',
          appTitlebarTagline: 'Tagline',
          appSplashSubtitle: 'Subtitle',
          directorSenderEmail: 'director@prana.local',
          directorSenderName: 'Director',
          avatarBaseUrl: '',
        },
      }),
    });

    const result = await channelRouterService.routeTelegramMessage({
      message: 'Please route this',
      senderId: 'someone@app.local',
      isDirector: false,
    });

    expect(result.accepted).toBe(false);
    expect(result.status).toBe('rejected');
  });

  it('returns blocked when protocol interceptor blocks the routed request', async () => {
    channelRouterService.__setDependenciesForTesting({
      getRuntimeConfig: () => ({
        directorName: 'Director',
        directorEmail: 'director@prana.local',
        governanceRepoUrl: 'repo',
        governanceRepoPath: 'path',
        vaultSpecVersion: 'v1',
        vaultTempZipExtension: '.zip',
        vaultOutputPrefix: 'vault_',
        vaultKdfIterations: 210000,
        vaultKeepTempOnClose: false,
        channels: {},
        sync: {
          pushIntervalMs: 120000,
          cronEnabled: true,
          pushCronExpression: '*/10 * * * *',
          pullCronExpression: '*/15 * * * *',
        },
        branding: {
          appBrandName: 'Prana',
          appTitlebarTagline: 'Tagline',
          appSplashSubtitle: 'Subtitle',
          directorSenderEmail: 'director@prana.local',
          directorSenderName: 'Director',
          avatarBaseUrl: '',
        },
      }),
      createId: () => 'id-fixed',
      nowIso: () => '2026-03-23T00:00:00.000Z',
      audit: {
        createTransaction: async () => 'txn-1',
        appendTransaction: async () => 'txn-2',
      },
      orchestrator: {
        orchestrateIntent: async () => ({
          success: true,
          workOrderId: 'wo-1',
          personaId: 'mira',
          message: 'Routed',
          auditTrailRef: 'audit-1',
        }),
      },
      interceptor: {
        interceptAndValidate: async () => ({
          action: InterceptionAction.BLOCK,
          violations: [
            {
              id: 'v-1',
              severity: 'CRITICAL',
              ruleId: 'rule-1',
              description: 'Blocked by policy',
              action: 'block',
              timestamp: '2026-03-23T00:00:00.000Z',
              agentId: 'mira',
              workOrderId: 'wo-1',
              violationDetails: {},
            },
          ],
        }),
      },
    });

    const result = await channelRouterService.routeTelegramMessage({
      message: 'Do the thing',
      senderId: 'director@prana.local',
      isDirector: true,
    });

    expect(result.accepted).toBe(false);
    expect(result.status).toBe('blocked');
    expect(result.workOrderId).toBe('wo-1');
  });

  it('returns escalated when protocol interceptor escalates', async () => {
    channelRouterService.__setDependenciesForTesting({
      getRuntimeConfig: () => ({
        directorName: 'Director',
        directorEmail: 'director@prana.local',
        governanceRepoUrl: 'repo',
        governanceRepoPath: 'path',
        vaultSpecVersion: 'v1',
        vaultTempZipExtension: '.zip',
        vaultOutputPrefix: 'vault_',
        vaultKdfIterations: 210000,
        vaultKeepTempOnClose: false,
        channels: {},
        sync: {
          pushIntervalMs: 120000,
          cronEnabled: true,
          pushCronExpression: '*/10 * * * *',
          pullCronExpression: '*/15 * * * *',
        },
        branding: {
          appBrandName: 'Prana',
          appTitlebarTagline: 'Tagline',
          appSplashSubtitle: 'Subtitle',
          directorSenderEmail: 'director@prana.local',
          directorSenderName: 'Director',
          avatarBaseUrl: '',
        },
      }),
      audit: {
        createTransaction: async () => 'txn-1',
        appendTransaction: async () => 'txn-2',
      },
      orchestrator: {
        orchestrateIntent: async () => ({
          success: true,
          workOrderId: 'wo-2',
          personaId: 'eva',
          message: 'Routed',
          auditTrailRef: 'audit-2',
        }),
      },
      interceptor: {
        interceptAndValidate: async () => ({
          action: InterceptionAction.ESCALATE_TO_EVA,
          violations: [
            {
              id: 'v-2',
              severity: 'WARNING',
              ruleId: 'rule-2',
              description: 'Escalated by policy',
              action: 'escalate',
              timestamp: '2026-03-23T00:00:00.000Z',
              agentId: 'eva',
              workOrderId: 'wo-2',
              violationDetails: {},
            },
          ],
        }),
      },
    });

    const result = await channelRouterService.routeTelegramMessage({
      message: 'Please evaluate',
      senderId: 'director@prana.local',
      isDirector: true,
    });

    expect(result.accepted).toBe(false);
    expect(result.status).toBe('escalated');
    expect(result.workOrderId).toBe('wo-2');
  });

  it('returns accepted when protocol interceptor allows', async () => {
    channelRouterService.__setDependenciesForTesting({
      getRuntimeConfig: () => ({
        directorName: 'Director',
        directorEmail: 'director@prana.local',
        governanceRepoUrl: 'repo',
        governanceRepoPath: 'path',
        vaultSpecVersion: 'v1',
        vaultTempZipExtension: '.zip',
        vaultOutputPrefix: 'vault_',
        vaultKdfIterations: 210000,
        vaultKeepTempOnClose: false,
        channels: {},
        sync: {
          pushIntervalMs: 120000,
          cronEnabled: true,
          pushCronExpression: '*/10 * * * *',
          pullCronExpression: '*/15 * * * *',
        },
        branding: {
          appBrandName: 'Prana',
          appTitlebarTagline: 'Tagline',
          appSplashSubtitle: 'Subtitle',
          directorSenderEmail: 'director@prana.local',
          directorSenderName: 'Director',
          avatarBaseUrl: '',
        },
      }),
      audit: {
        createTransaction: async () => 'txn-1',
        appendTransaction: async () => 'txn-2',
      },
      orchestrator: {
        orchestrateIntent: async () => ({
          success: true,
          workOrderId: 'wo-3',
          personaId: 'mira',
          message: 'Work order routed',
          auditTrailRef: 'audit-3',
        }),
      },
      interceptor: {
        interceptAndValidate: async () => ({
          action: InterceptionAction.ALLOW,
          violations: [],
        }),
      },
    });

    const result = await channelRouterService.routeTelegramMessage({
      message: 'Build update',
      senderId: 'director@prana.local',
      isDirector: true,
    });

    expect(result.accepted).toBe(true);
    expect(result.status).toBe('accepted');
    expect(result.workOrderId).toBe('wo-3');
  });

  it('routes internal chat through the persistent conversation switchboard', async () => {
    channelRouterService.__setDependenciesForTesting({
      getRuntimeConfig: () => ({
        directorName: 'Director',
        directorEmail: 'director@prana.local',
        governanceRepoUrl: 'repo',
        governanceRepoPath: 'path',
        vaultSpecVersion: 'v1',
        vaultTempZipExtension: '.zip',
        vaultOutputPrefix: 'vault_',
        vaultKdfIterations: 210000,
        vaultKeepTempOnClose: false,
        channels: {},
        sync: {
          pushIntervalMs: 120000,
          cronEnabled: true,
          pushCronExpression: '*/10 * * * *',
          pullCronExpression: '*/15 * * * *',
        },
        branding: {
          appBrandName: 'Prana',
          appTitlebarTagline: 'Tagline',
          appSplashSubtitle: 'Subtitle',
          directorSenderEmail: 'director@prana.local',
          directorSenderName: 'Director',
          avatarBaseUrl: '',
        },
      }),
      submitDirectorRequest: async () => ({
        workOrder: {
          id: 'wo-internal-1',
          createdAt: '2026-03-23T00:00:00.000Z',
          updatedAt: '2026-03-23T00:00:00.000Z',
          moduleRoute: '/ops',
          requester: 'DIRECTOR',
          message: 'Status update',
          targetEmployeeId: 'mira',
          priority: 'IMPORTANT',
          state: 'QUEUED',
          waitingOnRole: null,
          summary: null,
          error: null,
          collaboration: {
            globalWorkflowId: null,
            internalMemos: [],
            handshakes: [],
          },
        },
        queueEntryId: 'q-1',
        queueAccepted: true,
        queueReason: 'ok',
      }),
    });

    const result = await channelRouterService.routeInternalMessage({
      moduleRoute: '/ops',
      message: 'Status update',
      senderId: 'director@prana.local',
      senderName: 'Director',
      targetPersonaId: 'mira',
      isDirector: true,
    });

    expect(result.accepted).toBe(true);
    expect(result.conversationKey).toBeTruthy();

    const history = await channelRouterService.getConversationHistory(result.conversationKey!);
    expect(history).not.toBeNull();
    expect(history?.messages.length).toBe(2);
    expect(history?.messages[0]?.role).toBe('operator');
    expect(history?.messages[1]?.role).toBe('assistant');
  });

  it('persists telegram conversation history for accepted routing', async () => {
    channelRouterService.__setDependenciesForTesting({
      getRuntimeConfig: () => ({
        directorName: 'Director',
        directorEmail: 'director@prana.local',
        governanceRepoUrl: 'repo',
        governanceRepoPath: 'path',
        vaultSpecVersion: 'v1',
        vaultTempZipExtension: '.zip',
        vaultOutputPrefix: 'vault_',
        vaultKdfIterations: 210000,
        vaultKeepTempOnClose: false,
        channels: {},
        sync: {
          pushIntervalMs: 120000,
          cronEnabled: true,
          pushCronExpression: '*/10 * * * *',
          pullCronExpression: '*/15 * * * *',
        },
        branding: {
          appBrandName: 'Prana',
          appTitlebarTagline: 'Tagline',
          appSplashSubtitle: 'Subtitle',
          directorSenderEmail: 'director@prana.local',
          directorSenderName: 'Director',
          avatarBaseUrl: '',
        },
      }),
      audit: {
        createTransaction: async () => 'txn-1',
        appendTransaction: async () => 'txn-2',
      },
      orchestrator: {
        orchestrateIntent: async () => ({
          success: true,
          workOrderId: 'wo-tele-1',
          personaId: 'mira',
          message: 'Work order routed',
          auditTrailRef: 'audit-3',
        }),
      },
      interceptor: {
        interceptAndValidate: async () => ({
          action: InterceptionAction.ALLOW,
          violations: [],
        }),
      },
    });

    const result = await channelRouterService.routeTelegramMessage({
      message: 'Build update',
      senderId: 'director@prana.local',
      senderName: 'Director',
      chatId: 'chat-1',
      isDirector: true,
    });

    const history = await channelRouterService.getConversationHistory(result.conversationKey!);
    expect(history?.conversation.roomKey).toBe('chat-1');
    expect(history?.messages).toHaveLength(2);
  });

  it('routes generic internal-channel envelope through routeChannelMessage', async () => {
    channelRouterService.__setDependenciesForTesting({
      getRuntimeConfig: () => ({
        directorName: 'Director',
        directorEmail: 'director@prana.local',
        governanceRepoUrl: 'repo',
        governanceRepoPath: 'path',
        vaultSpecVersion: 'v1',
        vaultTempZipExtension: '.zip',
        vaultOutputPrefix: 'vault_',
        vaultKdfIterations: 210000,
        vaultKeepTempOnClose: false,
        channels: {},
        sync: {
          pushIntervalMs: 120000,
          cronEnabled: true,
          pushCronExpression: '*/10 * * * *',
          pullCronExpression: '*/15 * * * *',
        },
        branding: {
          appBrandName: 'Prana',
          appTitlebarTagline: 'Tagline',
          appSplashSubtitle: 'Subtitle',
          directorSenderEmail: 'director@prana.local',
          directorSenderName: 'Director',
          avatarBaseUrl: '',
        },
      }),
      submitDirectorRequest: async () => ({
        workOrder: {
          id: 'wo-generic-1',
          createdAt: '2026-03-23T00:00:00.000Z',
          updatedAt: '2026-03-23T00:00:00.000Z',
          moduleRoute: '/general',
          requester: 'DIRECTOR',
          message: 'Generic path',
          targetEmployeeId: 'mira',
          priority: 'IMPORTANT',
          state: 'QUEUED',
          waitingOnRole: null,
          summary: null,
          error: null,
          collaboration: {
            globalWorkflowId: null,
            internalMemos: [],
            handshakes: [],
          },
        },
        queueEntryId: 'q-generic-1',
        queueAccepted: true,
        queueReason: 'ok',
      }),
    });

    const result = await channelRouterService.routeChannelMessage({
      senderId: 'director@prana.local',
      senderName: 'Director',
      channelId: 'internal-chat',
      roomId: '/general',
      messageText: 'Generic path',
      isDirector: true,
      explicitTargetPersonaId: 'mira',
      metadata: {
        moduleRoute: '/general',
      },
    });

    expect(result.accepted).toBe(true);
    expect(result.status).toBe('accepted');
  });

  it('returns capabilities for registered channels', async () => {
    const capabilities = await channelRouterService.getChannelCapabilities();
    expect(capabilities.some((entry) => entry.channelId === 'internal-chat')).toBe(true);
    expect(capabilities.some((entry) => entry.channelId === 'telegram')).toBe(true);
    expect(capabilities.some((entry) => entry.channelId === 'whatsapp')).toBe(true);
  });
});
