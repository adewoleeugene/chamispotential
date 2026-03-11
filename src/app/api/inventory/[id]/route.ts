import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

function auth(req: NextRequest) {
    const token = req.cookies.get('rms-token')?.value;
    return token ? verifyToken(token) : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = auth(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const data = await req.json();
    if (data.lastRestocked) data.lastRestocked = new Date(data.lastRestocked);
    if (data.expiryDate) data.expiryDate = new Date(data.expiryDate);
    const item = await prisma.inventory.update({ where: { id }, data });
    return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = auth(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    await prisma.inventory.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
