import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';
import { isWaiterRole } from '@/lib/roleRoutes';
import {
    reconcileInventoryForOrderEdit,
    restoreInventoryForOrder,
    consumeInventoryForOrder,
} from '@/lib/inventory';
import {
    activateOrderForService,
    buildCustomizationCreates,
    isOperationalOrderStatus,
    moveTableToCleaningIfNoActiveOrders,
    shouldAutoCompleteServedOrder,
    shouldCloseOrderService,
    shouldStartKitchenService,
    shouldStartOrderService,
} from '@/lib/orders';
import { getTaxRateDecimal } from '@/lib/runtime-settings';
import { normalizeCustomizationInputs, type OrderItemInput } from '@/lib/order-customization';
import { isSettingEnabled } from '@/lib/runtime-settings';
import { fireAndForget, sendToUser } from '@/lib/notifications';

const orderItemInclude = {
    menuItem: true,
    removals: { include: { recipeIngredient: { include: { inventory: true } } } },
    additions: { include: { menuItemExtraOption: { include: { inventory: true } } } },
} as const;

const orderItemInternalInclude = {
    menuItem: { include: { recipeIngredients: true } },
    removals: { include: { recipeIngredient: true } },
    additions: { include: { menuItemExtraOption: true } },
} as const;

function canWaiterEditOrder(status: string) {
    return ['draft', 'payment_pending_confirmation', 'pending'].includes(status);
}

