import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

function auth(req: NextRequest) {
    const token = req.cookies.get('rms-token')?.value;
    return token ? verifyToken(token) : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = auth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const data = await req.json();
    const table = await prisma.table.update({ where: { id }, data });
    return NextResponse.json(table);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = auth(req);
    if (!user || user.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    await prisma.table.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
