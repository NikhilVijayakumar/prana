import { HttpStatusCode, ServerResponse } from 'astra';

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
    const files = await window.api.vault.listFiles();

    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Vault contents fetched',
      data: files,
    } as ServerResponse<VaultFile[]>;
  }

  async selectAndIngestFiles(): Promise<ServerResponse<VaultFile[]>> {
    const files = await window.api.vault.selectAndIngest();

    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Files ingested',
      data: files,
    } as ServerResponse<VaultFile[]>;
  }

  async publishVaultChanges(approvedByUser: boolean, message?: string): Promise<VaultPublishResult> {
    return window.api.vault.publish(message, approvedByUser);
  }
}
