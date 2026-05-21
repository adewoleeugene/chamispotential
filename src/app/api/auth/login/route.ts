import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    calculateLockoutExpiry,
    createToken,
    getLockoutMessage,
    MAX_LOGIN_ATTEMPTS,
    verifyPassword,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const identifier = (body.username ?? body.email)?.toLowerCase().trim();
        const { password } = body;

        if (!identifier || !password) {
            return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { email: identifier } });

        if (!user || !user.isActive) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const now = new Date();
        if (user.lockedUntil && user.lockedUntil > now) {
            return NextResponse.json(
                { error: getLockoutMessage(user.lockedUntil, now) },
                { status: 429 },
            );
        }

        const previousAttempts = user.lockedUntil && user.lockedUntil <= now
            ? 0
            : user.failedLoginAttempts;

        const valid = await verifyPassword(password, user.password);
        if (!valid) {
            const nextFailedAttempts = previousAttempts + 1;
            const shouldLock = nextFailedAttempts >= MAX_LOGIN_ATTEMPTS;

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    failedLoginAttempts: nextFailedAttempts,
                    lastFailedLoginAt: now,
                    lockedUntil: shouldLock ? calculateLockoutExpiry(now) : null,
                },
            });

            return NextResponse.json(
                { error: shouldLock ? getLockoutMessage(calculateLockoutExpiry(now), now) : 'Invalid credentials' },
                { status: shouldLock ? 429 : 401 },
            );
        }

        if (previousAttempts || user.lastFailedLoginAt || user.lockedUntil) {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    failedLoginAttempts: 0,
                    lastFailedLoginAt: null,
                    lockedUntil: null,
                },
            });
        }

        const token = createToken({
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            sessionVersion: user.sessionVersion,
        });

        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                mustChangePassword: user.mustChangePassword,
            },
        });

        response.cookies.set('rms-token', token, {
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
