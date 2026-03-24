export interface LoginFormState {
  email: string;
  password: string;
}

export interface AuthSession {
  directorName: string;
  email: string;
  sessionToken: string;
  loggedInAt: number;
}

export interface ForgotPasswordFormState {
  email: string;
}

export interface ResetPasswordFormState {
  newPassword: string;
  confirmPassword: string;
}

export type SSHVerifyStatus = 'idle' | 'verifying' | 'verified' | 'failed';
