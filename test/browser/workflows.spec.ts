import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import { v7 as uuidv7, version as uuidVersion } from 'uuid';

const fixtureCredentials = {
    admin: { username: process.env.TEST_SEED_ADMIN_USERNAME!, password: process.env.TEST_SEED_ADMIN_PASSWORD! },
    user: { username: process.env.TEST_SEED_USER_USERNAME!, password: process.env.TEST_SEED_USER_PASSWORD! },
};
const testPassword = crypto.randomUUID();

test('demo workout flow logs sets, creates exercises, and edits completed history', async ({ page, context }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    expect((await page.request.post('/api/auth/register', {
        data: { username: `sets-${uuidv7()}`, password: testPassword },
    })).ok()).toBe(true);
    await page.goto('/');
    await page.getByRole('link', { name: /Foundry District/ }).click();
    await expectPendingChanges(page, 0);
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Add Exercise', exact: true }).click();
    const modal = page.getByRole('dialog');
    await modal.getByLabel('Muscle group', { exact: true }).selectOption('chest');
    await modal.getByRole('textbox', { name: 'Search exercises…' }).fill('barbell bench press');
    await modal.getByRole('button', { name: 'barbell bench press Chest', exact: true }).click();
    await expect(modal).toHaveCount(0);
    const first = page.getByRole('article').first();
    await first.getByLabel('Weight (kg)', { exact: true }).fill('20');
    await first.getByLabel('Reps', { exact: true }).fill('12');
    await expect(first.getByRole('button', { name: 'Toggle warmup set' })).toHaveAttribute('aria-pressed', 'true');
    await first.getByRole('button', { name: 'Add set', exact: true }).click();
    await expect(first.getByRole('listitem')).toHaveCount(1);
    await expect(first.getByRole('button', { name: 'Toggle warmup set' })).toHaveAttribute('aria-pressed', 'true');
    await first.getByRole('button', { name: 'Toggle warmup set' }).click();
    await first.getByLabel('Weight (kg)', { exact: true }).fill('80');
    await first.getByLabel('Reps', { exact: true }).fill('8');
    await first.getByRole('button', { name: 'Add set', exact: true }).click();
    await expect(first.getByRole('listitem')).toHaveCount(2);
    await page.getByRole('button', { name: 'Add Exercise', exact: true }).click();
    await modal.getByRole('textbox', { name: 'Search exercises…' }).fill('My custom press');
    await modal.getByRole('button', { name: 'Can’t find it? Add New' }).click();
    await modal.getByLabel('Muscle group', { exact: true }).selectOption('shoulders');
    await modal.getByRole('button', { name: 'Save Exercise' }).click();
    await expect(page.getByRole('article')).toHaveCount(2);
    await expect(page.getByRole('article').nth(1).getByRole('button', { name: 'Toggle warmup set' })).toHaveAttribute('aria-pressed', 'false');
    await context.setOffline(false);
    await expectPendingChanges(page, 0);
    await page.reload();
    await expect(first.getByRole('listitem')).toHaveCount(2);
    await expect(first.getByRole('button', { name: 'Toggle warmup set' })).toHaveAttribute('aria-pressed', 'false');
    await page.screenshot({ path: testInfo.outputPath('workout-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1260, height: 844 });
    await page.screenshot({ path: testInfo.outputPath('workout-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
    await expectPendingChanges(page, 0);
    await page.getByRole('link', { name: 'Analysis', exact: true }).click();
    await expect(page.getByText('barbell bench press · 2 sets', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'View details' }).click();
    await expect(first.getByRole('listitem')).toHaveCount(2);
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Start date and time', { exact: true }).fill('2026-09-08T10:00');
    await page.getByLabel('End date and time', { exact: true }).fill('2026-09-08T09:00');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('The end cannot be before the start.');
    await page.getByLabel('End date and time', { exact: true }).fill('2026-09-08T11:30');
    page.once('dialog', dialog => dialog.accept());
    await first.getByRole('button', { name: 'Delete set' }).first().click();
    await expect(first.getByRole('listitem')).toHaveCount(1);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expectPendingChanges(page, 0);
    const snapshot = await (await page.request.get('/api/sync/snapshot')).json();
    expect(snapshot.customExercises).toHaveLength(1);
    expect(snapshot.workouts[0].endTime - snapshot.workouts[0].startTime).toBe(90 * 60 * 1000);
    await page.reload();
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await expect(page.getByLabel('Start date and time', { exact: true })).toHaveValue('2026-09-08T10:00');
    await expect(page.getByLabel('End date and time', { exact: true })).toHaveValue('2026-09-08T11:30');
    expect(snapshot.workoutExercises[0].sets).toEqual([expect.objectContaining({ weight: 80, reps: 8, type: 'working' })]);
    // Reusing the exercise in a second workout puts it first and exposes its history.
    await page.getByRole('link', { name: 'Training', exact: true }).click();
    await page.getByRole('link', { name: /Foundry District/ }).click();
    await page.getByRole('button', { name: 'Add Exercise', exact: true }).click();
    await expect(modal.getByRole('listitem').first()).toContainText('barbell bench press');
    await modal.getByRole('listitem').first().getByRole('button').click();
    await expect(first.getByRole('button', { name: 'Toggle warmup set' })).toHaveAttribute('aria-pressed', 'true');
    await first.getByRole('button', { name: 'History', exact: true }).click();
    await expect(modal).toContainText('80');
    await expect(modal).toContainText('8');
    await modal.getByRole('button', { name: 'Close' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
});

async function expectPendingChanges(page: Page, count: number) {
    await expect.poll(() => page.evaluate(async () => {
        const accountId = await fetch('/api/bootstrap').then(response => response.json())
            .then(bootstrap => bootstrap.user?.id as string | undefined).catch(() => undefined);
        const databases = await indexedDB.databases();
        const accountDatabases = databases.filter(database => database.name?.startsWith('GymApp:'));
        const name = (accountId ? accountDatabases.find(database => database.name?.endsWith(`:${accountId}`)) : accountDatabases[0])?.name;
        if (!name) return 0;
        return new Promise<number>((resolve, reject) => {
            const request = indexedDB.open(name);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const database = request.result;
                const countRequest = database.transaction('outbox').objectStore('outbox').count();
                countRequest.onerror = () => reject(countRequest.error);
                countRequest.onsuccess = () => { database.close(); resolve(countRequest.result); };
            };
        });
    })).toBe(count);
}

test('admin sees environment-managed settings without deployment credentials', async ({ page }) => {
    expect((await page.request.post('/api/auth/login', { data: fixtureCredentials.admin })).ok()).toBe(true);
    await page.goto('/admin');
    await page.getByRole('button', { name: 'General', exact: true }).click();
    await expect(page.getByLabel('Server port')).toHaveValue('4173');
    await expect(page.getByLabel('Server port')).toHaveAttribute('readonly', '');
    await expect(page.getByLabel('Development fixtures')).toHaveValue('Enabled');
    await page.getByRole('button', { name: 'OIDC', exact: true }).click();
    await expect(page.getByLabel('Issuer URL')).toHaveValue('https://identity.example');
    await expect(page.getByLabel('Issuer URL')).toBeDisabled();
    await expect(page.getByRole('checkbox')).toBeDisabled();
    await expect(page.getByText('OIDC credentials are configured.', { exact: true })).toBeVisible();
    await expect(page.locator('input[type=password]')).toHaveCount(0);
    await expect(page.getByLabel('Scopes')).toBeEnabled();
    await page.getByLabel('Scopes').fill('openid email');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Settings saved.', { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'OIDC', exact: true }).click();
    await expect(page.getByLabel('Scopes')).toHaveValue('openid email');
});

test('history deletion preserves the workout on local failure and supports retry', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    expect((await page.request.post('/api/auth/register', {
        data: { username: 'history-delete-retry', password: testPassword },
    })).ok()).toBe(true);
    await page.goto('/');
    await page.getByRole('link', { name: /Foundry District/ }).click();
    await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
    await expectPendingChanges(page, 0);
    await page.getByRole('link', { name: 'Analysis', exact: true }).click();
    const remove = page.getByRole('button', { name: 'Delete workout', exact: true });
    const workout = page.getByRole('link', { name: /view/i });
    await expect(workout).toHaveCount(1);
    page.once('dialog', dialog => dialog.dismiss());
    await remove.click();
    await expect(workout).toHaveCount(1);

    // Fail the actual local storage operation; an HTTP failure would only queue
    // an offline deletion and would not exercise this UI error path.
    await page.evaluate(() => {
        const original = IDBObjectStore.prototype.delete;
        IDBObjectStore.prototype.delete = function (key) {
            if (this.name === 'workouts') {
                IDBObjectStore.prototype.delete = original;
                throw new DOMException('Injected storage failure', 'UnknownError');
            }
            return original.call(this, key);
        };
    });
    page.once('dialog', dialog => dialog.accept());
    await remove.click();
    await expect(page.getByRole('alert')).toHaveText('Could not save this change. Please try again.');
    await expect(workout).toHaveCount(1);
    await expect(remove).toBeEnabled();
    await expectPendingChanges(page, 0);
    expect((await (await page.request.get('/api/sync/snapshot')).json()).workouts).toHaveLength(1);

    page.once('dialog', dialog => dialog.accept());
    await remove.click();
    await expect(workout).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect.poll(async () => (await (await page.request.get('/api/sync/snapshot')).json()).workouts).toEqual([]);
    expect(errors).toEqual([]);
});

test('fixture users share gyms and retain private timed workouts through logout and reload', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const login = async (role: keyof typeof fixtureCredentials) => {
        const { username, password } = fixtureCredentials[role];
        await page.goto('/auth');
        await page.locator('input[autocomplete=username]').fill(username);
        await page.locator('input[autocomplete=current-password]').fill(password);
        await page.getByRole('button', { name: 'Log in', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    };
    await login('user');
    const analysisLink = page.getByRole('link', { name: 'Analysis', exact: true });
    await analysisLink.focus();
    await analysisLink.press('Enter');
    await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeVisible();
    const trainingLink = page.getByRole('link', { name: 'Training', exact: true });
    await trainingLink.focus();
    await trainingLink.press('Enter');
    await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Profile', exact: true }).click();
    expect(await page.locator('main').evaluate(element => {
        element.scrollTop = element.scrollHeight;
        return element.scrollTop;
    })).toBeGreaterThan(0);
    await page.getByRole('link', { name: 'Training', exact: true }).click();
    await expect.poll(() => page.locator('main').evaluate(element => element.scrollTop)).toBe(0);
    await expect(page.getByRole('link', { name: /Iron Odyssey/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Moonshot Barbell Club/ })).toBeVisible();
    await page.getByRole('link', { name: /Iron Odyssey/ }).tap();
    await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toHaveCount(0);
    await expectPendingChanges(page, 0);
    const started = (await (await page.request.get('/api/sync/snapshot')).json()).workouts;
    expect(started).toHaveLength(1);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
    await expectPendingChanges(page, 0);
    expect((await (await page.request.get('/api/sync/snapshot')).json()).workouts).toEqual(started);
    await page.getByRole('link', { name: 'Training', exact: true }).click();
    await expect(page.getByRole('link', { name: /Moonshot Barbell Club/ })).toHaveCount(0);
    const bannerTime = page.getByRole('link', { name: /Workout session active/ }).locator('time');
    await expect(bannerTime).toHaveAttribute('datetime', new Date(started[0].startTime).toISOString());
    await expect(bannerTime).toHaveText(await page.evaluate(timestamp => new Date(timestamp).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' }), started[0].startTime));
    await expect(page.getByText('Moonshot Barbell Club', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Resume workout', exact: true }).click();
    await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    await expectPendingChanges(page, 0);
    await page.getByRole('link', { name: 'Analysis', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Iron Odyssey', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(page.locator('a[href="/admin"]')).toHaveCount(0);
    await expect(page.locator('a[href="/settings/gyms"]')).toHaveCount(0);
    await page.getByLabel('Theme').selectOption('oled');
    await expect(page.locator('html')).toHaveClass(/oled/);
    await page.getByLabel('Theme').selectOption('dark');
    await page.getByLabel('Language').selectOption('de');
    await expect(page.getByRole('link', { name: 'Analyse', exact: true })).toBeVisible();
    await page.locator('#settings-language').selectOption('en');
    await expectPendingChanges(page, 0);
    await page.getByRole('button', { name: /Log out|Logout/i }).click();
    await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
    await login('admin');
    await page.getByRole('link', { name: 'Analysis', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Iron Odyssey', exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(page.locator('a[href="/admin"]')).toBeVisible();
    await page.locator('a[href="/admin"]').click();
    await expect(page.getByRole('button', { name: 'Users', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /Log out|Logout/i }).click();
    await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
    await login('user');
    await page.getByRole('link', { name: 'Analysis', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Iron Odyssey', exact: true })).toBeVisible();
    await page.getByRole('link', { name: /view/i }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete workout', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Iron Odyssey', exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('offline timed intent, cancellation, profile measurements, and catalog edits use the new stores', async ({ page, context }) => {
    await page.goto('/auth');
    await page.locator('input[autocomplete=username]').fill(fixtureCredentials.admin.username);
    await page.locator('input[autocomplete=current-password]').fill(fixtureCredentials.admin.password);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page.getByRole('link', { name: /Moonshot Barbell Club/ })).toBeVisible();
    await context.setOffline(true);
    await page.getByRole('link', { name: /Moonshot Barbell Club/ }).click();
    await expectPendingChanges(page, 1);
    const offlineRevalidation = page.waitForEvent('requestfailed', request => request.url().endsWith('/api/bootstrap'));
    await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await offlineRevalidation;
    await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByText('Pending changes must be synchronized or explicitly discarded before refreshing.')).toBeVisible();
    await page.getByRole('link', { name: 'Training', exact: true }).click();
    await page.getByRole('link', { name: 'Resume workout', exact: true }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Cancel workout', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    await expectPendingChanges(page, 2);
    await context.setOffline(false);
    await expectPendingChanges(page, 0);
    await page.reload();
    await expect(page.getByRole('link', { name: 'Resume workout', exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'Profile', exact: true }).click();
    await page.getByLabel('Weight (kg)').fill('80');
    await page.getByRole('button', { name: 'Save Profile', exact: true }).click();
    await expect(page.getByText('Profile saved.', { exact: true })).toBeVisible();
    await expectPendingChanges(page, 0);
    const data = await (await page.request.get('/api/sync/snapshot')).json();
    expect(data.profile.weight).toBe(80);
    expect(data.measurements).toHaveLength(1);
    expect(uuidVersion(data.installationId)).toBe(7);
    expect(uuidVersion(data.accountId)).toBe(7);
    expect(data.profile.id).toBe(data.accountId);
    expect(uuidVersion(data.measurements[0].id)).toBe(7);
    for (const gym of data.gyms) expect(uuidVersion(gym.id)).toBe(7);
    expect(data.workouts).toEqual([]);
    await page.getByRole('link', { name: 'Analysis', exact: true }).click();
    await page.getByRole('button', { name: 'Body Analysis', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Weight History', exact: true })).toBeVisible();
    await expect(page.locator('.recharts-line-dots circle')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Body Fat History', exact: true })).toBeVisible();
    await page.goto('/settings/gyms');
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await page.locator('input').first().fill('Iron Odyssey Updated');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Iron Odyssey Updated', exact: true })).toBeVisible();
    await expectPendingChanges(page, 0);
    const renamed = await (await page.request.get('/api/sync/snapshot')).json();
    expect(renamed.gyms.some((gym: { name: string }) => gym.name === 'Iron Odyssey Updated')).toBe(true);
});

test('authorization failure refreshes a demoted administrator role', async ({ page, playwright }) => {
    const admin = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173' });
    try {
        expect((await admin.post('/api/auth/login', { data: fixtureCredentials.admin })).ok()).toBe(true);
        const created = await admin.post('/api/admin/users', {
            data: { username: 'role-refresh', password: testPassword, name: 'Role Refresh', isAdmin: true },
        });
        const { id } = await created.json();
        expect(created.ok()).toBe(true);
        await page.goto('/auth');
        await page.locator('input[autocomplete=username]').fill('role-refresh');
        await page.locator('input[autocomplete=current-password]').fill(testPassword);
        await page.getByRole('button', { name: 'Log in', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
        expect((await admin.patch(`/api/admin/users/${id}`, { data: { isAdmin: false } })).ok()).toBe(true);
        await page.getByRole('link', { name: 'Settings', exact: true }).click();
        await page.locator('a[href="/admin"]').click();
        await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
        await page.getByRole('link', { name: 'Settings', exact: true }).click();
        await expect(page.locator('a[href="/admin"]')).toHaveCount(0);
        expect((await admin.delete(`/api/admin/users/${id}`)).ok()).toBe(true);
    } finally {
        await admin.dispose();
    }
});

test('failed bootstrap preserves pending intent and retries without onboarding', async ({ page, context }) => {
    expect((await page.request.post('/api/auth/register', {
        data: { username: 'browser-retry', password: testPassword },
    })).ok()).toBe(true);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    await context.route('**/api/sync', route => route.abort());
    await page.getByRole('link', { name: /Foundry District/ }).click();
    await expectPendingChanges(page, 1);
    await page.route('**/api/bootstrap', route => route.fulfill({ status: 500, body: 'unavailable' }));
    await page.reload();
    await expect(page.getByText('Could not load your account. Local data has been preserved.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toHaveCount(0);
    await page.unroute('**/api/bootstrap');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
    await expectPendingChanges(page, 1);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Cancel workout', exact: true }).click();
    await context.unroute('**/api/sync');
    await expectPendingChanges(page, 0);
});

test('advanced recovery is failed-only, confirmed, failure-atomic, exportable, and account-scoped', async ({ page, context }) => {
    const register = async (username: string) => {
        expect((await page.request.post('/api/auth/register', {
            data: { username, password: testPassword },
        })).ok()).toBe(true);
        await page.goto('/');
        await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    };
    const queueWorkout = async () => {
        await page.getByRole('link', { name: /Foundry District/ }).click();
        await expectPendingChanges(page, 1);
    };

    await context.route('**/api/sync', route => route.fulfill({ status: 422, json: { error: 'rejected' } }));
    await register('discard-account-a');
    await queueWorkout();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /Log out|Logout/i }).click();

    await register('discard-account-b');
    await queueWorkout();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByText('Advanced recovery', { exact: true }).click();
    const discard = page.getByRole('button', { name: 'Discard all unsynced changes', exact: true });
    page.once('dialog', dialog => dialog.dismiss());
    await discard.click();
    await expect(discard).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export Data/ }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const exported = JSON.parse(await fs.readFile(downloadPath!, 'utf8'));
    expect(exported.pending).toHaveLength(1);
    expect(exported.pending[0].command.accountId).toBe(exported.binding.accountId);
    expect(exported.syncMetadata).toHaveLength(1);

    await page.route('**/api/bootstrap', route => route.fulfill({ status: 500, body: 'unavailable' }));
    page.once('dialog', dialog => dialog.accept());
    await discard.click();
    await expect(page.getByText('Could not load your account. Local data has been preserved.')).toBeVisible();
    await page.unroute('**/api/bootstrap');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.getByText(/Workout session active/)).toBeVisible();
    await expectPendingChanges(page, 1);

    page.once('dialog', dialog => dialog.accept());
    await page.getByText('Advanced recovery', { exact: true }).click();
    await page.getByRole('button', { name: 'Discard all unsynced changes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.getByText('Advanced recovery', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /Log out|Logout/i }).click();
    expect((await page.request.post('/api/auth/login', {
        data: { username: 'discard-account-a', password: testPassword },
    })).ok()).toBe(true);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Resume workout', exact: true })).toBeVisible();
    await expectPendingChanges(page, 1);

    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByText('Advanced recovery', { exact: true }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Discard all unsynced changes', exact: true }).click();
    await context.unroute('**/api/sync');
});

test('superseded bootstrap completion cannot publish stale session state', async ({ page }) => {
    expect((await page.request.post('/api/auth/register', {
        data: { username: 'superseded-bootstrap', password: testPassword },
    })).ok()).toBe(true);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/bootstrap', async route => {
        calls++;
        if (calls === 1) {
            await gate;
            await route.fulfill({ json: { ok: true, status: 'signedOut', installationId: uuidv7() } });
            return;
        }
        await route.continue();
    });
    await page.evaluate(() => {
        const channel = new BroadcastChannel('gymapp-session');
        channel.postMessage('changed');
        channel.close();
    });
    await expect.poll(() => calls).toBe(1);
    await page.evaluate(() => {
        const channel = new BroadcastChannel('gymapp-session');
        channel.postMessage('changed');
        channel.close();
    });
    release();
    await expect.poll(() => calls).toBe(2);
    await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log in', exact: true })).toHaveCount(0);
});

test('an external cookie switch pauses stale intent and rebinds the visible tab', async ({ page }) => {
    expect((await page.request.post('/api/auth/register', {
        data: { username: 'external-cookie-a', password: testPassword },
    })).ok()).toBe(true);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    let sending = false;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/sync', async route => {
        sending = true;
        await gate;
        await route.continue();
    });
    const mismatch = page.waitForResponse(response => response.url().endsWith('/api/sync') && response.status() === 409);
    await page.getByRole('link', { name: /Foundry District/ }).click();
    await expect.poll(() => sending).toBe(true);
    expect((await page.request.post('/api/auth/login', {
        data: fixtureCredentials.admin,
    })).ok()).toBe(true);
    release();
    expect((await mismatch).status()).toBe(409);
    await page.unroute('**/api/sync');
    await expect(page.getByRole('link', { name: 'Select a gym to start', exact: true })).toBeVisible();
    await expectPendingChanges(page, 0);
    expect((await (await page.request.get('/api/sync/snapshot')).json()).workouts).toEqual([]);

    await page.route('**/api/sync', route => route.fulfill({ status: 422, json: { error: 'rejected' } }));
    expect((await page.request.post('/api/auth/login', {
        data: { username: 'external-cookie-a', password: testPassword },
    })).ok()).toBe(true);
    await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
    await expectPendingChanges(page, 1);
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByText('Advanced recovery', { exact: true }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Discard all unsynced changes', exact: true }).click();
    await page.unroute('**/api/sync');
});

test('two tabs serialize senders and propagate logout and account switches', async ({ page, context }) => {
    expect((await page.request.post('/api/auth/register', {
        data: { username: 'browser-tabs', password: testPassword },
    })).ok()).toBe(true);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    const second = await context.newPage();
    await second.goto('/');
    await expect(second.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    let sends = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await context.route('**/api/sync', async route => {
        sends++;
        await gate;
        await route.continue();
    });
    let logoutRequests = 0;
    await context.route('**/api/auth/logout', async route => { logoutRequests++; await route.continue(); });
    try {
        await page.getByRole('link', { name: /Foundry District/ }).click();
        await expect.poll(() => sends).toBe(1);
        // A second sender's timer fires while the first still holds the browser lock.
        await expect.poll(() => second.evaluate(async () =>
            (await navigator.locks.query()).pending?.some(lock => lock.name?.startsWith('sync:')) ?? false)).toBe(true);
        expect(sends).toBe(1);
        await second.getByRole('link', { name: 'Settings', exact: true }).click();
        await second.getByRole('button', { name: /Log out|Logout/i }).click();
        await expect.poll(() => logoutRequests).toBe(0);
    } finally { release(); }
    await expect.poll(() => logoutRequests).toBe(1);
    await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
    await context.unroute('**/api/sync');
    await second.locator('input[autocomplete=username]').fill(fixtureCredentials.admin.username);
    await second.locator('input[autocomplete=current-password]').fill(fixtureCredentials.admin.password);
    await second.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(second.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    await expectPendingChanges(page, 0);
    await expect(page.getByRole('link', { name: 'Resume workout', exact: true })).toHaveCount(0);
    await second.getByRole('link', { name: 'Settings', exact: true }).click();
    await second.getByRole('button', { name: /Log out|Logout/i }).click();
    await second.locator('input[autocomplete=username]').fill('browser-tabs');
    await second.locator('input[autocomplete=current-password]').fill(testPassword);
    await second.getByRole('button', { name: 'Log in', exact: true }).click();
    await expectPendingChanges(second, 0);
    await expect(second.getByRole('link', { name: 'Resume workout', exact: true })).toBeVisible();
    second.once('dialog', dialog => dialog.accept());
    await second.getByRole('link', { name: 'Resume workout', exact: true }).click();
    await second.getByRole('button', { name: 'Cancel workout', exact: true }).click();
    await expect.poll(async () => (await (await second.request.get('/api/sync/snapshot')).json()).workouts).toEqual([]);
    await second.close();
});
