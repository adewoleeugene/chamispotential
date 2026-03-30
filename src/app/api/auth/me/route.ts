import { NextRequest, NextResponse } from 'next/server';
import { createToken, getRequestUser, shouldRefreshToken, verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user) return NextResponse.json({ user: null });

    const response = NextResponse.json({ user });

    // Sliding-window token refresh: reissue when past halfway through lifetime
    const token = req.cookies.get('rms-token')?.value;
    if (token) {
        const payload = verifyToken(token);
        if (payload && shouldRefreshToken(payload)) {
            const newToken = createToken({
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
                sessionVersion: user.sessionVersion,
            });
            response.cookies.set('rms-token', newToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 60 * 60 * 24 * 7,
                path: '/',
                sameSite: 'lax',
            });
        }
    }

    return response;
}
