import { beforeEach, describe, expect, it } from 'vitest';
import { channelRouterService } from './channelRouterService';
import { InterceptionAction } from './types/orchestrationTypes';

describe('channelRouterService', () => {
  beforeEach(() => {
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
});
