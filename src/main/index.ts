import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './services/ipcService'
import { vaultService } from './services/vaultService'
import { syncProviderService } from './services/syncProviderService'
import { startupOrchestratorService } from './services/startupOrchestratorService'
import { driveControllerService } from './services/driveControllerService'
import { getPranaRuntimeConfig } from './services/pranaRuntimeConfig'
import { getPranaPlatformRuntime, setPranaPlatformRuntime } from './services/pranaPlatformRuntime'

const initializePranaRuntime = (): void => {
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
  const systemDriveStatus = await driveControllerService.initializeSystemDrive()
  if (!systemDriveStatus.success) {
    console.warn('[PRANA] System virtual drive mount degraded:', systemDriveStatus.message)
  }

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
  void driveControllerService.dispose()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  void syncProviderService.syncOnClose()
  void syncProviderService.dispose()
  void vaultService.cleanupTemporaryWorkspace()
  void driveControllerService.dispose()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
