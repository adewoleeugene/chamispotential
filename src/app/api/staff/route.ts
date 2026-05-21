import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser, hashPassword, validatePassword } from '@/lib/auth';

export async function GET(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const staff = await prisma.user.findMany({
        where: user.role === 'manager' ? { role: { in: ['waiter', 'kitchen', 'staff', 'cashier'] } } : undefined,
        select: { id: true, name: true, phone: true, email: true, role: true, isActive: true, createdAt: true },
        orderBy: { name: 'asc' },
    });
    return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user || user.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json();
    const { name, password, role, phone } = body;
    const identifier = (body.username ?? body.email)?.toLowerCase().trim();

    if (!identifier) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    if (!/^[a-z0-9._@-]+$/i.test(identifier)) {
        return NextResponse.json({ error: 'Username can only contain letters, numbers, dots, dashes, underscores, or @' }, { status: 400 });
    }

    const passwordError = validatePassword(password);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email: identifier } });
    if (existing) return NextResponse.json({ error: 'That username is already taken' }, { status: 400 });

    const hashed = await hashPassword(password);
    const newUser = await prisma.user.create({
        data: { name, email: identifier, phone, password: hashed, role, mustChangePassword: true },
        select: { id: true, name: true, phone: true, email: true, role: true, isActive: true, createdAt: true },
    });
    return NextResponse.json(newUser, { status: 201 });
}
