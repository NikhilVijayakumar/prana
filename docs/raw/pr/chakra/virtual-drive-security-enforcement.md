# Prana PR: Virtual Drive Security Enforcement

**Status:** Proposal
**Owner repo:** Prana
**Requested by:** Chakra (Phase 10 — Drive Layout JSON, session 2)

---

## Problem

Four security enforcement gaps exist in the current virtual drive implementation.

### 1. Drive Stays Mounted After App Exits

The rclone process mounts the virtual drive. If the app exits abnormally (crash, force kill) or if `dispose()` does not wait for the rclone process to terminate, the mount point remains accessible to anyone with filesystem access. The drive should be locked (unmounted) whenever the app is not running.

### 2. failClosed Defaults to False

`failClosed` controls whether the app blocks startup or falls back to plaintext storage when the encrypted mount fails. It currently defaults to `false`, meaning a mount failure silently downgrades to an unencrypted local directory. In production, this is a security regression — sensitive data that should be encrypted is stored in plaintext without the user knowing.

### 3. Default/Weak cryptPassword Not Detected

The `cryptPassword` for the system drive falls back through `systemConfig.cryptPassword → runtimeConfig.systemCryptPassword → vaultArchivePassword`. If none of these are set, `vaultArchivePassword` defaults to `'default'` (a hardcoded placeholder). This means the crypt key is trivially guessable in any environment that hasn't explicitly configured a password.

### 4. rclone Mount Not Using a crypt Remote

If the rclone remote for the system drive is configured as a plain backend (local, sftp, s3) without a `crypt` remote overlay, files are stored and transferred unencrypted. Prana must validate at mount time that the resolved remote is a crypt type before proceeding.

---

## Encryption Key Generation (Chakra side)

Chakra provides a script to generate a strong encryption key for the virtual drive:

```
npm run generate:drive-key
```

This script (`scripts/generate-drive-key.cjs`):
- Generates a 256-bit random password (64 hex chars) and a 128-bit random salt (32 hex chars)
- Writes them as `MAIN_VITE_CHAKRA_VAULT_ARCHIVE_PASSWORD` and `MAIN_VITE_CHAKRA_VAULT_ARCHIVE_SALT` to the project `.env` file
- `.env` is git-ignored — the key never enters version control
- Does not overwrite keys that already exist
- Sets `MAIN_VITE_CHAKRA_VAULT_KDF_ITERATIONS=600000` if not present

**Team key sharing:** All team members who need to access the same encrypted drive must use the same password and salt. Share the values out-of-band (e.g., a password manager) — never via git.

**Key loss = data loss.** Without the password, the rclone crypt remote cannot decrypt the drive and mounting fails with `failClosed: true`.

---

## Protection Model

The drive protection model is:

1. **Without the key:** rclone cannot configure the crypt remote → `S:` never mounts → the drive letter does not exist → no access possible.
2. **With the key (app running):** rclone mounts `S:` with the crypt remote → files are transparently decrypted for processes that access through `S:` → this is the intended access path.
3. **With the key (app not running):** `S:` is unmounted → drive letter disappears → no access.
4. **Underlying storage:** files on the remote (e.g. sftp, local, cloud) are stored with rclone crypt-encrypted names and content → unreadable without the key even if the remote is accessed directly.

**Note:** While the app is running, any process on the same Windows user session can read `S:\` — WinFsp mounts are user-session-scoped, not app-scoped. The protection boundary is: key required to mount; app must be running for the drive to exist. Prana must enforce unmounting on exit (Fix 1 below) to close the window where the drive outlives the app.

---

## Proposal

### Fix 1 — Enforce Unmount on Process Exit

Ensure `driveControllerService.dispose()` waits for the rclone child process to fully exit (SIGTERM + timeout + SIGKILL fallback). Verify the `before-quit` hook in the client app correctly awaits `dispose()`.

Prana should expose a `getActiveChildren()` utility so the host app can register an explicit kill guard during `app.on('before-quit')`.

### Fix 2 — Default failClosed to True in Production

Change the default resolution of `failClosed`:

```typescript
// Before:
failClosed: runtimeConfig?.failClosed === true,

