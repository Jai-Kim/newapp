import { defineConfig, devices } from '@playwright/test';

/**
 * Web E2E for the core loop.
 *
 * Two modes, one spec (`E2E_MODE`):
 *
 *   stub  AI providers are replaced by deterministic fixtures at the Edge
 *         Function boundary. Free, fast, no provider calls — the per-commit
 *         mode. Everything below the stub is real: a real signed-in user, real
 *         RLS, real Postgres constraints.
 *
 *   live  Nothing is stubbed. Real Anthropic, real Gemini, the deployed
 *         functions, and the background worker. Costs money and takes minutes,
 *         so it is never on the per-commit path.
 *
 * The database is real in BOTH modes on purpose. Three of the four assertions
 * this harness exists for — the child persisting, one job per child, a
 * double-tap not buying two chapters — are properties of Postgres and RLS.
 * Asserting them against a fake would prove nothing at all.
 */

const isLive = process.env.E2E_MODE === 'live';

export default defineConfig({
  testDir: './e2e',
  // Refuses to start if this run points at the production Supabase project
  // (issue #19) — see e2e/support/guard-env.ts.
  globalSetup: './e2e/support/global-setup.ts',
  // The flow is a sequence; running it in parallel against one project would
  // have two tests fighting over the same family's one-live-job lock.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  // Live generation is ~93s of writing plus illustration and two safety
  // passes, and the spec waits for a background worker on top of that.
  timeout: isLive ? 15 * 60_000 : 3 * 60_000,
  expect: { timeout: isLive ? 60_000 : 15_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8081',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'pnpm expo start --web --port 8081',
    url: 'http://localhost:8081',
    // Expo's dev bundle takes a while to come up cold.
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
