import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser, hashPassword, validatePassword } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser(req);
    if (!user || user.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { id } = await params;
        const { password } = await req.json();
        const passwordError = validatePassword(password);

        if (passwordError) {
            return NextResponse.json({ error: passwordError }, { status: 400 });
        }

        const hashedPassword = await hashPassword(password);
        await prisma.user.update({
            where: { id },
            data: {
                password: hashedPassword,
                mustChangePassword: true,
                failedLoginAttempts: 0,
                lastFailedLoginAt: null,
                lockedUntil: null,
                sessionVersion: { increment: 1 },
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
