import { defineConfig, devices } from '@playwright/test';

/**
 * Auth session E2E. These flows can only be proven in a browser: which cookies
 * JavaScript can read, and what the client does when the server rejects a
 * token. Unit tests call services directly and cannot see either.
 *
 * The suite talks to a running stack rather than starting one — the backend
 * needs MySQL, Redis and RabbitMQ, which is a deployment concern, not a test
 * fixture. `E2E_BASE_URL` points at it; `npm run test:e2e` documents the
 * prerequisites.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  // A false pass here would be worse than a failure: retries would hide a
  // flaky session bug, which is exactly the class of bug this suite exists for.
  retries: 0,
  fullyParallel: false,
  // One worker, not for speed but for correctness: every test signs in as the
  // same seeded employee, and this suite deliberately manipulates that one
  // session — expiring its access token, logging it out. Two workers would run
  // two live sessions for one user, and one test's logout is another test's
  // unexplained 401.
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    // Session behaviour is the subject, so each test starts with no cookies.
    storageState: { cookies: [], origins: [] },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
