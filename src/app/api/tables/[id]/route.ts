import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    try {
        const { id } = await params;
        const data = await req.json();

        if (typeof data.layoutX === 'number' && !Number.isFinite(data.layoutX)) {
            return NextResponse.json({ error: 'Invalid horizontal table position' }, { status: 400 });
        }

        if (typeof data.layoutY === 'number' && !Number.isFinite(data.layoutY)) {
            return NextResponse.json({ error: 'Invalid vertical table position' }, { status: 400 });
        }

        const updateData = {
            ...(data.number !== undefined ? { number: data.number } : {}),
            ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
            ...(data.section !== undefined ? { section: data.section } : {}),
            ...(data.status !== undefined ? { status: data.status } : {}),
            ...(data.layoutX !== undefined ? { layoutX: data.layoutX } : {}),
            ...(data.layoutY !== undefined ? { layoutY: data.layoutY } : {}),
            ...(data.shape !== undefined ? { shape: data.shape } : {}),
            ...(data.mergeGroupId !== undefined ? { mergeGroupId: data.mergeGroupId } : {}),
            ...(data.qrCode !== undefined ? { qrCode: data.qrCode } : {}),
        };

        const table = await prisma.table.update({ where: { id }, data: updateData });
        return NextResponse.json(table);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unable to update table';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser(req);
    if (!user || user.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    await prisma.table.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
