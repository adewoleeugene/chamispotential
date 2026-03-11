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
    const { name, role, isActive, phone } = await req.json();
    const updated = await prisma.user.update({
        where: { id },
        data: { name, role, isActive, phone },
        select: { id: true, name: true, phone: true, email: true, role: true, isActive: true },
    });
    return NextResponse.json(updated);
}
