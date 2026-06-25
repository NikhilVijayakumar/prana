import { IpcService, ServerResponse } from 'astra';
import { PdfDocumentContent, PdfFetchInput, PdfProvenanceMetadata } from '../model/pdfViewer.types';

const ipc = new IpcService();

export const pdfViewerRepository = {
  fetchDocument(input: PdfFetchInput): Promise<ServerResponse<PdfDocumentContent>> {
    return ipc.invoke('viewer-pdf:fetch', input);
  },

  fetchProvenance(documentId: string): Promise<ServerResponse<PdfProvenanceMetadata>> {
    return ipc.invoke('viewer-pdf:fetch-provenance', { documentId });
  },

  logEvent(eventType: string, documentId?: string, detail?: string): void {
    ipc.send('viewer-pdf:log-event', { eventType, documentId, detail });
  }
};
