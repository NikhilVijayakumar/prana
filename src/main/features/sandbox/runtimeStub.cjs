'use strict';

// Minimal sandbox runtime stub for plugin development and E2E testing.
// Receives fixture and capability injection, emits heartbeats, handles shutdown.
//
// Set DUMMY_PLUGIN_SCENARIO to run a scripted test scenario:
//   silent              — baseline lifecycle, just heartbeats (default)
//   read-heavy          — 5 sqlite:read requests then clean exit
//   write-heavy         — 5 sqlite:write requests then clean exit
//   notification-emitter — 3 notifications:emit requests then clean exit
//   crash-prone         — deliberate uncaught exception after 200 ms
//   permission-violating — vault:read request (capability denied) then clean exit

let capabilities = {};
let fixture = null;
let shuttingDown = false;
const pendingRequests = new Map();

const heartbeat = setInterval(() => {
  if (!shuttingDown) {
    process.send({
      type: 'runtime:heartbeat',
      pid: process.pid,
      memoryUsage: process.memoryUsage().heapUsed,
      eventLoopLag: 0,
      timestamp: Date.now(),
    });
  }
}, 3000);

const sendIpcRequest = (messageType, payload) => {
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2, 10);
    pendingRequests.set(requestId, resolve);
    process.send({ type: 'ipc:request', requestId, messageType, payload });
  });
};

const selfShutdown = () => {
  shuttingDown = true;
  clearInterval(heartbeat);
  process.send({ type: 'runtime:shutdown_ack' });
  setTimeout(() => process.exit(0), 50);
};

const runScenario = async (scenario) => {
  switch (scenario) {
    case 'read-heavy': {
      for (let i = 0; i < 5; i++) {
        await sendIpcRequest('sqlite:read', { table: 'tasks', query: {} });
      }
      selfShutdown();
      break;
    }

    case 'write-heavy': {
      for (let i = 0; i < 5; i++) {
        await sendIpcRequest('sqlite:write', {
          table: 'scenario_writes',
          rows: [{ id: String(i), value: `write-${i}`, written_at: Date.now().toString() }],
        });
      }
      selfShutdown();
      break;
    }

    case 'notification-emitter': {
      for (let i = 0; i < 3; i++) {
        await sendIpcRequest('notifications:emit', {
          eventType: 'dummy.event',
          payload: { index: i },
        });
      }
      selfShutdown();
      break;
    }

    case 'crash-prone': {
      setTimeout(() => {
        throw new Error('deliberate crash from crash-prone scenario');
      }, 200);
      break;
    }

    case 'permission-violating': {
      // vault:read is not in capabilities — gateway returns { ok: false }
      await sendIpcRequest('vault:read', { table: 'vault_files', query: {} });
      selfShutdown();
      break;
    }

    // 'silent' and unknown: no scenario actions, just wait for runtime:shutdown from host
    default:
      break;
  }
};

process.on('message', (msg) => {
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'fixture:inject':
      fixture = msg.fixture;
      process.send({ type: 'fixture:ack', fixtureName: msg.fixture?.name });
      break;

    case 'capability:inject':
      capabilities = msg.capabilities ?? {};
      process.send({ type: 'capability:ack', capabilities });
      {
        const scenario = process.env.DUMMY_PLUGIN_SCENARIO;
        if (scenario && scenario !== 'silent') {
          runScenario(scenario).catch((err) => {
            process.send({ type: 'runtime:crash', error: err.message, stack: err.stack });
            process.exit(1);
          });
        }
      }
      break;

    case 'runtime:shutdown':
      shuttingDown = true;
      clearInterval(heartbeat);
      process.send({ type: 'runtime:shutdown_ack' });
      setTimeout(() => process.exit(0), 50);
      break;

    case 'ipc:request':
      // Reflect back IPC requests for integration testing
      process.send({ type: 'ipc:response', requestId: msg.requestId, payload: null });
      break;

    case 'ipc:response': {
      const resolver = pendingRequests.get(msg.requestId);
      if (resolver) {
        pendingRequests.delete(msg.requestId);
        resolver(msg);
      }
      break;
    }
  }
});

process.on('uncaughtException', (err) => {
  process.send({ type: 'runtime:crash', error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  process.send({ type: 'runtime:crash', error: String(reason) });
  process.exit(1);
});

// Signal readiness after message handlers are registered
process.send({ type: 'runtime:ready', pid: process.pid });
