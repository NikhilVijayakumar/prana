export type VirtualDriveId = 'system' | 'vault';
export type VirtualDriveStage = 'UNMOUNTED' | 'MOUNTING' | 'MOUNTED' | 'FAILED' | 'UNMOUNTING';

export interface VirtualDriveRecord {
  id: VirtualDriveId;
  stage: VirtualDriveStage;
  posture: 'SECURE' | 'DEGRADED' | 'UNAVAILABLE';
  providerId: string;
  mountPoint: string;
  sourcePath: string;
  resolvedPath: string;
  usedFallbackPath: boolean;
  pid: number | null;
  mountedAt: string | null;
  unmountedAt: string | null;
  activeSessionCount: number;
  retryCount: number;
  lastError: string | null;
  lastStderr: string | null;
}

const records = new Map<VirtualDriveId, VirtualDriveRecord>();

const cloneRecord = (record: VirtualDriveRecord): VirtualDriveRecord => ({ ...record });

export const mountRegistryService = {
  upsert(record: VirtualDriveRecord): VirtualDriveRecord {
    records.set(record.id, cloneRecord(record));
    return cloneRecord(record);
  },

  get(id: VirtualDriveId): VirtualDriveRecord | null {
    const record = records.get(id);
    return record ? cloneRecord(record) : null;
  },

  list(): VirtualDriveRecord[] {
    return Array.from(records.values()).map(cloneRecord);
  },

  clear(id: VirtualDriveId): void {
    records.delete(id);
  },

  reset(): void {
    records.clear();
  },
};
