import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const { name, role, isActive, phone } = await req.json();

    const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { role: true },
    });

    if (!existingUser) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (user.role === 'manager') {
        if (['admin', 'manager'].includes(existingUser.role)) {
            return NextResponse.json({ error: 'Managers can only edit staff below management' }, { status: 403 });
        }

        if (role && !['waiter', 'kitchen', 'staff', 'cashier'].includes(role)) {
            return NextResponse.json({ error: 'Managers can only assign staff roles below management' }, { status: 403 });
        }
    }

    const updated = await prisma.user.update({
        where: { id },
        data: {
            name,
            role,
            isActive,
            phone,
            ...(role !== undefined || isActive === false ? { sessionVersion: { increment: 1 } } : {}),
        },
        select: { id: true, name: true, phone: true, email: true, role: true, isActive: true },
    });
    return NextResponse.json(updated);
}
