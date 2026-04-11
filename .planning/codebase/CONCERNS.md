# Codebase Concerns & Known Architectural Gaps

According to the latest implementation audit, the following are tracked as high or medium severity gaps:

## Highest Impact Gaps
- **Runtime Doctor Integration:** There is no unified Doctor service to orchestrate diagnostic checks; `systemHealthService` covers only OS and process-level health.
- **Drive Dispose Lifecycle:** `driveControllerService.dispose()` is not safely wired into the process shutdown resulting in orphaned background references on application close.

## Medium Impact Gaps
- **Vault Mount Orchestration:** Vault mount and unmount operations are not fully automated chronologically around standard sync windows.
- **SQLite Engine Encryption Mitigation:** Database-native encryption is lacking; the application strictly depends on the underlying encrypted virtual drive mounting system for protection at-rest.
- **Secret Key Rotation:** A dedicated encryption key-rotation workflow pattern is currently missing from the Vault operations scope.
- **In-App Messaging Constraints:** In-app chat lacks persistent workspaces, conversational threading, and SQLite-backed caching natively integrated into the routing workflows.
- **Channel Bridging:** Missing broad multi-channel integrations (e.g. WhatsApp bridge inside `src/main/services`).

## Lower Impact
- Chat room lifecycle-to-session rollover policy has no distinct governance boundaries.
- No cross-channel identity reconciliation across external adapter systems.
