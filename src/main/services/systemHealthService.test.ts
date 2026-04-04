import { describe, expect, it } from 'vitest';
import { systemHealthService } from './systemHealthService';
import { mountRegistryService } from './mountRegistryService';

describe('systemHealthService', () => {
  it('returns bounded metric snapshot values', () => {
    systemHealthService.__resetForTesting();
    mountRegistryService.reset();

    const snapshot = systemHealthService.getSnapshot();

    expect(snapshot.cpuUsagePercent).toBeGreaterThanOrEqual(0);
    expect(snapshot.cpuUsagePercent).toBeLessThanOrEqual(100);
    expect(snapshot.memoryUsagePercent).toBeGreaterThanOrEqual(0);
    expect(snapshot.memoryUsagePercent).toBeLessThanOrEqual(100);
    expect(snapshot.processRssMb).toBeGreaterThan(0);
    expect(snapshot.totalMemoryMb).toBeGreaterThan(0);
    expect(snapshot.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(snapshot.storage.overallStatus).toBeDefined();
  });

  it('provides a second CPU sample without throwing', () => {
    systemHealthService.__resetForTesting();
    mountRegistryService.reset();

    systemHealthService.getSnapshot();
    const secondSnapshot = systemHealthService.getSnapshot();

    expect(secondSnapshot.cpuUsagePercent).toBeGreaterThanOrEqual(0);
    expect(secondSnapshot.cpuUsagePercent).toBeLessThanOrEqual(100);
  });
});
