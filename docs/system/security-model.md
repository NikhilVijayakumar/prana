# Security Model

## Objective
Layer disk-level virtual-drive encryption on top of Prana's existing vault archive encryption without replacing the current archive envelope model.

## Two-Drive Design
- `S:` is the system/runtime drive.
  - Backing source: `<GOV_REPO_PATH>/db`
  - Mounted on app startup.
  - Intended for SQLite stores, WAL traffic, caches, and local operational state.
- `V:` is the vault/user drive.
  - Backing source: `<GOV_REPO_PATH>/vault`
  - Mounted only after successful user authentication.
  - Intended for user-facing vault storage and encrypted archive access.

## Why This Is Additive
- Existing Prana vault envelope encryption remains active.
- Rclone crypt adds disk-level encryption for both file contents and filenames in the underlying backing folders.
- If the mounted view is unavailable, the underlying storage still remains protected by the existing vault archive model for archive payloads.

## Operational Guarantees
- System drive attempts to mount before startup orchestration.
- Vault drive mounts after successful login using the login password as the crypt password.
- Drive lifecycle is tracked in a mount registry to prevent duplicate mounts.
- Electron quit hooks attempt drive cleanup before process exit to reduce ghost-drive risk.

## Failure Handling
- Missing WinFsp/FUSE or busy mount points are surfaced from Rclone stderr.
- System drive falls back to `<GOV_REPO_PATH>/db/live` so startup can continue in degraded mode.
- Vault drive does not replace current archive encryption behavior; mount failure leaves the existing vault pipeline intact.
