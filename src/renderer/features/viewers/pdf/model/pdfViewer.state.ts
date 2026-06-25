import { PdfDocumentContent, PdfProvenanceMetadata } from './pdfViewer.types';

export interface PdfViewerState {
  document: PdfDocumentContent;
  provenance?: PdfProvenanceMetadata;
  currentPage: number;
  totalPages: number;
  zoom: number;
}
