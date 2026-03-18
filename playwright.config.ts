import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:4273',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'corepack pnpm exec vite preview --host 127.0.0.1 --port 4273 --strictPort',
    port: 4273,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
