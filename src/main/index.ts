import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './services/ipcService'
import { vaultService } from './services/vaultService'
import { syncProviderService } from './services/syncProviderService'
import { startupOrchestratorService } from './services/startupOrchestratorService'
import { getPranaRuntimeConfig, setPranaRuntimeConfig } from './services/pranaRuntimeConfig'
import { getPranaPlatformRuntime, setPranaPlatformRuntime } from './services/pranaPlatformRuntime'

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false
  }

  return fallback
}

const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const initializePranaRuntime = (): void => {
  setPranaRuntimeConfig({
    director: {
      name: process.env.PRANA_DIRECTOR_NAME ?? process.env.DHI_DIRECTOR_NAME ?? 'Director',
      email: process.env.PRANA_DIRECTOR_EMAIL ?? process.env.DHI_DIRECTOR_EMAIL ?? 'director@prana.local',
      password: process.env.PRANA_DIRECTOR_PASSWORD,
      passwordHash: process.env.PRANA_DIRECTOR_PASSWORD_HASH,
    },
    governance: {
      repoUrl: process.env.PRANA_GOVERNANCE_REPO_URL ?? 'file:///tmp/test-governance',
      repoPath: process.env.PRANA_GOVERNANCE_REPO_PATH ?? '.prana/test-governance',
    },
    vault: {
      specVersion: process.env.PRANA_VAULT_SPEC_VERSION,
      tempZipExtension: process.env.PRANA_VAULT_TEMP_ZIP_EXTENSION,
      outputPrefix: process.env.PRANA_VAULT_OUTPUT_PREFIX,
      archivePassword:
        process.env.PRANA_VAULT_ARCHIVE_PASSWORD ?? process.env.DHI_VAULT_ARCHIVE_PASSWORD ?? 'test-vault-archive-password-secret',
      archiveSalt: process.env.PRANA_VAULT_ARCHIVE_SALT ?? process.env.DHI_VAULT_ARCHIVE_SALT ?? 'dGVzdC12YXVsdC1zYWx0LWJhc2U2NA==',
      kdfIterations: parsePositiveInteger(
        process.env.PRANA_VAULT_KDF_ITERATIONS ?? process.env.DHI_VAULT_KDF_ITERATIONS,
        100000,
      ),
      keepTempOnClose: parseBoolean(process.env.PRANA_VAULT_KEEP_TEMP_ON_CLOSE, false),
    },
    sync: {
      pushIntervalMs: parsePositiveInteger(process.env.PRANA_SYNC_PUSH_INTERVAL_MS ?? process.env.DHI_SYNC_PUSH_INTERVAL_MS, 120000),
      cronEnabled: parseBoolean(process.env.PRANA_SYNC_CRON_ENABLED ?? process.env.DHI_SYNC_CRON_ENABLED, true),
      pushCronExpression: process.env.PRANA_SYNC_PUSH_CRON_EXPRESSION ?? process.env.DHI_SYNC_PUSH_CRON_EXPRESSION ?? '*/10 * * * *',
      pullCronExpression: process.env.PRANA_SYNC_PULL_CRON_EXPRESSION ?? process.env.DHI_SYNC_PULL_CRON_EXPRESSION ?? '*/15 * * * *',
    },
    channels: {
      telegramChannelId: process.env.PRANA_TELEGRAM_CHANNEL_ID,
      slackChannelId: process.env.PRANA_SLACK_CHANNEL_ID,
      teamsChannelId: process.env.PRANA_TEAMS_CHANNEL_ID,
    },
    modelGateway: {
      fallbackOrder: process.env.PRANA_MODEL_GATEWAY_FALLBACK_ORDER,
      lmStudio: {
        baseUrl: process.env.PRANA_LM_STUDIO_BASE_URL,
        model: process.env.PRANA_LM_STUDIO_MODEL,
      },
      openRouter: {
        baseUrl: process.env.PRANA_OPENROUTER_BASE_URL,
        model: process.env.PRANA_OPENROUTER_MODEL,
        apiKey: process.env.PRANA_OPENROUTER_API_KEY,
      },
      gemini: {
        baseUrl: process.env.PRANA_GEMINI_BASE_URL,
        model: process.env.PRANA_GEMINI_MODEL,
        apiKey: process.env.PRANA_GEMINI_API_KEY,
      },
    },
    registryRoot: process.env.PRANA_REGISTRY_ROOT,
  })

  setPranaPlatformRuntime({
    mode: (process.env.NODE_ENV as 'development' | 'production' | 'test' | undefined) ?? 'production',
    homeDir: app.getPath('home'),
    userProfileDir: process.env.USERPROFILE,
    inheritedEnv: { ...process.env } as Record<string, string>,
  })
}

initializePranaRuntime()

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  const rendererUrl = getPranaPlatformRuntime().rendererUrl
  if (is.dev && rendererUrl) {
    mainWindow.loadURL(rendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  const startupStatus = await startupOrchestratorService.runStartupSequence()
  if (startupStatus.overallStatus !== 'READY') {
    console.warn('[PRANA] Startup orchestration completed with non-ready status:', startupStatus.overallStatus)
  }

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.prana.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers({
    registryRuntime: {
      registryRoot: getPranaRuntimeConfig()?.registryRoot ?? join(process.cwd(), '.prana', 'registry')
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  void syncProviderService.syncOnClose()
  void vaultService.cleanupTemporaryWorkspace()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  void syncProviderService.syncOnClose()
  void syncProviderService.dispose()
  void vaultService.cleanupTemporaryWorkspace()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
