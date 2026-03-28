import { contextBridge, ipcRenderer } from 'electron'

// Minimal preload bridge for integration verification and app config checks.
contextBridge.exposeInMainWorld('api', {
	app: {
		getRuntimeConfig: () => ipcRenderer.invoke('app:get-runtime-config'),
		getIntegrationStatus: () => ipcRenderer.invoke('app:get-integration-status'),
		getStartupStatus: () => ipcRenderer.invoke('app:get-startup-status')
	}
})
