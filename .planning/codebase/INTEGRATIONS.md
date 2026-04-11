# Integrations

## Communication Channels
- **Telegram:** Implemented via `channelRouterService` and `protocolInterceptor` for routing inbound messages and operator-to-agent communication.
- **Email:** 
  - Comprehensive pipeline dealing with mailbox management (IMAP polling, MIME parsing).
  - Draft creation/sync and review gating before handoff.
  - Integration with `cronSchedulerService` for mailbox heartbeat polling.

## External Ecosystems
- **Google Ecosystem (`googleBridgeService`):**
  - Gmail-adjacent intake flows (IMAP/polling).
  - Browser fallback (`emailBrowserAgentService`) for interactive login and session reuse when required.

## Persistence & External Storage
- SQLite-based Hot Operational State
- Encrypted Durable Archives (Vault Layer using AES-256-GCM)
