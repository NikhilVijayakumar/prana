import { ServerResponse, HttpStatusCode } from 'astra';
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

export interface SSHStatusPayload {
  verified: boolean;
  message: string;
}

export class AuthRepo {
  async login(email: string, password: string): Promise<ServerResponse<LoginPayload>> {
    const result = await window.api.auth.login(email, password);

    if (result.success && result.email && result.sessionToken) {
      const onboardingComplete = await window.api.operations.getOnboardingCommitStatus();
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

    return {
      isSuccess: false,
      isError: true,
      status: HttpStatusCode.SUCCESS,
      statusMessage: reasonToMessage[result.reason] ?? 'invalid_credentials',
      data: null as unknown as LoginPayload,
    } as ServerResponse<LoginPayload>;
  }

  async verifySSH(email: string): Promise<ServerResponse<SSHVerifyPayload>> {
    const result = await window.api.auth.forgotPassword(email);
    return {
      isSuccess: result.success,
      isError: !result.success,
      status: HttpStatusCode.SUCCESS,
      statusMessage: result.reason,
      data: {
        verified: result.success,
        tempPassword: result.tempPassword,
      },
    } as ServerResponse<SSHVerifyPayload>;
  }

  async resetPassword(newPassword: string): Promise<ServerResponse<boolean>> {
    const result = await window.api.auth.resetPassword(newPassword);
    return {
      isSuccess: result.success,
      isError: !result.success,
      status: HttpStatusCode.SUCCESS,
      statusMessage: result.reason,
      data: result.success,
    } as ServerResponse<boolean>;
  }

  async checkSSHStatus(): Promise<ServerResponse<SSHStatusPayload>> {
    const status = await window.api.auth.getStatus();

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
