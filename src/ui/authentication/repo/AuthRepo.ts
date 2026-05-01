import { ServerResponse, HttpStatusCode } from 'astra';
import { safeIpcCall } from 'prana/ui/common/errors/safeIpcCall';
import {
  SESSION_STORAGE_KEY,
  ONBOARDING_COMPLETE_STORAGE_KEY,
  LEGACY_SESSION_STORAGE_KEY,
  LEGACY_ONBOARDING_COMPLETE_STORAGE_KEY,
} from 'prana/ui/constants/storageKeys';

export const SESSION_KEY = SESSION_STORAGE_KEY;
export const ONBOARDING_COMPLETE_KEY = ONBOARDING_COMPLETE_STORAGE_KEY;
export const LEGACY_SESSION_KEY = LEGACY_SESSION_STORAGE_KEY;
export const LEGACY_ONBOARDING_COMPLETE_KEY = LEGACY_ONBOARDING_COMPLETE_STORAGE_KEY;

export interface LoginPayload {
  directorName: string;
  email: string;
  isFirstInstall: boolean;
  sessionToken: string;
}

export interface SSHVerifyPayload {
  verified: boolean;
  tempPassword: string | null;
}

export interface CodeVerifyPayload {
  verified: boolean;
  reason?: string;
}

export interface SSHStatusPayload {
  verified: boolean;
  message: string;
}

interface RawAuthLoginResponse {
  success: boolean;
  email?: string;
  sessionToken?: string;
  directorName?: string;
  reason?: string;
}

interface RawAuthForgotPasswordResponse {
  success: boolean;
  tempPassword?: string | null;
  reason?: string;
}

interface RawAuthVerifyOtpResponse {
  success: boolean;
  reason?: string;
}

interface RawAuthResetPasswordResponse {
  success: boolean;
  reason: string;
}

interface RawAuthStatusResponse {
  sshVerified: boolean;
  sshMessage: string;
}

export class AuthRepo {
  async login(email: string, password: string): Promise<ServerResponse<LoginPayload>> {
    const result = await safeIpcCall<RawAuthLoginResponse>(
      'auth.login',
      () => window.api.auth.login(email, password),
      (value) => typeof (value as { success?: unknown }).success === 'boolean',
    );

    if (result.success && result.email && result.sessionToken) {
      const onboardingComplete = await safeIpcCall(
        'operations.getOnboardingCommitStatus',
        () => window.api.operations.getOnboardingCommitStatus(),
        (value) => typeof value === 'boolean',
      );
      return {
        isSuccess: true,
        isError: false,
        status: HttpStatusCode.SUCCESS,
        statusMessage: 'Authenticated',
        data: {
          directorName: result.directorName ?? 'Director',
          email: result.email,
          isFirstInstall: !onboardingComplete,
          sessionToken: result.sessionToken,
        },
      } as ServerResponse<LoginPayload>;
    }

    const reasonToMessage: Record<string, string> = {
      ssh_unavailable: 'ssh_unavailable',
      email_mismatch: 'email_mismatch',
      invalid_credentials: 'invalid_credentials',
    };
    const reason = result.reason ?? '';

    return {
      isSuccess: false,
      isError: true,
      status: HttpStatusCode.SUCCESS,
      statusMessage: reasonToMessage[reason] ?? 'invalid_credentials',
      data: null as unknown as LoginPayload,
    } as ServerResponse<LoginPayload>;
  }

  async verifySSH(email: string): Promise<ServerResponse<SSHVerifyPayload>> {
    const result = await safeIpcCall<RawAuthForgotPasswordResponse>(
      'auth.forgotPassword',
      () => window.api.auth.forgotPassword(email),
      (value) => typeof (value as { success?: unknown }).success === 'boolean',
    );
    return {
      isSuccess: result.success,
      isError: !result.success,
      status: HttpStatusCode.SUCCESS,
      statusMessage: result.reason,
      data: {
        verified: result.success,
        tempPassword: result.tempPassword ?? null,
      },
    } as ServerResponse<SSHVerifyPayload>;
  }

  async verifyOtp(otp: string): Promise<ServerResponse<boolean>> {
    const result = await safeIpcCall<RawAuthVerifyOtpResponse>(
      'auth.verifyOtp',
      () => window.api.auth.verifyOtp(otp),
      (value) => typeof (value as { success?: unknown }).success === 'boolean',
    );

    return {
      isSuccess: result.success,
      isError: !result.success,
      status: HttpStatusCode.SUCCESS,
      statusMessage: result.reason ?? (result.success ? 'verified' : 'verification_failed'),
      data: result.success,
    } as ServerResponse<boolean>;
  }

    async resetPassword(newPassword: string): Promise<ServerResponse<boolean>> {
    const result = await safeIpcCall<RawAuthResetPasswordResponse>(
      'auth.resetPassword',
      () => window.api.auth.resetPassword(newPassword),
      (value) => typeof (value as { success?: unknown }).success === 'boolean',
    );
    return {
      isSuccess: result.success,
      isError: !result.success,
      status: HttpStatusCode.SUCCESS,
      statusMessage: result.reason,
      data: result.success,
    } as ServerResponse<boolean>;
  }

  async verifyCode(code: string, _hash: string, _expiryTimestamp?: number): Promise<ServerResponse<CodeVerifyPayload>> {
    const result = await safeIpcCall<RawAuthVerifyOtpResponse>(
      'auth.verifyCode',
      () => window.api.auth.verifyOtp(code),
      (value) => typeof (value as { success?: unknown }).success === 'boolean',
    );
    return {
      isSuccess: result.success,
      isError: !result.success,
      status: HttpStatusCode.SUCCESS,
      statusMessage: result.reason ?? (result.success ? 'verified' : 'verification_failed'),
      data: {
        verified: result.success,
        reason: result.reason,
      },
    } as ServerResponse<CodeVerifyPayload>;
  }

  async checkSSHStatus(): Promise<ServerResponse<SSHStatusPayload>> {
    const status = await safeIpcCall<RawAuthStatusResponse>(
      'auth.getStatus',
      () => window.api.auth.getStatus(),
      (value) => typeof (value as { sshVerified?: unknown }).sshVerified === 'boolean',
    );

    return {
      isSuccess: status.sshVerified,
      isError: !status.sshVerified,
      status: HttpStatusCode.SUCCESS,
      statusMessage: status.sshMessage,
      data: {
        verified: status.sshVerified,
        message: status.sshMessage,
      },
    } as ServerResponse<SSHStatusPayload>;
  }
}
