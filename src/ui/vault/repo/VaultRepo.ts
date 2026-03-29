import { HttpStatusCode, ServerResponse } from 'astra';
import { safeIpcCall } from 'prana/ui/common/errors/safeIpcCall';

export interface VaultFile {
  id: string;
  filename: string;
  size: string;
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  scanStatus: 'PENDING' | 'SCANNING' | 'CLEAN' | 'QUARANTINE';
  uploadedAt: string;
  validationErrors?: string[];
}

export interface VaultPublishResult {
  success: boolean;
  archivePath: string;
  committed: boolean;
  pushed: boolean;
  hadStashedChanges: boolean;
  message: string;
}

export class VaultRepo {
  async fetchVaultContents(): Promise<ServerResponse<VaultFile[]>> {
    const files = await safeIpcCall('vault.listFiles', () => window.api.vault.listFiles(), Array.isArray);

    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Vault contents fetched',
      data: files,
    } as ServerResponse<VaultFile[]>;
  }

  async selectAndIngestFiles(): Promise<ServerResponse<VaultFile[]>> {
    const files = await safeIpcCall('vault.selectAndIngest', () => window.api.vault.selectAndIngest(), Array.isArray);

    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Files ingested',
      data: files,
    } as ServerResponse<VaultFile[]>;
  }

  async publishVaultChanges(approvedByUser: boolean, message?: string): Promise<VaultPublishResult> {
    return safeIpcCall(
      'vault.publish',
      () => window.api.vault.publish(message, approvedByUser),
      (value) => typeof (value as { success?: unknown }).success === 'boolean',
    );
  }
}
