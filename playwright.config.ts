import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: './test/browser',
    fullyParallel: false,
    workers: 1,
    use: { baseURL: 'http://127.0.0.1:4173', headless: true, hasTouch: true, viewport: { width: 390, height: 844 } },
    webServer: { command: 'node test/browser/server.mjs', url: 'http://127.0.0.1:4173/api/setup/status', reuseExistingServer: false },
});
