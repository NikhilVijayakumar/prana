import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@prana': resolve(__dirname, 'src')
      }
    }
  },

  preload: {
    build: {
      rollupOptions: {
        input: {
          preload: resolve(__dirname, 'src/main/preload.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@prana': resolve(__dirname, 'src')
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html')
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/ui'),
        '@prana': resolve(__dirname, 'src'),
        '@astra': resolve(__dirname, 'node_modules/astra')
      }
    },
    plugins: [react()]
  }
})
