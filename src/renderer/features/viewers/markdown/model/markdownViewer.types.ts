export interface MarkdownLoadInput {
  source: 'runtime' | 'vault';
  path: string;
  format: 'markdown';
  ownerType?: 'VAULT_DOCUMENT' | 'SYSTEM_LOG' | 'AUDIT_REPORT' | 'GOOGLE_DOC';
}

export interface MarkdownRawContent {
  content: string;
  path: string;
  format: string;
  ownerType?: string;
}

export type MarkdownPipelineStage =
  | 'IDLE'
  | 'LOADING'
  | 'VALIDATING'
  | 'PARSING'
  | 'SANITIZING'
  | 'RENDERED'
  | 'SANITIZATION_FAILED';
