import { HttpStatusCode, ServerResponse } from 'astra';
import { safeIpcCall } from 'prana/ui/common/errors/safeIpcCall';

export interface SystemMetric {
  id: string;
  label: string;
  value: string;
  status: 'ok' | 'warning' | 'critical';
  threshold: string;
}

export interface GoogleDriveSyncResult {
  status: 'SUCCESS' | 'FAILED';
  source: 'MANUAL' | 'CRON';
  startedAt: string;
  finishedAt: string;
  discoveredDocuments: number;
  sheetsRows: number;
  formsResponses: number;
  errors: string[];
  metadataPath: string | null;
}

export interface GoogleBridgeSnapshot {
  mode: 'live' | 'file-backed';
  config: {
    credentials: {
      clientId: string;
      clientSecret: string;
      refreshToken: string;
      adminEmail: string;
    } | null;
    spreadsheetId: string;
    formsEnabled: boolean;
    docsEnabled: boolean;
  };
  sheetsConnected: boolean;
  formsConnected: boolean;
  docsConnected: boolean;
  latestSync: GoogleDriveSyncResult | null;
}

export interface InfrastructurePayload {
  crisisModeActive: boolean;
  activeAgents: string[];
  metrics: SystemMetric[];
  googleBridge: GoogleBridgeSnapshot | null;
}

interface InfrastructureCorePayload {
  crisisModeActive: boolean;
  activeAgents: string[];
  metrics: SystemMetric[];
}

export class InfrastructureRepo {
  async getSystemHealth(): Promise<ServerResponse<InfrastructurePayload>> {
    const [payload, googleBridge] = await Promise.all([
      safeIpcCall<InfrastructureCorePayload>(
      'operations.getInfrastructure',
      () => window.api.operations.getInfrastructure(),
      (value) => typeof value === 'object' && value !== null,
      ),
      this.getGoogleBridgeSnapshot(),
    ]);

    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Loaded',
      data: {
        ...payload,
        googleBridge,
      },
    } as ServerResponse<InfrastructurePayload>;
  }

  async getGoogleBridgeSnapshot(): Promise<GoogleBridgeSnapshot | null> {
    if (!window.api?.operations?.getGoogleBridgeSnapshot) {
      return null;
    }

    return safeIpcCall(
      'operations.getGoogleBridgeSnapshot',
      () => window.api.operations.getGoogleBridgeSnapshot(),
      (value) => typeof value === 'object' && value !== null,
    );
  }

  async runGoogleDriveSync(source: 'MANUAL' | 'CRON' = 'MANUAL'): Promise<GoogleDriveSyncResult> {
    return safeIpcCall(
      'operations.runGoogleDriveSync',
      () => window.api.operations.runGoogleDriveSync({ source }),
      (value) => typeof value === 'object' && value !== null,
    );
  }

  async ensureGoogleDriveSyncSchedule(): Promise<{ jobId: string; target: string; expression: string }> {
    return safeIpcCall(
      'operations.ensureGoogleDriveSyncSchedule',
      () => window.api.operations.ensureGoogleDriveSyncSchedule(),
      (value) => typeof value === 'object' && value !== null,
    );
  }

  async publishGooglePolicyDocument(policyId: string, htmlContent: string) {
    return safeIpcCall(
      'operations.publishGooglePolicyDocument',
      () => window.api.operations.publishGooglePolicyDocument({ policyId, htmlContent }),
      (value) => typeof value === 'object' && value !== null,
    );
  }

  async pullGoogleDocumentToVault(documentId: string, vaultTargetPath: string) {
    return safeIpcCall(
      'operations.pullGoogleDocumentToVault',
      () => window.api.operations.pullGoogleDocumentToVault({ documentId, vaultTargetPath }),
      (value) => typeof value === 'object' && value !== null,
    );
  }
}
