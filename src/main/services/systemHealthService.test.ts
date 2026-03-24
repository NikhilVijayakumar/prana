import { describe, expect, it } from 'vitest';
import { systemHealthService } from './systemHealthService';

describe('systemHealthService', () => {
  it('returns bounded metric snapshot values', () => {
    systemHealthService.__resetForTesting();

    const snapshot = systemHealthService.getSnapshot();

    expect(snapshot.cpuUsagePercent).toBeGreaterThanOrEqual(0);
    expect(snapshot.cpuUsagePercent).toBeLessThanOrEqual(100);
    expect(snapshot.memoryUsagePercent).toBeGreaterThanOrEqual(0);
    expect(snapshot.memoryUsagePercent).toBeLessThanOrEqual(100);
    expect(snapshot.processRssMb).toBeGreaterThan(0);
    expect(snapshot.totalMemoryMb).toBeGreaterThan(0);
    expect(snapshot.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('provides a second CPU sample without throwing', () => {
    systemHealthService.__resetForTesting();

    systemHealthService.getSnapshot();
    const secondSnapshot = systemHealthService.getSnapshot();

    expect(secondSnapshot.cpuUsagePercent).toBeGreaterThanOrEqual(0);
    expect(secondSnapshot.cpuUsagePercent).toBeLessThanOrEqual(100);
  });
});
