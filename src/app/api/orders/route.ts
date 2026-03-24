import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';
import { createOrderWithItems } from '@/lib/orders';
import { normalizeCustomizationInputs } from '@/lib/order-customization';

export async function GET(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const statusWhere = status ? (status.includes(',') ? { status: { in: status.split(',') } } : { status }) : {};
    const where = {
        ...statusWhere,
        ...(user.role === 'waiter' ? { userId: user.id } : {}),
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
    if (user.role !== 'waiter') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
