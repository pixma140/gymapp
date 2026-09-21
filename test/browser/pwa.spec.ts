import { test, expect } from '@playwright/test';
import { v7 as uuidv7 } from 'uuid';
// Keep this suite's disposable registrations in a separate production rate-limit bucket.
test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '192.0.2.2' } });

test('an update waits for confirmation and preserves an active workout through reload', async ({ page }) => {
    await page.request.post('/api/auth/register', { data: { username: `pwa-update-${uuidv7()}`, password: uuidv7() } });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await page.getByRole('link', { name: /Foundry District/ }).click();
    await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
    const url = page.url();
    await page.request.post('/__test/pwa-update');
    await page.evaluate(async () => (await navigator.serviceWorker.ready).update());
    await expect(page.getByRole('button', { name: 'Update app', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Update app', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Update app', exact: true })).toBeVisible();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Update app', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Update app', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
    expect(page.url()).toBe(url);
});

test('offline admin caches have no admin capabilities and account switches do not reopen the prior cache', async ({ page, context }) => {
    await page.request.post('/api/auth/login', { data: {
        username: process.env.TEST_SEED_ADMIN_USERNAME, password: process.env.TEST_SEED_ADMIN_PASSWORD,
    } });
    await page.goto('/settings');
    await expect(page.getByRole('link', { name: /Admin/ })).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('status')).toContainText('Offline access');
    await expect(page.getByRole('link', { name: /Admin/ })).toHaveCount(0);
    await context.setOffline(false);
    await expect(page.getByRole('link', { name: /Admin/ })).toBeVisible();
    await page.getByRole('button', { name: /Log out|Logout/i }).click();
    await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
    await page.locator('input[autocomplete=username]').fill(process.env.TEST_SEED_USER_USERNAME!);
    await page.locator('input[autocomplete=current-password]').fill(process.env.TEST_SEED_USER_PASSWORD!);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    await context.setOffline(true);
    await page.goto('/settings');
    await expect(page.getByRole('status')).toContainText('Offline access');
    await expect(page.getByRole('link', { name: /Admin/ })).toHaveCount(0);
});

test('cold starts offline, retains workout edits, and verifies identity before delivery', async ({ page, context }) => {
    const username = `pwa-${uuidv7()}`, password = uuidv7();
    await page.request.post('/api/auth/register', { data: { username, password } });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    const manifest = await (await page.request.get('/manifest.webmanifest')).json();
    expect(manifest).toMatchObject({ start_url: '/', display: 'standalone' });
    await context.setOffline(true);
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto('/');
    await expect(reopened.getByRole('status')).toContainText('Offline access');
    await reopened.getByRole('link', { name: /Foundry District/ }).click();
    await reopened.getByRole('button', { name: 'Add Exercise', exact: true }).click();
    await reopened.getByRole('dialog').getByRole('textbox', { name: 'Search exercises…' }).fill('barbell bench press');
    await reopened.getByRole('dialog').getByRole('button', { name: 'barbell bench press Chest', exact: true }).click();
    await reopened.getByRole('article').first().getByLabel('Weight (kg)', { exact: true }).fill('40');
    await reopened.getByRole('article').first().getByLabel('Reps', { exact: true }).fill('10');
    await reopened.getByRole('article').first().getByRole('button', { name: 'Add set', exact: true }).click();
    await expect(reopened.getByRole('article').first().getByRole('listitem')).toHaveCount(1);
    await reopened.reload();
    await expect(reopened.getByRole('status')).toContainText('Offline access');
    await expect(reopened.getByRole('article').first().getByRole('listitem')).toHaveCount(1);
    const requests: string[] = [];
    reopened.on('request', request => { if (request.url().includes('/api/')) requests.push(new URL(request.url()).pathname); });
    await context.setOffline(false);
    await expect(reopened.getByRole('status')).toHaveCount(0);
    await expect.poll(async () => (await (await reopened.request.get('/api/sync/snapshot')).json()).workoutExercises.length).toBe(1);
    await expect.poll(async () => (await (await reopened.request.get('/api/sync/snapshot')).json()).workoutExercises[0].sets).toEqual([
        expect.objectContaining({ weight: 40, reps: 10 }),
    ]);
    expect(requests.indexOf('/api/bootstrap')).toBeGreaterThanOrEqual(0);
    expect(requests.indexOf('/api/sync')).toBeGreaterThan(requests.indexOf('/api/bootstrap'));
    expect(await reopened.evaluate(async () => {
        const keys = await caches.keys();
        const urls = (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat();
        return urls.some(url => new URL(url).pathname.startsWith('/api/'));
    })).toBe(false);
});

test('offline logout stays locked through a cold start and reconnect until explicit login', async ({ page, context }) => {
    const username = `pwa-logout-${uuidv7()}`, password = uuidv7();
    await page.request.post('/api/auth/register', { data: { username, password } });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await context.setOffline(true);
    await page.getByRole('link', { name: /Foundry District/ }).click();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /Log out|Logout/i }).click();
    await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
    await context.setOffline(false);
    await expect.poll(async () => (await (await page.request.get('/api/bootstrap')).json()).status).toBe('signedOut');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
    await page.locator('input[autocomplete=username]').fill(username);
    await page.locator('input[autocomplete=current-password]').fill(password);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page.getByRole('link', { name: /Workout session active/ })).toBeVisible();
    await expect.poll(async () => (await (await page.request.get('/api/sync/snapshot')).json()).workouts.length).toBe(1);
});
