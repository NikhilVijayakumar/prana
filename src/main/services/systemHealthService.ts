import os from 'node:os';
import { driveControllerService, VirtualDriveDiagnosticsSnapshot } from './driveControllerService';

export interface SystemHealthSnapshot {
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  processRssMb: number;
  totalMemoryMb: number;
  uptimeSeconds: number;
  storage: VirtualDriveDiagnosticsSnapshot;
}

interface CpuTimes {
  idle: number;
  total: number;
}

/**
 * Factory function to create a system health service.
 * Eliminates module-level state for CPU time tracking.
 */
export const createSystemHealthService = () => {
  // Instance-level state (not module-level)
  let previousCpuTimes: CpuTimes | null = null;

  const readCpuTimes = (): CpuTimes => {
    const cpuTimes = os.cpus().reduce(
      (accumulator, core) => {
        const total =
          core.times.user +
          core.times.nice +
          core.times.sys +
          core.times.idle +
          core.times.irq;

        return {
          idle: accumulator.idle + core.times.idle,
          total: accumulator.total + total,
        };
      },
      { idle: 0, total: 0 },
    );

    return cpuTimes;
  };

  const sampleCpuUsagePercent = (): number => {
    const current = readCpuTimes();

    if (!previousCpuTimes) {
      previousCpuTimes = current;
      return 0;
    }

    const idleDelta = current.idle - previousCpuTimes.idle;
    const totalDelta = current.total - previousCpuTimes.total;
    previousCpuTimes = current;

    if (totalDelta <= 0) {
      return 0;
    }

    const utilization = 100 - (idleDelta / totalDelta) * 100;
    return Number(Math.min(100, Math.max(0, utilization)).toFixed(1));
  };

  return {
    getSnapshot(): SystemHealthSnapshot {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = Math.max(totalMem - freeMem, 0);
      const memoryUsagePercent = totalMem > 0 ? Number(((usedMem / totalMem) * 100).toFixed(1)) : 0;

      const processRssMb = Number((process.memoryUsage().rss / (1024 * 1024)).toFixed(1));
      const totalMemoryMb = Number((totalMem / (1024 * 1024)).toFixed(1));
      const uptimeSeconds = Math.floor(process.uptime());

      return {
        cpuUsagePercent: sampleCpuUsagePercent(),
        memoryUsagePercent,
        processRssMb,
        totalMemoryMb,
        uptimeSeconds,
        storage: driveControllerService.getDiagnostics(),
      };
    },

    __resetForTesting(): void {
      previousCpuTimes = null;
    },
  };
};

// Backward compatibility - creates a default instance
export const systemHealthService = createSystemHealthService();
