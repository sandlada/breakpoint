import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        element: resolve(__dirname, 'element-query.html'),
        custom: resolve(__dirname, 'custom-conditions.html'),
        height: resolve(__dirname, 'height-observer.html'),
        rxjs: resolve(__dirname, 'rxjs-streams.html')
      }
    }
  },
  resolve: {
    alias: {
      '@sandlada/breakpoint': resolve(__dirname, '../src/index.ts')
    }
  }
})
