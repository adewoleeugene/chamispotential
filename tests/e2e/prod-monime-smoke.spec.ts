import { expect, test } from '@playwright/test';

test.describe('production monime smoke', () => {
    test('waiter can start a Monime checkout on production', async ({ page }) => {
        await page.goto('/login');

        const emailField = page.getByLabel('Email Address').or(page.getByPlaceholder('Enter your email'));
        const passwordField = page.getByLabel('Password').or(page.getByPlaceholder('Enter your password'));
        const submitButton = page.getByRole('button', { name: /enter dashboard|sign in/i });

        await emailField.fill('waiter@rms.com');
        await passwordField.fill('waiter123');
        await submitButton.click();
        await page.waitForURL(/\/tables|\/dashboard/, { timeout: 20_000 });

        await page.getByRole('link', { name: /orders/i }).click();
        await page.waitForURL(/\/orders$/, { timeout: 20_000 });

        const tableSelect = page.getByLabel('Service Table');
        const tableOption = tableSelect.locator('option:not([value=""])').first();
        const tableId = await tableOption.getAttribute('value');
        expect(tableId).toBeTruthy();

        await tableSelect.selectOption(tableId!);
        await page.locator('.menu-item-card').first().click();

        await page.getByRole('button', { name: /monime checkout/i }).click();
        await expect(page.getByRole('button', { name: /pay with monime/i })).toBeVisible();

        const checkoutResponsePromise = page.waitForResponse((response) =>
            response.url().includes('/api/payments/monime/checkout') &&
            response.request().method() === 'POST'
        );

        await page.getByRole('button', { name: /pay with monime/i }).click();
        const checkoutResponse = await checkoutResponsePromise;
        expect(checkoutResponse.ok()).toBeTruthy();

        await page.waitForURL(/monime/i, { timeout: 30_000 });
        expect(page.url()).toMatch(/monime/i);
    });
});
