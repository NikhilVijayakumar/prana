'use strict';

// Minimal sandbox runtime stub for plugin development.
// Receives fixture and capability injection, emits heartbeats, handles shutdown.

let capabilities = {};
let fixture = null;
let shuttingDown = false;

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
