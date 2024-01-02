import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), vueJsx()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    rollupOptions: {
      input: 'src/main.ts',
      output: {
        entryFileNames: 'main.js',
        assetFileNames: (assetInfo) => {
          let extType = assetInfo.name.split('.').at(1);
          if (extType == 'css') return 'main.css';
          return `assets/${extType}/[name]-[hash][extname]`;
        }
      }
    },
    outDir: './dist'
  },
})
