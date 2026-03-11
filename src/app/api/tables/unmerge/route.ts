import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
    const token = req.cookies.get('rms-token')?.value;
    const user = token ? verifyToken(token) : null;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tableId } = await req.json();

    if (!tableId) {
        return NextResponse.json({ error: 'tableId is required' }, { status: 400 });
    }

    const table = await prisma.table.findUnique({
        where: { id: tableId },
    });

    if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 });

    if (!table.mergeGroupId) {
        return NextResponse.json({ error: 'Table is not merged' }, { status: 400 });
    }

    // Unmerge all tables in this group
    await prisma.table.updateMany({
        where: { mergeGroupId: table.mergeGroupId },
        data: {
            status: 'available',
            mergeGroupId: null
        },
    });

    // We should also probably handle active orders? 
    // Usually if a table is unmerged, they should be done or paid. But for the sake of simplicity,
    // if there are active orders, maybe we just unmerge the tables but don't touch the orders (orders are tied to the primary table).

    return NextResponse.json({
        success: true,
        message: 'Tables successfully unmerged',
    });
}
