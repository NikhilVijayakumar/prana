import { IEventRegistry } from '../event-registry/eventRegistryService';

export type SyncDomain = 'vault' | 'document' | 'sheet';
export type SyncOperation = 'PUSH' | 'PULL' | 'VERIFY' | 'RECONCILE' | 'RECOVER';

export interface SyncJob {
  jobId: string;
  domain: SyncDomain;
  operation: SyncOperation;
  payloadRef: string;
}

export interface SyncResult {
  success: boolean;
  requiresReconcile?: boolean;
  reason?: string;
}

export interface IDomainAdapter {
  push(payloadRef: string): Promise<SyncResult>;
  pull(payloadRef: string): Promise<SyncResult>;
  verify(payloadRef: string): Promise<SyncResult>;
  reconcile(payloadRef: string): Promise<SyncResult>;
  recover(payloadRef: string): Promise<SyncResult>;
}

export interface ISyncEngineService {
  dispatch(job: SyncJob): Promise<SyncResult>;
  registerAdapter(domain: SyncDomain, adapter: IDomainAdapter): void;
}

class SyncEngineService implements ISyncEngineService {
  private adapters = new Map<SyncDomain, IDomainAdapter>();
  private events: IEventRegistry | null = null;

  setEventRegistry(events: IEventRegistry): void {
    this.events = events;
  }

  registerAdapter(domain: SyncDomain, adapter: IDomainAdapter): void {
    this.adapters.set(domain, adapter);
  }

  async dispatch(job: SyncJob): Promise<SyncResult> {
    const adapter = this.adapters.get(job.domain);
    if (!adapter) {
      const result: SyncResult = { success: false, reason: 'unknown_operation' };
      this.emitFailure(job);
      return result;
    }

    const knownOps: SyncOperation[] = ['PUSH', 'PULL', 'VERIFY', 'RECONCILE', 'RECOVER'];
    if (!knownOps.includes(job.operation)) {
      const result: SyncResult = { success: false, reason: 'unknown_operation' };
      this.emitFailure(job);
      return result;
    }

    let result: SyncResult;

    try {
      switch (job.operation) {
        case 'PUSH':
          result = await adapter.push(job.payloadRef);
          if (result.success) {
            const verifyResult = await adapter.verify(job.payloadRef);
            if (!verifyResult.success || verifyResult.requiresReconcile) {
              result = { ...result, requiresReconcile: true };
            }
          }
          break;
        case 'PULL':
          result = await adapter.pull(job.payloadRef);
          if (result.success) {
            const verifyResult = await adapter.verify(job.payloadRef);
            if (!verifyResult.success || verifyResult.requiresReconcile) {
              result = { ...result, requiresReconcile: true };
            }
          }
          break;
        case 'VERIFY':
          result = await adapter.verify(job.payloadRef);
          break;
        case 'RECONCILE':
          result = await adapter.reconcile(job.payloadRef);
          break;
        case 'RECOVER':
          result = await adapter.recover(job.payloadRef);
          if (result.success) {
            const verifyResult = await adapter.verify(job.payloadRef);
            if (!verifyResult.success || verifyResult.requiresReconcile) {
              result = { ...result, requiresReconcile: true };
            }
          }
          break;
      }
    } catch (err) {
      result = { success: false, reason: err instanceof Error ? err.message : String(err) };
      this.emitFailure(job);
      return result;
    }

    if (!result.success) {
      this.emitFailure(job);
    }

    return result;
  }

  private emitFailure(job: SyncJob): void {
    try {
      this.events?.emit({
        eventType: `storage:sync:failed`,
        source: 'syncEngine',
        payload: { jobId: job.jobId, domain: job.domain, operation: job.operation }
      });
    } catch { /* ignore emit errors */ }
  }
}

export const syncEngineService = new SyncEngineService();
