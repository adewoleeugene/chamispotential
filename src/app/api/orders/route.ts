import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { createOrderWithItems } from '@/lib/orders';

function auth(req: NextRequest) {
    const token = req.cookies.get('rms-token')?.value;
    return token ? verifyToken(token) : null;
}

export async function GET(req: NextRequest) {
    if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const where = status ? (status.includes(',') ? { status: { in: status.split(',') } } : { status }) : {};
    const orders = await prisma.order.findMany({
        where,
        include: {
            table: true,
            user: { select: { name: true, id: true } },
            items: { include: { menuItem: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });
    return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
    const user = auth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tableId, items, type, notes, customerName, customerPhone, discount, paymentMethod, paymentStatus, status, deferActivation } = await req.json();

    if (!items || items.length === 0) {
        return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

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
            items,
        });
    });

    return NextResponse.json(order, { status: 201 });
}