function canWaiterCancelOrder(status: string) {
    return ['draft', 'payment_pending_confirmation', 'pending'].includes(status);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!await getRequestUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const order = await prisma.order.findUnique({
        where: { id },
        include: { table: true, user: { select: { name: true } }, items: { include: orderItemInclude } },
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
    const isWaiterAction = Boolean(data.items) || data.action === 'confirm_manual_payment' || data.confirmManualPayment === true || nextStatus === 'served' || nextStatus === 'cancelled';

    if (!isWaiterRole(user.role) && user.role !== 'kitchen') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (user.role === 'kitchen' && !isKitchenTransition) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (isWaiterRole(user.role) && !isWaiterAction) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (data.items) {
        const updatedOrder = await prisma.$transaction(async (tx) => {
            const existingOrder = await tx.order.findUnique({
                where: { id },
                include: { items: { include: orderItemInternalInclude } },
            }) as any;

            if (!existingOrder) {
                throw new Error('ORDER_NOT_FOUND');
            }

            if (!canWaiterEditOrder(existingOrder.status)) {
                throw new Error('ORDER_EDIT_LOCKED');
            }

            const nextItems = (data.items as OrderItemInput[]).map(normalizeCustomizationInputs);
            const customizationCreates = await buildCustomizationCreates(tx, nextItems);

            const menuItems = await tx.menuItem.findMany({
                where: { id: { in: nextItems.map((item) => item.menuItemId) } },
                include: { recipeIngredients: true },
            });

            const itemMap = new Map(menuItems.map((menuItem) => [menuItem.id, menuItem]));
            const orderItems = nextItems.map((item) => {
                const menuItem = itemMap.get(item.menuItemId);
                return {
                    menuItemId: item.menuItemId,
                    quantity: item.quantity,
                    unitPrice: menuItem?.price || 0,
                    notes: item.notes,
                    kitchenNote: item.kitchenNote,
                };
            });

            const subtotal = orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
            const taxRate = await getTaxRateDecimal();
            const tax = subtotal * taxRate;
            const total = subtotal + tax;

            if (isOperationalOrderStatus(existingOrder.status)) {
                await reconcileInventoryForOrderEdit(
                    tx,
                    existingOrder.items,
                    orderItems.map((item, index) => ({
                        menuItemId: item.menuItemId,
                        quantity: item.quantity,
                        removals: customizationCreates[index]?.removals || [],
                        additions: customizationCreates[index]?.additions || [],
                    }))
                );
            }

            await tx.orderItem.deleteMany({ where: { orderId: id } });
            const updatedOrder = await tx.order.update({
                where: { id },
                data: {
                    subtotal,
                    tax,
                    total,
                    items: { create: orderItems }
                },
                include: { items: true },
            });

            await Promise.all(
                updatedOrder.items.flatMap((orderItem, index) => {
                    const removals = (customizationCreates[index]?.removals || []).map((removal) => tx.orderItemRemoval.create({
                        data: {
                            ...removal,
                            orderItemId: orderItem.id,
                        },
                    }));
                    const additions = (customizationCreates[index]?.additions || []).map((addition) => tx.orderItemAddition.create({
                        data: {
                            ...addition,
                            orderItemId: orderItem.id,
                        },
                    }));

                    return [...removals, ...additions];
                })
            );

            return tx.order.findUniqueOrThrow({
                where: { id },
                include: { table: true, user: { select: { name: true } }, items: { include: orderItemInclude } },
            });
        }, { timeout: 20000 });

        return NextResponse.json(updatedOrder);
    }

    try {
        const order = await prisma.$transaction(async (tx) => {
            const existingOrder = await tx.order.findUnique({
                where: { id },
                include: { items: { include: orderItemInternalInclude } },
            }) as any;

            if (!existingOrder) {
                throw new Error('ORDER_NOT_FOUND');
            }

            if (nextStatus === 'cancelled' && !canWaiterCancelOrder(existingOrder.status)) {
                throw new Error('ORDER_CANCEL_LOCKED');
            }

            if (data.action === 'confirm_manual_payment' || data.confirmManualPayment === true) {
                const shouldCompleteOrder = shouldCloseOrderService(existingOrder);
                const paidOrder = await tx.order.update({
                    where: { id },
                    data: {
                        paymentStatus: 'paid',
                        paymentMethod: data.paymentMethod || existingOrder.paymentMethod || 'cash',
                        ...(shouldCompleteOrder
                            ? {
                                status: 'completed',
                                serviceEndedAt: existingOrder.serviceEndedAt || new Date(),
                            }
                            : {}),
                    },
                    include: { table: true, user: { select: { name: true } }, items: { include: orderItemInclude } },
                });

                if (shouldCompleteOrder) {
                    await moveTableToCleaningIfNoActiveOrders(tx, paidOrder.tableId);
                    return paidOrder;
                }

                if (isOperationalOrderStatus(existingOrder.status)) {
                    return paidOrder;
                }

                return activateOrderForService(tx, id);
            }

            if (nextStatus === 'cancelled' && existingOrder.status !== 'cancelled' && isOperationalOrderStatus(existingOrder.status)) {
                await restoreInventoryForOrder(
                    tx,
                    existingOrder.items
                );
            }

            if (nextStatus && nextStatus !== 'cancelled' && existingOrder.status === 'cancelled') {
                await consumeInventoryForOrder(
                    tx,
                    existingOrder.items
                );
            }

            const serviceLifecyclePatch: Record<string, Date | null> = {};
            const shouldCompleteOnServed = nextStatus === 'served' && shouldAutoCompleteServedOrder(existingOrder);

            if (nextStatus && !existingOrder.serviceStartedAt && shouldStartOrderService(nextStatus)) {
                serviceLifecyclePatch.serviceStartedAt = new Date();
            }

            if (nextStatus && !existingOrder.kitchenStartedAt && shouldStartKitchenService(nextStatus)) {
                serviceLifecyclePatch.kitchenStartedAt = new Date();
            }

            if (
                (nextStatus && ['served', 'completed', 'cancelled'].includes(nextStatus))
                || shouldCompleteOnServed
            ) {
                if (
                    !existingOrder.serviceEndedAt
                    && (
                        shouldCompleteOnServed
                        || shouldCloseOrderService(existingOrder)
                        || (nextStatus ? shouldStartOrderService(nextStatus) : false)
                    )
                ) {
                    serviceLifecyclePatch.serviceEndedAt = new Date();
                }
            }

            const resolvedStatus = shouldCompleteOnServed
                ? 'completed'
                : nextStatus;

            const updatedOrder = await tx.order.update({
                where: { id },
                data: {
                    ...data,
                    ...(shouldCompleteOnServed ? { status: 'completed' } : {}),
                    ...serviceLifecyclePatch,
                },
                include: { table: true, user: { select: { name: true } }, items: { include: orderItemInclude } },
            });

            if (resolvedStatus && ['completed', 'cancelled'].includes(resolvedStatus) && updatedOrder.tableId && (isOperationalOrderStatus(existingOrder.status) || resolvedStatus === 'completed')) {
                await moveTableToCleaningIfNoActiveOrders(tx, updatedOrder.tableId);
            }

            return updatedOrder;
        }, { timeout: 20000 });

        if (order.status === 'ready' && order.userId) {
            fireAndForget((async () => {
                if (!(await isSettingEnabled('notifyNewOrders'))) return;
                const tableLabel = order.tableId && order.table?.number != null
                    ? `Table ${order.table.number}`
                    : (order.type === 'takeout' ? 'Takeaway' : 'Order');
                await sendToUser(order.userId, {
                    title: `Order #${order.orderNumber} is ready`,
                    body: `${tableLabel} • ready for pickup from the kitchen`,
                    url: `/tables`,
                    tag: `order-ready-${order.id}`,
                });
            })());
        }

        return NextResponse.json(order);
    } catch (error) {
        if (error instanceof Error && error.message === 'ORDER_NOT_FOUND') {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        if (error instanceof Error && error.message === 'ORDER_EDIT_LOCKED') {
            return NextResponse.json({ error: 'Orders already in kitchen prep cannot be edited' }, { status: 409 });
        }
        if (error instanceof Error && error.message === 'ORDER_CANCEL_LOCKED') {
            return NextResponse.json({ error: 'Orders already in kitchen prep cannot be cancelled' }, { status: 409 });
        }
        if (error instanceof Error && (
            error.message.startsWith('INVALID_REMOVAL:')
            || error.message.startsWith('INVALID_ADDITION:')
            || error.message.startsWith('DUPLICATE_REMOVALS:')
            || error.message.startsWith('DUPLICATE_ADDITIONS:')
        )) {
            return NextResponse.json({ error: 'Invalid item customization payload' }, { status: 400 });
        }
        throw error;
    }
}
