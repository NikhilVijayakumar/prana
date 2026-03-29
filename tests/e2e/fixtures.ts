import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { test as base, expect, type Page } from '@playwright/test';
import electronPath from 'electron';
import { _electron as electron, type ElectronApplication } from 'playwright';

const DEFAULT_BRANCH = 'test-sandbox';
const DEFAULT_LM_STUDIO_BASE_URL = 'http://127.0.0.1:1234';
const DEFAULT_LM_STUDIO_MODEL = 'openai/gpt-oss-20b';

type PranaFixtures = {
  electronApp: ElectronApplication;
  window: Page;
  testConfig: Record<string, unknown>;
};

const readHeadlessFromConfig = (): boolean => {
  return process.env.PW_ELECTRON_HEADLESS !== 'false';
};

const readSlowMoFromConfig = (): number => {
  const parsed = Number(process.env.PW_ELECTRON_SLOW_MO ?? '0');
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const loadTestConfig = (): Record<string, unknown> => {
  const configPath = join(process.cwd(), 'config', 'test_env.json');
  if (!existsSync(configPath)) {
    throw new Error(`Test config file not found at ${configPath}. Cannot run E2E tests without configuration.`);
  }

  try {
    const fileContent = readFileSync(configPath, 'utf8');
    const config = JSON.parse(fileContent) as Record<string, unknown>;
    return config;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load test config: ${message}`);
  }
};

export const setConfigInRenderer = async (
  window: Page,
  config: Record<string, unknown>,
): Promise<void> => {
  // Map config keys from UPPER_CASE to camelCase for pranaConfig interface
  const brandingConfig = {
    appBrandName: config.APP_BRAND_NAME ?? '',
    appTitlebarTagline: config.APP_TITLEBAR_TAGLINE ?? '',
    appSplashSubtitle: config.APP_SPLASH_SUBTITLE ?? '',
    directorSenderName: config.DIRECTOR_SENDER_NAME ?? '',
    directorSenderEmail: config.DIRECTOR_SENDER_EMAIL ?? '',
    avatarBaseUrl: config.AVATAR_BASE_URL,
  };

  // Inject config into window before React renders
  // This simulates how a calling app would provide config to Prana
  await window.evaluate((cfg) => {
    window.__pranaTestBrandingConfig = cfg;
  }, brandingConfig);
};

const readProbeTimeoutMs = (): number => {
  const parsed = Number(process.env.PRANA_MODEL_GATEWAY_PROBE_TIMEOUT_MS ?? '2000');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2000;
};

const resolveLmStudioBaseUrl = (): string => {
  return process.env.PRANA_LM_STUDIO_BASE_URL?.trim() || DEFAULT_LM_STUDIO_BASE_URL;
};

const resolveLmStudioModel = (): string => {
  return process.env.PRANA_LM_STUDIO_MODEL?.trim() || DEFAULT_LM_STUDIO_MODEL;
};

const assertLmStudioReady = async (): Promise<void> => {
  const baseUrl = resolveLmStudioBaseUrl();
  const modelName = resolveLmStudioModel();
  const timeoutMs = readProbeTimeoutMs();
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const modelsUrl = new URL('/v1/models', baseUrl).toString();
    const response = await fetch(modelsUrl, {
      method: 'GET',
      signal: abortController.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`LM Studio probe failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ id?: string }>;
    };

    const modelIds = (payload.data ?? []).map((entry) => entry.id).filter((entry): entry is string => !!entry);
    if (!modelIds.includes(modelName)) {
      throw new Error(
        `LM Studio is reachable but model ${modelName} was not found. Available models: ${modelIds.join(', ') || 'none'}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `LM Studio preflight failed. Expected base URL ${baseUrl} and model ${modelName}. ${message}`,
    );
  } finally {
    clearTimeout(timeout);
  }
};

export const test = base.extend<PranaFixtures>({
  testConfig: async ({}, use) => {
    const config = loadTestConfig();
    await use(config);
  },

  electronApp: async ({ testConfig }, use) => {
    await assertLmStudioReady();

    const mainEntrypoint = join(process.cwd(), 'out', 'main', 'index.js');
    if (!existsSync(mainEntrypoint)) {
      throw new Error('Missing Electron build at out/main/index.js. Run npm run build before e2e tests.');
    }

    const requestedBranch = process.env.PRANA_TEST_BRANCH ?? DEFAULT_BRANCH;
    if (requestedBranch !== DEFAULT_BRANCH) {
      throw new Error(
        `Unsafe PRANA_TEST_BRANCH (${requestedBranch}). E2E tests only allow ${DEFAULT_BRANCH} to protect production data.`,
      );
    }

    const startupLogs: string[] = [];

    const app = await electron.launch({
      executablePath: electronPath,
      args: ['.'],
      cwd: process.cwd(),
      headless: readHeadlessFromConfig(),
      slowMo: readSlowMoFromConfig(),
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV ?? 'test',
        PRANA_TEST_BRANCH: DEFAULT_BRANCH,
        PRANA_DHARMA_BRANCH: DEFAULT_BRANCH,
        DHARMA_BRANCH: DEFAULT_BRANCH,
      },
    });

    const appProcess = app.process();
    appProcess.stdout?.on('data', (chunk) => startupLogs.push(`[stdout] ${String(chunk).trim()}`));
    appProcess.stderr?.on('data', (chunk) => startupLogs.push(`[stderr] ${String(chunk).trim()}`));

    await app.evaluate(({ app: electronApp }) => {
      electronApp.on('browser-window-created', () => {
        console.log('[PLAYWRIGHT_E2E] browser-window-created');
      });
    });

    const existingWindows = app.windows();
    if (existingWindows.length === 0) {
      try {
        await app.waitForEvent('window', { timeout: 60_000 });
      } catch {
        const combinedLogs = startupLogs.slice(-20).join('\n') || 'No process output captured.';
        throw new Error(`Electron did not create a BrowserWindow within 60s.\n${combinedLogs}`);
      }
    }

    await use(app);
    await app.close();
  },

  window: async ({ electronApp, testConfig }, use) => {
    const firstWindow = await electronApp.firstWindow();
    await firstWindow.waitForLoadState('domcontentloaded');

    // Inject config BEFORE React component tree mounts
    // This simulates a parent app providing config when bootstrapping Prana
    await setConfigInRenderer(firstWindow, testConfig);

    await use(firstWindow);
  },
});

export { expect };
