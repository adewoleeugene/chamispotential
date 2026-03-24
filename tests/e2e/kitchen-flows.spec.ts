import { expect, test, type Page, type Browser } from '@playwright/test';

const credentials = {
    kitchen: { email: 'kitchen@rms.com', password: 'kitchen123', landingPath: /\/kitchen$/ },
    waiter: { email: 'waiter@rms.com', password: 'waiter123', landingPath: /\/tables$/ },
} as const;

async function loginAs(page: Page, role: keyof typeof credentials) {
    const account = credentials[role];
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: /enter dashboard/i }).click();
    await page.waitForURL(account.landingPath, { timeout: 15_000 });
}

async function createPendingOrder(browser: Browser) {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3000' });
    const page = await context.newPage();

    await loginAs(page, 'waiter');

    const payload = await page.evaluate(async () => {
        const [tablesResponse, menuResponse] = await Promise.all([
            fetch('/api/tables'),
            fetch('/api/menu'),
        ]);

        const tables = await tablesResponse.json();
        const menuItems = await menuResponse.json();
        const availableTable = Array.isArray(tables) ? tables.find((table: any) => table.status !== 'cleaning') : null;
        const firstMenuItem = Array.isArray(menuItems) ? menuItems[0] : null;

        if (!availableTable || !firstMenuItem) {
            throw new Error('Missing seeded table or menu item for kitchen E2E setup');
        }

        const createResponse = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tableId: availableTable.id,
                type: 'dine-in',
                paymentMethod: 'cash',
                paymentStatus: 'paid',
                status: 'pending',
                items: [
                    {
                        menuItemId: firstMenuItem.id,
                        quantity: 1,
                    },
                ],
            }),
        });

        if (!createResponse.ok) {
            throw new Error(`Failed to create setup order: ${createResponse.status}`);
        }

        const createdOrder = await createResponse.json();
        return {
            orderId: createdOrder.id as string,
            orderNumber: createdOrder.orderNumber as number,
        };
    });

    await context.close();
    return payload;
}

async function updateOrderAsWaiter(browser: Browser, orderId: string, status: 'served' | 'cancelled') {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3000' });
    const page = await context.newPage();

    await loginAs(page, 'waiter');
    await page.evaluate(async ({ id, nextStatus }) => {
        await fetch(`/api/orders/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: nextStatus }),
        });
    }, { id: orderId, nextStatus: status });

    await context.close();
}

test.describe('kitchen flows', () => {
    test('kitchen only sees kitchen navigation', async ({ page }) => {
        await loginAs(page, 'kitchen');

        await expect(page).toHaveURL(/\/kitchen$/);
        await expect(page.getByRole('link', { name: /kitchen/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /dashboard/i })).toHaveCount(0);
        await expect(page.getByRole('link', { name: /orders/i })).toHaveCount(0);
        await expect(page.getByRole('link', { name: /tables/i })).toHaveCount(0);
        await expect(page.getByRole('link', { name: /inventory/i })).toHaveCount(0);
        await expect(page.getByRole('link', { name: /staff/i })).toHaveCount(0);
        await expect(page.getByRole('link', { name: /reports/i })).toHaveCount(0);
        await expect(page.getByRole('link', { name: /settings/i })).toHaveCount(0);
    });

    test('kitchen can move a waiter order from incoming to ready', async ({ page, browser }) => {
        const createdOrder = await createPendingOrder(browser);

        await loginAs(page, 'kitchen');
        await page.goto('/kitchen');

        const orderCard = page.locator('.card').filter({ hasText: `#${createdOrder.orderNumber}` }).first();
        await expect(orderCard).toBeVisible();

        const preparingResponse = page.waitForResponse((response) =>
            response.url().includes(`/api/orders/${createdOrder.orderId}`) &&
            response.request().method() === 'PATCH' &&
            response.ok()
        );
        await orderCard.getByRole('button', { name: /start preparing/i }).click();
        await preparingResponse;
        await expect(orderCard.getByText('preparing')).toBeVisible();

        const readyResponse = page.waitForResponse((response) =>
            response.url().includes(`/api/orders/${createdOrder.orderId}`) &&
            response.request().method() === 'PATCH' &&
            response.ok()
        );
        await orderCard.getByRole('button', { name: /mark as ready/i }).click();
        await readyResponse;
        await expect(orderCard.getByText('ready')).toBeVisible();
        await expect(orderCard.getByText(/waiting for pickup/i)).toBeVisible();

        const persistedOrder = await page.evaluate(async (orderId) => {
            const response = await fetch(`/api/orders/${orderId}`);
            return response.json();
        }, createdOrder.orderId);

        expect(persistedOrder.status).toBe('ready');

        await updateOrderAsWaiter(browser, createdOrder.orderId, 'served');

        const servedOrder = await page.evaluate(async (orderId) => {
            const response = await fetch(`/api/orders/${orderId}`);
            return response.json();
        }, createdOrder.orderId);

        expect(servedOrder.status).toBe('completed');
        expect(servedOrder.paymentStatus).toBe('paid');
        expect(servedOrder.serviceEndedAt).toBeTruthy();
    });
});
