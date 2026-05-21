import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    // Soft-delete (deactivate) so existing per-item extras don't lose context.
    const extra = await prisma.extraCatalog.update({
        where: { id },
        data: { isActive: false },
    }).catch(() => null);
    if (!extra) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
}
