import { describe, expect, it } from 'vitest';
import { mountRegistryService } from './mountRegistryService';

describe('mountRegistryService', () => {
  it('tracks independent system and vault drive records', () => {
    mountRegistryService.reset();
    mountRegistryService.upsert({
      id: 'system',
      stage: 'MOUNTED',
      posture: 'SECURE',
      providerId: 'rclone',
      mountPoint: 'S:',
      sourcePath: 'repo/db',
      resolvedPath: 'S:',
      usedFallbackPath: false,
      pid: 100,
      mountedAt: new Date().toISOString(),
      unmountedAt: null,
      activeSessionCount: 0,
      retryCount: 0,
      lastError: null,
      lastStderr: null,
    });
    mountRegistryService.upsert({
      id: 'vault',
      stage: 'FAILED',
      posture: 'UNAVAILABLE',
      providerId: 'rclone',
      mountPoint: 'V:',
      sourcePath: 'repo/vault',
      resolvedPath: 'V:',
      usedFallbackPath: false,
      pid: null,
      mountedAt: null,
      unmountedAt: null,
      activeSessionCount: 0,
      retryCount: 1,
      lastError: 'busy',
      lastStderr: 'busy',
    });

    const records = mountRegistryService.list();
    expect(records).toHaveLength(2);
    expect(mountRegistryService.get('system')?.mountPoint).toBe('S:');
    expect(mountRegistryService.get('vault')?.lastError).toBe('busy');
  });
});
