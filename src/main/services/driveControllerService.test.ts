import { describe, expect, it } from 'vitest';
import { mountRegistryService } from './mountRegistryService';

describe('mountRegistryService', () => {
  it('tracks independent system and vault drive records', () => {
    mountRegistryService.reset();
    mountRegistryService.upsert({
      id: 'system',
      stage: 'MOUNTED',
      mountPoint: 'S:',
      sourcePath: 'repo/db',
      pid: 100,
      mountedAt: new Date().toISOString(),
      lastError: null,
      lastStderr: null,
    });
    mountRegistryService.upsert({
      id: 'vault',
      stage: 'FAILED',
      mountPoint: 'V:',
      sourcePath: 'repo/vault',
      pid: null,
      mountedAt: null,
      lastError: 'busy',
      lastStderr: 'busy',
    });

    const records = mountRegistryService.list();
    expect(records).toHaveLength(2);
    expect(mountRegistryService.get('system')?.mountPoint).toBe('S:');
    expect(mountRegistryService.get('vault')?.lastError).toBe('busy');
  });
});
