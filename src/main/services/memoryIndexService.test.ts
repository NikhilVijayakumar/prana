import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { memoryIndexService } from './memoryIndexService';

const tempRoot = join(process.cwd(), '.dhi', 'tmp', 'memory-index-tests');

describe('memoryIndexService', () => {
  beforeEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
    await mkdir(tempRoot, { recursive: true });
    await memoryIndexService.__resetForTesting();
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('indexes documents and reports health telemetry', async () => {
    await memoryIndexService.indexText({
      relativePath: 'data/processed/strategy.md',
      content: 'Quarterly strategy focus on retention and product velocity.',
    });

    const health = await memoryIndexService.getHealth();

    expect(health.stats.documentCount).toBe(1);
    expect(health.stats.chunkCount).toBeGreaterThan(0);
    expect(health.stats.averageChunkTokens).toBeGreaterThan(0);
    expect(['healthy', 'warning']).toContain(health.status);
  });

  it('reindexes from a directory and removes stale files', async () => {
    const firstFile = join(tempRoot, 'data', 'processed', 'roadmap.md');
    await mkdir(join(tempRoot, 'data', 'processed'), { recursive: true });
    await writeFile(firstFile, 'Roadmap covers launch milestones and QA gates.', 'utf8');

    const firstStats = await memoryIndexService.reindexDirectory(tempRoot);
    expect(firstStats.documentCount).toBe(1);

    await rm(firstFile, { force: true });

    const secondStats = await memoryIndexService.reindexDirectory(tempRoot);
    expect(secondStats.documentCount).toBe(0);
    expect(secondStats.chunkCount).toBe(0);
  });
});
