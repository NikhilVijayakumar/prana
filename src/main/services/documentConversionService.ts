import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { marked } from 'marked';
import HTMLToDOCX from 'html-to-docx';

export type DocumentFormat = 'markdown' | 'html' | 'docx';

export interface DocumentConversionRequest {
  sourceFormat: DocumentFormat;
  targetFormat: DocumentFormat;
  content: string;
}

export interface DocumentConversionResult {
  sourceFormat: DocumentFormat;
  targetFormat: DocumentFormat;
  content: string;
  warning: string | null;
}

export interface FileDocumentConversionRequest {
  inputPath: string;
  outputPath: string;
  sourceFormat?: DocumentFormat;
  targetFormat?: DocumentFormat;
}

export interface FileDocumentConversionResult {
  inputPath: string;
  outputPath: string;
  sourceFormat: DocumentFormat;
  targetFormat: DocumentFormat;
  bytesWritten: number;
  warning: string | null;
}

export interface MarkdownHtmlProtocol {
  markdownToHtml(markdown: string): Promise<string>;
  htmlToMarkdown(html: string): Promise<string>;
}

export interface DocxBridgeProtocol {
  htmlToDocxBase64(html: string): Promise<string>;
  docxBase64ToHtml(docxBase64: string): Promise<string>;
}

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);

const inferFormatFromPath = (path: string): DocumentFormat => {
  const extension = extname(path).toLowerCase();
  if (MARKDOWN_EXTENSIONS.has(extension)) {
    return 'markdown';
  }
  if (extension === '.html' || extension === '.htm') {
    return 'html';
  }
  if (extension === '.docx') {
    return 'docx';
  }

  throw new Error(`Unsupported file extension for conversion: ${extension || '(none)'}`);
};

class MarkdownHtmlService implements MarkdownHtmlProtocol {
  private readonly turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });

  async markdownToHtml(markdown: string): Promise<string> {
    const parsed = marked.parse(markdown);
    return typeof parsed === 'string' ? parsed : await parsed;
  }

  async htmlToMarkdown(html: string): Promise<string> {
    return this.turndown.turndown(html);
  }
}

class DocxBridgeService implements DocxBridgeProtocol {
  async htmlToDocxBase64(html: string): Promise<string> {
    const buffer = await HTMLToDOCX(html, null, {
      table: {
        row: {
          cantSplit: true,
        },
      },
      footer: false,
      pageNumber: false,
    });

    return buffer.toString('base64');
  }

  async docxBase64ToHtml(docxBase64: string): Promise<string> {
    const buffer = Buffer.from(docxBase64, 'base64');
    const output = await mammoth.convertToHtml({ buffer });
    return output.value;
  }
}

const normalizeLineEndings = (value: string): string => {
  return value.replace(/\r\n/g, '\n');
};

const looksLikeBase64 = (value: string): boolean => {
  const compact = value.trim();
  if (compact.length === 0 || compact.length % 4 !== 0) {
    return false;
  }

  return /^[A-Za-z0-9+/=\s]+$/.test(compact);
};

export class DocumentConversionService {
  constructor(
    private readonly markdownHtml: MarkdownHtmlProtocol,
    private readonly docxBridge: DocxBridgeProtocol,
  ) {}

  async convertContent(request: DocumentConversionRequest): Promise<DocumentConversionResult> {
    const sourceFormat = request.sourceFormat;
    const targetFormat = request.targetFormat;

    if (sourceFormat === targetFormat) {
      return {
        sourceFormat,
        targetFormat,
        content: request.content,
        warning: 'Source and target formats are identical. Content returned unchanged.',
      };
    }

    if (sourceFormat === 'markdown' && targetFormat === 'html') {
      return {
        sourceFormat,
        targetFormat,
        content: await this.markdownHtml.markdownToHtml(request.content),
        warning: null,
      };
    }

    if (sourceFormat === 'html' && targetFormat === 'markdown') {
      return {
        sourceFormat,
        targetFormat,
        content: await this.markdownHtml.htmlToMarkdown(request.content),
        warning: null,
      };
    }

    if (sourceFormat === 'markdown' && targetFormat === 'docx') {
      const html = await this.markdownHtml.markdownToHtml(request.content);
      const docxBase64 = await this.docxBridge.htmlToDocxBase64(html);
      return {
        sourceFormat,
        targetFormat,
        content: docxBase64,
        warning: null,
      };
    }

    if (sourceFormat === 'docx' && targetFormat === 'markdown') {
      const html = await this.docxBridge.docxBase64ToHtml(request.content);
      const markdown = await this.markdownHtml.htmlToMarkdown(html);
      return {
        sourceFormat,
        targetFormat,
        content: markdown,
        warning: null,
      };
    }

    if (sourceFormat === 'html' && targetFormat === 'docx') {
      const docxBase64 = await this.docxBridge.htmlToDocxBase64(request.content);
      return {
        sourceFormat,
        targetFormat,
        content: docxBase64,
        warning: null,
      };
    }

    if (sourceFormat === 'docx' && targetFormat === 'html') {
      return {
        sourceFormat,
        targetFormat,
        content: await this.docxBridge.docxBase64ToHtml(request.content),
        warning: null,
      };
    }

    throw new Error(`Unsupported conversion path: ${sourceFormat} -> ${targetFormat}`);
  }

  async convertFile(request: FileDocumentConversionRequest): Promise<FileDocumentConversionResult> {
    const sourceFormat = request.sourceFormat ?? inferFormatFromPath(request.inputPath);
    const targetFormat = request.targetFormat ?? inferFormatFromPath(request.outputPath);

    let sourceContent: string;
    if (sourceFormat === 'docx') {
      const buffer = await readFile(request.inputPath);
      sourceContent = buffer.toString('base64');
    } else {
      sourceContent = normalizeLineEndings(await readFile(request.inputPath, 'utf8'));
    }

    const converted = await this.convertContent({
      sourceFormat,
      targetFormat,
      content: sourceContent,
    });

    if (targetFormat === 'docx') {
      const base64 = converted.content.trim();
      if (!looksLikeBase64(base64)) {
        throw new Error('DOCX conversion output is not valid base64 content.');
      }

      const buffer = Buffer.from(base64, 'base64');
      await writeFile(request.outputPath, buffer);
      return {
        inputPath: request.inputPath,
        outputPath: request.outputPath,
        sourceFormat,
        targetFormat,
        bytesWritten: buffer.byteLength,
        warning: converted.warning,
      };
    }

    await writeFile(request.outputPath, converted.content, 'utf8');
    return {
      inputPath: request.inputPath,
      outputPath: request.outputPath,
      sourceFormat,
      targetFormat,
      bytesWritten: Buffer.byteLength(converted.content, 'utf8'),
      warning: converted.warning,
    };
  }
}

export const documentConversionService = new DocumentConversionService(
  new MarkdownHtmlService(),
  new DocxBridgeService(),
);
