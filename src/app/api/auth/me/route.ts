import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user) return NextResponse.json({ user: null });
    return NextResponse.json({ user });
}
