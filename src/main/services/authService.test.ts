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

vi.mock('./governanceRepoService', () => ({
  ensureGovernanceRepoReady: vi.fn(),
}));

vi.mock('./runtimeConfigService', () => ({
  getRuntimeBootstrapConfig: vi.fn(() => ({
    director: {
      name: 'Director',
      email: 'director@example.com',
      password: 'Director1',
    },
  })),
}));

vi.mock('./emailService', () => ({
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