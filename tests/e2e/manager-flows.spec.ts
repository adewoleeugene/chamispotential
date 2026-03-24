import { expect, test } from '@playwright/test';

async function loginAsManager(page: import('@playwright/test').Page) {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill('manager@rms.com');
    await page.getByLabel('Password').fill('manager123');
    await page.getByRole('button', { name: /enter dashboard/i }).click();
    await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });
}

test.describe('manager flows', () => {
    test('manager orders page shows analytics filters', async ({ page }) => {
        await loginAsManager(page);
        await page.getByRole('link', { name: /orders/i }).click();

        await expect(page).toHaveURL(/\/orders$/);
        await expect(page.getByText('Order Performance')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Day' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Week' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Month' })).toBeVisible();
        await expect(page.getByRole('button', { name: /submit order/i })).toHaveCount(0);

        await page.getByRole('button', { name: 'Month' }).click();
        await expect(page.getByText(/This Month Orders|Today Orders|This Week Orders/)).toBeVisible();
    });

    test('manager tables page shows table analytics filters', async ({ page }) => {
        await loginAsManager(page);
        await page.getByRole('link', { name: /tables/i }).click();

        await expect(page).toHaveURL(/\/tables$/);
        await expect(page.getByText('Table Intelligence')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Day' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Week' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Month' })).toBeVisible();
        await expect(page.getByText('Quick Action')).toHaveCount(0);
        await expect(page.getByText('New Order')).toHaveCount(0);
    });

    test('manager can manage inventory items from the UI', async ({ page }) => {
        const itemName = `Playwright Stock ${Date.now()}`;
        await loginAsManager(page);
        await page.getByRole('link', { name: /inventory/i }).click();

        await expect(page).toHaveURL(/\/inventory$/);
        await page.getByRole('button', { name: /add inventory/i }).click();
        await page.getByLabel('Item Name').fill(itemName);
        await page.getByLabel('Category').fill('Testing');
        await page.getByLabel(/^Unit$/).fill('pcs');
        await page.getByLabel('Current Stock').fill('6');
        await page.getByLabel('Minimum Stock').fill('2');
        await page.getByLabel('Maximum Stock').fill('10');
        await page.getByLabel(/^Unit Cost$/).fill('1.5');
        await page.getByRole('button', { name: /create inventory item/i }).click();

        await expect(page.getByText(itemName)).toBeVisible();

        const row = page.locator('tr', { hasText: itemName });
        await row.getByTitle('Edit').click();
        await page.getByLabel('Current Stock').fill('8');
        await page.getByLabel('Storage Location').fill('QA Shelf');
        await page.getByRole('button', { name: /save changes/i }).click();
        await expect(row).toContainText(itemName);
        await row.getByTitle('Edit').click();
        await expect(page.getByLabel('Current Stock')).toHaveValue('8');
        await expect(page.getByLabel('Storage Location')).toHaveValue('QA Shelf');
        await page.getByRole('button', { name: /save changes/i }).click();

        page.once('dialog', (dialog) => dialog.accept());
        await row.getByTitle('Delete').click();
        await expect(page.getByText(itemName)).toHaveCount(0);
    });

    test('manager reports page supports day week month and custom filters', async ({ page }) => {
        await loginAsManager(page);
        await page.getByRole('link', { name: /reports/i }).click();

        await expect(page).toHaveURL(/\/reports$/);
        await expect(page.getByText('Executive Reports')).toBeVisible();
        await expect(page.getByRole('button', { name: /purchase ledger csv/i })).toBeVisible();
        await expect(page.getByLabel('Costing')).toBeVisible();
        await expect(page.getByText('This Week')).toBeVisible();
        await expect(page.getByText('This Month')).toBeVisible();
        await page.getByRole('button', { name: 'Day' }).click();
        await expect(page.getByText(/Today Net Sales|This Week Net Sales|This Month Net Sales/)).toBeVisible();
        await page.getByRole('button', { name: 'Custom' }).click();
        await expect(page.getByLabel('Start')).toBeVisible();
        await expect(page.getByLabel('End')).toBeVisible();
        await page.getByRole('button', { name: 'Month' }).click();
        await expect(page.getByText('Revenue Rhythm')).toBeVisible();
        await expect(page.getByText('Purchases by Ingredient')).toBeVisible();
        await expect(page.getByText('Cost Audit View')).toBeVisible();
    });
});
