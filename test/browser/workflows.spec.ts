import { test, expect } from '@playwright/test';

test('fixture users share gyms and retain private timed workouts through logout and reload', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const login = async (username: string) => {
        await page.goto('/auth');
        await page.locator('input[autocomplete=username]').fill(username);
        await page.locator('input[autocomplete=current-password]').fill('123geheim');
        await page.getByRole('button', { name: 'Log in', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    };
    await login('user');
    await expect(page.getByRole('button', { name: /Iron Odyssey/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Moonshot Barbell Club/ })).toBeVisible();
    await page.getByRole('button', { name: /Iron Odyssey/ }).tap();
    await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Start workout', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
    await expect(page.getByText('Pending changes: 0', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    await expect(page.getByText('Pending changes: 0', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Analysis', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Iron Odyssey', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.locator('a[href="/admin"]')).toHaveCount(0);
    await expect(page.locator('a[href="/settings/gyms"]')).toHaveCount(0);
    await page.getByRole('button', { name: /Log out|Logout/i }).click();
    await login('admin');
    await page.getByRole('button', { name: 'Analysis', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Iron Odyssey', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.locator('a[href="/admin"]')).toBeVisible();
    await page.locator('a[href="/admin"]').click();
    await expect(page.getByRole('button', { name: 'Users', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /Log out|Logout/i }).click();
    await login('user');
    await page.getByRole('button', { name: 'Analysis', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Iron Odyssey', exact: true })).toBeVisible();
    await page.getByRole('link', { name: /view/i }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete workout', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Iron Odyssey', exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('offline timed intent, cancellation, profile measurements, and catalog edits use the new stores', async ({ page, context }) => {
    await page.goto('/auth');
    await page.locator('input[autocomplete=username]').fill('admin');
    await page.locator('input[autocomplete=current-password]').fill('123geheim');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.getByRole('button', { name: /Moonshot Barbell Club/ }).click();
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Start workout', exact: true }).click();
    await expect(page.getByText('Pending changes: 1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByText('Pending changes must be synchronized or explicitly discarded before refreshing.')).toBeVisible();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Cancel workout', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
    await expect(page.getByText('Pending changes: 2', { exact: true })).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText('Pending changes: 0', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.locator('input[type=number]').first().fill('80');
    await page.getByRole('button', { name: 'Save Profile', exact: true }).click();
    await expect(page.getByText('Profile saved.', { exact: true })).toBeVisible();
    await expect(page.getByText('Pending changes: 0', { exact: true })).toBeVisible();
    const data = await (await page.request.get('/api/sync/snapshot')).json();
    expect(data.profile.weight).toBe(80);
    expect(data.measurements).toHaveLength(1);
    expect(data.workouts).toEqual([]);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.locator('a[href="/settings/gyms"]').click();
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await page.locator('input').first().fill('Iron Odyssey Updated');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Iron Odyssey Updated', exact: true })).toBeVisible();
    await expect(page.getByText('Pending changes: 0', { exact: true })).toBeVisible();
    const renamed = await (await page.request.get('/api/sync/snapshot')).json();
    expect(renamed.gyms.some((gym: { name: string }) => gym.name === 'Iron Odyssey Updated')).toBe(true);
});

test('authorization failure refreshes a demoted administrator role', async ({ page, playwright }) => {
    const admin = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173' });
    try {
        expect((await admin.post('/api/auth/login', { data: { username: 'admin', password: '123geheim' } })).ok()).toBe(true);
        const created = await admin.post('/api/admin/users', {
            data: { username: 'role-refresh', password: 'testpassword', name: 'Role Refresh', isAdmin: true },
        });
        const { id } = await created.json();
        expect(created.ok()).toBe(true);
        await page.goto('/auth');
        await page.locator('input[autocomplete=username]').fill('role-refresh');
        await page.locator('input[autocomplete=current-password]').fill('testpassword');
        await page.getByRole('button', { name: 'Log in', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
        expect((await admin.patch(`/api/admin/users/${id}`, { data: { isAdmin: false } })).ok()).toBe(true);
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.locator('a[href="/admin"]').click();
        await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await expect(page.locator('a[href="/admin"]')).toHaveCount(0);
        expect((await admin.delete(`/api/admin/users/${id}`)).ok()).toBe(true);
    } finally {
        await admin.dispose();
    }
});
