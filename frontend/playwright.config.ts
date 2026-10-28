import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'if [ -f .venv/bin/python ]; then .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000; else python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000; fi',
      cwd: '..',
      port: 8000,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: 'npm run dev -- --port 3000',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
