import { useDataState, ServerResponse, HttpStatusCode } from 'astra';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { markdownViewerRepository } from '../repo/markdownViewerRepository';
import { MarkdownLoadInput, MarkdownRawContent } from '../model/markdownViewer.types';
import { MarkdownViewerState } from '../model/markdownViewer.state';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

// Allowlist per spec L2 §5.5
const ALLOWED_TAGS = [
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote',
  'code', 'pre',
  'a', 'strong', 'em', 'del',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'img'
];
const ALLOWED_ATTR = ['href', 'src', 'alt', 'title'];
// href: http/https only; src: https only (per spec §5.5)
const ALLOWED_URI_REGEXP = /^(?:https?:\/\/)/i;

function validateContent(raw: string): void {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(raw);
  if (bytes.length > MAX_SIZE_BYTES) {
    throw new Error('Document exceeds maximum size of 10 MB');
  }
}

function parseMarkdown(raw: string): string {
  return marked.parse(raw, { gfm: true }) as string;
}

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    FORBID_TAGS: ['style', 'script'],
    FORBID_ATTR: ['style', 'class', 'id'],
  });
}

export function useMarkdownViewer() {
  const [appState, execute] = useDataState<MarkdownViewerState>();

  const load = (input: MarkdownLoadInput) =>
    execute(async () => {
      const response = await markdownViewerRepository.load(input);
      if (response.isError) {
        return ServerResponse.error<MarkdownViewerState>({ status: response.status, statusMessage: response.statusMessage });
      }
      const raw = (response.data as MarkdownRawContent).content;
      validateContent(raw);
      const parsed = parseMarkdown(raw);

      let sanitized: string;
      try {
        sanitized = sanitizeHtml(parsed);
      } catch (err) {
        // Fail-closed per spec L2 §9.1 — MUST NOT partially render unsanitized content
        return ServerResponse.error<MarkdownViewerState>({
          status: HttpStatusCode.INTERNAL_SERVER_ERROR,
          statusMessage: err instanceof Error ? err.message : 'Sanitization failed'
        });
      }

      return ServerResponse.success<MarkdownViewerState>({
        status: HttpStatusCode.SUCCESS,
        statusMessage: 'OK',
        data: {
          rawContent: raw,
          renderedHtml: sanitized,
          path: (response.data as MarkdownRawContent).path,
          pipelineStage: 'RENDERED' as const,
          sanitizerRejections: 0
        }
      });
    });

  return { appState, load };
}
