import type {
  GoogleSheetsGatewayProtocol,
  GoogleFormsGatewayProtocol,
  GoogleSheetStaffRow,
  GoogleFormFeedbackResponse,
} from './administrationIntegrationService';
import type { DocumentConversionService } from './documentConversionService';
import { cronSchedulerService } from './cronSchedulerService';
import { sqliteConfigStoreService } from './sqliteConfigStoreService';
import { runtimeDocumentStoreService } from './runtimeDocumentStoreService';

export interface GoogleDocsPublishResult {
  status: 'PUBLISHED' | 'SKIPPED' | 'FAILED';
  message: string;
  documentId: string | null;
  publishedAt: string;
}

export interface GoogleDocsPullResult {
  status: 'PULLED' | 'SKIPPED' | 'FAILED';
  message: string;
  vaultPath: string | null;
  pulledAt: string;
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

export interface GoogleDriveSyncScheduleResult {
  jobId: string;
  target: string;
  expression: string;
}

export interface GoogleBridgeCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  adminEmail: string;
}

export interface GoogleBridgeConfig {
  credentials: GoogleBridgeCredentials | null;
  spreadsheetId: string;
  formsEnabled: boolean;
  docsEnabled: boolean;
}

export interface GoogleBridgeSnapshot {
  mode: 'live' | 'file-backed';
  config: GoogleBridgeConfig;
  sheetsConnected: boolean;
  formsConnected: boolean;
  docsConnected: boolean;
  latestSync: GoogleDriveSyncResult | null;
}

export interface GoogleDocsPublisherProtocol {
  publishPolicyToDoc(policyId: string, htmlContent: string): Promise<GoogleDocsPublishResult>;
}

export interface GoogleDocsPullerProtocol {
  pullDocToVault(documentId: string, vaultTargetPath: string): Promise<GoogleDocsPullResult>;
}

const PUBLISHED_DOC_PREFIX = 'org/administration/published';
const GOOGLE_SYNC_SUMMARY_PATH = 'org/administration/integrations/google-workspace.sync-summary.json';
const GOOGLE_SYNC_CRON_JOB_ID = 'job-google-drive-sync';
const GOOGLE_SYNC_CRON_TARGET = 'GOOGLE_DRIVE_SYNC';
const GOOGLE_SYNC_CRON_EXPRESSION = '0 */12 * * *';

const resolveCredentials = (): GoogleBridgeCredentials | null => {
  const googleConfig = sqliteConfigStoreService.readSnapshotSync()?.config?.google;
  const clientId = googleConfig?.clientId ?? '';
  const clientSecret = googleConfig?.clientSecret ?? '';
  const refreshToken = googleConfig?.refreshToken ?? '';
  const adminEmail = googleConfig?.adminEmail ?? '';

  if (!clientId || !clientSecret || !refreshToken || !adminEmail) {
    return null;
  }

  return { clientId, clientSecret, refreshToken, adminEmail };
};

class FileBackedDocsPublisher implements GoogleDocsPublisherProtocol {
  async publishPolicyToDoc(policyId: string, htmlContent: string): Promise<GoogleDocsPublishResult> {
    const now = new Date().toISOString();

    try {
      const documentKey = `${PUBLISHED_DOC_PREFIX}/${policyId}.published.html`;
      await runtimeDocumentStoreService.writeText(documentKey, htmlContent);
      await runtimeDocumentStoreService.flushPendingToVault(`sync: publish policy ${policyId}`);

      return {
        status: 'PUBLISHED',
        message: `Policy ${policyId} published to runtime document cache.`,
        documentId: `local://${documentKey}`,
        publishedAt: now,
      };
    } catch (error) {
      return {
        status: 'FAILED',
        message: error instanceof Error ? error.message : 'Unknown publish failure.',
        documentId: null,
        publishedAt: now,
      };
    }
  }
}

class FileBackedDocsPuller implements GoogleDocsPullerProtocol {
  constructor(private readonly conversionService: DocumentConversionService | null) {}

