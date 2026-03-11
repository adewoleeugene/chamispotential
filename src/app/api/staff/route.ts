import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';

function auth(req: NextRequest) {
    const token = req.cookies.get('rms-token')?.value;
    return token ? verifyToken(token) : null;
}

export async function GET(req: NextRequest) {
    const user = auth(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const staff = await prisma.user.findMany({
        select: { id: true, name: true, phone: true, email: true, role: true, isActive: true, createdAt: true },
        orderBy: { name: 'asc' },
    });
    return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
    const user = auth(req);
    if (!user || user.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { name, email, password, role, phone } = await req.json();
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 400 });

    const hashed = await hashPassword(password);
    const newUser = await prisma.user.create({
        data: { name, email: email.toLowerCase(), phone, password: hashed, role },
        select: { id: true, name: true, phone: true, email: true, role: true, isActive: true, createdAt: true },
    });
    return NextResponse.json(newUser, { status: 201 });
}
