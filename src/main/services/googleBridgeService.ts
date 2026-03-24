import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getGovernanceRepoPath } from './governanceRepoService';
import type {
  GoogleSheetsGatewayProtocol,
  GoogleFormsGatewayProtocol,
  GoogleSheetStaffRow,
  GoogleFormFeedbackResponse,
} from './administrationIntegrationService';
import type { DocumentConversionService } from './documentConversionService';

const DHI_VAULT_ROOT = 'dhi-vault';

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
}

export interface GoogleDocsPublisherProtocol {
  publishPolicyToDoc(policyId: string, htmlContent: string): Promise<GoogleDocsPublishResult>;
}

export interface GoogleDocsPullerProtocol {
  pullDocToVault(documentId: string, vaultTargetPath: string): Promise<GoogleDocsPullResult>;
}

const getVaultRootPath = (): string => {
  return join(getGovernanceRepoPath(), DHI_VAULT_ROOT);
};

const resolveCredentials = (): GoogleBridgeCredentials | null => {
  const clientId = process.env.GOOGLE_WORKSPACE_CLIENT_ID ?? '';
  const clientSecret = process.env.GOOGLE_WORKSPACE_CLIENT_SECRET ?? '';
  const refreshToken = process.env.GOOGLE_WORKSPACE_REFRESH_TOKEN ?? '';
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL ?? '';

  if (!clientId || !clientSecret || !refreshToken || !adminEmail) {
    return null;
  }

  return { clientId, clientSecret, refreshToken, adminEmail };
};



class FileBackedDocsPublisher implements GoogleDocsPublisherProtocol {
  async publishPolicyToDoc(policyId: string, htmlContent: string): Promise<GoogleDocsPublishResult> {
    const now = new Date().toISOString();

    try {
      const publishDir = join(getVaultRootPath(), 'org', 'administration', 'published');
      await mkdir(publishDir, { recursive: true });

      const outputPath = join(publishDir, `${policyId}.published.html`);
      await writeFile(outputPath, htmlContent, 'utf8');

      return {
        status: 'PUBLISHED',
        message: `Policy ${policyId} published to local vault (file-backed mode).`,
        documentId: `local://${outputPath}`,
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

    const publishedPath = join(getVaultRootPath(), 'org', 'administration', 'published');
    const localHtmlFile = join(publishedPath, `${documentId}.published.html`);

    if (!existsSync(localHtmlFile)) {
      return {
        status: 'SKIPPED',
        message: `No published document found for ID: ${documentId}. File-backed mode requires local publish first.`,
        vaultPath: null,
        pulledAt: now,
      };
    }

    try {
      const htmlContent = await readFile(localHtmlFile, 'utf8');

      if (this.conversionService) {
        const converted = await this.conversionService.convertContent({
          sourceFormat: 'html',
          targetFormat: 'markdown',
          content: htmlContent,
        });

        const targetDir = join(getVaultRootPath(), ...vaultTargetPath.split('/').slice(0, -1));
        await mkdir(targetDir, { recursive: true });

        const fullTarget = join(getVaultRootPath(), vaultTargetPath);
        await writeFile(fullTarget, converted.content, 'utf8');

        return {
          status: 'PULLED',
          message: `Document ${documentId} pulled and converted to markdown in vault.`,
          vaultPath: vaultTargetPath,
          pulledAt: now,
        };
      }

      const targetDir = join(getVaultRootPath(), ...vaultTargetPath.split('/').slice(0, -1));
      await mkdir(targetDir, { recursive: true });

      const fullTarget = join(getVaultRootPath(), vaultTargetPath);
      await writeFile(fullTarget, htmlContent, 'utf8');

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
    // When googleapis is installed, this will use the Sheets API v4 to read
    // the staff registry spreadsheet. For now, this falls back to returning
    // an empty array, signaling that the file-backed gateway should be used.
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
    // When googleapis is installed, this will use the Forms API to read
    // feedback responses. Falls back to empty array.
    console.log(
      `[GoogleBridge] Live Forms gateway not yet wired. Credentials for: ${this._credentials.adminEmail}`,
    );
    return [];
  }
}

class LiveGoogleDocsPublisher implements GoogleDocsPublisherProtocol {
  constructor(_credentials: GoogleBridgeCredentials) {}

  async publishPolicyToDoc(policyId: string, htmlContent: string): Promise<GoogleDocsPublishResult> {
    // Live Google Docs/Drive API integration placeholder.
    // When googleapis is installed, this will create/update a Google Doc
    // from the HTML content and share it according to policy governance rules.
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
    // Live Google Drive API integration placeholder.
    // When googleapis is installed, this will download the DOCX export of
    // a Google Doc, convert to markdown using the conversion service,
    // and write to the vault target path.
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

  constructor(
    conversionService: DocumentConversionService | null = null,
    credentialsOverride?: GoogleBridgeCredentials | null,
  ) {
    this.credentials = credentialsOverride !== undefined ? credentialsOverride : resolveCredentials();

    const mappingPath = join(
      getVaultRootPath(),
      'org',
      'administration',
      'integrations',
      'google-sheets.mapping.json',
    );

    let spreadsheetId = '';
    try {
      if (existsSync(mappingPath)) {
        const raw = require('fs').readFileSync(mappingPath, 'utf8');
        const mapping = JSON.parse(raw) as { workbook?: { spreadsheetId?: string } };
        spreadsheetId = mapping?.workbook?.spreadsheetId ?? '';
      }
    } catch {
      spreadsheetId = '';
    }

    this.config = {
      credentials: this.credentials,
      spreadsheetId,
      formsEnabled: this.credentials !== null,
      docsEnabled: this.credentials !== null,
    };

    if (this.credentials && spreadsheetId && spreadsheetId !== 'REPLACE_WITH_SPREADSHEET_ID') {
      this.sheetsGateway = new LiveGoogleSheetsGateway(this.credentials, spreadsheetId);
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
}

export const googleBridgeService = new GoogleBridgeService();
