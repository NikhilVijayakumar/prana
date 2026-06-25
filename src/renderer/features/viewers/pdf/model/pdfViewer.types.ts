export interface PdfFetchInput {
  source: 'runtime' | 'vault';
  path: string;
  documentId?: string;
}

export interface PdfDocumentContent {
  documentId: string;
  source: 'runtime' | 'vault';
  content: string; // base64
  path: string;
  sizeBytes: number;
}

export interface PdfProvenanceMetadata {
  documentId: string;
  source: 'vault' | 'google' | 'system';
  originPath: string;
  createdAt: string;
  lastModified: string;
}
