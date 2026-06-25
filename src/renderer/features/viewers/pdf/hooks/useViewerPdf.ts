import { useDataState, ServerResponse, HttpStatusCode } from 'astra';
import { pdfViewerRepository } from '../repo/pdfViewerRepository';
import { PdfDocumentContent, PdfFetchInput, PdfProvenanceMetadata } from '../model/pdfViewer.types';
import { PdfViewerState } from '../model/pdfViewer.state';

export function useViewerPdf() {
  const [appState, execute, setAppState] = useDataState<PdfViewerState>();

  const load = (input: PdfFetchInput) =>
    execute(async () => {
      const response = await pdfViewerRepository.fetchDocument(input);
      if (response.isError) {
        return ServerResponse.error<PdfViewerState>({ status: response.status, statusMessage: response.statusMessage });
      }
      const doc = response.data as PdfDocumentContent;
      pdfViewerRepository.logEvent('document_loaded', doc.documentId);
      return ServerResponse.success<PdfViewerState>({
        status: HttpStatusCode.SUCCESS,
        statusMessage: 'OK',
        data: { document: doc, currentPage: 1, totalPages: 1, zoom: 1.0 }
      });
    });

  const setPage = (page: number) =>
    setAppState((prev) => ({
      ...prev,
      data: prev.data ? { ...prev.data, currentPage: page } : prev.data
    }));

  const setZoom = (zoom: number) =>
    setAppState((prev) => ({
      ...prev,
      data: prev.data ? { ...prev.data, zoom } : prev.data
    }));

  const setTotalPages = (totalPages: number) =>
    setAppState((prev) => ({
      ...prev,
      data: prev.data ? { ...prev.data, totalPages } : prev.data
    }));

  const loadProvenance = async (documentId: string) => {
    const response = await pdfViewerRepository.fetchProvenance(documentId);
    if (response.isError || !response.data) return;
    const provenance = response.data as PdfProvenanceMetadata;
    setAppState((prev) => ({
      ...prev,
      data: prev.data ? { ...prev.data, provenance } : prev.data
    }));
  };

  return { appState, load, setPage, setZoom, setTotalPages, loadProvenance };
}
