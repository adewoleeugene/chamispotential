import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
    if (!await getRequestUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const extras = await prisma.extraCatalog.findMany({
        where: { isActive: true },
        include: { inventory: { select: { id: true, name: true, unit: true } } },
        orderBy: { name: 'asc' },
    });
    return NextResponse.json(extras);
}

export async function POST(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json().catch(() => null);
    const name = String(body?.name || '').trim();
    const inventoryId = String(body?.inventoryId || '').trim();
    const defaultQuantity = Number(body?.defaultQuantity);

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!inventoryId) return NextResponse.json({ error: 'Pick an inventory item' }, { status: 400 });
    if (!Number.isFinite(defaultQuantity) || defaultQuantity <= 0) {
        return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 });
    }

    const inventory = await prisma.inventory.findUnique({ where: { id: inventoryId } });
    if (!inventory) return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });

    const extra = await prisma.extraCatalog.create({
        data: { name, inventoryId, defaultQuantity },
        include: { inventory: { select: { id: true, name: true, unit: true } } },
    });
    return NextResponse.json(extra, { status: 201 });
}
