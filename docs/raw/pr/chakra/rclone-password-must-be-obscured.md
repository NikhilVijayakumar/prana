# Prana Bug: rclone crypt password must be obscured before passing to env vars

**Status:** Bug — drive does not mount; silent fallback to unencrypted local storage
**Owner repo:** Prana
**Reported by:** Chakra integration
**Affects:** `virtualDriveProvider.ts` — all platforms

---

## Problem

rclone requires that **password-type config values passed via environment variables are in obscured format** — the output of `rclone obscure <plaintext>`. The `virtualDriveProvider.ts` `createCryptEnv` function passes the raw plain-text password directly:

```typescript
// virtualDriveProvider.ts — createCryptEnv (current, broken)
[`RCLONE_CONFIG_${remoteName}_PASSWORD`]: password,  // plain text ← wrong
```

When rclone receives a plain-text value for a password field, it attempts to decode it as base64url (the obscured format). This either fails silently or produces a garbage decryption key. The crypt remote either refuses to mount or mounts with the wrong key.

Reference: [rclone docs — remote config via environment variables](https://rclone.org/docs/#environment-variables)

> "Note that the value must be obscured using `rclone obscure` if the option is a password."

---

## rclone Obscure Algorithm

The obscure format is a simple reversible XOR cipher encoded as base64url (no padding). It is not a security measure — it only prevents casual reading. The algorithm:

1. Generate 2 random bytes (`key`).
2. XOR each byte of the UTF-8 password with `key[i % 2]`.
3. Concatenate `key + xored`.
4. Base64url-encode (no padding).

**Node.js / TypeScript implementation:**

```typescript
import { randomBytes } from 'node:crypto'

export const obscureRclonePassword = (plaintext: string): string => {
  const input = Buffer.from(plaintext, 'utf8')
  const key = randomBytes(2)
  const xored = Buffer.allocUnsafe(input.length)
  for (let i = 0; i < input.length; i++) {
    xored[i] = input[i] ^ key[i % 2]
  }
  return Buffer.concat([key, xored]).toString('base64url')
}
```

No external dependency — uses only Node's built-in `crypto` module.

---

## Fix

### Option A — Implement `obscureRclonePassword` in Prana and apply it in `createCryptEnv`

Add the helper (e.g. to `virtualDriveProvider.ts` or a new `rcloneUtils.ts`) and use it:

```diff
+import { randomBytes } from 'node:crypto'
+
+const obscureRclonePassword = (plaintext: string): string => {
+  const input = Buffer.from(plaintext, 'utf8')
+  const key = randomBytes(2)
+  const xored = Buffer.allocUnsafe(input.length)
+  for (let i = 0; i < input.length; i++) {
+    xored[i] = input[i] ^ key[i % 2]
+  }
+  return Buffer.concat([key, xored]).toString('base64url')
+}
+
 const createCryptEnv = (
   remoteName: string,
   sourcePath: string,
   password: string,
   obscuredFileNames: boolean,
 ): Record<string, string> => ({
   [`RCLONE_CONFIG_${remoteName}_TYPE`]: 'crypt',
   [`RCLONE_CONFIG_${remoteName}_REMOTE`]: sourcePath,
-  [`RCLONE_CONFIG_${remoteName}_PASSWORD`]: password,
+  [`RCLONE_CONFIG_${remoteName}_PASSWORD`]: obscureRclonePassword(password),
   [`RCLONE_CONFIG_${remoteName}_FILENAME_ENCRYPTION`]: obscuredFileNames ? 'standard' : 'off',
   [`RCLONE_CONFIG_${remoteName}_DIRECTORY_NAME_ENCRYPTION`]: obscuredFileNames ? 'true' : 'false',
 })
```

### Option B — Run `rclone obscure` as a subprocess (slower, no in-process implementation)

```typescript
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const obscureRclonePassword = async (plaintext: string, binaryPath = 'rclone'): Promise<string> => {
  const { stdout } = await execFileAsync(binaryPath, ['obscure', plaintext], { windowsHide: true })
  return stdout.trim()
}
```

Option A is preferred — it avoids an extra subprocess and the `randomBytes`-based implementation is equivalent to rclone's own `obscure` command.

---

## Effect on Drive Layout

When the password is wrong (plain text passed to rclone):

- rclone may refuse to start the crypt remote entirely → mount fails → `failClosed: false` silently falls back to local storage → **no drive letter appears in Windows Explorer**
- OR rclone mounts but with a garbage decryption key → drive letter appears but files show garbled/encrypted names (not the folder layout from `drive-layout.json`)

After this fix, the correct password is delivered to rclone → crypt remote initialises → `S:` appears in Windows Explorer → `chakra:ensure-drive-layout` creates `apps/`, `cache/sqlite/`, `data/governance/` under the drive root.

---

## Acceptance Criteria

- `createCryptEnv` obscures the password before assigning to `RCLONE_CONFIG_<name>_PASSWORD`.
- Calling `rclone obscure <same_plaintext>` and calling `obscureRclonePassword(plaintext)` both produce values that rclone `reveal` decodes back to the original plaintext (though specific outputs differ because of random key bytes).
- The system drive mounts at `S:` on Windows with WinFsp when a valid password is configured.
- The vault drive session flow is unaffected.

---

## Files Expected to Change in Prana

- `src/main/services/virtualDriveProvider.ts` — `createCryptEnv` function, add `obscureRclonePassword` helper
