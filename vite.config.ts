/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: { $lib: fileURLToPath(new URL('src/lib', import.meta.url)) },
    // Svelte's browser build in tests too: its server build can't mount components
    ...(process.env.VITEST && { conditions: ['browser'] }),
  },
  // The unit tests (the browser tests have their own runner, Playwright)
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/browser/**'],
  },
  // Lets `npm run preview` be reached through a Cloudflare quick tunnel for phone testing
  preview: {
    allowedHosts: ['.trycloudflare.com'],
  },
})
