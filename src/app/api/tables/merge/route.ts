import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
    const token = req.cookies.get('rms-token')?.value;
    const user = token ? verifyToken(token) : null;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { primaryTableId, secondaryTableId } = await req.json();

    if (!primaryTableId || !secondaryTableId) {
        return NextResponse.json({ error: 'primaryTableId and secondaryTableId are required' }, { status: 400 });
    }
    if (primaryTableId === secondaryTableId) {
        return NextResponse.json({ error: 'Cannot merge a table with itself' }, { status: 400 });
    }

    const [primaryTable, secondaryTable] = await Promise.all([
        prisma.table.findUnique({ where: { id: primaryTableId } }),
        prisma.table.findUnique({ where: { id: secondaryTableId } }),
    ]);

    if (!primaryTable) return NextResponse.json({ error: 'Primary table not found' }, { status: 404 });
    if (!secondaryTable) return NextResponse.json({ error: 'Secondary table not found' }, { status: 404 });

    if (primaryTable.status !== 'available') {
        return NextResponse.json({ error: `${primaryTable.section} is not available (currently: ${primaryTable.status})` }, { status: 400 });
    }
    if (secondaryTable.status !== 'available') {
        return NextResponse.json({ error: `${secondaryTable.section} is not available (currently: ${secondaryTable.status})` }, { status: 400 });
    }

    // Generate a shared merge group ID to link both tables permanently
    const mergeGroupId = crypto.randomUUID();

    // Mark both tables as occupied, stamp with the shared group ID
    await Promise.all([
        prisma.table.update({ where: { id: primaryTableId }, data: { status: 'occupied', mergeGroupId } }),
        prisma.table.update({ where: { id: secondaryTableId }, data: { status: 'occupied', mergeGroupId } }),
    ]);

    // Return the primary table so the client can open the order modal immediately
    const updatedPrimary = await prisma.table.findUnique({
        where: { id: primaryTableId },
        include: {
            orders: {
                where: { status: { in: ['pending', 'preparing', 'ready'] } },
                include: { items: { include: { menuItem: true } }, user: true },
            },
        },
    });

    return NextResponse.json({
        success: true,
        message: `${primaryTable.section} + ${secondaryTable.section} merged — combined capacity: ${primaryTable.capacity + secondaryTable.capacity} seats`,
        combinedCapacity: primaryTable.capacity + secondaryTable.capacity,
        mergeGroupId,
        primaryTable: updatedPrimary,
    });
}
