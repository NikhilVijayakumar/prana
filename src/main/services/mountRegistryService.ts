export type VirtualDriveId = 'system' | 'vault';
export type VirtualDriveStage = 'UNMOUNTED' | 'MOUNTING' | 'MOUNTED' | 'FAILED' | 'UNMOUNTING';

export interface VirtualDriveRecord {
  id: VirtualDriveId;
  stage: VirtualDriveStage;
  mountPoint: string;
  sourcePath: string;
  pid: number | null;
  mountedAt: string | null;
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
