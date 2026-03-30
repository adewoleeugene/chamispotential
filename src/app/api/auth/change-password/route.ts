import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createToken, getRequestUser, hashPassword, validatePassword, verifyPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
    const sessionUser = await getRequestUser(req);
    if (!sessionUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { currentPassword, newPassword } = await req.json();
        const passwordError = validatePassword(newPassword);

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 });
        }

        if (passwordError) {
            return NextResponse.json({ error: passwordError }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
        if (!user || !user.isActive) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const valid = await verifyPassword(currentPassword, user.password);
        if (!valid) {
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
        }

        const nextPasswordMatchesCurrent = await verifyPassword(newPassword, user.password);
        if (nextPasswordMatchesCurrent) {
            return NextResponse.json({ error: 'Choose a new password different from the current one' }, { status: 400 });
        }

        const hashedPassword = await hashPassword(newPassword);
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                mustChangePassword: false,
                failedLoginAttempts: 0,
                lastFailedLoginAt: null,
                lockedUntil: null,
                sessionVersion: { increment: 1 },
            },
            select: { id: true, email: true, role: true, name: true, sessionVersion: true },
        });

        const response = NextResponse.json({ success: true });
        response.cookies.set('rms-token', createToken({
            id: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role,
            name: updatedUser.name,
            sessionVersion: updatedUser.sessionVersion,
        }), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
            sameSite: 'lax',
        });

        return response;
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
