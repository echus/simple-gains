import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;

// The browser tests (npm run test:browser): the production build in each engine, at a phone
// size with touch and at a computer size with a mouse. Chromium covers Chrome and Edge. One
// engine: npm run test:browser -- --project=chromium-phone
export default defineConfig({
  testDir: '.',
  forbidOnly: true,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: 'chromium-phone', use: { ...devices['Pixel 7'] } },
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-phone', use: { ...devices['Desktop Firefox'], viewport: { width: 360, height: 780 } } }, // Firefox can't emulate touch
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-phone', use: { ...devices['iPhone 15'] } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    cwd: '../..',
    url: `http://localhost:${PORT}`,
    timeout: 120_000,
  },
});
