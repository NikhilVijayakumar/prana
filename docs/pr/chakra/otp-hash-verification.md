# Prana PR: OTP Hash + Verification for Forgot Password Flow

## PR Title
`feat: add dedicated OTP hash field and verification method for forgot password flow`

## 1. Overview
Replaces the shared `tempPasswordHash` field with dedicated OTP fields to properly handle the 3-step forgot password flow: Request OTP → Verify OTP → Reset Password.

Currently, `tempPasswordHash` is used for both temporary password (from auto-generation) and OTP, causing confusion. This PR creates clean separation with dedicated fields.

## 2. Key Design Decisions
| Decision | Resolution |
|----------|-------------|
| New Field Names | `otpHash` and `otpExpiresAt` instead of reusing `tempPasswordHash` |
| OTP Format | 6-digit numeric (e.g., `123456`) |
| OTP Storage | bcrypt hash (10 rounds) in `otpHash` field |
| OTP TTL | 5 minutes (300,000 ms) stored in `otpExpiresAt` |
| OTP Delivery | Via Prana's email service (configured by consuming app) |
| Verification | New `verifyOtp()` method compares bcrypt hash |
| Clear on Reset | OTP fields cleared after successful password reset |
| Remove tempPasswordHash | Remove the shared field - not needed with dedicated OTP |

## 3. Changes to Prana

### 3.1 Modified Files
| File Path | Changes |
|-----------|---------|
| `src/main/services/authStoreService.ts` | Remove `tempPasswordHash`, add `otpHash` and `otpExpiresAt` fields |
| `src/main/services/authService.ts` | Modify `forgotPassword()` to generate OTP, add `verifyOtp()` method, modify `resetPassword()` to clear OTP fields |
| `src/main/services/ipcService.ts` | Add `auth:verify-otp` handler |

### 3.2 AuthStoreRecord Changes
```typescript
// BEFORE (confusing - shared field)
export interface AuthStoreRecord {
  directorName: string;
  email: string;
  passwordHash: string;
  tempPasswordHash: string | null;      // Used for both temp password AND OTP
  tempPasswordExpiresAt: number | null;  // Ambiguous naming
  lastPasswordResetAt: string;
  attemptCount?: number;
  attemptLockUntil?: number;
}

// AFTER (clear separation)
export interface AuthStoreRecord {
  directorName: string;
  email: string;
  passwordHash: string;
  otpHash: string | null;                // Dedicated OTP hash field
  otpExpiresAt: number | null;           // Dedicated OTP expiry timestamp
  lastPasswordResetAt: string;
  attemptCount?: number;
  attemptLockUntil?: number;
}
```

## 4. API Specification

### 4.1 Updated AuthStoreRecord Type
```typescript
export interface AuthStoreRecord {
  directorName: string;
  email: string;
  passwordHash: string;
  otpHash: string | null;           // NEW: bcrypt hash of 6-digit OTP
  otpExpiresAt: number | null;       // NEW: timestamp when OTP expires
  lastPasswordResetAt: string;
  attemptCount?: number;
  attemptLockUntil?: number;
}
```

### 4.2 ForgotPasswordResult (updated)
```typescript
export interface ForgotPasswordResult {
  success: boolean;
  reason?: 'ssh_unavailable' | 'email_mismatch' | 'email_send_failed';
}
```

### 4.3 OTP Verification Result (NEW)
```typescript
export interface OtpVerificationResult {
  success: boolean;
  reason?: 'no_otp_requested' | 'otp_expired' | 'invalid_otp';
}
```

### 4.4 authService Methods

#### Generate 6-digit OTP
```typescript
const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
```

#### Modified forgotPassword(email: string)
```typescript
async forgotPassword(email: string): Promise<ForgotPasswordResult> {
  const record = await ensureAuthStore();
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail !== record.email.toLowerCase()) {
    return { success: false, reason: 'email_mismatch' };
  }

  // Generate 6-digit OTP and hash it
  const otp = generateOtp();
  record.otpHash = await bcrypt.hash(otp, 10);
  record.otpExpiresAt = Date.now() + OTP_TTL_MS; // 5 minutes
  record.attemptCount = 0;
  await authStoreService.save(record);

  // Send OTP via email API (configured by consuming app)
  try {
    const { sendEmail } = await import('./emailService');
    await sendEmail({
      to: [record.email],
      subject: '[App] Password Reset OTP',
      templateName: 'otp-email',
      data: { otpCode: otp, expiryMinutes: 5 }
    });
  } catch (error) {
    console.error('[OTP_EMAIL_ERROR] Failed to send OTP email:', error);
    return { success: false, reason: 'email_send_failed' };
  }

  return { success: true };
}

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
```

