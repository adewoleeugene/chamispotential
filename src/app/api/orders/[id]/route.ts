import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';
import {
    reconcileInventoryForOrderEdit,
    restoreInventoryForOrder,
    consumeInventoryForOrder,
} from '@/lib/inventory';
import { activateOrderForService, isOperationalOrderStatus } from '@/lib/orders';
import { getTaxRateDecimal } from '@/lib/runtime-settings';

type OrderItemInput = {
    menuItemId: string;
    quantity: number;
    notes?: string;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!await getRequestUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const order = await prisma.order.findUnique({
        where: { id },
        include: { table: true, user: { select: { name: true } }, items: { include: { menuItem: true } } },
    });
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(order);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const data = await req.json();

    const nextStatus = typeof data.status === 'string' ? data.status : null;
    const isKitchenTransition = nextStatus === 'preparing' || nextStatus === 'ready';
    const isWaiterAction = Boolean(data.items) || data.action === 'confirm_manual_payment' || nextStatus === 'served' || nextStatus === 'cancelled';

    if (!['waiter', 'kitchen'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (user.role === 'kitchen' && !isKitchenTransition) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (user.role === 'waiter' && !isWaiterAction) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (data.items) {
        const updatedOrder = await prisma.$transaction(async (tx) => {
            const existingOrder = await tx.order.findUnique({
                where: { id },
                include: { items: true },
            });

            if (!existingOrder) {
                throw new Error('ORDER_NOT_FOUND');
            }

            const nextItems = data.items as OrderItemInput[];

            const menuItems = await tx.menuItem.findMany({
                where: { id: { in: nextItems.map((item) => item.menuItemId) } },
            });

            const itemMap = new Map(menuItems.map((menuItem) => [menuItem.id, menuItem]));
            const orderItems = nextItems.map((item) => {
                const menuItem = itemMap.get(item.menuItemId);
                return {
                    menuItemId: item.menuItemId,
                    quantity: item.quantity,
                    unitPrice: menuItem?.price || 0,
                    notes: item.notes,
                };
            });

            const subtotal = orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
            const taxRate = await getTaxRateDecimal();
            const tax = subtotal * taxRate;
            const total = subtotal + tax;

            if (isOperationalOrderStatus(existingOrder.status)) {
                await reconcileInventoryForOrderEdit(
                    tx,
                    existingOrder.items.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
                    nextItems
                );
            }

            await tx.orderItem.deleteMany({ where: { orderId: id } });

            return tx.order.update({
                where: { id },
                data: {
                    subtotal,
                    tax,
                    total,
                    items: { create: orderItems }
                },
                include: { table: true, user: { select: { name: true } }, items: { include: { menuItem: true } } },
            });
        });

        return NextResponse.json(updatedOrder);
    }

    try {
        const order = await prisma.$transaction(async (tx) => {
            const existingOrder = await tx.order.findUnique({
                where: { id },
                include: { items: true },
            });

            if (!existingOrder) {
                throw new Error('ORDER_NOT_FOUND');
            }

            if (data.action === 'confirm_manual_payment') {
                await tx.order.update({
                    where: { id },
                    data: {
                        paymentStatus: 'paid',
                        paymentMethod: data.paymentMethod || existingOrder.paymentMethod || 'cash',
                    },
                });

                return activateOrderForService(tx, id);
            }

            if (nextStatus === 'cancelled' && existingOrder.status !== 'cancelled' && isOperationalOrderStatus(existingOrder.status)) {
                await restoreInventoryForOrder(
                    tx,
                    existingOrder.items.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity }))
                );
            }

            if (nextStatus && nextStatus !== 'cancelled' && existingOrder.status === 'cancelled') {
                await consumeInventoryForOrder(
                    tx,
                    existingOrder.items.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity }))
                );
            }

            const updatedOrder = await tx.order.update({
                where: { id },
                data,
                include: { table: true, user: { select: { name: true } }, items: { include: { menuItem: true } } },
            });

            if (['completed', 'cancelled'].includes(data.status) && updatedOrder.tableId && (isOperationalOrderStatus(existingOrder.status) || data.status === 'completed')) {
                const activeOrders = await tx.order.count({
                    where: { tableId: updatedOrder.tableId, status: { in: ['pending', 'preparing', 'ready', 'served'] } },
                });
                if (activeOrders === 0) {
                    await tx.table.update({ where: { id: updatedOrder.tableId }, data: { status: 'cleaning' } });
                }
            }

            return updatedOrder;
        });

        return NextResponse.json(order);
    } catch (error) {
        if (error instanceof Error && error.message === 'ORDER_NOT_FOUND') {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        throw error;
    }
}
