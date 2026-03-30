import { expect, test } from '@playwright/test';

const credentials = {
    admin: { email: 'admin@rms.com', password: 'admin123', landingPath: /\/dashboard$/ },
    waiter: { email: 'waiter@rms.com', password: 'waiter123', landingPath: /\/tables$/ },
} as const;

async function loginAs(page: import('@playwright/test').Page, role: keyof typeof credentials) {
    const account = credentials[role];
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: /enter dashboard/i }).click();
    await page.waitForURL(account.landingPath, { timeout: 15_000 });
}

test.describe('admin and waiter flows', () => {
    test('admin can add a staff member and deactivate the account after verification', async ({ page }) => {
        await loginAs(page, 'admin');
        await expect(page.getByRole('link', { name: /settings/i })).toHaveCount(0);
        await page.getByRole('link', { name: /staff/i }).click();

        await expect(page).toHaveURL(/\/staff$/);
        await expect(page.getByRole('button', { name: /add member/i })).toBeVisible();

        const uniqueStamp = Date.now();
        const staffName = `Playwright Admin ${uniqueStamp}`;
        const staffEmail = `playwright.admin.${uniqueStamp}@rms.com`;

        await page.getByRole('button', { name: /add member/i }).click();
        await page.getByLabel('Full Name').fill(staffName);
        await page.getByLabel('Email').fill(staffEmail);
        await page.getByLabel('Phone Number').fill('+23270000000');
        await page.getByLabel('Password').fill('playwright123');
        await page.getByLabel('Role / Access Level').selectOption('waiter');

        const createResponse = page.waitForResponse((response) =>
            response.url().includes('/api/staff') && response.request().method() === 'POST' && response.status() === 201
        );
        await page.getByRole('button', { name: /create account/i }).click();
        const createdMemberResponse = await createResponse;
        const createdMember = await createdMemberResponse.json();

        await expect(page.getByText(staffName)).toBeVisible();
        await expect(page.getByText(staffEmail)).toBeVisible();

        expect(createdMember).toBeTruthy();

        if (createdMember) {
            const disableResponse = await page.evaluate(async (memberId) => {
                const response = await fetch(`/api/staff/${memberId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isActive: false }),
                });

                return {
                    ok: response.ok,
                    status: response.status,
                };
            }, createdMember.id);
            expect(disableResponse.ok).toBeTruthy();
        }
    });

    test('waiter only sees waiter navigation and cannot access management links', async ({ page }) => {
        await loginAs(page, 'waiter');

        await expect(page).toHaveURL(/\/tables$/);
        await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /orders/i })).toHaveCount(0);
        await expect(page.getByRole('link', { name: /tables/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /inventory/i })).toHaveCount(0);
        await expect(page.getByRole('link', { name: /reports/i })).toHaveCount(0);
        await expect(page.getByRole('link', { name: /settings/i })).toHaveCount(0);
        await expect(page.getByRole('link', { name: /staff/i })).toHaveCount(0);

        await page.goto('/orders');
        await expect(page).toHaveURL(/\/tables$/);
    });

    test('waiter can create a dine-in order from the tables workspace', async ({ page }) => {
        await loginAs(page, 'waiter');
        await page.getByText('Waterloo', { exact: true }).click();
        await expect(page.getByRole('heading', { name: /order for waterloo/i })).toBeVisible();

        const beforeOrders = await page.evaluate(async () => {
            const response = await fetch('/api/orders?status=pending,preparing,ready,draft,payment_pending_confirmation');
            return response.json();
        });
        const beforeMaxOrderNumber = Array.isArray(beforeOrders)
            ? beforeOrders.reduce((max: number, order: any) => Math.max(max, order.orderNumber || 0), 0)
            : 0;

        await page.locator('.menu-item-card').first().click();
        await expect(page.getByRole('heading', { name: /cart/i })).toBeVisible();

        const submitResponse = page.waitForResponse((response) =>
            response.url().includes('/api/orders') && response.request().method() === 'POST' && response.status() === 201
        );
        await page.getByRole('button', { name: /place order/i }).click();
        await page.getByRole('button', { name: /^open tab$/i }).click();
        const createdOrderResponse = await submitResponse;
        const createdOrder = await createdOrderResponse.json();

        expect(createdOrder.orderNumber).toBeGreaterThan(beforeMaxOrderNumber);
        expect(createdOrder.status).toBe('pending');
        expect(createdOrder.table?.number).toBe(3);

        const persistedOrder = await page.evaluate(async (orderId) => {
            const response = await fetch('/api/orders?status=pending,preparing,ready,draft,payment_pending_confirmation');
            const orders = await response.json();
            return Array.isArray(orders) ? orders.find((order: any) => order.id === orderId) ?? null : null;
        }, createdOrder.id);

        expect(persistedOrder).toBeTruthy();
        expect(persistedOrder.status).toBe('pending');
        expect(persistedOrder.paymentStatus).toBe('unpaid');
    });

    test('waiter can settle an open tab with cash when the guest is leaving', async ({ page }) => {
        await loginAs(page, 'waiter');
        await page.getByText('Waterloo', { exact: true }).click();
        await expect(page.getByRole('heading', { name: /order for waterloo/i })).toBeVisible();

        await page.locator('.menu-item-card').first().click();

        const createResponse = page.waitForResponse((response) =>
            response.url().includes('/api/orders') && response.request().method() === 'POST' && response.status() === 201
        );
        await page.getByRole('button', { name: /place order/i }).click();
        await page.getByRole('button', { name: /^open tab$/i }).click();
        const createdOrderResponse = await createResponse;
        const createdOrder = await createdOrderResponse.json();

        await expect(page.getByRole('heading', { name: /order for waterloo/i })).toHaveCount(0);

        await page.getByText('Waterloo', { exact: true }).click();
        await expect(page.getByRole('heading', { name: /order for waterloo/i })).toBeVisible();

        const orderCard = page.locator('div').filter({ hasText: `#${createdOrder.orderNumber}` }).first();
        await expect(orderCard).toContainText(/settle bill/i);

        const settleResponse = page.waitForResponse((response) =>
            response.url().includes(`/api/orders/${createdOrder.id}`) &&
            response.request().method() === 'PATCH' &&
            response.ok()
        );
        await orderCard.getByRole('button', { name: /settle bill/i }).click();
        await page.getByRole('button', { name: /^cash$/i }).click();
        await settleResponse;

        const persistedOrder = await page.evaluate(async (orderId) => {
            const response = await fetch(`/api/orders/${orderId}`);
            return response.json();
        }, createdOrder.id);

        expect(persistedOrder.paymentStatus).toBe('paid');
        expect(persistedOrder.paymentMethod).toBe('cash');
        expect(['pending', 'preparing', 'ready', 'served']).toContain(persistedOrder.status);
    });
});
