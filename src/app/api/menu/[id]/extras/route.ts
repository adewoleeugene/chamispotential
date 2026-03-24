import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';

type ExtraInput = {
    inventoryId: string;
    label: string;
    quantityUsed: number;
};

function normalizeExtraInput(input: unknown): ExtraInput | null {
    if (!input || typeof input !== 'object') {
        return null;
    }

    const data = input as Record<string, unknown>;
    const inventoryId = String(data.inventoryId ?? '').trim();
    const label = String(data.label ?? '').trim();
    const quantityUsed = Number(data.quantityUsed);

    if (!inventoryId || !label || !Number.isFinite(quantityUsed) || quantityUsed <= 0) {
        return null;
    }

    return { inventoryId, label, quantityUsed };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!await getRequestUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const extras = await prisma.menuItemExtraOption.findMany({
        where: { menuItemId: id, isActive: true },
        include: { inventory: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json(extras);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json() as { extras?: unknown[] } | unknown;
    const incomingExtras: Array<ExtraInput | null> = Array.isArray((body as { extras?: unknown[] })?.extras)
        ? ((body as { extras: unknown[] }).extras).map(normalizeExtraInput)
        : [normalizeExtraInput(body)];
    const extras = incomingExtras.filter((extra): extra is ExtraInput => extra !== null);

    if (extras.length === 0) {
        return NextResponse.json({ error: 'At least one valid extra is required' }, { status: 400 });
    }

    const uniqueLabels = new Set(extras.map((extra) => extra.label.toLowerCase()));
    if (uniqueLabels.size !== extras.length) {
        return NextResponse.json({ error: 'Duplicate extra labels are not allowed in the same request' }, { status: 400 });
    }

    const existingCount = await prisma.menuItemExtraOption.count({
        where: { menuItemId: id },
    });

    const savedExtras = await prisma.$transaction(async (tx) => Promise.all(
        extras.map(async ({ inventoryId, label, quantityUsed }, index) => {
            const existing = await tx.menuItemExtraOption.findFirst({
                where: { menuItemId: id, label, isActive: true },
            });

            if (existing) {
                return tx.menuItemExtraOption.update({
                    where: { id: existing.id },
                    data: { inventoryId, quantityUsed, isActive: true },
                    include: { inventory: true },
                });
            }

            return tx.menuItemExtraOption.create({
                data: {
                    menuItemId: id,
                    inventoryId,
                    label,
                    quantityUsed,
                    sortOrder: existingCount + index,
                },
                include: { inventory: true },
            });
        })
    ));

    return NextResponse.json(savedExtras, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { extraOptionId } = await req.json();
    const deleted = await prisma.menuItemExtraOption.updateMany({
        where: {
            id: String(extraOptionId ?? ''),
            menuItemId: id,
            isActive: true,
        },
        data: { isActive: false },
    });

    if (deleted.count === 0) {
        return NextResponse.json({ error: 'Extra option not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