  async pullDocToVault(documentId: string, vaultTargetPath: string): Promise<GoogleDocsPullResult> {
    const now = new Date().toISOString();
    const localHtmlFile = `${PUBLISHED_DOC_PREFIX}/${documentId}.published.html`;
    const htmlContent = await runtimeDocumentStoreService.readText(localHtmlFile);
    if (!htmlContent) {
      return {
        status: 'SKIPPED',
        message: `No published document found for ID: ${documentId}. File-backed mode requires local publish first.`,
        vaultPath: null,
        pulledAt: now,
      };
    }

    try {
      if (this.conversionService) {
        const converted = await this.conversionService.convertContent({
          sourceFormat: 'html',
          targetFormat: 'markdown',
          content: htmlContent,
        });
        await runtimeDocumentStoreService.writeText(vaultTargetPath, converted.content);
        await runtimeDocumentStoreService.flushPendingToVault(`sync: pull google doc ${documentId}`);

        return {
          status: 'PULLED',
          message: `Document ${documentId} pulled and converted to markdown in vault.`,
          vaultPath: vaultTargetPath,
          pulledAt: now,
        };
      }
      await runtimeDocumentStoreService.writeText(vaultTargetPath, htmlContent);
      await runtimeDocumentStoreService.flushPendingToVault(`sync: pull google doc ${documentId}`);

      return {
        status: 'PULLED',
        message: `Document ${documentId} pulled to vault as HTML (no conversion service available).`,
        vaultPath: vaultTargetPath,
        pulledAt: now,
      };
    } catch (error) {
      return {
        status: 'FAILED',
        message: error instanceof Error ? error.message : 'Unknown pull failure.',
        vaultPath: null,
        pulledAt: now,
      };
    }
  }
}

class LiveGoogleSheetsGateway implements GoogleSheetsGatewayProtocol {
  constructor(
    private readonly _credentials: GoogleBridgeCredentials,
    private readonly _spreadsheetId: string,
  ) {}

  async listStaffRows(): Promise<GoogleSheetStaffRow[]> {
    // Live Google Sheets API integration placeholder.
    console.log(
      `[GoogleBridge] Live Sheets gateway not yet wired. Credentials for: ${this._credentials.adminEmail}, Sheet: ${this._spreadsheetId}`,
    );
    return [];
  }
}

class LiveGoogleFormsGateway implements GoogleFormsGatewayProtocol {
  constructor(private readonly _credentials: GoogleBridgeCredentials) {}

  async listFeedbackResponses(): Promise<GoogleFormFeedbackResponse[]> {
    // Live Google Forms API integration placeholder.
    console.log(
      `[GoogleBridge] Live Forms gateway not yet wired. Credentials for: ${this._credentials.adminEmail}`,
    );
    return [];
  }
}

class LiveGoogleDocsPublisher implements GoogleDocsPublisherProtocol {
  constructor(_credentials: GoogleBridgeCredentials) {}

  async publishPolicyToDoc(policyId: string, htmlContent: string): Promise<GoogleDocsPublishResult> {
    const now = new Date().toISOString();
    console.log(
      `[GoogleBridge] Live Docs publisher not yet wired. Policy: ${policyId}, Content length: ${htmlContent.length}`,
    );
    return {
      status: 'SKIPPED',
      message: 'Live Google Docs publisher not yet implemented. Use file-backed mode.',
      documentId: null,
      publishedAt: now,
    };
  }
}

class LiveGoogleDocsPuller implements GoogleDocsPullerProtocol {
  constructor(
    _credentials: GoogleBridgeCredentials,
    private readonly _conversionService: DocumentConversionService | null,
  ) {}

  async pullDocToVault(documentId: string, vaultTargetPath: string): Promise<GoogleDocsPullResult> {
    const now = new Date().toISOString();
    console.log(
      `[GoogleBridge] Live Docs puller not yet wired. Doc: ${documentId}, Target: ${vaultTargetPath}, Converter: ${this._conversionService ? 'available' : 'unavailable'}`,
    );
    return {
      status: 'SKIPPED',
      message: 'Live Google Docs puller not yet implemented. Use file-backed mode.',
      vaultPath: null,
      pulledAt: now,
    };
  }
}

export class GoogleBridgeService {
  private readonly credentials: GoogleBridgeCredentials | null;
  private readonly sheetsGateway: GoogleSheetsGatewayProtocol;
  private readonly formsGateway: GoogleFormsGatewayProtocol;
  private readonly docsPublisher: GoogleDocsPublisherProtocol;
  private readonly docsPuller: GoogleDocsPullerProtocol;
  private readonly config: GoogleBridgeConfig;
  private latestSync: GoogleDriveSyncResult | null = null;

  constructor(
    conversionService: DocumentConversionService | null = null,
    credentialsOverride?: GoogleBridgeCredentials | null,
  ) {
    this.credentials = credentialsOverride !== undefined ? credentialsOverride : resolveCredentials();
    const spreadsheetId = '';

    this.config = {
      credentials: this.credentials,
      spreadsheetId,
      formsEnabled: this.credentials !== null,
      docsEnabled: this.credentials !== null,
    };

    if (this.credentials) {
      this.sheetsGateway = spreadsheetId && spreadsheetId !== 'REPLACE_WITH_SPREADSHEET_ID'
        ? new LiveGoogleSheetsGateway(this.credentials, spreadsheetId)
        : {
          async listStaffRows() {
            return [];
          },
        };
      this.formsGateway = new LiveGoogleFormsGateway(this.credentials);
      this.docsPublisher = new LiveGoogleDocsPublisher(this.credentials);
      this.docsPuller = new LiveGoogleDocsPuller(this.credentials, conversionService);
    } else {
      this.sheetsGateway = {
        async listStaffRows() {
          return [];
        },
      };
      this.formsGateway = {
        async listFeedbackResponses() {
          return [];
        },
      };
      this.docsPublisher = new FileBackedDocsPublisher();
      this.docsPuller = new FileBackedDocsPuller(conversionService);
    }
  }

