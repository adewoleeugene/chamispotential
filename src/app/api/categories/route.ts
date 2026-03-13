import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
    if (!await getRequestUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
    return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const data = await req.json();
    const category = await prisma.category.create({ data });
    return NextResponse.json(category, { status: 201 });
}
