import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';
import { createOrderWithItems } from '@/lib/orders';
import { normalizeCustomizationInputs } from '@/lib/order-customization';
import { isWaiterRole } from '@/lib/roleRoutes';
import { isSettingEnabled } from '@/lib/runtime-settings';
import { fireAndForget, sendToRoles } from '@/lib/notifications';

export async function GET(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const statusWhere = status ? (status.includes(',') ? { status: { in: status.split(',') } } : { status }) : {};
    const where = {
        ...statusWhere,
        ...(isWaiterRole(user.role) ? { userId: user.id } : {}),
    };
    const orders = await prisma.order.findMany({
        where,
        include: {
            table: true,
            user: { select: { name: true, id: true } },
            items: {
                include: {
                    menuItem: true,
                    removals: true,
                    additions: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });
    return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isWaiterRole(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { tableId, items, type, notes, customerName, customerPhone, discount, paymentMethod, paymentStatus, status, deferActivation } = await req.json();

    if (!items || items.length === 0) {
        return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const normalizedItems = items.map(normalizeCustomizationInputs);

    try {
        const order = await prisma.$transaction(async (tx) => {
            return createOrderWithItems(tx, {
                tableId,
                userId: user.id,
                type,
                notes,
                customerName,
                customerPhone,
                discount,
                paymentMethod,
                paymentStatus,
                status,
                applySideEffects: deferActivation ? false : true,
                items: normalizedItems,
            });
        }, { timeout: 20000 });

        if (order.status === 'pending') {
            fireAndForget((async () => {
                if (await isSettingEnabled('notifyNewOrders')) {
                    const tableLabel = order.tableId && order.table?.number != null
                        ? `Table ${order.table.number}`
                        : (order.type || 'Order');
                    await sendToRoles(['kitchen', 'manager', 'admin'], {
                        title: `New order #${order.orderNumber}`,
                        body: `${tableLabel} • ${order.items.length} item${order.items.length === 1 ? '' : 's'}`,
                        url: '/kitchen',
                        tag: `order-${order.id}`,
                    });
                }

                if (await isSettingEnabled('notifyLowInventory')) {
                    const lowItems = await prisma.inventory.findMany({
                        where: { currentStock: { lte: prisma.inventory.fields.minStock } },
                        select: { name: true, currentStock: true, minStock: true, unit: true },
                        orderBy: { currentStock: 'asc' },
                        take: 5,
                    });
                    if (lowItems.length > 0) {
                        const summary = lowItems
                            .slice(0, 3)
                            .map((item) => `${item.name} (${item.currentStock}${item.unit})`)
                            .join(', ');
                        const extra = lowItems.length > 3 ? ` +${lowItems.length - 3} more` : '';
                        await sendToRoles(['manager', 'admin'], {
                            title: 'Low inventory',
                            body: `${summary}${extra}`,
                            url: '/inventory',
                            tag: 'low-inventory',
                        });
                    }
                }
            })());
        }

        return NextResponse.json(order, { status: 201 });
    } catch (error) {
        if (error instanceof Error && (
            error.message.startsWith('MENU_ITEM_NOT_FOUND:')
            || error.message.startsWith('INVALID_REMOVAL:')
            || error.message.startsWith('INVALID_ADDITION:')
            || error.message.startsWith('DUPLICATE_REMOVALS:')
            || error.message.startsWith('DUPLICATE_ADDITIONS:')
        )) {
            return NextResponse.json({ error: 'Invalid item customization payload' }, { status: 400 });
        }

        throw error;
    }
}
