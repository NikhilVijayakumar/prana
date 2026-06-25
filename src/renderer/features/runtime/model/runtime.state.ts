import { AppRegistryRecord, IdentityAccount } from './runtime.types';

export interface RuntimeIdentityState {
  identity: IdentityAccount | null;
}

export interface RuntimeRegistryState {
  applications: AppRegistryRecord[];
}

export interface RuntimeInstallState {
  installResult: AppRegistryRecord | null;
  progress: number;
  phase: string;
}

export interface RuntimeUpdateState {
  updateResult: AppRegistryRecord | null;
  progress: number;
  phase: string;
}