#### NEW verifyOtp(otp: string)
```typescript
async verifyOtp(otp: string): Promise<OtpVerificationResult> {
  const record = await ensureAuthStore();

  // Check if OTP was requested
  if (!record.otpHash || !record.otpExpiresAt) {
    return { success: false, reason: 'no_otp_requested' };
  }

  // Check if OTP has expired
  if (Date.now() > record.otpExpiresAt) {
    // Clear expired OTP
    record.otpHash = null;
    record.otpExpiresAt = null;
    await authStoreService.save(record);
    return { success: false, reason: 'otp_expired' };
  }

  // Verify OTP against stored hash
  const isMatch = await bcrypt.compare(otp, record.otpHash);
  if (!isMatch) {
    return { success: false, reason: 'invalid_otp' };
  }

  return { success: true };
}
```

#### Modified resetPassword(newPassword: string)
```typescript
async resetPassword(newPassword: string): Promise<ResetPasswordResult> {
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);

  if (!(hasMinLength && hasUppercase && hasNumber)) {
    return { success: false, reason: 'invalid_password' };
  }

  const record = await ensureAuthStore();

  // Update password
  record.passwordHash = await bcrypt.hash(newPassword, 10);
  record.lastPasswordResetAt = new Date().toISOString();
  record.attemptCount = 0;

  // Clear OTP fields after successful password reset
  record.otpHash = null;
  record.otpExpiresAt = null;

  await authStoreService.save(record);

  return { success: true };
}
```

### 4.5 IPC Handler (NEW)
```typescript
ipcMain.handle('auth:verify-otp', async (_event, payload: { otp: string }) => {
  const schema = z.object({
    otp: z.string().length(6, 'OTP must be 6 digits')
  });
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
  }

  return authService.verifyOtp(payload.otp);
});
```

## 5. Breaking Changes
| Change | Impact |
|--------|--------|
| Remove `tempPasswordHash` field | Existing data migration needed - clear this field on upgrade |
| Remove `tempPasswordExpiresAt` field | Replaced by `otpExpiresAt` |
| `forgotPassword()` now returns `{ success: boolean, reason?: string }` | No longer returns `tempPassword` (was always null in new flow) |
| `resetPassword()` clears OTP fields | After reset, no OTP verification possible |

## 6. Testing Steps

### 6.1 Unit Tests
| Test | Description |
|------|-------------|
| OTP generation | Verify 6-digit numeric string (100000-999999) |
| OTP hashing | Verify bcrypt hash is stored in `otpHash` field |
| OTP expiry | Verify `otpExpiresAt` is set to current time + 5 minutes |
| `verifyOtp()` success | Verify returns `{ success: true }` with correct OTP |
| `verifyOtp()` invalid | Verify returns `{ success: false, reason: 'invalid_otp' }` |
| `verifyOtp()` expired | Verify returns `{ success: false, reason: 'otp_expired' }` and clears fields |
| `verifyOtp()` not requested | Verify returns `{ success: false, reason: 'no_otp_requested' }` |
| `resetPassword()` clears OTP | Verify `otpHash` and `otpExpiresAt` are null after reset |
| Email send failure | Verify `forgotPassword()` returns `{ success: false, reason: 'email_send_failed' }` |

### 6.2 Integration Tests (with Chakra)
| Test | Description |
|------|-------------|
| Full flow | Enter email → OTP sent → Enter correct OTP → Reset password (success) |
| Wrong OTP | Enter email → OTP sent → Enter wrong OTP → verification fails |
| OTP expiry | Wait 5+ minutes → Enter OTP → verification fails with 'otp_expired' |
| Email failure | Email service not configured → forgotPassword returns 'email_send_failed' |

## 7. Migration Note
On first startup after this PR:
- Read existing `tempPasswordHash` if present (may contain old temp password or OTP hash)
- Clear it (set to null) since it's being replaced
- New OTP flow will populate `otpHash` and `otpExpiresAt` instead

## 8. Checklist
- [ ] Remove `tempPasswordHash` from AuthStoreRecord
- [ ] Remove `tempPasswordExpiresAt` from AuthStoreRecord
- [ ] Add `otpHash` field to AuthStoreRecord
- [ ] Add `otpExpiresAt` field to AuthStoreRecord
- [ ] Modify `forgotPassword()` to generate OTP + send email
- [ ] Add `verifyOtp()` method to authService
- [ ] Add `auth:verify-otp` IPC handler in ipcService.ts
- [ ] Modify `resetPassword()` to clear OTP fields
- [ ] Add migration logic for existing tempPasswordHash data
- [ ] Add unit tests for OTP generation, hashing, verification
- [ ] Update Chakra preload types with verifyOtp method