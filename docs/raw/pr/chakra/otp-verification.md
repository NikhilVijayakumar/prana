# Prana PR: OTP Verification for Forgot Password Flow

## PR Title
`feat: add OTP verification step for forgot password flow`

## 1. Overview
Adds OTP verification logic to Prana's auth service to support a 3-step forgot password flow: Request OTP → Verify OTP → Reset Password. This aligns with Chakra's UI expectations in `todo.md`.

## 2. Key Design Decisions
| Decision | Resolution |
|----------|-------------|
| OTP Generation | 6-digit numeric, bcrypt-hashed, stored in existing `tempPasswordHash` field |
| OTP Expiry | 5 minutes (300,000 ms), stored in existing `tempPasswordExpiresAt` |
| OTP Delivery | Via Prana's general email API (configured by Chakra) |
| Verification | New `verifyOtp()` method compares bcrypt hash |
| IPC Handler | New `auth:verify-otp` handler added to `ipcService.ts` |

## 3. Changes to Prana

### 3.1 Modified Files

| File Path | Changes |
|-----------|---------|
| `src/main/services/authService.ts` | - Modify `forgotPassword()`: generate 6-digit OTP, store hash, send via email API (no temp password in response)<br>- Add `verifyOtp(otp: string)` method<br>- Update `resetPassword()` to work with OTP verification |
| `src/main/services/ipcService.ts` | - Modify `auth:forgot-password` handler: no tempPassword in response<br>- Add `auth:verify-otp` handler<br>- Modify `auth:reset-password` handler if needed |
| `src/ui/authentication/repo/AuthRepo.ts` | - Modify `verifySSH()` to call new `verifyOtp()` instead<br>- Add `verifyOtp(otp: string)` method to repo |
| `src/ui/authentication/viewmodel/useForgotPasswordViewModel.ts` | - Update to handle 3-step flow: email → OTP verification → password reset<br>- Remove temp password display state |

### 3.2 Detailed Code Changes

#### `authService.ts` - New/Modified Methods

```typescript
// Generate 6-digit OTP
const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Modified forgotPassword
async forgotPassword(email: string): Promise<ForgotPasswordResult> {
  const record = await ensureAuthStore();
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail !== record.email.toLowerCase()) {
    return { success: false, reason: 'email_mismatch', tempPassword: null };
  }

  const otp = generateOtp();
  record.tempPasswordHash = await bcrypt.hash(otp, 10);
  record.tempPasswordExpiresAt = Date.now() + TEMP_PASSWORD_TTL_MS;
  record.attemptCount = 0;
  await authStoreService.save(record);

  // Send OTP via email API (configured by consuming app)
  try {
    const { sendEmail } = await import('./emailService');
    await sendEmail({
      to: [record.email],
      subject: '[Chakra] Password Reset OTP',
      templateName: 'otp-email',
      data: { otpCode: otp, expiryMinutes: 5 }
    });
  } catch (error) {
    console.error('[OTP_EMAIL_ERROR] Failed to send OTP email:', error);
    return { success: false, reason: 'email_send_failed', tempPassword: null };
  }

  return { success: true, tempPassword: null };
}

// New verifyOtp method
async verifyOtp(otp: string): Promise<OtpVerificationResult> {
  const record = await ensureAuthStore();

  if (!record.tempPasswordHash || !record.tempPasswordExpiresAt) {
    return { success: false, reason: 'no_otp_requested' };
  }

  if (Date.now() > record.tempPasswordExpiresAt) {
    record.tempPasswordHash = null;
    record.tempPasswordExpiresAt = null;
    await authStoreService.save(record);
    return { success: false, reason: 'otp_expired' };
  }

  const isMatch = await bcrypt.compare(otp, record.tempPasswordHash);
  if (!isMatch) {
    return { success: false, reason: 'invalid_otp' };
  }

  return { success: true };
}

export interface OtpVerificationResult {
  success: boolean;
  reason?: 'no_otp_requested' | 'otp_expired' | 'invalid_otp';
}
```

#### `ipcService.ts` - New Handler

```typescript
ipcMain.handle('auth:verify-otp', async (_event, payload: { otp: string }) => {
  const schema = z.object({ otp: z.string() });
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
  }

  return authService.verifyOtp(payload.otp);
});
```

#### `AuthRepo.ts` - New Method

```typescript
async verifyOtp(otp: string): Promise<ServerResponse<boolean>> {
  const result = await safeIpcCall(
    'auth.verifyOtp',
    () => window.api.auth.verifyOtp(otp),
    (value) => typeof value === 'object' && value !== null
  );

  return {
    isSuccess: result.success ?? false,
    isError: !result.success,
    status: HttpStatusCode.SUCCESS,
    statusMessage: result.reason ?? 'verified',
    data: result.success ?? false
  } as ServerResponse<boolean>;
}
```

## 4. Integration with Email API PR
This PR depends on the general email API PR (`general-email-api.md`):
- Uses `sendEmail()` from `emailService.ts`
- Consuming app (Chakra) must configure email service before calling `forgotPassword()`

## 5. Testing Steps

### 5.1 Unit Tests
- `generateOtp()` produces 6-digit numeric string
- `verifyOtp()` succeeds with correct OTP
- `verifyOtp()` fails with incorrect OTP
- `verifyOtp()` fails when OTP expired
- `verifyOtp()` fails when no OTP was requested
- `forgotPassword()` sends OTP via email API

### 5.2 E2E Tests (Chakra)
- Forgot password flow: enter email → OTP sent → enter correct OTP → reset password (success)
- Wrong OTP entered → verification fails
- Wait 5+ minutes → OTP expires → verification fails

## 6. Breaking Changes
- `forgotPassword()` no longer returns `tempPassword` in response (returns `null`)
- Chakra's `useForgotPasswordViewModel.ts` must be updated to handle new flow
- `AuthRepo.verifySSH()` behavior changes (now calls `verifyOtp()`)

## 7. Checklist
- [ ] Modify `authService.forgotPassword()` to generate OTP + send email
- [ ] Add `authService.verifyOtp()` method
- [ ] Add `auth:verify-otp` IPC handler in `ipcService.ts`
- [ ] Modify `AuthRepo.ts` to add `verifyOtp()` method
- [ ] Update `useForgotPasswordViewModel.ts` for 3-step flow
- [ ] Add unit tests for OTP verification
- [ ] Update Chakra UI to match 3-step flow from `todo.md`
- [ ] Cross-check with general-email-api PR (dependency)
