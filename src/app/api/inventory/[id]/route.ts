import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';

function normalizeInventoryPayload(input: Record<string, unknown>) {
    const parseOptionalNumber = (value: unknown) => {
        if (value === '' || value == null) return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    };

    const parseRequiredNumber = (value: unknown) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const parseOptionalDate = (value: unknown) => {
        if (!value) return null;
        const parsed = new Date(String(value));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    return {
        name: String(input.name ?? '').trim(),
        category: String(input.category ?? '').trim(),
        unit: String(input.unit ?? '').trim(),
        currentStock: parseRequiredNumber(input.currentStock),
        minStock: parseRequiredNumber(input.minStock),
        maxStock: parseOptionalNumber(input.maxStock),
        cost: parseOptionalNumber(input.cost),
        supplier: String(input.supplier ?? '').trim() || null,
        location: String(input.location ?? '').trim() || null,
        lastRestocked: parseOptionalDate(input.lastRestocked),
        expiryDate: parseOptionalDate(input.expiryDate),
    };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const data = normalizeInventoryPayload(await req.json());
    const item = await prisma.inventory.update({ where: { id }, data });
    return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    await prisma.inventory.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
