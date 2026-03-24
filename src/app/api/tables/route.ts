import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tables = await prisma.table.findMany({
        orderBy: { number: 'asc' },
        include: {
            orders: {
                where: { status: { in: ['draft', 'payment_pending_confirmation', 'pending', 'preparing', 'ready', 'served'] } },
                include: {
                    items: {
                        include: {
                            menuItem: true,
                            removals: true,
                            additions: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }
        }
    });
    return NextResponse.json(tables);
}

export async function POST(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user || user.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const data = await req.json();
    const table = await prisma.table.create({ data });
    return NextResponse.json(table, { status: 201 });
}
