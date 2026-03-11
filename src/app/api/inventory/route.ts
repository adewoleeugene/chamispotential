import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

function auth(req: NextRequest) {
    const token = req.cookies.get('rms-token')?.value;
    return token ? verifyToken(token) : null;
}

export async function GET(req: NextRequest) {
    if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const inventory = await prisma.inventory.findMany({ orderBy: { name: 'asc' } });
    return NextResponse.json(inventory);
}

export async function POST(req: NextRequest) {
    const user = auth(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const data = await req.json();
    if (data.lastRestocked) data.lastRestocked = new Date(data.lastRestocked);
    if (data.expiryDate) data.expiryDate = new Date(data.expiryDate);
    const item = await prisma.inventory.create({ data });
    return NextResponse.json(item, { status: 201 });
}
