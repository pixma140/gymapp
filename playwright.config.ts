import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Shared only by this test run and its child server/worker processes.
for (const key of ['SEED_ADMIN_USERNAME', 'SEED_ADMIN_PASSWORD', 'SEED_USER_USERNAME', 'SEED_USER_PASSWORD']) {
    process.env[`TEST_${key}`] ||= randomUUID();
}
export default defineConfig({
    testDir: './test/browser',
    fullyParallel: false,
    workers: 1,
    use: { baseURL: 'http://127.0.0.1:4173', headless: true, hasTouch: true, viewport: { width: 390, height: 844 } },
    webServer: { command: 'node test/browser/server.mjs', url: 'http://127.0.0.1:4173/api/setup/status', reuseExistingServer: false },
});
