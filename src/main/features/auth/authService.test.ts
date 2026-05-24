import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';

let store: {
  directorName: string;
  email: string;
  passwordHash: string;
  otpHash: string | null;
  otpExpiresAt: number | null;
  lastPasswordResetAt: string;
  attemptCount?: number;
  attemptLockUntil?: number;
} | null = null;

const sendEmailMock = vi.fn();

vi.mock('../governance/governanceRepoService', () => ({
  ensureGovernanceRepoReady: vi.fn(),
}));

vi.mock('../../common/config/runtimeConfigService', () => ({
  getRuntimeBootstrapConfig: vi.fn(() => ({
    director: {
      name: 'Director',
      email: 'director@example.com',
      password: 'Director1',
    },
  })),
}));

vi.mock('../communication/emailService', () => ({
  sendEmail: sendEmailMock,
}));

vi.mock('./authStoreService', () => ({
  authStoreService: {
    get: vi.fn(async () => store),
    save: vi.fn(async (record) => {
      store = JSON.parse(JSON.stringify(record));
    }),
    clearOtpState: vi.fn(async () => {
      if (!store) {
        return;
      }

      store = {
        ...store,
        otpHash: null,
        otpExpiresAt: null,
      };
    }),
  },
}));

describe('authService login flow', () => {
  beforeEach(() => {
    store = {
      directorName: 'Director',
      email: 'director@example.com',
      passwordHash: bcrypt.hashSync('Director1', 10),
      otpHash: null,
      otpExpiresAt: null,
      lastPasswordResetAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      attemptCount: 0,
      attemptLockUntil: undefined,
    };
    sendEmailMock.mockReset();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  it('succeeds with valid email and password', async () => {
    const { authService } = await import('./authService');
    const result = await authService.login('director@example.com', 'Director1');

    expect(result.success).toBe(true);
    expect(result.directorName).toBe('Director');
    expect(result.email).toBe('director@example.com');
    expect(result.sessionToken).toMatch(/^prana_session_/);
    expect(result.sessionTokenExpiresAt).toBeTypeOf('string');
    expect(store?.attemptCount).toBe(0);
    expect(store?.attemptLockUntil).toBeUndefined();
  });

  it('rejects invalid password with invalid_credentials reason', async () => {
    const { authService } = await import('./authService');
    const result = await authService.login('director@example.com', 'WrongPassword1');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_credentials');
    expect(result.sessionToken).toBeNull();
    expect(store?.attemptCount).toBe(1);
  });

  it('rejects email mismatch with email_mismatch reason', async () => {
    const { authService } = await import('./authService');
    const result = await authService.login('wrong@example.com', 'Director1');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('email_mismatch');
    expect(result.sessionToken).toBeNull();
    expect(store?.attemptCount).toBe(1);
  });

  it('applies soft lockout after 3 failed attempts', async () => {
    const { authService } = await import('./authService');

    for (let i = 0; i < 3; i++) {
      const result = await authService.login('director@example.com', 'WrongPassword1');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_credentials');
    }

    expect(store?.attemptCount).toBe(3);
    expect(store?.attemptLockUntil).toBeGreaterThan(Date.now());
  });

  it('applies hard lockout after 10 failed attempts', async () => {
    const { authService } = await import('./authService');

    for (let i = 0; i < 10; i++) {
      const result = await authService.login('director@example.com', 'WrongPassword1');
      expect(result.success).toBe(false);
    }

    expect(store?.attemptCount).toBe(10);
    expect(store?.attemptLockUntil).toBeGreaterThan(Date.now());
  });

  it('returns invalid_credentials (not lockout detail) when account is locked', async () => {
    const { authService } = await import('./authService');

    for (let i = 0; i < 5; i++) {
      await authService.login('director@example.com', 'WrongPassword1');
    }

    const lockedResult = await authService.login('director@example.com', 'WrongPassword1');
    expect(lockedResult.success).toBe(false);
    expect(lockedResult.reason).toBe('invalid_credentials');
    expect(lockedResult.sessionToken).toBeNull();
  });

  it('resets attempt counter on successful login', async () => {
    const { authService } = await import('./authService');

    await authService.login('director@example.com', 'WrongPassword1');
    await authService.login('director@example.com', 'WrongPassword1');
    expect(store?.attemptCount).toBe(2);

    const result = await authService.login('director@example.com', 'Director1');
    expect(result.success).toBe(true);
    expect(store?.attemptCount).toBe(0);
    expect(store?.attemptLockUntil).toBeUndefined();
  });

  it('generates unique session tokens on each login', async () => {
    const { authService } = await import('./authService');

    const first = await authService.login('director@example.com', 'Director1');
    store!.attemptCount = 0; // reset for second login
    store!.attemptLockUntil = undefined;
    const second = await authService.login('director@example.com', 'Director1');

    expect(first.sessionToken).not.toBe(second.sessionToken);
    expect(first.sessionTokenExpiresAt).toBeTypeOf('string');
    expect(second.sessionTokenExpiresAt).toBeTypeOf('string');
  });

  it('is case-insensitive for email comparison', async () => {
    const { authService } = await import('./authService');
    const result = await authService.login('DIRECTOR@EXAMPLE.COM', 'Director1');

    expect(result.success).toBe(true);
    expect(result.email).toBe('director@example.com');
  });
});

describe('authService OTP flow', () => {
  beforeEach(() => {
    store = {
      directorName: 'Director',
      email: 'director@example.com',
      passwordHash: bcrypt.hashSync('Director1', 10),
      otpHash: null,
      otpExpiresAt: null,
      lastPasswordResetAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      attemptCount: 0,
      attemptLockUntil: undefined,
    };
    sendEmailMock.mockReset();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  it('requests otp, stores hash and sends email', async () => {
    sendEmailMock.mockResolvedValue({ success: true, messageId: 'msg-1' });

    const { authService } = await import('./authService');
    const result = await authService.forgotPassword('director@example.com');

    expect(result).toEqual({ success: true, tempPassword: null });
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['director@example.com'],
        subject: '[Prana] Password Reset OTP',
        templateName: 'otp-email',
        data: { otpCode: '100000', expiryMinutes: 5 },
      }),
    );
    expect(store?.otpHash).toBeTypeOf('string');
    expect(store?.otpExpiresAt).toBeGreaterThan(Date.now());
    expect(store?.attemptCount).toBe(0);

    const verifyResult = await authService.verifyOtp('100000');
    expect(verifyResult).toEqual({ success: true });
  });

  it('returns email_send_failed when otp delivery fails and clears otp state', async () => {
    sendEmailMock.mockResolvedValue({ success: false, error: 'Email service not configured' });

    const { authService } = await import('./authService');
    const result = await authService.forgotPassword('director@example.com');

    expect(result).toEqual({ success: false, reason: 'email_send_failed', tempPassword: null });
    expect(store?.otpHash).toBeNull();
    expect(store?.otpExpiresAt).toBeNull();
  });

  it('rejects expired otp and clears stored state', async () => {
    const hashedOtp = await bcrypt.hash('100000', 10);
    store = {
      ...store!,
      otpHash: hashedOtp,
      otpExpiresAt: Date.now() - 1000,
    };

    const { authService } = await import('./authService');
    const result = await authService.verifyOtp('100000');

    expect(result).toEqual({ success: false, reason: 'otp_expired' });
    expect(store?.otpHash).toBeNull();
    expect(store?.otpExpiresAt).toBeNull();
  });

  it('rejects missing otp request', async () => {
    const { authService } = await import('./authService');
    const result = await authService.verifyOtp('100000');

    expect(result).toEqual({ success: false, reason: 'no_otp_requested' });
  });

  it('clears otp fields on password reset', async () => {
    const hashedOtp = await bcrypt.hash('100000', 10);
    store = {
      ...store!,
      otpHash: hashedOtp,
      otpExpiresAt: Date.now() + 300000,
    };

    const { authService } = await import('./authService');
    const result = await authService.resetPassword('NewPass1');

    expect(result).toEqual({ success: true });
    expect(store?.otpHash).toBeNull();
    expect(store?.otpExpiresAt).toBeNull();
    expect(await bcrypt.compare('NewPass1', store!.passwordHash)).toBe(true);
  });
});