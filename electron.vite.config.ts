import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['sql.js', 'bcryptjs', 'js-tiktoken', 'mammoth', 'marked', 'turndown'],
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
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['sql.js', 'bcryptjs', 'js-tiktoken', 'mammoth', 'marked', 'turndown']
      }
    },
    resolve: {
      alias: {
        '@prana': resolve(__dirname, 'src')
      }
    }
  },
  renderer: {
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
