export type AppLifecycleStatus =
  | 'NOT_INSTALLED'
  | 'INSTALLING'
  | 'INSTALLED'
  | 'RUNNING'
  | 'STOPPED'
  | 'UPDATING'
  | 'UNINSTALLING'
  | 'FAILED'
  | 'CORRUPTED';

export interface AppRegistryRecord {
  appId: string;
  name: string;
  version: string;
  installedAt: string;
  status: AppLifecycleStatus;
  metadata?: Record<string, unknown>;
}

export interface IdentityAccount {
  accountId: string;
  provider: string;
  email?: string;
  linkedAt: string;
}

export interface RuntimeConfigEntry {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface UpdateMetadata {
  appId: string;
  currentVersion: string;
  availableVersion?: string;
  lastCheckedAt: string;
  lastAppliedAt?: string;
}

export interface InstallProgressEvent {
  appId: string;
  phase: 'INSTALLING' | 'DONE' | 'FAILED';
  progress: number;
}

export interface AppStateChangeEvent {
  appId: string;
  status: AppLifecycleStatus;
}