  getSnapshot(): GoogleBridgeSnapshot {
    const isLive = this.credentials !== null;

    return {
      mode: isLive ? 'live' : 'file-backed',
      config: this.config,
      sheetsConnected: isLive && this.config.spreadsheetId.length > 0,
      formsConnected: isLive && this.config.formsEnabled,
      docsConnected: isLive && this.config.docsEnabled,
      latestSync: this.latestSync,
    };
  }

  getSheetsGateway(): GoogleSheetsGatewayProtocol {
    return this.sheetsGateway;
  }

  getFormsGateway(): GoogleFormsGatewayProtocol {
    return this.formsGateway;
  }

  async publishPolicy(policyId: string, htmlContent: string): Promise<GoogleDocsPublishResult> {
    return this.docsPublisher.publishPolicyToDoc(policyId, htmlContent);
  }

  async pullDocument(documentId: string, vaultTargetPath: string): Promise<GoogleDocsPullResult> {
    return this.docsPuller.pullDocToVault(documentId, vaultTargetPath);
  }

  async runSync(source: 'MANUAL' | 'CRON' = 'MANUAL'): Promise<GoogleDriveSyncResult> {
    const startedAt = new Date().toISOString();
    const errors: string[] = [];
    let staffRows: GoogleSheetStaffRow[] = [];
    let feedbackResponses: GoogleFormFeedbackResponse[] = [];

    try {
      staffRows = await this.sheetsGateway.listStaffRows();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Sheets sync failed.');
    }

    try {
      feedbackResponses = await this.formsGateway.listFeedbackResponses();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Forms sync failed.');
    }

    const finishedAt = new Date().toISOString();
    const discoveredDocuments = staffRows.length + feedbackResponses.length;

    const summaryPayload = {
      source,
      mode: this.credentials ? 'live' : 'file-backed',
      startedAt,
      finishedAt,
      discoveredDocuments,
      sheetsRows: staffRows.length,
      formsResponses: feedbackResponses.length,
      errors,
    };

    let metadataPath: string | null = GOOGLE_SYNC_SUMMARY_PATH;
    try {
      await runtimeDocumentStoreService.writeText(
        GOOGLE_SYNC_SUMMARY_PATH,
        `${JSON.stringify(summaryPayload, null, 2)}\n`,
      );
      await runtimeDocumentStoreService.flushPendingToVault(`sync: google workspace ${source.toLowerCase()}`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Failed to persist Google sync summary.');
      metadataPath = null;
    }

    const result: GoogleDriveSyncResult = {
      status: errors.length === 0 ? 'SUCCESS' : 'FAILED',
      source,
      startedAt,
      finishedAt,
      discoveredDocuments,
      sheetsRows: staffRows.length,
      formsResponses: feedbackResponses.length,
      errors,
      metadataPath,
    };

    this.latestSync = result;
    return result;
  }

  async ensureSyncSchedulerJob(): Promise<GoogleDriveSyncScheduleResult> {
    await cronSchedulerService.upsertJob({
      id: GOOGLE_SYNC_CRON_JOB_ID,
      name: 'Google Workspace Sync',
      expression: GOOGLE_SYNC_CRON_EXPRESSION,
      target: GOOGLE_SYNC_CRON_TARGET,
      recoveryPolicy: 'RUN_ONCE',
      enabled: true,
      retentionDays: 30,
      maxRuntimeMs: 45_000,
    });

    cronSchedulerService.registerJobExecutor(GOOGLE_SYNC_CRON_JOB_ID, async () => {
      await this.runSync('CRON');
    });

    return {
      jobId: GOOGLE_SYNC_CRON_JOB_ID,
      target: GOOGLE_SYNC_CRON_TARGET,
      expression: GOOGLE_SYNC_CRON_EXPRESSION,
    };
  }

  disableSyncSchedulerJob(): void {
    cronSchedulerService.unregisterJobExecutor(GOOGLE_SYNC_CRON_JOB_ID);
  }
}

export const googleBridgeService = new GoogleBridgeService();
