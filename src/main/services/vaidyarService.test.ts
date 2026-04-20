import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VirtualDriveDiagnosticsSnapshot } from './driveControllerService'

const getDiagnosticsMock = vi.fn()
const getDrivePolicyMock = vi.fn()
const getSystemHealthSnapshotMock = vi.fn()

vi.mock('./driveControllerService', () => ({
  driveControllerService: {
    getDiagnostics: getDiagnosticsMock,
    getPolicy: getDrivePolicyMock
  }
}))

vi.mock('./systemHealthService', () => ({
  systemHealthService: {
    getSnapshot: getSystemHealthSnapshotMock
  }
}))

const buildHealthyDiagnostics = (): VirtualDriveDiagnosticsSnapshot => ({
  overallStatus: 'Healthy' as const,
  failClosed: false,
  records: [
    {
      id: 'system',
      stage: 'MOUNTED',
      posture: 'SECURE',
      providerId: 'rclone',
      mountPoint: 'S:',
      sourcePath: 'E:/Python/prana/db',
      resolvedPath: 'S:',
      usedFallbackPath: false,
      pid: 1,
      mountedAt: new Date().toISOString(),
      unmountedAt: null,
      activeSessionCount: 0,
      retryCount: 0,
      lastError: null,
      lastStderr: null
    },
    {
      id: 'vault',
      stage: 'MOUNTED',
      posture: 'SECURE',
      providerId: 'rclone',
      mountPoint: 'V:',
      sourcePath: 'E:/Python/prana/vault',
      resolvedPath: 'V:',
      usedFallbackPath: false,
      pid: 2,
      mountedAt: new Date().toISOString(),
      unmountedAt: null,
      activeSessionCount: 1,
      retryCount: 0,
      lastError: null,
      lastStderr: null
    }
  ],
  checks: []
})

describe('vaidyarService', () => {
  beforeEach(async () => {
    vi.resetModules()
    getDiagnosticsMock.mockReset()
    getDrivePolicyMock.mockReset()
    getSystemHealthSnapshotMock.mockReset()

    getDiagnosticsMock.mockReturnValue(buildHealthyDiagnostics())
    getDrivePolicyMock.mockReturnValue({ clientManaged: false })
    getSystemHealthSnapshotMock.mockReturnValue({
      cpuUsagePercent: 10,
      memoryUsagePercent: 40,
      processRssMb: 200,
      totalMemoryMb: 16000,
      uptimeSeconds: 120,
      storage: buildHealthyDiagnostics()
    })

    const { vaidyarService } = await import('./vaidyarService')
    vaidyarService.reset()
  })

  it('returns a healthy normalized report when all checks pass', async () => {
    const { vaidyarService } = await import('./vaidyarService')

    const report = await vaidyarService.runOnDemandDiagnostics()

    expect(report.overall_status).toBe('Healthy')
    expect(report.layers.length).toBe(4)
    expect(report.blocked_signals).toEqual([])
    expect(report.layers.every((layer) => layer.status === 'Healthy')).toBe(true)

    const telemetry = vaidyarService.getTelemetry()
    expect(telemetry.lastExecutionLatencyMs).toBeGreaterThanOrEqual(0)
    expect(Object.keys(telemetry.checkExecutionLatencyMs).length).toBeGreaterThan(0)
  })

  it('classifies blocked storage posture and exposes blocking signals', async () => {
    const { vaidyarService } = await import('./vaidyarService')

    getDiagnosticsMock.mockReturnValue({
      ...buildHealthyDiagnostics(),
      overallStatus: 'Blocked',
      failClosed: true,
      records: [
        {
          ...buildHealthyDiagnostics().records[0],
          stage: 'FAILED',
          posture: 'UNAVAILABLE',
          usedFallbackPath: true
        },
        buildHealthyDiagnostics().records[1]
      ]
    })
    getSystemHealthSnapshotMock.mockReturnValue({
      cpuUsagePercent: 12,
      memoryUsagePercent: 45,
      processRssMb: 210,
      totalMemoryMb: 16000,
      uptimeSeconds: 140,
      storage: {
        ...buildHealthyDiagnostics(),
        overallStatus: 'Blocked'
      }
    })

    const report = await vaidyarService.runBootstrapDiagnostics()

    expect(report.overall_status).toBe('Blocked')
    expect(report.blocked_signals).toContain('BLOCKED_STORAGE')

    const events = vaidyarService.getRecentEvents(10)
    expect(events.some((event) => event.eventType === 'diagnostic:system_blocked')).toBe(true)
  })

  it('keeps storage checks non-blocking when virtual drive policy is client-managed', async () => {
    const { vaidyarService } = await import('./vaidyarService')

    getDrivePolicyMock.mockReturnValue({ clientManaged: true })
    getDiagnosticsMock.mockReturnValue({
      ...buildHealthyDiagnostics(),
      overallStatus: 'Blocked',
      failClosed: true,
      records: [
        {
          ...buildHealthyDiagnostics().records[0],
          stage: 'FAILED',
          posture: 'UNAVAILABLE',
          usedFallbackPath: true
        },
        {
          ...buildHealthyDiagnostics().records[1],
          stage: 'FAILED',
          posture: 'UNAVAILABLE'
        }
      ]
    })

    const report = await vaidyarService.runBootstrapDiagnostics()

    expect(report.overall_status).toBe('Healthy')
    expect(report.blocked_signals).toEqual([])
    const storageChecks = report.layers.find((layer) => layer.name === 'Storage')?.checks ?? []
    expect(storageChecks.find((check) => check.check_id === 'vault_mount')?.status).toBe('Healthy')
    expect(storageChecks.find((check) => check.check_id === 'system_drive_posture')?.status).toBe('Healthy')
  })
})
