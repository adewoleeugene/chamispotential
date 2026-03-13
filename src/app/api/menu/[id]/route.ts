import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';

function normalizeMenuItemPayload(input: Record<string, unknown>) {
    const costValue = input.cost;
    const parsedCost = costValue === '' || costValue == null ? null : Number(costValue);

    return {
        name: String(input.name ?? '').trim(),
        description: String(input.description ?? '').trim() || null,
        price: Number(input.price),
        cost: Number.isFinite(parsedCost as number) ? parsedCost : null,
        categoryId: String(input.categoryId ?? '').trim(),
    };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const data = normalizeMenuItemPayload(await req.json());
    if (!data.name || !data.categoryId || !Number.isFinite(data.price)) {
        return NextResponse.json({ error: 'Name, category, and a valid price are required' }, { status: 400 });
    }
    const item = await prisma.menuItem.update({ where: { id }, data, include: { category: true } });
    return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    await prisma.menuItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
