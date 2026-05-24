import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPluginSandboxHost } from './pluginSandboxHost'

vi.mock('../communication/notificationCentreService', () => ({
  notificationCentreService: {
    emit: vi.fn().mockResolvedValue(undefined),
  },
}))

// vaidyarService moved to governance/ in restructure; supervisor import path is stale.
// Mock the broken path so the supervisor catches the error and continues without Vaidyar checks.
vi.mock('../vaidyarService', () => ({
  vaidyarService: {
    getReport: vi.fn().mockReturnValue(null),
    runOnDemandDiagnostics: vi.fn().mockResolvedValue(null),
  },
}))

describe('PluginSandboxHost — Dummy Pair E2E', () => {
  let host: ReturnType<typeof createPluginSandboxHost>

  beforeEach(() => {
    host = createPluginSandboxHost()
  })

  afterEach(async () => {
    const s = host.getStatus()
    if (s === 'running' || s === 'booting' || s === 'stopping') {
      await host.shutdown()
    }
  })

  it('boots and shuts down cleanly in dummy host mode', async () => {
    await host.launch(
      undefined,
      undefined,
      { sqlite: { read: true, write: true } },
      { dummyHostMode: true },
    )

    await host.waitUntilRunning()
    expect(host.getStatus()).toBe('running')
    expect(host.isDummyHostMode()).toBe(true)

    await host.shutdown()
    expect(host.getStatus()).toBe('stopped')
  }, 10_000)

  it('read-heavy scenario: plugin sends 5 sqlite:read requests and exits', async () => {
    const fixture = {
      name: 'read-heavy-fixture',
      tables: {
        tasks: [
          { id: '1', title: 'Task A' },
          { id: '2', title: 'Task B' },
        ],
      },
    }

    await host.launch(
      undefined,
      fixture,
      { sqlite: { read: true, write: true } },
      { dummyHostMode: true, scenario: 'read-heavy' },
    )

    await host.waitForPluginExit()

    // Plugin shut itself down cleanly via runtime:shutdown_ack
    expect(host.getStatus()).toBe('stopped')
  }, 10_000)

  it('write-heavy scenario: plugin writes rows and exits cleanly', async () => {
    await host.launch(
      undefined,
      undefined,
      { sqlite: { read: true, write: true } },
      { dummyHostMode: true, scenario: 'write-heavy' },
    )

    await host.waitForPluginExit()
    expect(host.getStatus()).toBe('stopped')
  }, 10_000)

  it('crash-prone scenario: host detects crash and marks status', async () => {
    await host.launch(
      undefined,
      undefined,
      { sqlite: { read: true, write: true } },
      { dummyHostMode: true, scenario: 'crash-prone' },
    )

    await host.waitForPluginExit()
    expect(host.getStatus()).toBe('crashed')
  }, 10_000)

  it('permission-violating scenario: vault:read denied, plugin still exits cleanly', async () => {
    await host.launch(
      undefined,
      undefined,
      { sqlite: { read: true, write: true } },
      { dummyHostMode: true, scenario: 'permission-violating' },
    )

    await host.waitForPluginExit()
    // Gateway returns { ok: false } for vault:read — plugin receives the error response and self-shuts
    expect(host.getStatus()).toBe('stopped')
  }, 10_000)

  it('waitForPluginExit resolves immediately if already stopped', async () => {
    await host.launch(
      undefined,
      undefined,
      { sqlite: { read: true, write: true } },
      { dummyHostMode: true, scenario: 'read-heavy' },
    )

    await host.waitForPluginExit()
    // Second call should resolve immediately
    await expect(host.waitForPluginExit()).resolves.toBeUndefined()
  }, 10_000)
})
