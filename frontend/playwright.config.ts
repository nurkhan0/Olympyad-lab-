import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Judge round-trips (submit → Celery → subprocess) can take a while.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // Archived diagnostics are kept for reference but never run.
  testIgnore: '**/archive/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    // Staging rehearsals override this: E2E_BASE_URL=http://localhost:8080
    // (or https://localhost:8443 for the TLS rehearsal).
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    // TLS rehearsal against the local CA: the chain is separately verified
    // with `openssl s_client -CAfile certs/dev/ca.crt`. Public-CA deployments
    // do not need this flag.
    ignoreHTTPSErrors: process.env.E2E_IGNORE_TLS_ERRORS === '1',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // The local dev webServer is only used for default (5173) runs; staging/HTTPS
  // rehearsals set E2E_BASE_URL and manage their own stack.
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: 'http://localhost:5173',
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
        },
      }),
});
