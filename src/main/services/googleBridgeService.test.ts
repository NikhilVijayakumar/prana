import { describe, expect, it } from 'vitest';
import { cronSchedulerService } from './cronSchedulerService';
import { governanceLifecycleQueueStoreService } from './governanceLifecycleQueueStoreService';
import { GoogleBridgeService } from './googleBridgeService';

describe('googleBridgeService', () => {
  it('initializes in file-backed mode when no credentials are set', () => {
    const service = new GoogleBridgeService(null, null);
    const snapshot = service.getSnapshot();

    expect(snapshot.mode).toBe('file-backed');
    expect(snapshot.sheetsConnected).toBe(false);
    expect(snapshot.formsConnected).toBe(false);
    expect(snapshot.docsConnected).toBe(false);
  });

  it('provides gateway interfaces even in file-backed mode', () => {
    const service = new GoogleBridgeService(null, null);

    expect(service.getSheetsGateway()).toBeDefined();
    expect(service.getFormsGateway()).toBeDefined();
  });

  it('file-backed sheets gateway returns empty array', async () => {
    const service = new GoogleBridgeService(null, null);
    const rows = await service.getSheetsGateway().listStaffRows();

    expect(rows).toEqual([]);
  });

  it('file-backed forms gateway returns empty array', async () => {
    const service = new GoogleBridgeService(null, null);
    const responses = await service.getFormsGateway().listFeedbackResponses();

    expect(responses).toEqual([]);
  });

  it('file-backed publish produces local publish result', async () => {
    const service = new GoogleBridgeService(null, null);
    const result = await service.publishPolicy('test-policy', '<h1>Test</h1>');

    expect(result.status === 'PUBLISHED' || result.status === 'FAILED').toBe(true);
    expect(result.publishedAt).toBeDefined();
  });

  it('file-backed pull returns SKIPPED when no published document exists', async () => {
    const service = new GoogleBridgeService(null, null);
    const result = await service.pullDocument('nonexistent-doc', 'org/test/pulled.md');

    expect(result.status).toBe('SKIPPED');
    expect(result.pulledAt).toBeDefined();
  });

  it('reports live mode when credentials are provided', () => {
    const creds = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      refreshToken: 'test-refresh-token',
      adminEmail: 'admin@example.com',
    };

    const service = new GoogleBridgeService(null, creds);
    const snapshot = service.getSnapshot();

    expect(snapshot.mode).toBe('live');
    expect(snapshot.config.credentials).not.toBeNull();
  });

  it('records latest sync report after a manual run', async () => {
    const service = new GoogleBridgeService(null, null);
    const report = await service.runSync('MANUAL');
    const snapshot = service.getSnapshot();

    expect(report.source).toBe('MANUAL');
    expect(report.startedAt).toBeDefined();
    expect(report.finishedAt).toBeDefined();
    expect(snapshot.latestSync).not.toBeNull();
    expect(snapshot.latestSync?.source).toBe('MANUAL');
  });

  it('registers a cron schedule for google drive sync', async () => {
    await governanceLifecycleQueueStoreService.__resetForTesting();
    await cronSchedulerService.__resetForTesting();

    const service = new GoogleBridgeService(null, null);
    const schedule = await service.ensureSyncSchedulerJob();
    const jobs = await cronSchedulerService.listJobs();

    expect(schedule.jobId).toBe('job-google-drive-sync');
    expect(schedule.target).toBe('GOOGLE_DRIVE_SYNC');
    expect(jobs.some((job) => job.id === schedule.jobId)).toBe(true);

    service.disableSyncSchedulerJob();
    await cronSchedulerService.dispose();
  });
});
