import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

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
        'prana': resolve(__dirname, 'src')
      }
    }
  },

  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['sql.js', 'bcryptjs', 'js-tiktoken', 'mammoth', 'marked', 'turndown'],
        input: {
          index: resolve(__dirname, 'src/main/preload.ts')
        }
      }
    },
    resolve: {
      alias: {
        'prana': resolve(__dirname, 'src')
      }
    }
  },

})
