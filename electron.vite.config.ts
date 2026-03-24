import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'packages/prana/main/index.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@prana': resolve('packages/prana'),
        '@dharma': resolve('packages/dharma')
      }
    }
  },

  preload: {
    resolve: {
      alias: {
        '@prana': resolve('packages/prana'),
        '@dharma': resolve('packages/dharma')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@prana': resolve('packages/prana'),
        '@dharma': resolve('packages/dharma'),
        '@dhi': resolve('packages/dhi'),
        '@vidhan': resolve('packages/vidhan'),
        '@astra': resolve('packages/astra')
      }
    },
    plugins: [react()]
  }
})