// After:
const isDev = process.env.NODE_ENV === 'development'
failClosed: runtimeConfig?.failClosed ?? !isDev,
```

When `failClosed` is `true` and the encrypted mount fails, Prana logs a blocking error and returns a `BLOCKED` status from `bootstrapHost` rather than silently falling back.

The client app may override with `failClosed: false` explicitly for dev/test environments.

### Fix 3 — Weak Password Warning

Before mounting the system drive, check whether the resolved `cryptPassword` is a known weak value:

```typescript
const WEAK_PASSWORDS = new Set(['default', 'password', '', 'changeme', 'prana'])

if (WEAK_PASSWORDS.has(password.toLowerCase())) {
  console.warn('[Prana] SECURITY WARNING: virtual drive crypt password is a weak/default value. Set CHAKRA_VAULT_ARCHIVE_PASSWORD or systemConfig.cryptPassword to a strong secret.')
}
```

This is non-blocking — dev environments commonly use placeholder passwords. The warning must be visible in the log at WARN level.

### Fix 4 — Validate crypt Remote Type Before Mount

Before mounting, resolve the remote name from the rclone config and confirm it is of type `crypt`:

```typescript
const remoteType = await resolveRcloneRemoteType(remoteName)
if (remoteType !== 'crypt') {
  const msg = `[Prana] Virtual drive remote "${remoteName}" is type "${remoteType}", expected "crypt". Files will not be encrypted.`
  if (failClosed) throw new Error(msg)
  console.warn(msg)
}
```

---

## Observed Symptom: All Files Visible in Mounted Drive

**Reported by:** Chakra integration — user can open the mounted drive (e.g. `S:`) and read all files without restriction.

**Root cause A — plaintext fallback (failClosed=false):**
When the encrypted rclone crypt mount fails, `failClosed=false` silently downgrades storage to an unencrypted local directory. Files accumulate in plaintext at a fallback path. Applying Fix 2 (default `failClosed: true` in production) prevents this: mount failure blocks startup instead.

**Root cause B — plain rclone remote without crypt overlay:**
If the rclone remote is not a `crypt` type, files are stored and served unencrypted. Applying Fix 4 (remote type validation) detects and blocks this at mount time.

**Root cause C — expected rclone crypt behavior (not a bug):**
If the rclone crypt mount succeeds, files accessed through `S:` ARE transparently decrypted — this is correct. Files on the underlying remote are stored encrypted; files through the mount are not. A user browsing `S:\` and reading files is expected behavior when the app is running. The protection is that `S:` only exists while the app is running with the correct key.

**Diagnosis steps for Prana:**
1. Check the rclone config: is the system drive remote of type `crypt`? If plain, Fix 4 applies.
2. Check logs for `[Prana] Falling back to local storage` — if present, Fix 2 applies.
3. If neither — files are visible because Fix 1 is missing: the drive outlived the app process.

---

## Required Behavior

1. After `dispose()` completes, the rclone mount point is no longer accessible.
2. In production (`failClosed: true` default), if the encrypted mount fails, `bootstrapHost` returns `BLOCKED` — no silent plaintext fallback.
3. A weak/default `cryptPassword` produces a `[Prana] SECURITY WARNING` log line at mount time (non-blocking).
4. A non-crypt rclone remote is detected and blocked (or warned) before mount completes.
5. Existing behavior in dev mode (`NODE_ENV === 'development'` or explicit `failClosed: false`) is unchanged.

---

## Acceptance Criteria

- `dispose()` terminates the rclone process and verifies the mount point is no longer accessible.
- `failClosed` defaults to `true` in non-development environments.
- Weak password set produces a `console.warn` at mount time (non-blocking).
- Non-crypt remote detected before mount — blocks with `failClosed: true`, warns with `failClosed: false`.
- No breaking change to `failClosed: false` explicit override for dev/test.

---

## Non-Goals

- Do not change the crypt algorithm or key derivation — this is existing rclone crypt behavior.
- Do not add per-user key management — the single `cryptPassword` model is sufficient.
- Do not add an explicit lock/unlock UI — the mount lifecycle is internal to Prana.

---

## Files Expected to Change in Prana

- `src/main/services/driveControllerService.ts` — `failClosed` default logic, weak-password check, dispose() kill verification, remote type validation
- `src/main/services/virtualDriveProvider.ts` — Ensure `unmount()` waits for process exit and confirms mount point inaccessible
