import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { documentConversionService } from './documentConversionService';

describe('documentConversionService', () => {
  it('converts markdown to html and html back to markdown', async () => {
    const markdown = '# Admin Policy\n\n- Rule one\n- Rule two\n\n**Important** updates.';

    const toHtml = await documentConversionService.convertContent({
      sourceFormat: 'markdown',
      targetFormat: 'html',
      content: markdown,
    });

    expect(toHtml.targetFormat).toBe('html');
    expect(toHtml.content.toLowerCase()).toContain('<h1');
    expect(toHtml.content.toLowerCase()).toContain('<li>rule one</li>');

    const backToMarkdown = await documentConversionService.convertContent({
      sourceFormat: 'html',
      targetFormat: 'markdown',
      content: toHtml.content,
    });

    expect(backToMarkdown.targetFormat).toBe('markdown');
    expect(backToMarkdown.content.toLowerCase()).toContain('admin policy');
    expect(backToMarkdown.content).toContain('-   Rule one');
  });

  it('converts markdown file to docx and back to markdown file', async () => {
    const folder = join(tmpdir(), `dhi-doc-conversion-${Date.now()}`);
    const inputPath = join(folder, 'policy.md');
    const docxPath = join(folder, 'policy.docx');
    const outputMarkdownPath = join(folder, 'policy.roundtrip.md');

    await mkdir(folder, { recursive: true });
    await writeFile(inputPath, '# Employee Feedback\n\nThis is a monthly summary.', 'utf8');

    const toDocx = await documentConversionService.convertFile({
      inputPath,
      outputPath: docxPath,
    });

    expect(toDocx.targetFormat).toBe('docx');
    expect(toDocx.bytesWritten).toBeGreaterThan(0);

    const backToMarkdown = await documentConversionService.convertFile({
      inputPath: docxPath,
      outputPath: outputMarkdownPath,
    });

    expect(backToMarkdown.targetFormat).toBe('markdown');
    expect(backToMarkdown.bytesWritten).toBeGreaterThan(0);

    const roundtrip = await readFile(outputMarkdownPath, 'utf8');
    expect(roundtrip.toLowerCase()).toContain('employee feedback');

    await rm(folder, { recursive: true, force: true });
  });
});
