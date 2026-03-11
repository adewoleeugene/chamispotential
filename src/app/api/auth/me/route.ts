import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const token = req.cookies.get('rms-token')?.value;
    if (!token) return NextResponse.json({ user: null });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ user: null });

    const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, name: true, email: true, role: true, avatar: true, isActive: true },
    });

    if (!user || !user.isActive) return NextResponse.json({ user: null });
    return NextResponse.json({ user });
}
