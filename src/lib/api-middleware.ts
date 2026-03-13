import { NextRequest, NextResponse } from 'next/server';
import { AuthenticatedUser, getRequestUser } from './auth';

export function withAuth(
    handler: (req: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>
) {
    return async (req: NextRequest) => {
        const user = await getRequestUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return handler(req, user);
    };
}

export function withRole(roles: string[]) {
    return function (
        handler: (req: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>
    ) {
        return withAuth(async (req, user) => {
            if (!roles.includes(user.role)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            return handler(req, user);
        });
    };
}

export function successResponse(data: unknown, status = 200) {
    return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(message: string, status = 400) {
    return NextResponse.json({ success: false, error: message }, { status });
}
