import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

function auth(req: NextRequest) {
    const token = req.cookies.get('rms-token')?.value;
    return token ? verifyToken(token) : null;
}

export async function GET(req: NextRequest) {
    if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const reservations = await prisma.reservation.findMany({
        include: { table: true },
        orderBy: { date: 'asc' },
    });
    return NextResponse.json(reservations);
}

export async function POST(req: NextRequest) {
    if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const data = await req.json();
    const reservation = await prisma.reservation.create({
        data: { ...data, date: new Date(data.date) },
        include: { table: true },
    });
    return NextResponse.json(reservation, { status: 201 });
}
