import { ipcMain, BrowserWindow } from 'electron';
import { ServerResponse, HttpStatusCode } from 'astra';
import { runtimeService } from './runtimeService';
import { IEventRegistry } from '../event-registry/eventRegistryService';

export function registerRuntimeIpcHandlers(events?: IEventRegistry): void {
  ipcMain.handle('runtime:identity-get', () => {
    try {
      return ServerResponse.success({
        status: HttpStatusCode.SUCCESS,
        statusMessage: 'OK',
        data: runtimeService.getIdentity()
      });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('runtime:identity-link-account', (_e, payload: { provider: string; email: string; metadata?: Record<string, unknown> }) => {
    try {
      const account = runtimeService.linkAccount(payload.provider, payload.email, payload.metadata);
      events?.emit({ eventType: 'identity:account:linked', source: 'runtime', payload: { accountId: account.accountId } });
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'Account linked', data: account });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('runtime:session-validate', () => {
    try {
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: { valid: runtimeService.validateSession() } });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('runtime:registry-list', () => {
    try {
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: runtimeService.listApplications() });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('runtime:registry-get', (_e, payload: { appId: string }) => {
    try {
      const app = runtimeService.getApplication(payload.appId);
      if (!app) return ServerResponse.error({ status: HttpStatusCode.NOT_FOUND, statusMessage: `Application ${payload.appId} not found` });
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: app });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('runtime:install', async (_e, payload: { appId: string; name: string; version: string }) => {
    try {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('runtime:install-progress', { appId: payload.appId, phase: 'INSTALLING', progress: 0 });
      const record = runtimeService.installApplication(payload.appId, payload.name, payload.version);
      events?.emit({ eventType: 'application:started', source: 'runtime', payload: { appId: payload.appId } });
      win?.webContents.send('runtime:install-progress', { appId: payload.appId, phase: 'DONE', progress: 100 });
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'Installed', data: record });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('runtime:update-check', (_e, payload: { appId: string }) => {
    try {
      const meta = runtimeService.checkUpdate(payload.appId);
      if (!meta) return ServerResponse.error({ status: HttpStatusCode.NOT_FOUND, statusMessage: `Application ${payload.appId} not found` });
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: meta });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('runtime:update-apply', async (_e, payload: { appId: string; version: string }) => {
    try {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('runtime:update-progress', { appId: payload.appId, phase: 'UPDATING', progress: 0 });
      const record = runtimeService.applyUpdate(payload.appId, payload.version);
      win?.webContents.send('runtime:update-progress', { appId: payload.appId, phase: 'DONE', progress: 100 });
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'Updated', data: record });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('runtime:launch', (_e, payload: { appId: string }) => {
    try {
      const app = runtimeService.getApplication(payload.appId);
      if (!app) return ServerResponse.error({ status: HttpStatusCode.NOT_FOUND, statusMessage: `Application ${payload.appId} not found` });
      if (app.status !== 'INSTALLED' && app.status !== 'STOPPED') {
        return ServerResponse.error({ status: HttpStatusCode.BAD_REQUEST, statusMessage: `Application ${payload.appId} is not in a launchable state` });
      }
      runtimeService.updateApplicationStatus(payload.appId, 'RUNNING');
      events?.emit({ eventType: 'application:started', source: 'runtime', payload: { appId: payload.appId } });
      BrowserWindow.getAllWindows()[0]?.webContents.send('runtime:app-state-change', { appId: payload.appId, status: 'RUNNING' });
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'Launched', data: { appId: payload.appId, status: 'RUNNING' } });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('runtime:stop', (_e, payload: { appId: string }) => {
    try {
      const app = runtimeService.getApplication(payload.appId);
      if (!app) return ServerResponse.error({ status: HttpStatusCode.NOT_FOUND, statusMessage: `Application ${payload.appId} not found` });
      runtimeService.updateApplicationStatus(payload.appId, 'STOPPED');
      events?.emit({ eventType: 'application:stopped', source: 'runtime', payload: { appId: payload.appId } });
      BrowserWindow.getAllWindows()[0]?.webContents.send('runtime:app-state-change', { appId: payload.appId, status: 'STOPPED' });
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'Stopped', data: { appId: payload.appId, status: 'STOPPED' } });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('runtime:config-get', (_e, payload?: { key?: string }) => {
    try {
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: runtimeService.getConfig(payload?.key) });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('runtime:config-set', (_e, payload: { key: string; value: unknown }) => {
    try {
      const entry = runtimeService.setConfig(payload.key, payload.value);
      events?.emit({ eventType: 'runtime:configuration:changed', source: 'runtime', payload: { key: payload.key } });
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'Updated', data: entry });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });
}
