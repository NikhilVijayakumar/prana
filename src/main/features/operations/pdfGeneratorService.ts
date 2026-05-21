/**
 * PDF Generator Service - Lightweight Electron-Based Renderer
 *
 * Uses Electron's built-in Chromium via hidden BrowserWindow + printToPDF()
 * to generate PDFs from HTML strings or URLs. Zero external dependencies.
 */

import { BrowserWindow } from 'electron';

export interface PdfGeneratorOptions {
  landscape?: boolean;
  pageSize?: string;
  printBackground?: boolean;
  margins?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
}

const PDF_RENDER_TIMEOUT_MS = 15_000;

const createHiddenWindow = (): BrowserWindow => {
  return new BrowserWindow({
    show: false,
    width: 1024,
    height: 768,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
};

const waitForLoad = (win: BrowserWindow): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`[PdfGenerator] Page load timed out after ${PDF_RENDER_TIMEOUT_MS}ms.`));
    }, PDF_RENDER_TIMEOUT_MS);

    win.webContents.once('did-finish-load', () => {
      clearTimeout(timeout);
      resolve();
    });

    win.webContents.once('did-fail-load', (_event, errorCode, errorDescription) => {
      clearTimeout(timeout);
      reject(new Error(`[PdfGenerator] Page load failed: ${errorCode} - ${errorDescription}`));
    });
  });
};

/**
 * Generate a PDF buffer from raw HTML content.
 */
export const generatePdfFromHtml = async (
  htmlContent: string,
  options: PdfGeneratorOptions = {},
): Promise<Buffer> => {
  const win = createHiddenWindow();

  try {
    const loadPromise = waitForLoad(win);
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    await loadPromise;

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: options.printBackground ?? true,
      landscape: options.landscape ?? false,
      pageSize: (options.pageSize as any) ?? 'A4',
      margins: options.margins
        ? {
            marginType: 'custom',
            top: options.margins.top ?? 0.4,
            bottom: options.margins.bottom ?? 0.4,
            left: options.margins.left ?? 0.4,
            right: options.margins.right ?? 0.4,
          }
        : undefined,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (!win.isDestroyed()) {
      win.destroy();
    }
  }
};

/**
 * Generate a PDF buffer from a URL.
 */
export const generatePdfFromUrl = async (
  url: string,
  options: PdfGeneratorOptions = {},
): Promise<Buffer> => {
  const win = createHiddenWindow();

  try {
    const loadPromise = waitForLoad(win);
    win.loadURL(url);
    await loadPromise;

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: options.printBackground ?? true,
      landscape: options.landscape ?? false,
      pageSize: (options.pageSize as any) ?? 'A4',
      margins: options.margins
        ? {
            marginType: 'custom',
            top: options.margins.top ?? 0.4,
            bottom: options.margins.bottom ?? 0.4,
            left: options.margins.left ?? 0.4,
            right: options.margins.right ?? 0.4,
          }
        : undefined,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (!win.isDestroyed()) {
      win.destroy();
    }
  }
};
